import type {
  OAuthConsentDetails,
  OAuthConsentLookup,
} from "../../services/supabase";

export type OAuthConsentGateway = {
  getDetails(authorizationId: string): Promise<OAuthConsentLookup>;
  approve(details: OAuthConsentDetails): Promise<string>;
  deny(details: OAuthConsentDetails): Promise<string>;
};
