import type { PropsWithChildren } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { AppTheme } from "../design-system/theme";
import { useAppTheme } from "../design-system/theme";

type Props = PropsWithChildren<{ plain?: boolean }>;

export function Screen({ children, plain = false }: Props) {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  return (
    <SafeAreaView style={styles.safe}>
      {plain ? null : (
        <>
          <View style={styles.topGlow} />
          <View style={styles.texture} />
        </>
      )}
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

function createStyles({ colors }: AppTheme) {
  return StyleSheet.create({
    safe: { backgroundColor: colors.background, flex: 1 },
    keyboard: { flex: 1 },
    content: {
      alignSelf: "center",
      maxWidth: 680,
      paddingBottom: 72,
      paddingHorizontal: 16,
      width: "100%",
    },
    topGlow: {
      backgroundColor: colors.brandContainer,
      borderBottomLeftRadius: 120,
      height: 176,
      pointerEvents: "none",
      position: "absolute",
      right: -56,
      top: -68,
      width: 210,
    },
    texture: {
      backgroundColor: colors.border,
      height: 1,
      left: 16,
      position: "absolute",
      pointerEvents: "none",
      right: 16,
      top: 12,
    },
  });
}
