import type { PropsWithChildren } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, spacing } from "../design-system/tokens";

export function Screen({ children }: PropsWithChildren) {
  return (
    <SafeAreaView style={styles.safe}>
      <View pointerEvents="none" style={styles.texture} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboard}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.rice, flex: 1 },
  keyboard: { flex: 1 },
  content: { paddingBottom: spacing.xxl, paddingHorizontal: spacing.lg },
  texture: {
    borderColor: "rgba(20,37,30,0.035)",
    borderWidth: 24,
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
});
