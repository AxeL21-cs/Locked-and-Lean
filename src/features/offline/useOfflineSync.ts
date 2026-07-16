import * as Haptics from "expo-haptics";
import * as Network from "expo-network";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";

import { mobileApi } from "../../services/supabase";
import {
  listQueuedConfirmations,
  listQueuedManualConfirmations,
  markQueuedConfirmationError,
  removeQueuedConfirmation,
  removeQueuedManualConfirmation,
  rememberFoodContext,
  serverPreviewMatchesLocal,
  subscribeQueue,
  type QueuedConfirmation,
  type QueuedManualConfirmation,
  updateQueuedManualConfirmation,
} from "./offlineStore";

export function useOfflineSync(ownerId?: string) {
  const client = useQueryClient();
  const [queue, setQueue] = useState<
    (QueuedConfirmation | QueuedManualConfirmation)[]
  >([]);
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(async () => {
    if (ownerId) {
      const [server, manual] = await Promise.all([
        listQueuedConfirmations(ownerId),
        listQueuedManualConfirmations(ownerId),
      ]);
      setQueue(
        [...server, ...manual].sort((a, b) =>
          a.createdAt.localeCompare(b.createdAt),
        ),
      );
    } else setQueue([]);
  }, [ownerId]);

  const flush = useCallback(async () => {
    if (!ownerId || syncing) return;
    const state = await Network.getNetworkStateAsync();
    const reachable =
      state.isConnected !== false && state.isInternetReachable !== false;
    setOnline(reachable);
    if (!reachable) return;
    setSyncing(true);
    let synced = 0;
    const pending = await listQueuedConfirmations(ownerId);
    for (const item of pending) {
      try {
        await mobileApi.confirmFoodPreview(
          item.preview.id,
          item.preview.revision,
          item.idempotencyKey,
        );
        await removeQueuedConfirmation(item.idempotencyKey);
        synced += 1;
      } catch (error) {
        await markQueuedConfirmationError(
          item.idempotencyKey,
          error instanceof Error
            ? error.message
            : "Sync failed. Retry when connected.",
        );
      }
    }
    const manual = await listQueuedManualConfirmations(ownerId);
    for (const item of manual.filter(
      (candidate) => candidate.status !== "needs_review",
    )) {
      try {
        const serverPreview = await mobileApi.createManualFoodPreview(
          item.input,
        );
        if (!serverPreviewMatchesLocal(item.localPreview, serverPreview)) {
          await updateQueuedManualConfirmation(
            item.idempotencyKey,
            "needs_review",
            "The server preview differs from the offline snapshot. Review it before logging.",
            serverPreview,
          );
          continue;
        }
        await mobileApi.confirmFoodPreview(
          serverPreview.id,
          serverPreview.revision,
          item.idempotencyKey,
        );
        if (item.input.saveForReuse)
          await mobileApi.saveFoodForReuse(item.input);
        await rememberFoodContext(ownerId, item.input);
        await removeQueuedManualConfirmation(item.idempotencyKey);
        synced += 1;
      } catch (error) {
        await updateQueuedManualConfirmation(
          item.idempotencyKey,
          "error",
          error instanceof Error
            ? error.message
            : "Sync failed. Retry when connected.",
        );
      }
    }
    await refresh();
    if (pending.length || manual.length) {
      await client.invalidateQueries({ queryKey: ["today"] });
    }
    if (synced > 0) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setSyncing(false);
  }, [client, ownerId, refresh, syncing]);

  useEffect(() => {
    const timeout = setTimeout(() => void refresh(), 0);
    const unsubscribe = subscribeQueue(() => void refresh());
    return () => {
      clearTimeout(timeout);
      unsubscribe();
    };
  }, [refresh]);

  useEffect(() => {
    const subscription = Network.addNetworkStateListener((state) => {
      const reachable =
        state.isConnected !== false && state.isInternetReachable !== false;
      setOnline(reachable);
      if (reachable) void flush();
    });
    const timeout = setTimeout(() => void flush(), 0);
    return () => {
      clearTimeout(timeout);
      subscription.remove();
    };
  }, [flush]);

  return { queue, online, syncing, retry: flush };
}
