import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Image,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AppProviders, useSession } from "../src/features/auth/SessionProvider";
import { Screen } from "../src/components/Screen";
import { PRODUCT } from "../src/design-system/product";
import { colors, spacing, type } from "../src/design-system/tokens";

function BrandedLaunch() {
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
          <Image
            accessible={false}
            source={require("../assets/brand/locked-and-lean-mark.png")}
            style={launchStyles.mark}
          />
          <Text style={launchStyles.name}>{PRODUCT.name}</Text>
          <Text style={launchStyles.copy}>RESTORING YOUR FIELD LOG</Text>
        </Animated.View>
      </View>
    </Screen>
  );
}

const launchStyles = StyleSheet.create({
  root: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    minHeight: 420,
  },
  mark: { height: 124, resizeMode: "contain", width: 124 },
  name: {
    color: colors.ink,
    fontFamily: type.display,
    fontSize: 30,
    marginTop: spacing.md,
  },
  copy: {
    color: colors.calamansiDeep,
    fontFamily: type.label,
    fontSize: 11,
    letterSpacing: 1.3,
    marginTop: spacing.sm,
  },
});

function Navigator() {
  const { loading, session } = useSession();
  if (loading) return <BrandedLaunch />;

  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: colors.rice },
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

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AppProviders>
        <Navigator />
      </AppProviders>
    </SafeAreaProvider>
  );
}
