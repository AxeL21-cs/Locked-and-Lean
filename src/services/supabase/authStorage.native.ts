import * as SecureStore from "expo-secure-store";

import type { AuthStorage } from "./authStorage";

type SecureStoreBackend = Pick<
  typeof SecureStore,
  "deleteItemAsync" | "getItemAsync" | "setItemAsync"
>;
type Manifest = { chunks: number; generation: string; version: 1 };

// 400 Unicode code points stay below 1,600 UTF-8 bytes in the worst case.
const CHUNK_CODE_POINTS = 400;
const MAX_CHUNKS = 128;
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

function parseManifest(value: string | null): Manifest | undefined {
  if (!value) return undefined;
  try {
    const candidate = JSON.parse(value) as Partial<Manifest>;
    if (
      candidate.version === 1 &&
      Number.isInteger(candidate.chunks) &&
      Number(candidate.chunks) > 0 &&
      Number(candidate.chunks) <= MAX_CHUNKS &&
      typeof candidate.generation === "string" &&
      /^[A-Za-z0-9_-]+$/.test(candidate.generation)
    ) {
      return candidate as Manifest;
    }
  } catch {
    // A non-manifest value may be a legacy single-key session.
  }
  return undefined;
}

function chunkKey(key: string, manifest: Manifest, index: number) {
  return `${key}.v${manifest.version}.${manifest.generation}.${index}`;
}

function splitIntoChunks(value: string): string[] {
  const points = Array.from(value);
  const chunks: string[] = [];
  for (let index = 0; index < points.length; index += CHUNK_CODE_POINTS) {
    chunks.push(points.slice(index, index + CHUNK_CODE_POINTS).join(""));
  }
  return chunks.length ? chunks : [""];
}

function generation() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

async function deleteChunks(
  backend: SecureStoreBackend,
  key: string,
  manifest: Manifest | undefined,
) {
  if (!manifest) return;
  await Promise.all(
    Array.from({ length: manifest.chunks }, (_, index) =>
      backend.deleteItemAsync(chunkKey(key, manifest, index), OPTIONS),
    ),
  );
}

export function createNativeAuthStorage(
  backend: SecureStoreBackend = SecureStore,
): AuthStorage {
  return {
    async getItem(key) {
      const stored = await backend.getItemAsync(key, OPTIONS);
      const manifest = parseManifest(stored);
      if (!manifest) return stored;

      const chunks = await Promise.all(
        Array.from({ length: manifest.chunks }, (_, index) =>
          backend.getItemAsync(chunkKey(key, manifest, index), OPTIONS),
        ),
      );
      if (chunks.some((chunk) => chunk == null)) {
        await backend.deleteItemAsync(key, OPTIONS);
        await deleteChunks(backend, key, manifest);
        return null;
      }
      return chunks.join("");
    },
    async setItem(key, value) {
      const previous = parseManifest(await backend.getItemAsync(key, OPTIONS));
      const chunks = splitIntoChunks(value);
      if (chunks.length > MAX_CHUNKS) {
        throw new Error(
          "The authentication session is too large to store safely.",
        );
      }
      const next: Manifest = {
        chunks: chunks.length,
        generation: generation(),
        version: 1,
      };

      try {
        await Promise.all(
          chunks.map((chunk, index) =>
            backend.setItemAsync(chunkKey(key, next, index), chunk, OPTIONS),
          ),
        );
        await backend.setItemAsync(key, JSON.stringify(next), OPTIONS);
      } catch (error) {
        await deleteChunks(backend, key, next);
        throw error;
      }
      await deleteChunks(backend, key, previous);
    },
    async removeItem(key) {
      const manifest = parseManifest(await backend.getItemAsync(key, OPTIONS));
      await backend.deleteItemAsync(key, OPTIONS);
      await deleteChunks(backend, key, manifest);
    },
  };
}

export const authStorage = createNativeAuthStorage();
