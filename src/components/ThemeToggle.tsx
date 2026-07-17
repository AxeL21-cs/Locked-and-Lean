import * as Haptics from "expo-haptics";
import { SymbolView } from "expo-symbols";
import { Pressable, StyleSheet } from "react-native";

import type { AppTheme } from "../design-system/theme";
import { useAppTheme } from "../design-system/theme";

export function ThemeToggle() {
  const theme = useAppTheme();
  const styles = createStyles(theme);

  const toggle = () => {
    theme.toggleDarkMode();
    void Haptics.selectionAsync().catch(() => undefined);
  };

  return (
    <Pressable
      accessibilityHint={
        theme.isDark
          ? "Switches the app to light appearance"
          : "Switches the app to dark appearance"
      }
      accessibilityLabel="Dark mode"
      accessibilityRole="switch"
      accessibilityState={{ checked: theme.isDark }}
      android_ripple={{ color: theme.colors.brandContainer }}
      onPress={toggle}
      style={({ pressed }) => [
        styles.control,
        theme.isDark && styles.active,
        pressed && styles.pressed,
      ]}
    >
      <SymbolView
        accessible={false}
        name={
          theme.isDark
            ? { android: "dark_mode", ios: "moon.fill", web: "dark_mode" }
            : { android: "light_mode", ios: "sun.max", web: "light_mode" }
        }
        size={19}
        tintColor={theme.colors.text}
      />
    </Pressable>
  );
}

function createStyles({ colors, radius }: AppTheme) {
  return StyleSheet.create({
    control: {
      alignItems: "center",
      borderColor: colors.borderStrong,
      borderRadius: radius.pill,
      borderWidth: 1,
      justifyContent: "center",
      height: 48,
      minHeight: 48,
      minWidth: 48,
      width: 48,
    },
    active: { backgroundColor: colors.brandContainer },
    pressed: { opacity: 0.72 },
  });
}
