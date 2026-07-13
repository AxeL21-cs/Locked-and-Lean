export type AuthStorage = {
  getItem(key: string): Promise<string | null>;
  removeItem(key: string): Promise<void>;
  setItem(key: string, value: string): Promise<void>;
};

type WebStorage = Pick<Storage, "getItem" | "removeItem" | "setItem">;

function availableWebStorage(): WebStorage | undefined {
  try {
    return typeof globalThis.localStorage === "undefined"
      ? undefined
      : globalThis.localStorage;
  } catch {
    return undefined;
  }
}

export function createWebAuthStorage(
  storage = availableWebStorage(),
): AuthStorage {
  const memory = new Map<string, string>();

  return {
    async getItem(key) {
      try {
        return storage?.getItem(key) ?? memory.get(key) ?? null;
      } catch {
        return memory.get(key) ?? null;
      }
    },
    async setItem(key, value) {
      memory.set(key, value);
      try {
        storage?.setItem(key, value);
      } catch {
        // Memory keeps the current tab functional when browser storage is denied.
      }
    },
    async removeItem(key) {
      memory.delete(key);
      try {
        storage?.removeItem(key);
      } catch {
        // The in-memory copy is still cleared.
      }
    },
  };
}

// Metro resolves authStorage.native.ts on native platforms. This fallback is
// deliberately browser-only and is also safe during static rendering.
export const authStorage = createWebAuthStorage();
