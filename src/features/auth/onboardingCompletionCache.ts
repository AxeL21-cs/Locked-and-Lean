import { getCache, putCache } from "../offline/offlineStore";

const ONBOARDING_COMPLETION_KEY = "onboarding-completion";

export async function readCachedOnboardingCompletion(ownerId: string) {
  const cached = await getCache<boolean>(ownerId, ONBOARDING_COMPLETION_KEY);
  return cached?.value;
}

export async function writeCachedOnboardingCompletion(
  ownerId: string,
  hasConfirmedTarget: boolean,
) {
  await putCache(ownerId, ONBOARDING_COMPLETION_KEY, hasConfirmedTarget);
}
