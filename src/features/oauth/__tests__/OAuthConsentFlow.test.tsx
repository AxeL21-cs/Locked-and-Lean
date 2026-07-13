import { fireEvent, render, waitFor } from "@testing-library/react-native";

import type { OAuthConsentDetails } from "../../../services/supabase";
import { OAuthConsentFlow } from "../OAuthConsentFlow";
import type { OAuthConsentGateway } from "../types";

const authorizationId = "8b3f66de-1968-4b38-80df-ccf1d524e7bb";
const details: OAuthConsentDetails = {
  kind: "consent",
  authorizationId,
  redirectUri: "https://chat.example.com/oauth/callback",
  client: {
    id: "client-1",
    name: "Example Chat Client",
    uri: "https://chat.example.com",
    logoUri: "https://chat.example.com/logo.png",
  },
  userId: "user-1",
  userEmail: "lance@example.com",
  requestedScope: "openid email profile",
  supportedScopes: ["openid", "email", "profile"],
  unsupportedScopes: [],
  approvalBlockedReasons: [],
};
const approvedRedirect =
  "https://chat.example.com/oauth/callback?code=server-code&state=opaque";

function gateway(
  overrides: Partial<OAuthConsentGateway> = {},
): OAuthConsentGateway {
  return {
    getDetails: jest.fn().mockResolvedValue(details),
    approve: jest.fn().mockResolvedValue(approvedRedirect),
    deny: jest
      .fn()
      .mockResolvedValue(
        "https://chat.example.com/oauth/callback?error=access_denied&state=opaque",
      ),
    ...overrides,
  };
}

async function renderFlow(
  api: OAuthConsentGateway,
  onReturn: (url: string) => Promise<void> = jest
    .fn()
    .mockResolvedValue(undefined),
) {
  const view = await render(
    <OAuthConsentFlow
      authorizationId={authorizationId}
      gateway={api}
      onReauthenticate={jest.fn()}
      onReturn={onReturn}
    />,
  );
  return view;
}

async function press(element: Parameters<typeof fireEvent.press>[0]) {
  fireEvent.press(element);
  await Promise.resolve();
}

describe("OAuthConsentFlow", () => {
  it("shows server client identity, standard scopes, and the honest permission boundary", async () => {
    const api = gateway();
    const onReturn = jest.fn().mockResolvedValue(undefined);
    const view = await renderFlow(api, onReturn);

    expect(
      await view.findByText("Example Chat Client wants to connect"),
    ).toBeTruthy();
    expect(view.getByText("lance@example.com")).toBeTruthy();
    expect(view.getByText("chat.example.com/oauth/callback")).toBeTruthy();
    expect(view.getByText("Sign-in identity")).toBeTruthy();
    expect(view.getByText("Email identity")).toBeTruthy();
    expect(view.getByText("Basic profile")).toBeTruthy();
    expect(view.getByText("These are identity scopes only")).toBeTruthy();
    expect(
      view.getByText(/does not currently issue custom calorie/i),
    ).toBeTruthy();

    await press(
      view.getByRole("button", { name: "Approve identity connection" }),
    );
    await waitFor(() => expect(api.approve).toHaveBeenCalledWith(details));
    expect(onReturn).toHaveBeenCalledWith(approvedRedirect);
  });

  it("blocks approval for unsupported scopes but still permits denial", async () => {
    const blocked: OAuthConsentDetails = {
      ...details,
      requestedScope: "openid email food:write",
      supportedScopes: ["openid", "email"],
      unsupportedScopes: ["food:write"],
      approvalBlockedReasons: [
        "Unsupported OAuth scopes requested: food:write.",
      ],
    };
    const api = gateway({ getDetails: jest.fn().mockResolvedValue(blocked) });
    const view = await renderFlow(api);
    expect(await view.findByText("Approval blocked")).toBeTruthy();
    expect(
      view.getByText("! Unsupported OAuth scopes requested: food:write."),
    ).toBeTruthy();
    expect(
      view.getByRole("button", { name: "Approve identity connection" }).props
        .accessibilityState.disabled,
    ).toBe(true);
    await press(view.getByRole("button", { name: "Deny and return" }));
    await waitFor(() => expect(api.deny).toHaveBeenCalledWith(blocked));
    expect(api.approve).not.toHaveBeenCalled();
  });

  it("names an expired request and offers a safe retry", async () => {
    const api = gateway({
      getDetails: jest
        .fn()
        .mockRejectedValue(
          new Error("Authorization request expired or unavailable."),
        ),
    });
    const view = await renderFlow(api);
    expect(
      await view.findByText("Request expired or unavailable"),
    ).toBeTruthy();
    expect(view.getByRole("button", { name: /Retry request/ })).toBeTruthy();
  });

  it("returns immediately when the server reports prior consent", async () => {
    const api = gateway({
      getDetails: jest.fn().mockResolvedValue({
        kind: "redirect",
        redirectUrl: approvedRedirect,
      }),
    });
    const onReturn = jest.fn().mockResolvedValue(undefined);
    const view = await renderFlow(api, onReturn);
    expect(await view.findByText("Returning to client")).toBeTruthy();
    await waitFor(() =>
      expect(onReturn).toHaveBeenCalledWith(approvedRedirect),
    );
  });

  it("keeps a return URL server-owned and offers retry if opening it fails", async () => {
    const api = gateway();
    const onReturn = jest
      .fn()
      .mockRejectedValueOnce(new Error("Could not open the registered client."))
      .mockResolvedValueOnce(undefined);
    const view = await renderFlow(api, onReturn);
    await view.findByText("Example Chat Client wants to connect");
    await press(
      view.getByRole("button", { name: "Approve identity connection" }),
    );
    expect(await view.findByText("Return was interrupted")).toBeTruthy();
    await press(view.getByRole("button", { name: /Retry secure return/ }));
    await waitFor(() => expect(onReturn).toHaveBeenCalledTimes(2));
    expect(onReturn).toHaveBeenLastCalledWith(approvedRedirect);
  });
});
