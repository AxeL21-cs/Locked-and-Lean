import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { useEffect, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AppProviders, useSession } from "../src/features/auth/SessionProvider";
import { BrandMark } from "../src/components/BrandMark";
import { Screen } from "../src/components/Screen";
import { PRODUCT } from "../src/design-system/product";
import type { AppTheme } from "../src/design-system/theme";
import { AppThemeProvider, useAppTheme } from "../src/design-system/theme";

function BrandedLaunch() {
  const theme = useAppTheme();
  const launchStyles = createLaunchStyles(theme);
  const [opacity] = useState(() => new Animated.Value(0.55));
  const [scale] = useState(() => new Animated.Value(0.96));
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (!active || reduced) {
        opacity.setValue(1);
        scale.setValue(1);
        return;
      }
      Animated.parallel([
        Animated.timing(opacity, {
          duration: 420,
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          damping: 16,
          stiffness: 150,
          toValue: 1,
          useNativeDriver: true,
        }),
      ]).start();
    });
    return () => {
      active = false;
    };
  }, [opacity, scale]);
  return (
    <Screen>
      <View
        accessibilityLabel={`Opening ${PRODUCT.name}`}
        accessibilityLiveRegion="polite"
        style={launchStyles.root}
      >
        <Animated.View
          style={{ alignItems: "center", opacity, transform: [{ scale }] }}
        >
          <BrandMark decorative size={124} />
          <Text style={launchStyles.name}>{PRODUCT.name}</Text>
          <Text style={launchStyles.copy}>RESTORING YOUR FIELD LOG</Text>
        </Animated.View>
      </View>
    </Screen>
  );
}

function createLaunchStyles({ colors, spacing, type }: AppTheme) {
  return StyleSheet.create({
    root: {
      alignItems: "center",
      flex: 1,
      justifyContent: "center",
      minHeight: 420,
    },
    name: {
      color: colors.text,
      fontFamily: type.display,
      fontSize: 30,
      marginTop: spacing.md,
    },
    copy: {
      color: colors.brandStrong,
      fontFamily: type.label,
      fontSize: 11,
      letterSpacing: 1.3,
      marginTop: spacing.sm,
    },
  });
}

function Navigator() {
  const { loading, session } = useSession();
  const { colors } = useAppTheme();
  if (loading) return <BrandedLaunch />;

  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: colors.background },
        headerShown: false,
      }}
    >
      <Stack.Protected guard={Boolean(session)}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="target-review" />
        <Stack.Screen name="manual-entry" />
        <Stack.Screen name="barcode-scan" />
        <Stack.Screen name="saved-foods" />
        <Stack.Screen name="repeat-entry" />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Screen name="oauth/consent" />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

function ThemedRoot() {
  const { colors, isDark } = useAppTheme();

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.background);
  }, [colors.background]);

  return (
    <SafeAreaProvider>
      <StatusBar style={isDark ? "light" : "dark"} />
      <AppProviders>
        <Navigator />
      </AppProviders>
    </SafeAreaProvider>
  );
}

export default function RootLayout() {
  return (
    <AppThemeProvider>
      <ThemedRoot />
    </AppThemeProvider>
  );
}
