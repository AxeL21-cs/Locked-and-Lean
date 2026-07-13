# ChatGPT app setup status

The Phase 6 MCP package is suitable for local contract and transport testing.
It must not yet be registered or described as a production-ready ChatGPT app.

## Local verification

From `mcp-server/`:

```powershell
npm ci
npm run check
```

Set the variables documented in `docs/OAUTH.md` only with test issuer/project
values, then run:

```powershell
npm start
```

The process binds to `127.0.0.1` and exposes:

- `POST /mcp` for stateless Streamable HTTP;
- `GET /.well-known/oauth-protected-resource` for discovery; and
- `GET /healthz` for secret-free configuration status.

An unauthenticated client may initialize, list tools, and call `health`.
Protected calls must receive a valid user bearer token or return the OAuth
challenge. Do not place credentials in source control, logs, query strings, or
tool output.

## Production gates

Before adding a remote connector in ChatGPT developer mode, all of these must
be completed and recorded:

1. Deploy the MCP endpoint on its final HTTPS origin and keep its canonical
   resource URL stable.
2. Configure an authorization server that issues the exact resource audience,
   `client_id`, user identity/role, standard scopes, and verifiable asymmetric
   JWTs expected by the server.
3. Add a reviewed general preview/revision backend contract that accepts the
   authorized OAuth application without weakening RLS, exact-revision checks,
   transactional confirmation, or idempotency.
4. Verify discovery, authorization, token refresh/revocation behavior, every
   tool descriptor, and every challenge with MCP Inspector and ChatGPT
   developer mode.
5. Add a real body-size/rate-limit boundary in front of Streamable HTTP. The
   local server rejects oversized declared `Content-Length`, but that alone
   does not bound chunked request bodies.
6. Complete the repository's remaining security, privacy, observability,
   deployment, and release gates.

Until then, the mandatory health blockers
`supabase_custom_application_scopes_unavailable` and
`hosted_oauth_and_mcp_inspector_unverified` are truthful and intentional.

Reference: [Build an MCP server](https://developers.openai.com/apps-sdk/build/mcp-server).
