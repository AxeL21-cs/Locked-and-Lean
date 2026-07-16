import { Platform } from "react-native";

const lightBase = {
  background: "#F5F7FA",
  surface: "#FFFFFF",
  surfaceRaised: "#FFFFFF",
  surfaceMuted: "#EAF0F5",
  text: "#07182F",
  textMuted: "#405168",
  textFaint: "#607087",
  border: "#D5DEE8",
  borderStrong: "#A9B8C9",
  brand: "#9DDD16",
  brandStrong: "#3F6200",
  brandContainer: "#E9F8C5",
  danger: "#B42318",
  dangerContainer: "#FEE4E2",
  success: "#247A3B",
  successContainer: "#DDF5E3",
  info: "#245E8F",
  infoContainer: "#DCECF8",
  onBrand: "#07182F",
  onDanger: "#FFFFFF",
  shadow: "#07182F",
} as const;

const darkBase = {
  background: "#000000",
  surface: "#061225",
  surfaceRaised: "#0A1A30",
  surfaceMuted: "#102640",
  text: "#F2F6FA",
  textMuted: "#B7C3D0",
  textFaint: "#8D9CAF",
  border: "#263A52",
  borderStrong: "#435B75",
  brand: "#A7E51D",
  brandStrong: "#B6EF3D",
  brandContainer: "#172D00",
  danger: "#FFB4AB",
  dangerContainer: "#3B1114",
  success: "#8EDA9D",
  successContainer: "#0E3218",
  info: "#A9D2F3",
  infoContainer: "#0C2A43",
  onBrand: "#07182F",
  onDanger: "#3B090C",
  shadow: "#000000",
} as const;

function withLegacyAliases<T extends typeof lightBase | typeof darkBase>(
  base: T,
) {
  return {
    ...base,
    ink: base.text,
    inkMuted: base.textMuted,
    inkFaint: base.textFaint,
    inkRule: base.borderStrong,
    rice: base.background,
    riceDark: base.textMuted,
    paper: base.surface,
    paperRaised: base.surfaceRaised,
    rule: base.border,
    ruleStrong: base.borderStrong,
    calamansi: base.brand,
    calamansiDeep: base.brandStrong,
    calamansiWash: base.brandContainer,
    tomato: base.danger,
    tomatoWash: base.dangerContainer,
    skyWash: base.infoContainer,
    white: "#FFFFFF",
  } as const;
}

export const lightColors = withLegacyAliases(lightBase);
export const darkColors = withLegacyAliases(darkBase);
export type AppColors = { [K in keyof typeof lightColors]: string };

/** Light-mode compatibility export while feature screens migrate to useAppTheme. */
export const colors = lightColors;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
  xxl: 40,
} as const;
export const radius = { sm: 10, md: 16, lg: 22, xl: 30, pill: 999 } as const;

export const type = {
  display: Platform.select({
    ios: "Avenir Next Heavy",
    android: "sans-serif-black",
    default: "system-ui",
  }),
  body: Platform.select({
    ios: "Avenir Next",
    android: "sans-serif",
    default: "system-ui",
  }),
  bodyStrong: Platform.select({
    ios: "Avenir Next Demi Bold",
    android: "sans-serif-medium",
    default: "system-ui",
  }),
  label: Platform.select({
    ios: "Avenir Next Demi Bold",
    android: "sans-serif-medium",
    default: "system-ui",
  }),
  numeric: Platform.select({
    ios: "Avenir Next Condensed Bold",
    android: "sans-serif-medium",
    default: "system-ui",
  }),
} as const;

export const typeScale = {
  caption: 12,
  label: 13,
  bodySmall: 14,
  body: 16,
  title: 20,
  headline: 26,
  display: 34,
  hero: 56,
} as const;

export function createElevation(palette: AppColors) {
  return {
    card:
      Platform.select({
        android: { elevation: 2 },
        ios: {
          shadowColor: palette.shadow,
          shadowOffset: { height: 2, width: 0 },
          shadowOpacity: 0.12,
          shadowRadius: 8,
        },
        web: { boxShadow: `0 2px 8px ${palette.shadow}1F` },
      }) ?? {},
    floating:
      Platform.select({
        android: { elevation: 8 },
        ios: {
          shadowColor: palette.shadow,
          shadowOffset: { height: 6, width: 0 },
          shadowOpacity: 0.22,
          shadowRadius: 14,
        },
        web: { boxShadow: `0 8px 24px ${palette.shadow}38` },
      }) ?? {},
  } as const;
}

export const elevation = createElevation(lightColors);
