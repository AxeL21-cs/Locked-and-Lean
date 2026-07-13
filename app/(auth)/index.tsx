import { useLocalSearchParams } from "expo-router";

import { AuthForm } from "../../src/features/auth/AuthForm";
import { normalizeAuthorizationId } from "../../src/features/oauth/authorization";

export default function LoginScreen() {
  const params = useLocalSearchParams<{
    oauth_authorization_id?: string | string[];
  }>();
  return (
    <AuthForm
      mode="login"
      oauthAuthorizationId={normalizeAuthorizationId(
        params.oauth_authorization_id,
      )}
    />
  );
}
