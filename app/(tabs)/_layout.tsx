import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Platform } from "react-native";

import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === "web" ? 12 : Math.max(insets.bottom, 8);
  const tabBarHeight = 56 + bottomPadding;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#afffff",
        tabBarInactiveTintColor: "#e0e0e0",
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          paddingTop: 8,
          paddingBottom: bottomPadding,
          height: tabBarHeight,
          backgroundColor: "#0D1F2D",
          borderTopColor: "#354656",
          borderTopWidth: 0.5,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Emergency",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="exclamationmark.triangle.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="training"
        options={{
          title: "Training",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="book.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="medical"
        options={{
          title: "My Kit",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="cross.case.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="gearshape.fill" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
