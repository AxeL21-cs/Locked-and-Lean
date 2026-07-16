# OAuth consent shell

This feature is a fail-closed consent UI for a hosted Supabase OAuth 2.1 Server. It does not turn the mobile app or backend into an OpenAI client, and it does not grant food, calorie, macro, or weight permissions.

## Enablement

Consent is disabled unless the public Expo build sets `EXPO_PUBLIC_OAUTH_CONSENT_MODE=hosted` and supplies an HTTPS, non-local Supabase project URL plus its public publishable key. The flag must only be enabled after the hosted project has:

- OAuth Server enabled with `/oauth/consent` as its authorization path.
- An HTTPS Site URL and registered OAuth clients/redirect URIs.
- Asymmetric JWT signing configured.
- RLS plus separate server-side client/action policy that defaults tool access to denied.

No secret or service-role key belongs in Expo public configuration.

## Flow and boundaries

- Only one bounded, URL-safe opaque `authorization_id` is accepted and it is preserved exactly. Supabase Auth resolves the handle before any consent is shown; arbitrary return URLs and registration detours are not accepted.
- The adapter calls `auth.getUser()` before reading consent details and again before approve/deny, then verifies that the server request belongs to that user.
- Client identity, email, requested scopes, and registered redirect destination come from `getAuthorizationDetails`.
- Only Supabase's current standard identity scopes (`openid`, `email`, `profile`, `phone`) are displayed as supported. Any custom scope blocks approval.
- Approve/deny use `skipBrowserRedirect: true`. The returned HTTPS URL must match the registered redirect origin and path before the app opens it.
- Authorization codes are neither parsed nor stored by this feature.

OAuth access tokens are still user JWTs. Identity consent is not granular authorization for application tools; RLS and a separate default-deny server policy remain mandatory.

Current implementation references:

- [Supabase OAuth 2.1 flows](https://supabase.com/docs/guides/auth/oauth-server/oauth-flows)
- [Configure an OAuth consent screen](https://supabase.com/docs/guides/auth/oauth-server/getting-started)
- [Supabase OAuth Server](https://supabase.com/docs/guides/auth/oauth-server)
