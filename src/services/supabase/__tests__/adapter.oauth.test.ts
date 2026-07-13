import { getOAuthConsentReadiness } from "../../../config/environment";
import type { OAuthConsentDetails } from "../types";
import { mobileApi } from "../adapter";

const mockGetUser = jest.fn();
const mockGetAuthorizationDetails = jest.fn();
const mockApproveAuthorization = jest.fn();
const mockDenyAuthorization = jest.fn();

jest.mock("../../../config/environment", () => ({
  publicEnvironment: {
    oauthConsentMode: "hosted",
    productName: "Locked and Lean",
    supabasePublishableKey: "public-test-key",
    supabaseUrl: "https://locked-and-lean.supabase.co",
  },
  getOAuthConsentReadiness: jest.fn(() => ({ enabled: true })),
}));

jest.mock("../client", () => ({
  getSupabaseClient: () => ({
    auth: {
      getUser: mockGetUser,
      oauth: {
        getAuthorizationDetails: mockGetAuthorizationDetails,
        approveAuthorization: mockApproveAuthorization,
        denyAuthorization: mockDenyAuthorization,
      },
    },
  }),
}));

const authorizationId = "8b3f66de-1968-4b38-80df-ccf1d524e7bb";
const user = { id: "user-1", email: "lance@example.com" };
const consentDetails = {
  authorization_id: authorizationId,
  redirect_uri: "https://chat.example.com/oauth/callback",
  client: {
    id: "client-1",
    name: "Example Chat Client",
    uri: "https://chat.example.com",
    logo_uri: "https://chat.example.com/logo.png",
  },
  user,
  scope: "openid email profile",
};

function mappedDetails(
  overrides: Partial<OAuthConsentDetails> = {},
): OAuthConsentDetails {
  return {
    kind: "consent",
    authorizationId,
    redirectUri: consentDetails.redirect_uri,
    client: {
      id: consentDetails.client.id,
      name: consentDetails.client.name,
      uri: consentDetails.client.uri,
      logoUri: consentDetails.client.logo_uri,
    },
    userId: user.id,
    userEmail: user.email,
    requestedScope: consentDetails.scope,
    supportedScopes: ["openid", "email", "profile"],
    unsupportedScopes: [],
    approvalBlockedReasons: [],
    ...overrides,
  };
}

describe("mobile OAuth consent adapter", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getOAuthConsentReadiness).mockReturnValue({ enabled: true });
    mockGetUser.mockResolvedValue({ data: { user }, error: null });
    mockGetAuthorizationDetails.mockResolvedValue({
      data: consentDetails,
      error: null,
    });
  });

  it("fetches a fresh user before mapping server-owned consent details", async () => {
    const result = await mobileApi.getOAuthConsentDetails(authorizationId);

    expect(mockGetUser).toHaveBeenCalledTimes(1);
    expect(mockGetUser.mock.invocationCallOrder[0]!).toBeLessThan(
      mockGetAuthorizationDetails.mock.invocationCallOrder[0]!,
    );
    expect(mockGetAuthorizationDetails).toHaveBeenCalledWith(authorizationId);
    expect(result).toEqual(mappedDetails());
  });

  it("blocks unsupported custom scopes before calling approval", async () => {
    mockGetAuthorizationDetails.mockResolvedValue({
      data: { ...consentDetails, scope: "openid food:write weight:read" },
      error: null,
    });
    const result = await mobileApi.getOAuthConsentDetails(authorizationId);
    expect(result).toEqual(
      expect.objectContaining({
        supportedScopes: ["openid"],
        unsupportedScopes: ["food:write", "weight:read"],
        approvalBlockedReasons: [
          "Unsupported OAuth scopes requested: food:write, weight:read.",
        ],
      }),
    );

    await expect(
      mobileApi.approveOAuthAuthorization(result as OAuthConsentDetails),
    ).rejects.toThrow("cannot be approved safely");
    expect(mockApproveAuthorization).not.toHaveBeenCalled();
  });

  it("requires the freshly authenticated user for every decision", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "different-user", email: "other@example.com" } },
      error: null,
    });

    await expect(
      mobileApi.approveOAuthAuthorization(mappedDetails()),
    ).rejects.toThrow("different authenticated user");
    await expect(
      mobileApi.denyOAuthAuthorization(mappedDetails()),
    ).rejects.toThrow("different authenticated user");
    expect(mockApproveAuthorization).not.toHaveBeenCalled();
    expect(mockDenyAuthorization).not.toHaveBeenCalled();
  });

  it("approves and denies without browser auto-redirect, then validates the returned destination", async () => {
    const approved =
      "https://chat.example.com/oauth/callback?code=opaque-code&state=opaque-state";
    const denied =
      "https://chat.example.com/oauth/callback?error=access_denied&state=opaque-state";
    mockApproveAuthorization.mockResolvedValue({
      data: { redirect_url: approved },
      error: null,
    });
    mockDenyAuthorization.mockResolvedValue({
      data: { redirect_url: denied },
      error: null,
    });

    await expect(
      mobileApi.approveOAuthAuthorization(mappedDetails()),
    ).resolves.toBe(approved);
    await expect(
      mobileApi.denyOAuthAuthorization(mappedDetails()),
    ).resolves.toBe(denied);
    expect(mockGetUser).toHaveBeenCalledTimes(2);
    expect(mockApproveAuthorization).toHaveBeenCalledWith(authorizationId, {
      skipBrowserRedirect: true,
    });
    expect(mockDenyAuthorization).toHaveBeenCalledWith(authorizationId, {
      skipBrowserRedirect: true,
    });
  });

  it("rejects an open redirect returned after approval", async () => {
    mockApproveAuthorization.mockResolvedValue({
      data: {
        redirect_url:
          "https://attacker.example/oauth/callback?code=opaque-code",
      },
      error: null,
    });

    await expect(
      mobileApi.approveOAuthAuthorization(mappedDetails()),
    ).rejects.toThrow("unsafe approval redirect");
  });

  it("fails closed when hosted OAuth consent is not explicitly ready", async () => {
    jest.mocked(getOAuthConsentReadiness).mockReturnValue({
      enabled: false,
      reason: "OAuth consent is disabled in this build.",
    });

    await expect(
      mobileApi.getOAuthConsentDetails(authorizationId),
    ).rejects.toThrow("disabled in this build");
    expect(mockGetUser).not.toHaveBeenCalled();
    expect(mockGetAuthorizationDetails).not.toHaveBeenCalled();
  });
});
