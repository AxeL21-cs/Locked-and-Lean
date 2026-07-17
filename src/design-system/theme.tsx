import Storage from "expo-sqlite/kv-store";
import type { PropsWithChildren } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { useColorScheme } from "react-native";

import {
  createElevation,
  darkColors,
  lightColors,
  radius,
  spacing,
  type,
  typeScale,
} from "./tokens";

export { darkColors, lightColors } from "./tokens";
export type { AppColors } from "./tokens";

export type AppColorScheme = "light" | "dark";
export type AppThemePreference = AppColorScheme | "system";

const THEME_PREFERENCE_KEY = "locked-and-lean:theme-preference";

export function isAppThemePreference(
  value: string | null,
): value is AppThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

export function resolvePreferredColorScheme(
  preference: AppThemePreference,
  systemScheme: string | null | undefined,
): AppColorScheme {
  if (preference !== "system") return preference;
  return systemScheme === "dark" ? "dark" : "light";
}

export function resolveAppTheme(colorScheme: AppColorScheme) {
  const colors = colorScheme === "dark" ? darkColors : lightColors;
  return Object.freeze({
    colorScheme,
    isDark: colorScheme === "dark",
    colors,
    spacing,
    radius,
    type,
    typeScale,
    elevation: createElevation(colors),
  });
}

export type AppTheme = ReturnType<typeof resolveAppTheme>;

type AppThemeContextValue = AppTheme & {
  preference: AppThemePreference;
  setPreference: (preference: AppThemePreference) => void;
  toggleDarkMode: () => void;
};

const fallbackTheme = resolveAppTheme("light");
const AppThemeContext = createContext<AppThemeContextValue>({
  ...fallbackTheme,
  preference: "system",
  setPreference: () => undefined,
  toggleDarkMode: () => undefined,
});

export function AppThemeProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<AppThemePreference>(() => {
    try {
      const stored = Storage.getItemSync(THEME_PREFERENCE_KEY);
      return isAppThemePreference(stored) ? stored : "system";
    } catch {
      return "system";
    }
  });

  const setPreference = useCallback((next: AppThemePreference) => {
    setPreferenceState(next);
    void Storage.setItem(THEME_PREFERENCE_KEY, next).catch(() => undefined);
  }, []);

  const colorScheme = resolvePreferredColorScheme(preference, systemScheme);
  const toggleDarkMode = useCallback(() => {
    setPreference(colorScheme === "dark" ? "light" : "dark");
  }, [colorScheme, setPreference]);
  const value = useMemo<AppThemeContextValue>(
    () => ({
      ...resolveAppTheme(colorScheme),
      preference,
      setPreference,
      toggleDarkMode,
    }),
    [colorScheme, preference, setPreference, toggleDarkMode],
  );

  return (
    <AppThemeContext.Provider value={value}>
      {children}
    </AppThemeContext.Provider>
  );
}

export function useAppTheme() {
  return useContext(AppThemeContext);
}
