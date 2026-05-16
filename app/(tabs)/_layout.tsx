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
        tabBarActiveTintColor: "#FF3B30",
        tabBarInactiveTintColor: "#8E9BAA",
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          paddingTop: 8,
          paddingBottom: bottomPadding,
          height: tabBarHeight,
          backgroundColor: "#0A0F14",
          borderTopColor: "#1C2B38",
          borderTopWidth: 0.5,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          letterSpacing: 0.3,
        },
      }}
    >
      {/* Main SOS / Call screen */}
      <Tabs.Screen
        name="index"
        options={{
          title: "SOS",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={26} name="phone.fill" color={color} />
          ),
        }}
      />
      {/* Prepare: training + kit checklist */}
      <Tabs.Screen
        name="prepare"
        options={{
          title: "Prepare",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={26} name="shield.fill" color={color} />
          ),
        }}
      />
      {/* Settings */}
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={26} name="gearshape.fill" color={color} />
          ),
        }}
      />
      {/* Hidden legacy screens — kept so router doesn't crash if referenced */}
      <Tabs.Screen name="training" options={{ href: null }} />
      <Tabs.Screen name="medical" options={{ href: null }} />
    </Tabs>
  );
}
