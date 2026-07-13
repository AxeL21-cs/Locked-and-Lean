import type { PropsWithChildren } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors } from "../design-system/tokens";

export function Screen({ children }: PropsWithChildren) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topGlow} />
      <View style={styles.texture} />
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
  content: {
    alignSelf: "center",
    maxWidth: 680,
    paddingBottom: 72,
    paddingHorizontal: 16,
    width: "100%",
  },
  topGlow: {
    backgroundColor: "rgba(207,255,79,0.18)",
    borderBottomLeftRadius: 120,
    height: 176,
    pointerEvents: "none",
    position: "absolute",
    right: -56,
    top: -68,
    width: 210,
  },
  texture: {
    backgroundColor: "rgba(16,36,27,0.025)",
    height: 1,
    left: 16,
    position: "absolute",
    pointerEvents: "none",
    right: 16,
    top: 12,
  },
});
