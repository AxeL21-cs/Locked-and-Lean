import {
  Redirect,
  type Href,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import * as Linking from "expo-linking";

import { getOAuthConsentReadiness } from "../../src/config/environment";
import { useSession } from "../../src/features/auth/SessionProvider";
import {
  InvalidOAuthRequest,
  OAuthConsentBlocked,
  OAuthConsentFlow,
} from "../../src/features/oauth/OAuthConsentFlow";
import {
  isSafeServerRedirect,
  normalizeAuthorizationId,
  oauthLoginRoute,
} from "../../src/features/oauth/authorization";
import type { OAuthConsentGateway } from "../../src/features/oauth/types";
import { mobileApi } from "../../src/services/supabase";

const gateway: OAuthConsentGateway = {
  getDetails: (authorizationId) =>
    mobileApi.getOAuthConsentDetails(authorizationId),
  approve: (details) => mobileApi.approveOAuthAuthorization(details),
  deny: (details) => mobileApi.denyOAuthAuthorization(details),
};

export default function OAuthConsentScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    authorization_id?: string | string[];
  }>();
  const authorizationId = normalizeAuthorizationId(params.authorization_id);
  const readiness = getOAuthConsentReadiness();
  const { session } = useSession();

  if (!authorizationId) return <InvalidOAuthRequest />;
  if (!readiness.enabled)
    return <OAuthConsentBlocked reason={readiness.reason} />;
  const loginRoute = oauthLoginRoute(authorizationId);
  if (!loginRoute) return <InvalidOAuthRequest />;
  if (!session && loginRoute) return <Redirect href={loginRoute as Href} />;

  const signInAgain = () => {
    void mobileApi.logout().finally(() => router.replace(loginRoute as Href));
  };

  return (
    <OAuthConsentFlow
      authorizationId={authorizationId}
      gateway={gateway}
      onReauthenticate={signInAgain}
      onReturn={async (redirectUrl) => {
        if (!isSafeServerRedirect(redirectUrl))
          throw new Error("Blocked an unsafe OAuth return destination.");
        await Linking.openURL(redirectUrl);
      }}
    />
  );
}
