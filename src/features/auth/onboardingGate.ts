export type OnboardingGateState = "loading" | "required" | "ready";

type OnboardingGateInput = {
  sessionLoading: boolean;
  hasSession: boolean;
  hasConfirmedTarget?: boolean;
  cachedHasConfirmedTarget?: boolean;
  goalSetupFailed: boolean;
};

export function resolveOnboardingGateState({
  sessionLoading,
  hasSession,
  hasConfirmedTarget,
  cachedHasConfirmedTarget,
  goalSetupFailed,
}: OnboardingGateInput): OnboardingGateState {
  if (sessionLoading) return "loading";
  if (!hasSession) return "ready";
  if (hasConfirmedTarget === false) return "required";
  if (hasConfirmedTarget === true) return "ready";
  if (cachedHasConfirmedTarget === true) return "ready";
  if (cachedHasConfirmedTarget === false || goalSetupFailed) return "required";
  return "loading";
}
