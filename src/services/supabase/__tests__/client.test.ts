import { authStorage } from "../authStorage";
import { getSupabaseClient } from "../client";

const mockClient = { auth: {} };
const mockCreateClient = jest.fn(
  (_url: unknown, _key: unknown, _options: unknown) => mockClient,
);
jest.mock("@supabase/supabase-js", () => ({
  createClient: (url: unknown, key: unknown, options: unknown) =>
    mockCreateClient(url, key, options),
}));
jest.mock("../../../config/environment", () => ({
  getSupabasePublicConfiguration: () => ({
    publishableKey: "sb_publishable_test",
    url: "https://project.supabase.co",
  }),
}));
jest.mock("../authStorage", () => ({
  authStorage: {
    getItem: jest.fn(),
    removeItem: jest.fn(),
    setItem: jest.fn(),
  },
}));

describe("Supabase mobile client", () => {
  it("persists auth with the platform storage adapter and a public key", () => {
    expect(getSupabaseClient()).toBe(mockClient);
    expect(mockCreateClient).toHaveBeenCalledWith(
      "https://project.supabase.co",
      "sb_publishable_test",
      {
        auth: {
          autoRefreshToken: true,
          detectSessionInUrl: false,
          persistSession: true,
          storage: authStorage,
        },
      },
    );
  });
});
