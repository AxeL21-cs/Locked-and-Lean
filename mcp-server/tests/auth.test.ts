import assert from "node:assert/strict";
import test from "node:test";

import { generateKeyPair, SignJWT } from "jose";

import { JwtAccessTokenVerifier } from "../src/auth/tokenVerifier.js";
import { TokenVerificationError } from "../src/auth/types.js";

const issuer = "https://auth.example.test";
const audience = "https://mcp.example.test";
const subject = "0f8fad5b-d9cb-469f-a165-70867728950e";

async function setup() {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const verifier = new JwtAccessTokenVerifier(
    {
      issuer,
      audience,
      jwksUri: `${issuer}/jwks.json`,
      algorithms: ["RS256"],
      allowedClientActions: { chatgpt: ["get_day_history"] },
      expectedRole: "authenticated",
      clockToleranceSeconds: 0,
    },
    publicKey,
  );
  const sign = async (overrides: Record<string, unknown> = {}) => {
    const now = Math.floor(Date.now() / 1000);
    return new SignJWT({
      role: "authenticated",
      client_id: "chatgpt",
      scope: "openid",
      resource: audience,
      exp: now + 300,
      ...overrides,
    })
      .setProtectedHeader({ alg: "RS256" })
      .setIssuer(issuer)
      .setAudience(audience)
      .setSubject(subject)
      .setIssuedAt(now)
      .sign(privateKey);
  };
  return { verifier, sign };
}

test("verifies signature, identity, standard scope, and client/action policy", async () => {
  const { verifier, sign } = await setup();
  const token = await sign();
  const principal = await verifier.verify({
    accessToken: token,
    action: "get_day_history",
    requiredScopes: ["openid"],
  });
  assert.equal(principal.subject, subject);
  assert.equal(principal.clientId, "chatgpt");
  assert.deepEqual(principal.audience, [audience]);
});

test("rejects array audiences even when one value matches", async () => {
  const { verifier } = await setup();
  const { privateKey } = await generateKeyPair("RS256");
  const now = Math.floor(Date.now() / 1000);
  const token = await new SignJWT({
    role: "authenticated",
    client_id: "chatgpt",
    scope: "openid",
  })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(issuer)
    .setAudience([audience, "https://other.example.test"])
    .setSubject(subject)
    .setIssuedAt(now)
    .setExpirationTime(now + 300)
    .sign(privateKey);
  await assert.rejects(
    verifier.verify({
      accessToken: token,
      action: "get_day_history",
      requiredScopes: ["openid"],
    }),
    TokenVerificationError,
  );
});

test("rejects invalid role, missing scope, and denied action", async () => {
  const { verifier, sign } = await setup();
  for (const [token, action] of [
    [await sign({ role: "service_role" }), "get_day_history"],
    [await sign({ scope: "profile" }), "get_day_history"],
    [await sign(), "record_weight"],
  ] as const) {
    await assert.rejects(
      verifier.verify({
        accessToken: token,
        action,
        requiredScopes: ["openid"],
      }),
      TokenVerificationError,
    );
  }
});

test("rejects an expired token", async () => {
  const { verifier, sign } = await setup();
  const token = await sign({ exp: Math.floor(Date.now() / 1000) - 10 });
  await assert.rejects(
    verifier.verify({
      accessToken: token,
      action: "get_day_history",
      requiredScopes: ["openid"],
    }),
    TokenVerificationError,
  );
});
