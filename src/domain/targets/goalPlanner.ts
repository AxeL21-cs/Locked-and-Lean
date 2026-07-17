import type { Goal } from "../../services/supabase/types";

const GOAL_TOLERANCE_KG = 0.05;

export function calculateBmi(
  heightCm: number,
  weightKg: number,
): number | null {
  if (
    !Number.isFinite(heightCm) ||
    !Number.isFinite(weightKg) ||
    heightCm <= 0 ||
    weightKg <= 0
  ) {
    return null;
  }

  const heightMeters = heightCm / 100;
  return Math.round((weightKg / heightMeters ** 2) * 10) / 10;
}

export function deriveWeightGoal(
  currentWeightKg: number,
  targetWeightKg: number,
): Goal | null {
  if (
    !Number.isFinite(currentWeightKg) ||
    !Number.isFinite(targetWeightKg) ||
    currentWeightKg <= 0 ||
    targetWeightKg <= 0
  ) {
    return null;
  }

  if (targetWeightKg < currentWeightKg - GOAL_TOLERANCE_KG) return "lose";
  if (targetWeightKg > currentWeightKg + GOAL_TOLERANCE_KG) return "gain";
  return "maintain";
}
