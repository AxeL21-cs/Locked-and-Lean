import { Platform } from "react-native";

export const colors = {
  ink: "#132019",
  inkMuted: "#3E5246",
  inkFaint: "#728077",
  inkRule: "#33483B",
  rice: "#F5F0E6",
  riceDark: "#D9D1C4",
  paper: "#FFFBF3",
  rule: "#D5CABB",
  calamansi: "#D9FF64",
  calamansiDeep: "#5A7413",
  tomato: "#FF6B4A",
  tomatoWash: "#FFE1DA",
  skyWash: "#DCE8E2",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
  xxl: 40,
} as const;
export const radius = { sm: 8, md: 14, lg: 20, xl: 28, pill: 999 } as const;

export const type = {
  display: Platform.select({
    ios: "Georgia-Bold",
    android: "serif",
    default: "Georgia",
  }),
  body: Platform.select({
    ios: "Avenir Next",
    android: "sans-serif",
    default: "sans-serif",
  }),
  bodyStrong: Platform.select({
    ios: "Avenir Next Demi Bold",
    android: "sans-serif-medium",
    default: "sans-serif",
  }),
  label: Platform.select({
    ios: "Avenir Next Condensed Demi Bold",
    android: "sans-serif-condensed",
    default: "sans-serif",
  }),
} as const;
