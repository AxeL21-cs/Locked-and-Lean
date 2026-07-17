import {
  darkColors,
  isAppThemePreference,
  lightColors,
  resolveAppTheme,
  resolvePreferredColorScheme,
} from "../theme";

function luminance(hex: string) {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)!
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) =>
      channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    );
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

function contrast(foreground: string, background: string) {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

describe("app theme", () => {
  it.each([
    ["system", true],
    ["light", true],
    ["dark", true],
    ["sepia", false],
    [null, false],
  ])("validates the stored preference %s", (value, expected) => {
    expect(isAppThemePreference(value)).toBe(expected);
  });

  it.each([
    ["system", "dark", "dark"],
    ["system", "light", "light"],
    ["system", null, "light"],
    ["light", "dark", "light"],
    ["dark", "light", "dark"],
  ] as const)(
    "resolves %s preference with %s system mode to %s",
    (preference, system, expected) => {
      expect(resolvePreferredColorScheme(preference, system)).toBe(expected);
    },
  );

  it("provides matching semantic roles for light and dark palettes", () => {
    expect(Object.keys(darkColors).sort()).toEqual(
      Object.keys(lightColors).sort(),
    );
    expect(resolveAppTheme("light").isDark).toBe(false);
    expect(resolveAppTheme("dark").isDark).toBe(true);
  });

  it("uses an OLED-aware dark background", () => {
    expect(darkColors.background).toBe("#000000");
  });

  it.each([
    [lightColors.text, lightColors.background],
    [lightColors.textFaint, lightColors.background],
    [darkColors.text, darkColors.background],
    [darkColors.textFaint, darkColors.background],
    [lightColors.onBrand, lightColors.brand],
    [darkColors.onBrand, darkColors.brand],
    [lightColors.danger, lightColors.dangerContainer],
    [darkColors.danger, darkColors.dangerContainer],
  ])("keeps primary text combinations at WCAG AA contrast", (text, surface) => {
    expect(contrast(text, surface)).toBeGreaterThanOrEqual(4.5);
  });
});
