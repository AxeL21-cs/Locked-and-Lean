import { Image, StyleSheet, Text, View } from "react-native";

import { PRODUCT } from "../design-system/product";
import { useAppTheme } from "../design-system/theme";

const LIGHT_MARK = require("../../assets/brand/locked-and-lean-brand-light.png");
const DARK_MARK = require("../../assets/brand/locked-and-lean-brand-dark.png");

type Props = {
  accessibilityLabel?: string;
  decorative?: boolean;
  showWordmark?: boolean;
  size?: number;
};

export function BrandMark({
  accessibilityLabel = `${PRODUCT.name} logo`,
  decorative = false,
  showWordmark = false,
  size = 96,
}: Props) {
  const { colors, isDark, spacing, type, typeScale } = useAppTheme();

  return (
    <View
      accessible={!decorative}
      accessibilityLabel={decorative ? undefined : accessibilityLabel}
      accessibilityRole={decorative ? undefined : "image"}
      style={[styles.row, { gap: spacing.md }]}
    >
      <View
        style={[
          styles.clip,
          {
            backgroundColor: "#000000",
            borderRadius: size * 0.215,
            height: size,
            width: size,
          },
        ]}
      >
        <Image
          accessible={false}
          resizeMode="cover"
          source={isDark ? DARK_MARK : LIGHT_MARK}
          style={{ height: size, width: size }}
        />
      </View>
      {showWordmark ? (
        <Text
          allowFontScaling
          style={{
            color: colors.text,
            flexShrink: 1,
            fontFamily: type.display,
            fontSize: typeScale.title,
          }}
        >
          {PRODUCT.name}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: "center", flexDirection: "row" },
  clip: { overflow: "hidden" },
});
