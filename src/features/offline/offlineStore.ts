import * as SQLite from "expo-sqlite";

import type {
  FoodPreview,
  ManualFoodInput,
  MealType,
} from "../../services/supabase";

let database: ReturnType<typeof SQLite.openDatabaseAsync> | undefined;

async function db() {
  database ??= SQLite.openDatabaseAsync("locked-and-lean.db");
  const value = await database;
  await value.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS local_cache (
      owner_id TEXT NOT NULL,
      cache_key TEXT NOT NULL,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (owner_id, cache_key)
    );
    CREATE TABLE IF NOT EXISTS confirmation_queue (
      idempotency_key TEXT PRIMARY KEY NOT NULL,
      owner_id TEXT NOT NULL,
      preview_id TEXT NOT NULL,
      preview_revision INTEGER NOT NULL,
      preview_payload TEXT NOT NULL,
      status TEXT NOT NULL,
      last_error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS food_context (
      owner_id TEXT NOT NULL,
      normalized_name TEXT NOT NULL,
      input_payload TEXT NOT NULL,
      use_count INTEGER NOT NULL DEFAULT 1,
      last_used_at TEXT NOT NULL,
      PRIMARY KEY (owner_id, normalized_name)
    );
    CREATE TABLE IF NOT EXISTS favorite_foods (
      owner_id TEXT NOT NULL,
      food_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (owner_id, food_id)
    );
    CREATE TABLE IF NOT EXISTS manual_confirmation_queue (
      idempotency_key TEXT PRIMARY KEY NOT NULL,
      owner_id TEXT NOT NULL,
      input_payload TEXT NOT NULL,
      local_preview_payload TEXT NOT NULL,
      server_preview_payload TEXT,
      status TEXT NOT NULL,
      last_error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  return value;
}

export type CachedValue<T> = { value: T; updatedAt: string };

export async function putCache<T>(ownerId: string, key: string, value: T) {
  const updatedAt = new Date().toISOString();
  await (
    await db()
  ).runAsync(
    `INSERT INTO local_cache(owner_id, cache_key, payload, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(owner_id, cache_key) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`,
    ownerId,
    key,
    JSON.stringify(value),
    updatedAt,
  );
}

export async function getCache<T>(
  ownerId: string,
  key: string,
): Promise<CachedValue<T> | null> {
  const row = await (
    await db()
  ).getFirstAsync<{ payload: string; updated_at: string }>(
    "SELECT payload, updated_at FROM local_cache WHERE owner_id = ? AND cache_key = ?",
    ownerId,
    key,
  );
  return row
    ? { value: JSON.parse(row.payload) as T, updatedAt: row.updated_at }
    : null;
}

export type QueuedConfirmation = {
  kind: "server-preview";
  ownerId: string;
  preview: FoodPreview;
  idempotencyKey: string;
  status: "waiting" | "error";
  lastError: string | null;
  createdAt: string;
};

export async function enqueueConfirmation(
  input: Omit<
    QueuedConfirmation,
    "kind" | "status" | "lastError" | "createdAt"
  >,
) {
  const now = new Date().toISOString();
  await (
    await db()
  ).runAsync(
    `INSERT INTO confirmation_queue(idempotency_key, owner_id, preview_id, preview_revision, preview_payload, status, last_error, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'waiting', NULL, ?, ?)
     ON CONFLICT(idempotency_key) DO NOTHING`,
    input.idempotencyKey,
    input.ownerId,
    input.preview.id,
    input.preview.revision,
    JSON.stringify(input.preview),
    now,
    now,
  );
  emitQueueChange();
}

export async function listQueuedConfirmations(
  ownerId: string,
): Promise<QueuedConfirmation[]> {
  const rows = await (
    await db()
  ).getAllAsync<{
    owner_id: string;
    preview_payload: string;
    idempotency_key: string;
    status: "waiting" | "error";
    last_error: string | null;
    created_at: string;
  }>(
    "SELECT owner_id, preview_payload, idempotency_key, status, last_error, created_at FROM confirmation_queue WHERE owner_id = ? ORDER BY created_at",
    ownerId,
  );
  return rows.map((row) => ({
    kind: "server-preview",
    ownerId: row.owner_id,
    preview: JSON.parse(row.preview_payload) as FoodPreview,
    idempotencyKey: row.idempotency_key,
    status: row.status,
    lastError: row.last_error,
    createdAt: row.created_at,
  }));
}

export type QueuedManualConfirmation = {
  kind: "manual-input";
  ownerId: string;
  input: ManualFoodInput;
  localPreview: FoodPreview;
  serverPreview: FoodPreview | null;
  idempotencyKey: string;
  status: "waiting" | "error" | "needs_review";
  lastError: string | null;
  createdAt: string;
};

export async function enqueueManualConfirmation(
  input: Omit<
    QueuedManualConfirmation,
    "kind" | "status" | "lastError" | "createdAt" | "serverPreview"
  >,
) {
  const now = new Date().toISOString();
  await (
    await db()
  ).runAsync(
    `INSERT INTO manual_confirmation_queue(idempotency_key, owner_id, input_payload, local_preview_payload, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'waiting', ?, ?) ON CONFLICT(idempotency_key) DO NOTHING`,
    input.idempotencyKey,
    input.ownerId,
    JSON.stringify(input.input),
    JSON.stringify(input.localPreview),
    now,
    now,
  );
  emitQueueChange();
}

export async function listQueuedManualConfirmations(
  ownerId: string,
): Promise<QueuedManualConfirmation[]> {
  const rows = await (
    await db()
  ).getAllAsync<{
    owner_id: string;
    input_payload: string;
    local_preview_payload: string;
    server_preview_payload: string | null;
    idempotency_key: string;
    status: "waiting" | "error" | "needs_review";
    last_error: string | null;
    created_at: string;
  }>(
    "SELECT * FROM manual_confirmation_queue WHERE owner_id = ? ORDER BY created_at",
    ownerId,
  );
  return rows.map((row) => ({
    kind: "manual-input",
    ownerId: row.owner_id,
    input: JSON.parse(row.input_payload) as ManualFoodInput,
    localPreview: JSON.parse(row.local_preview_payload) as FoodPreview,
    serverPreview: row.server_preview_payload
      ? (JSON.parse(row.server_preview_payload) as FoodPreview)
      : null,
    idempotencyKey: row.idempotency_key,
    status: row.status,
    lastError: row.last_error,
    createdAt: row.created_at,
  }));
}

export async function removeQueuedManualConfirmation(key: string) {
  await (
    await db()
  ).runAsync(
    "DELETE FROM manual_confirmation_queue WHERE idempotency_key = ?",
    key,
  );
  emitQueueChange();
}

export async function updateQueuedManualConfirmation(
  key: string,
  status: QueuedManualConfirmation["status"],
  error: string | null,
  serverPreview?: FoodPreview,
) {
  await (
    await db()
  ).runAsync(
    "UPDATE manual_confirmation_queue SET status = ?, last_error = ?, server_preview_payload = COALESCE(?, server_preview_payload), updated_at = ? WHERE idempotency_key = ?",
    status,
    error,
    serverPreview ? JSON.stringify(serverPreview) : null,
    new Date().toISOString(),
    key,
  );
  emitQueueChange();
}

export function buildLocalManualPreview(
  input: ManualFoodInput,
  key: string,
): FoodPreview {
  const consumedAt = `${input.consumedDate}T${input.consumedTime}:00+08:00`;
  return {
    id: `local-${key}`,
    revision: 0,
    mealType: input.mealType,
    consumedAt,
    expiresAt: "",
    items: [
      {
        id: `local-item-${key}`,
        foodName: input.foodName,
        brand: input.brand,
        servingDescription: `${input.quantity} ${input.servingUnit}`,
        calories: input.calories,
        proteinG: input.proteinG ?? null,
        carbohydratesG: input.carbohydratesG ?? null,
        fatG: input.fatG ?? null,
        estimated: false,
        confidence: null,
        source: "On-device user input · not server-verified",
        uncertainty: [
          "The server preview has not been created yet. Reconnection may require another review.",
        ],
      },
    ],
    totalCalories: input.calories,
    totalProteinG: input.proteinG ?? null,
    totalCarbohydratesG: input.carbohydratesG ?? null,
    totalFatG: input.fatG ?? null,
  };
}

const sameNumber = (a: number | null, b: number | null) => a === b;
const sameInstant = (a: string, b: string) => {
  const left = Date.parse(a);
  const right = Date.parse(b);
  return Number.isFinite(left) && Number.isFinite(right) && left === right;
};
export function serverPreviewMatchesLocal(
  local: FoodPreview,
  server: FoodPreview,
) {
  if (
    local.mealType !== server.mealType ||
    !sameInstant(local.consumedAt, server.consumedAt) ||
    local.items.length !== server.items.length
  )
    return false;
  if (
    local.totalCalories !== server.totalCalories ||
    !sameNumber(local.totalProteinG, server.totalProteinG) ||
    !sameNumber(local.totalCarbohydratesG, server.totalCarbohydratesG) ||
    !sameNumber(local.totalFatG, server.totalFatG)
  )
    return false;
  return local.items.every((item, index) => {
    const other = server.items[index];
    if (!other) return false;
    return (
      item.foodName.trim().toLocaleLowerCase() ===
        other.foodName.trim().toLocaleLowerCase() &&
      (item.brand ?? "").trim().toLocaleLowerCase() ===
        (other.brand ?? "").trim().toLocaleLowerCase() &&
      item.servingDescription.trim().toLocaleLowerCase() ===
        other.servingDescription.trim().toLocaleLowerCase() &&
      item.calories === other.calories &&
      item.estimated === other.estimated &&
      sameNumber(item.confidence, other.confidence) &&
      sameNumber(item.proteinG, other.proteinG) &&
      sameNumber(item.carbohydratesG, other.carbohydratesG) &&
      sameNumber(item.fatG, other.fatG)
    );
  });
}

export async function removeQueuedConfirmation(key: string) {
  await (
    await db()
  ).runAsync("DELETE FROM confirmation_queue WHERE idempotency_key = ?", key);
  emitQueueChange();
}

export async function markQueuedConfirmationError(
  key: string,
  message: string,
) {
  await (
    await db()
  ).runAsync(
    "UPDATE confirmation_queue SET status = 'error', last_error = ?, updated_at = ? WHERE idempotency_key = ?",
    message,
    new Date().toISOString(),
    key,
  );
  emitQueueChange();
}

export type FoodContextSuggestion = ManualFoodInput & {
  useCount: number;
  lastUsedAt: string;
  historicalLabel: string;
};

const normalize = (name: string) => name.trim().toLocaleLowerCase();

export async function rememberFoodContext(
  ownerId: string,
  input: ManualFoodInput,
) {
  const normalizedName = normalize(input.foodName);
  const now = new Date().toISOString();
  await (
    await db()
  ).runAsync(
    `INSERT INTO food_context(owner_id, normalized_name, input_payload, use_count, last_used_at)
     VALUES (?, ?, ?, 1, ?)
     ON CONFLICT(owner_id, normalized_name) DO UPDATE SET
       input_payload = excluded.input_payload,
       use_count = food_context.use_count + 1,
       last_used_at = excluded.last_used_at`,
    ownerId,
    normalizedName,
    JSON.stringify(input),
    now,
  );
}

export async function listFoodContext(
  ownerId: string,
  limit = 8,
): Promise<FoodContextSuggestion[]> {
  const rows = await (
    await db()
  ).getAllAsync<{
    input_payload: string;
    use_count: number;
    last_used_at: string;
  }>(
    "SELECT input_payload, use_count, last_used_at FROM food_context WHERE owner_id = ? ORDER BY use_count DESC, last_used_at DESC LIMIT ?",
    ownerId,
    limit,
  );
  return rows.map((row) => {
    const input = JSON.parse(row.input_payload) as ManualFoodInput;
    return {
      ...input,
      useCount: row.use_count,
      lastUsedAt: row.last_used_at,
      historicalLabel: `${input.quantity} ${input.servingUnit} · last confirmed ${new Date(row.last_used_at).toLocaleDateString()}`,
    };
  });
}

export async function setFavorite(
  ownerId: string,
  foodId: string,
  favorite: boolean,
) {
  if (favorite) {
    await (
      await db()
    ).runAsync(
      "INSERT OR IGNORE INTO favorite_foods(owner_id, food_id, created_at) VALUES (?, ?, ?)",
      ownerId,
      foodId,
      new Date().toISOString(),
    );
  } else {
    await (
      await db()
    ).runAsync(
      "DELETE FROM favorite_foods WHERE owner_id = ? AND food_id = ?",
      ownerId,
      foodId,
    );
  }
}

export async function listFavoriteIds(ownerId: string) {
  const rows = await (
    await db()
  ).getAllAsync<{ food_id: string }>(
    "SELECT food_id FROM favorite_foods WHERE owner_id = ?",
    ownerId,
  );
  return new Set(rows.map((row) => row.food_id));
}

const listeners = new Set<() => void>();
function emitQueueChange() {
  listeners.forEach((listener) => listener());
}
export function subscribeQueue(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const cacheKeys = {
  today: "today",
  savedFoods: "saved-foods",
  calendar: (start: string, end: string) => `calendar:${start}:${end}`,
  day: (localDate: string) => `day:${localDate}`,
};

export function isConnectivityError(error: unknown) {
  return (
    error instanceof Error &&
    /network|offline|fetch|connection|internet/i.test(error.message)
  );
}

export function inputParams(input: ManualFoodInput): Record<string, string> {
  return {
    name: input.foodName,
    brand: input.brand ?? "",
    barcode: input.barcode ?? "",
    calories: String(input.calories),
    proteinG: input.proteinG == null ? "" : String(input.proteinG),
    carbohydratesG:
      input.carbohydratesG == null ? "" : String(input.carbohydratesG),
    fatG: input.fatG == null ? "" : String(input.fatG),
    quantity: String(input.quantity),
    unit: input.servingUnit,
    meal: input.mealType satisfies MealType,
    context: "historical",
  };
}
