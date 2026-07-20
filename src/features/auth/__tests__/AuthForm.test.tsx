import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import type { PropsWithChildren } from "react";

import { resolveAppTheme, useAppTheme } from "../../../design-system/theme";
import { mobileApi } from "../../../services/supabase";
import {
  clearPendingOAuthAuthorizationId,
  getPendingOAuthAuthorizationId,
} from "../../oauth/pendingAuthorization";
import { AuthForm } from "../AuthForm";

const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
}));

jest.mock("../../../design-system/theme", () => {
  const actual = jest.requireActual("../../../design-system/theme");
  return { ...actual, useAppTheme: jest.fn() };
});

const mockedUseAppTheme = useAppTheme as jest.MockedFunction<
  typeof useAppTheme
>;

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      mutations: { gcTime: Infinity, retry: false },
      queries: { gcTime: Infinity, retry: false },
    },
  });
}

function wrapper(client: QueryClient) {
  return function QueryWrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

async function submitRegistration(
  result: { needsVerification: boolean },
  email = "new.user@example.com",
) {
  const client = createQueryClient();
  const register = jest
    .spyOn(mobileApi, "register")
    .mockResolvedValueOnce(result);
  const view = await render(<AuthForm mode="register" />, {
    wrapper: wrapper(client),
  });

  await fireEvent.changeText(view.getByLabelText("Email"), email);
  await fireEvent.changeText(
    view.getByLabelText("Password"),
    "strong-password",
  );
  await fireEvent.press(view.getByRole("button", { name: "Create account" }));

  return { client, email, register, view };
}

describe("AuthForm registration routing", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    clearPendingOAuthAuthorizationId();
    mockPush.mockClear();
    mockReplace.mockClear();
    mockedUseAppTheme.mockReturnValue({
      ...resolveAppTheme("light"),
      preference: "light",
      setPreference: jest.fn(),
      toggleDarkMode: jest.fn(),
    });
  });

  it("opens baseline setup immediately when registration creates a session", async () => {
    const { client, email, register, view } = await submitRegistration({
      needsVerification: false,
    });

    await waitFor(() =>
      expect(register).toHaveBeenCalledWith(email, "strong-password"),
    );
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith("/onboarding"),
    );
    expect(mockReplace).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(view.getByRole("button", { name: "Create account" })).toBeTruthy(),
    );

    await view.unmount();
    client.clear();
  });

  it("opens email verification with the submitted address when required", async () => {
    const { client, email, register, view } = await submitRegistration({
      needsVerification: true,
    });

    await waitFor(() =>
      expect(register).toHaveBeenCalledWith(email, "strong-password"),
    );
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith({
        pathname: "/verify-email",
        params: { email },
      }),
    );
    expect(mockReplace).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(view.getByRole("button", { name: "Create account" })).toBeTruthy(),
    );

    await view.unmount();
    client.clear();
  });

  it("preserves a validated OAuth request until login can return to consent", async () => {
    const authorizationId = "psjtkmmcim2qcyix6bmvk6jvzikhckbw";
    let resolveLogin!: () => void;
    const login = jest.spyOn(mobileApi, "login").mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveLogin = resolve;
      }),
    );
    const client = createQueryClient();
    const view = await render(
      <AuthForm mode="login" oauthAuthorizationId={authorizationId} />,
      { wrapper: wrapper(client) },
    );

    await fireEvent.changeText(
      view.getByLabelText("Email"),
      "returning.user@example.com",
    );
    await fireEvent.changeText(
      view.getByLabelText("Password"),
      "strong-password",
    );
    await fireEvent.press(view.getByRole("button", { name: "Sign in" }));

    await waitFor(() =>
      expect(login).toHaveBeenCalledWith(
        "returning.user@example.com",
        "strong-password",
      ),
    );
    expect(getPendingOAuthAuthorizationId()).toBe(authorizationId);

    resolveLogin();
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith({
        pathname: "/oauth/consent",
        params: { authorization_id: authorizationId },
      }),
    );
    expect(getPendingOAuthAuthorizationId()).toBeUndefined();

    await view.unmount();
    client.clear();
  });
});
