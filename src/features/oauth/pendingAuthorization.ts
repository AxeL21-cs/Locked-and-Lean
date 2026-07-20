import { useSyncExternalStore } from "react";

import { normalizeAuthorizationId } from "./authorization";

let pendingAuthorizationId: string | undefined;
const listeners = new Set<() => void>();

function emitChange() {
  listeners.forEach((listener) => listener());
}

export function setPendingOAuthAuthorizationId(value: unknown) {
  const nextValue = normalizeAuthorizationId(value);
  if (pendingAuthorizationId === nextValue) return;
  pendingAuthorizationId = nextValue;
  emitChange();
}

export function clearPendingOAuthAuthorizationId() {
  setPendingOAuthAuthorizationId(undefined);
}

export function getPendingOAuthAuthorizationId() {
  return pendingAuthorizationId;
}

export function usePendingOAuthAuthorizationId() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getPendingOAuthAuthorizationId,
    getPendingOAuthAuthorizationId,
  );
}
