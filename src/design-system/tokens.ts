import { Platform } from "react-native";

export const colors = {
  ink: "#10241B",
  inkMuted: "#40554A",
  inkFaint: "#66786E",
  inkRule: "#294237",
  rice: "#F4F1E9",
  riceDark: "#D8D3C8",
  paper: "#FFFEFA",
  paperRaised: "#FFFFFF",
  rule: "#D6D4CA",
  ruleStrong: "#AEB8B1",
  calamansi: "#CFFF4F",
  calamansiDeep: "#496B00",
  calamansiWash: "#EBF8C8",
  tomato: "#C8482D",
  tomatoWash: "#FBE4DE",
  skyWash: "#DCEBE4",
  white: "#FFFFFF",
} as const;

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

export const elevation = {
  card:
    Platform.select({
      android: { elevation: 2 },
      ios: {
        shadowColor: colors.ink,
        shadowOffset: { height: 2, width: 0 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      web: { boxShadow: "0 2px 8px rgba(16, 36, 27, 0.08)" },
    }) ?? {},
  floating:
    Platform.select({
      android: { elevation: 8 },
      ios: {
        shadowColor: colors.ink,
        shadowOffset: { height: 6, width: 0 },
        shadowOpacity: 0.18,
        shadowRadius: 14,
      },
      web: { boxShadow: "0 8px 24px rgba(16, 36, 27, 0.16)" },
    }) ?? {},
} as const;
