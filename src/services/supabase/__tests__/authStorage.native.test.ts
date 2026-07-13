import { createNativeAuthStorage } from "../authStorage.native";

function backend() {
  const values = new Map<string, string>();
  return {
    values,
    api: {
      deleteItemAsync: jest.fn(async (key: string) => {
        values.delete(key);
      }),
      getItemAsync: jest.fn(async (key: string) => values.get(key) ?? null),
      setItemAsync: jest.fn(async (key: string, value: string) => {
        values.set(key, value);
      }),
    },
  };
}

describe("native Supabase auth storage", () => {
  it("round-trips a large Unicode session through small SecureStore chunks", async () => {
    const secureStore = backend();
    const storage = createNativeAuthStorage(secureStore.api);
    const session = JSON.stringify({
      access_token: "token".repeat(900),
      display_name: "Lakas 💪".repeat(100),
      refresh_token: "refresh".repeat(500),
    });

    await storage.setItem("sb-project-auth-token", session);

    expect(await storage.getItem("sb-project-auth-token")).toBe(session);
    expect(secureStore.values.size).toBeGreaterThan(2);
    expect(secureStore.values.get("sb-project-auth-token")).not.toContain(
      "access_token",
    );
    expect(
      [...secureStore.values.values()].every(
        (value) => new TextEncoder().encode(value).length <= 1_600,
      ),
    ).toBe(true);
  });

  it("removes the manifest and every encrypted-store chunk on logout", async () => {
    const secureStore = backend();
    const storage = createNativeAuthStorage(secureStore.api);
    await storage.setItem("sb-project-auth-token", "session".repeat(500));

    await storage.removeItem("sb-project-auth-token");

    expect(await storage.getItem("sb-project-auth-token")).toBeNull();
    expect(secureStore.values.size).toBe(0);
  });

  it("cleans superseded chunks after a refreshed session is stored", async () => {
    const secureStore = backend();
    const storage = createNativeAuthStorage(secureStore.api);
    await storage.setItem("sb-project-auth-token", "old".repeat(700));
    const oldKeys = new Set(secureStore.values.keys());

    await storage.setItem("sb-project-auth-token", "new-session");

    expect(await storage.getItem("sb-project-auth-token")).toBe("new-session");
    for (const oldKey of oldKeys) {
      if (oldKey !== "sb-project-auth-token") {
        expect(secureStore.values.has(oldKey)).toBe(false);
      }
    }
  });
});
