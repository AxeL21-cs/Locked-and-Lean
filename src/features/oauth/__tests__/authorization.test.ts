import {
  isSafeServerRedirect,
  normalizeAuthorizationId,
  oauthConsentRoute,
  oauthLoginRoute,
  redirectDisplayLabel,
  splitRequestedScopes,
} from "../authorization";

describe("OAuth authorization parameter safety", () => {
  const id = "psjtkmmcim2qcyix6bmvk6jvzikhckbw";

  it("accepts one URL-safe opaque authorization_id without rewriting it", () => {
    expect(normalizeAuthorizationId(id.toUpperCase())).toBe(id.toUpperCase());
    expect(normalizeAuthorizationId([id])).toBe(id);
    expect(normalizeAuthorizationId([id, id])).toBeUndefined();
    expect(
      normalizeAuthorizationId("https://evil.example/return"),
    ).toBeUndefined();
    expect(
      normalizeAuthorizationId(`${id}?return=https://evil.example`),
    ).toBeUndefined();
    expect(normalizeAuthorizationId(` ${id}`)).toBeUndefined();
    expect(normalizeAuthorizationId("short-id")).toBeUndefined();
  });

  it("builds only fixed login and consent routes from a validated ID", () => {
    expect(oauthConsentRoute(id)).toEqual({
      pathname: "/oauth/consent",
      params: { authorization_id: id },
    });
    expect(oauthLoginRoute(id)).toEqual({
      pathname: "/(auth)",
      params: { oauth_authorization_id: id },
    });
    expect(
      oauthConsentRoute(`${id}?return=https://evil.example/callback`),
    ).toBeUndefined();
    expect(oauthLoginRoute("https://evil.example/callback")).toBeUndefined();
  });

  it("separates supported identity scopes from unsupported custom claims", () => {
    expect(
      splitRequestedScopes("openid email email profile food:write weight:read"),
    ).toEqual({
      supported: ["openid", "email", "profile"],
      unsupported: ["food:write", "weight:read"],
    });
  });

  it("accepts only HTTPS server returns matching the registered base redirect", () => {
    const expected = "https://chat.example.com/oauth/callback";
    expect(
      isSafeServerRedirect(
        `${expected}?code=server-code&state=opaque-state`,
        expected,
      ),
    ).toBe(true);
    expect(
      isSafeServerRedirect(
        "https://evil.example/oauth/callback?code=stolen",
        expected,
      ),
    ).toBe(false);
    expect(isSafeServerRedirect("javascript:alert(1)", expected)).toBe(false);
    expect(
      isSafeServerRedirect(
        `${expected}?code=server-code#unexpected-fragment`,
        expected,
      ),
    ).toBe(false);
    expect(redirectDisplayLabel(`${expected}?code=secret`)).toBe(
      "chat.example.com/oauth/callback",
    );
  });
});
