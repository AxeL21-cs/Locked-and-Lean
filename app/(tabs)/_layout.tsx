import { Tabs } from "expo-router";
import { Text, View } from "react-native";

import { TAB_ITEMS } from "../../src/features/navigation/tabs";
import { colors, type } from "../../src/design-system/tokens";

const glyphs = ["◆", "▦", "+", "↗", "●"] as const;

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.inkFaint,
        tabBarLabelStyle: {
          fontFamily: type.label,
          fontSize: 11,
          marginBottom: 6,
        },
        tabBarStyle: {
          backgroundColor: colors.paper,
          borderTopColor: colors.rule,
          height: 78,
          paddingTop: 7,
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
                style={
                  item.name === "add"
                    ? {
                        alignItems: "center",
                        backgroundColor: colors.calamansi,
                        borderColor: colors.ink,
                        borderRadius: 18,
                        borderWidth: 1,
                        height: 36,
                        justifyContent: "center",
                        marginTop: -11,
                        width: 44,
                      }
                    : undefined
                }
              >
                <Text
                  style={{
                    color: item.name === "add" ? colors.ink : color,
                    fontFamily: type.label,
                    fontSize: item.name === "add" ? 24 : 17,
                    fontWeight: focused ? "800" : "600",
                  }}
                >
                  {glyphs[index]}
                </Text>
              </View>
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
