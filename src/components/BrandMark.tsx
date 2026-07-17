import { Image, StyleSheet, Text, View } from "react-native";

import { PRODUCT } from "../design-system/product";
import { useAppTheme } from "../design-system/theme";

const LIGHT_MARK = require("../../assets/brand/locked-and-lean-brand-light.png");
const DARK_MARK = require("../../assets/brand/locked-and-lean-brand-dark.png");

type Props = {
  accessibilityLabel?: string;
  artworkScale?: number;
  decorative?: boolean;
  showWordmark?: boolean;
  size?: number;
  wordmarkSize?: number;
};

export function BrandMark({
  accessibilityLabel = `${PRODUCT.name} logo`,
  artworkScale = 1,
  decorative = false,
  showWordmark = false,
  size = 96,
  wordmarkSize,
}: Props) {
  const { colors, isDark, spacing, type, typeScale } = useAppTheme();
  const artworkSize = size * artworkScale;
  const artworkOffset = (size - artworkSize) / 2;

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
            backgroundColor: isDark ? "#061225" : "#FFFFFF",
            borderRadius: size * 0.215,
            height: size,
            width: size,
          },
        ]}
      >
        <Image
          accessible={false}
          resizeMode="contain"
          source={isDark ? DARK_MARK : LIGHT_MARK}
          testID="brand-artwork"
          style={{
            height: artworkSize,
            left: artworkOffset,
            position: "absolute",
            top: artworkOffset,
            width: artworkSize,
          }}
        />
      </View>
      {showWordmark ? (
        <Text
          allowFontScaling
          style={{
            color: colors.text,
            flexShrink: 1,
            fontFamily: type.display,
            fontSize: wordmarkSize ?? typeScale.title,
            lineHeight: (wordmarkSize ?? typeScale.title) * 1.25,
          }}
        >
          {PRODUCT.name}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: "center", flexDirection: "row", flexShrink: 1 },
  clip: { overflow: "hidden" },
});
