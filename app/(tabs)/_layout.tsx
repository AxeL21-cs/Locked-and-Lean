import { Tabs } from "expo-router";
import { SymbolView } from "expo-symbols";
import { StyleSheet, View } from "react-native";

import { TAB_ITEMS } from "../../src/features/navigation/tabs";
import {
  colors,
  elevation,
  radius,
  type,
} from "../../src/design-system/tokens";

const glyphs = [
  { android: "home", ios: "house.fill", web: "home" },
  { android: "calendar_month", ios: "calendar", web: "calendar_month" },
  { android: "add", ios: "plus", web: "add" },
  {
    android: "monitoring",
    ios: "chart.line.uptrend.xyaxis",
    web: "monitoring",
  },
  { android: "person", ios: "person.crop.circle", web: "person" },
] as const;

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.inkFaint,
        tabBarLabelStyle: {
          fontFamily: type.label,
          fontSize: 12,
          marginBottom: 7,
        },
        tabBarStyle: {
          backgroundColor: colors.paperRaised,
          borderTopColor: colors.rule,
          height: 82,
          paddingTop: 8,
          ...elevation.floating,
        },
      }}
    >
      {TAB_ITEMS.map((item, index) => (
        <Tabs.Screen
          key={item.name}
          name={item.name}
          options={{
            title: item.label,
            tabBarAccessibilityLabel: `${item.label} tab`,
            tabBarIcon: ({ color, focused }) => (
              <View
                style={[
                  styles.iconBox,
                  focused && styles.activeIconBox,
                  item.name === "add" && styles.addIconBox,
                ]}
              >
                <SymbolView
                  name={glyphs[index]!}
                  size={item.name === "add" ? 27 : 23}
                  tintColor={item.name === "add" ? colors.ink : color}
                />
              </View>
            ),
          }}
        />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconBox: {
    alignItems: "center",
    borderRadius: radius.pill,
    height: 32,
    justifyContent: "center",
    width: 52,
  },
  activeIconBox: { backgroundColor: colors.calamansiWash },
  addIconBox: {
    backgroundColor: colors.calamansi,
    borderColor: colors.ink,
    borderWidth: 1,
    height: 48,
    marginTop: -16,
    width: 56,
    ...elevation.card,
  },
});
