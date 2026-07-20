import { resolveOnboardingGateState } from "../onboardingGate";

const authenticated = {
  hasSession: true,
  sessionLoading: false,
};

describe("resolveOnboardingGateState", () => {
  it("requires baseline setup for an authenticated account without a confirmed target", () => {
    expect(
      resolveOnboardingGateState({
        ...authenticated,
        goalSetupFailed: false,
        hasConfirmedTarget: false,
      }),
    ).toBe("required");
  });

  it("allows an authenticated account with a confirmed target into the app", () => {
    expect(
      resolveOnboardingGateState({
        ...authenticated,
        goalSetupFailed: false,
        hasConfirmedTarget: true,
      }),
    ).toBe("ready");
  });

  it("keeps the launch state while the authenticated goal setup is pending", () => {
    expect(
      resolveOnboardingGateState({
        ...authenticated,
        goalSetupFailed: false,
        hasConfirmedTarget: undefined,
      }),
    ).toBe("loading");
  });

  it("requires baseline setup when goal setup fails without cached completion", () => {
    expect(
      resolveOnboardingGateState({
        ...authenticated,
        goalSetupFailed: true,
        hasConfirmedTarget: undefined,
      }),
    ).toBe("required");
  });

  it("allows offline app access only with cached confirmed completion", () => {
    expect(
      resolveOnboardingGateState({
        ...authenticated,
        cachedHasConfirmedTarget: true,
        goalSetupFailed: true,
        hasConfirmedTarget: undefined,
      }),
    ).toBe("ready");
  });

  it("lets a current server result override a stale completion cache", () => {
    expect(
      resolveOnboardingGateState({
        ...authenticated,
        cachedHasConfirmedTarget: true,
        goalSetupFailed: false,
        hasConfirmedTarget: false,
      }),
    ).toBe("required");
  });

  it("uses fresh server confirmation when the offline completion hint is still stale", () => {
    expect(
      resolveOnboardingGateState({
        ...authenticated,
        cachedHasConfirmedTarget: false,
        goalSetupFailed: false,
        hasConfirmedTarget: true,
      }),
    ).toBe("ready");
  });
});
