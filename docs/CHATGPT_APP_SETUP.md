# ChatGPT app setup

The hosted MCP package is live at
`https://locked-and-lean-mcp.vercel.app/mcp` for restricted, allowlisted
testing. One existing ChatGPT OAuth client is approved for calendar insights
plus preview, revision, and exact food confirmation. Locked and Lean is not yet
published in the public ChatGPT plugin catalog.

## Connect the hosted developer preview

If Locked and Lean is already connected to the testing account, preserve that
app instance. Deleting and recreating it generates a new OAuth client
registration that must be approved again.

For a new administrator-assisted test:

1. In ChatGPT web, open **Settings → Security and login** and enable
   **Developer mode**.
2. Open **Settings → Plugins** or
   [chatgpt.com/plugins](https://chatgpt.com/plugins).
3. Create a developer-mode app named `Locked and Lean`.
4. Use `https://locked-and-lean-mcp.vercel.app/mcp` as the MCP server URL.
5. Preserve the created app instance and approve its exact OAuth `client_id`
   and intended actions in both the hosted MCP policy and
   `private.oauth_client_action_policies`.
6. Refresh the app metadata, open a new conversation, and select
   **+ → More → Locked and Lean**.
7. Invoke a protected read, complete the Locked and Lean OAuth sign-in, and
   verify the owner-scoped result.

A connection may discover tools before its OAuth client is approved. A policy
`403` needs administrator action; reconnecting does not grant permission. See
OpenAI's current
[Connect from ChatGPT](https://developers.openai.com/apps-sdk/deploy/connect-chatgpt)
instructions for the developer-mode interface.

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

## Public release gates

Before submitting Locked and Lean for general distribution through the public
plugin review flow, all of these must be completed and recorded:

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
