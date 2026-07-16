import type { PropsWithChildren } from "react";
import { createContext, useContext, useMemo } from "react";
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

const fallbackTheme = resolveAppTheme("light");
const AppThemeContext = createContext<AppTheme>(fallbackTheme);

export function AppThemeProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const colorScheme: AppColorScheme =
    systemScheme === "dark" ? "dark" : "light";
  const theme = useMemo(() => resolveAppTheme(colorScheme), [colorScheme]);

  return (
    <AppThemeContext.Provider value={theme}>
      {children}
    </AppThemeContext.Provider>
  );
}

export function useAppTheme() {
  return useContext(AppThemeContext);
}
