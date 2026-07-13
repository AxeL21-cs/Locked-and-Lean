import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getSupabasePublicConfiguration } from "../../config/environment";
import { authStorage } from "./authStorage";

let client: SupabaseClient | undefined;

export function getSupabaseClient(): SupabaseClient {
  if (client) return client;
  const config = getSupabasePublicConfiguration();
  client = createClient(config.url, config.publishableKey, {
    auth: {
      storage: authStorage,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      persistSession: true,
    },
  });
  return client;
}
