import * as Haptics from "expo-haptics";
import type { Href } from "expo-router";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";

import { AsyncStatePanel } from "../../components/AsyncStatePanel";
import { Screen } from "../../components/Screen";
import { localDateInManila } from "../../domain/history";
import {
  mobileApi,
  type FoodPreview,
  type MealType,
} from "../../services/supabase";
import { useSession } from "../auth/SessionProvider";
import {
  enqueueConfirmation,
  isConnectivityError,
} from "../offline/offlineStore";
import { ManualPreviewCard } from "./ManualPreviewCard";

const key = () =>
  globalThis.crypto?.randomUUID?.() ??
  `repeat-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const time = () =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Manila",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());

export function RepeatEntryFlow() {
  const router = useRouter();
  const { session } = useSession();
  const params = useLocalSearchParams<{
    entryId: string;
    meal?: MealType;
    label?: string;
  }>();
  const [preview, setPreview] = useState<FoodPreview>();
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string>();
  const [confirmationKey] = useState(key);

  const create = async () => {
    setLoading(true);
    setError(undefined);
    try {
      setPreview(
        await mobileApi.copyFoodEntryToPreview(
          params.entryId,
          params.meal ?? "snack",
          `${localDateInManila(new Date())}T${time()}:00+08:00`,
        ),
      );
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : "Could not create the copied preview.",
      );
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };
  const confirm = async () => {
    if (!preview) return;
    setConfirming(true);
    setError(undefined);
    try {
      await mobileApi.confirmFoodPreview(
        preview.id,
        preview.revision,
        confirmationKey,
      );
    } catch (value) {
      if (!session?.user.id || !isConnectivityError(value)) {
        setError(
          value instanceof Error ? value.message : "Confirmation failed.",
        );
        setConfirming(false);
        return;
      }
      await enqueueConfirmation({
        ownerId: session.user.id,
        preview,
        idempotencyKey: confirmationKey,
      });
    }
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace({
      pathname: "/",
      params: { sync: "check" },
    } as unknown as Href);
  };

  if (preview)
    return (
      <Screen>
        <ManualPreviewCard
          preview={preview}
          confirming={confirming}
          error={error}
          onConfirm={() => void confirm()}
          onEdit={() => setPreview(undefined)}
        />
      </Screen>
    );
  return (
    <Screen>
      <AsyncStatePanel
        actionLabel={loading ? undefined : "Create exact preview"}
        kind={
          error
            ? isConnectivityError(new Error(error))
              ? "offline"
              : "error"
            : "empty"
        }
        title={params.label ?? "Repeat confirmed food"}
        message={
          error ??
          "The server will copy the confirmed nutrition snapshot into a new current preview. You must review and confirm that exact revision."
        }
        onAction={loading ? undefined : () => void create()}
      />
    </Screen>
  );
}
