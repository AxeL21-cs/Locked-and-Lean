# ChatGPT app setup status

The Phase 6 MCP package is deployed for restricted, allowlisted testing. It is
not a general-production ChatGPT app while the remaining gates below are open.

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
3. Graduate the reviewed restricted preview/revision backend contract from one
   allowlisted client to general access only after ADR-0001's authorization
   exit criteria pass.
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

## Avoiding repeated reconnects

Use one stable connector registration. The preferred controlled setup is a
predefined OAuth client whose exact ID is approved in the MCP environment and
database policy before the user links it. If DCR is used instead, capture and
approve the client ID created for that connector instance, then keep that
instance rather than deleting and recreating it.

After linking, verify a protected read immediately, wait past one access-token
lifetime, and verify it again. The second call must succeed through refresh and
must produce an access token with the same `client_id` and canonical MCP `aud`.
A `401` should trigger refresh/re-authentication; a policy `403` should not ask
the user to reconnect. Never place either token in screenshots, logs, docs, or
test fixtures.

The server exposes two focused read-only tools for the initial safe stage:
`get_today_calories` and `get_weekly_protein_average`. The latter returns no
numeric average when any of the seven Manila days has incomplete macro data.
For one reviewed client, food logging is limited to a complete temporary
preview, complete-snapshot revisions, and a separate exact confirmation. The
preview functions cannot write permanent history; final confirmation remains
transactional and idempotent. Real ChatGPT post-expiry refresh/revocation and
end-to-end confirmation evidence are still required.

Reference: [Build an MCP server](https://developers.openai.com/apps-sdk/build/mcp-server).
