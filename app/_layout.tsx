import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { colors } from "../src/design-system/tokens";
import { AppProviders, useSession } from "../src/features/auth/SessionProvider";
import { AsyncStatePanel } from "../src/components/AsyncStatePanel";
import { Screen } from "../src/components/Screen";

function Navigator() {
  const { loading, session } = useSession();
  if (loading)
    return (
      <Screen>
        <AsyncStatePanel
          kind="loading"
          title="Opening your field log"
          message="Restoring the secure session on this device."
        />
      </Screen>
    );

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
