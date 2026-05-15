import { Text, View, Pressable, Linking, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { DISASTER_BUTTONS } from "@/constants/emergency-data";
import { haptic } from "@/lib/haptics";
import { useSettings } from "@/hooks/use-settings";
import { useAppContext } from "@/lib/app-context";

export default function HomeScreen() {
  const router = useRouter();
  const { settings } = useSettings();
  const { batteryLevel, blackoutMode, panicDetected, toggleBlackoutMode } = useAppContext();

  const handleSOS = () => {
    haptic.heavy();
    router.push("/sos");
  };

  const handleDisaster = (type: string) => {
    haptic.medium();
    router.push(`/panic?type=${type}`);
  };

  const handleCall = () => Linking.openURL("tel:103");

  const batteryPct = Math.round(batteryLevel * 100);
  const batteryColor =
    batteryPct <= 15 ? "#FF3D3D" : batteryPct <= 30 ? "#F59E0B" : "#22C55E";

  // Blackout mode: minimal UI with maximum contrast
  if (blackoutMode) {
    return (
      <ScreenContainer containerClassName="bg-[#000000]" edges={["top", "left", "right", "bottom"]}>
        <View style={styles.blackoutContainer}>
          <Text style={styles.blackoutTitle}>LIFELINE</Text>
          <Text style={styles.blackoutBattery}>🔋 {batteryPct}%</Text>
          <Pressable
            onPress={handleSOS}
            style={({ pressed }) => [styles.blackoutSOS, pressed && { opacity: 0.8 }]}
          >
            <Text style={styles.blackoutSOSText}>SOS</Text>
          </Pressable>
          <Pressable
            onPress={handleCall}
            style={({ pressed }) => [styles.blackoutCall, pressed && { opacity: 0.8 }]}
          >
            <Text style={styles.blackoutCallText}>📞 103</Text>
          </Pressable>
          <Pressable
            onPress={toggleBlackoutMode}
            style={({ pressed }) => [styles.blackoutExit, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.blackoutExitText}>Exit Blackout Mode</Text>
          </Pressable>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer containerClassName="bg-background">
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>LIFELINE</Text>
            <Text style={styles.tagline}>AI Survival Companion</Text>
          </View>
          <View style={styles.headerRight}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>● OFFLINE AI</Text>
            </View>
            {batteryPct <= 30 && (
              <Pressable
                onPress={toggleBlackoutMode}
                style={[styles.batteryBadge, { borderColor: batteryColor }]}
              >
                <Text style={[styles.batteryText, { color: batteryColor }]}>
                  🔋 {batteryPct}%
                </Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Panic detected banner */}
        {panicDetected && (
          <View style={styles.panicBanner}>
            <Text style={styles.panicText}>⚠️ PANIC MODE ACTIVE — UI enlarged</Text>
          </View>
        )}

        {/* Family Contact Banner */}
        {settings.familyNumber ? (
          <View style={styles.contactBanner}>
            <Text style={styles.contactText}>
              📱 Emergency contact: {settings.familyNumber}
            </Text>
          </View>
        ) : (
          <Pressable
            onPress={() => router.push("/(tabs)/settings")}
            style={({ pressed }) => [styles.contactBannerEmpty, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.contactTextEmpty}>
              ⚠️ No emergency contact — tap to add in Settings
            </Text>
          </Pressable>
        )}

        {/* SOS Button */}
        <View style={styles.sosContainer}>
          <Pressable
            onPress={handleSOS}
            style={({ pressed }) => [
              styles.sosButton,
              panicDetected && styles.sosButtonLarge,
              pressed && { transform: [{ scale: 0.95 }], opacity: 0.9 },
            ]}
          >
            <Text style={[styles.sosText, panicDetected && { fontSize: 44 }]}>SOS</Text>
            <Text style={styles.sosSubtext}>PRESS & SPEAK</Text>
          </Pressable>
        </View>

        {/* Disaster Grid */}
        <View style={styles.grid}>
          {DISASTER_BUTTONS.map((item) => (
            <Pressable
              key={item.type}
              onPress={() => handleDisaster(item.type)}
              style={({ pressed }) => [styles.gridItem, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.gridEmoji}>{item.emoji}</Text>
              <Text style={styles.gridLabel}>{item.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Emergency Call Bar */}
        <Pressable
          onPress={handleCall}
          style={({ pressed }) => [styles.callBar, pressed && { opacity: 0.8 }]}
        >
          <Text style={styles.callText}>📞 Call Emergency — 103</Text>
        </Pressable>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  headerRight: { alignItems: "flex-end", gap: 6 },
  title: { fontSize: 32, fontWeight: "800", color: "#FFFFFF", letterSpacing: 2 },
  tagline: { fontSize: 14, color: "#e0e0e0", marginTop: 2 },
  badge: {
    backgroundColor: "#0D6E6E",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: { color: "#afffff", fontSize: 11, fontWeight: "700" },
  batteryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  batteryText: { fontSize: 11, fontWeight: "700" },
  panicBanner: {
    backgroundColor: "#FF3D3D20",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#FF3D3D",
  },
  panicText: { fontSize: 12, color: "#FF3D3D", fontWeight: "700", textAlign: "center" },
  contactBanner: {
    backgroundColor: "#0D6E6E30",
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#0D6E6E",
  },
  contactText: { fontSize: 13, color: "#afffff", fontWeight: "600" },
  contactBannerEmpty: {
    backgroundColor: "#FF3D3D15",
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#FF3D3D50",
  },
  contactTextEmpty: { fontSize: 13, color: "#FF3D3D", fontWeight: "600" },
  sosContainer: { flex: 1, justifyContent: "center", alignItems: "center", minHeight: 160 },
  sosButton: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "#FF3D3D",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#FF3D3D",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 10,
  },
  sosButtonLarge: { width: 160, height: 160, borderRadius: 80 },
  sosText: { fontSize: 36, fontWeight: "900", color: "#FFFFFF", letterSpacing: 3 },
  sosSubtext: { fontSize: 9, fontWeight: "600", color: "#FFFFFF", marginTop: 4, opacity: 0.9 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 16,
  },
  gridItem: {
    width: "31%",
    backgroundColor: "#1d2e3d",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#354656",
  },
  gridEmoji: { fontSize: 28, marginBottom: 6 },
  gridLabel: { fontSize: 12, fontWeight: "600", color: "#FFFFFF" },
  callBar: {
    backgroundColor: "#22C55E",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  callText: { fontSize: 16, fontWeight: "700", color: "#FFFFFF" },
  // Blackout mode
  blackoutContainer: {
    flex: 1,
    backgroundColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    paddingHorizontal: 24,
  },
  blackoutTitle: { fontSize: 40, fontWeight: "900", color: "#FFFFFF", letterSpacing: 4 },
  blackoutBattery: { fontSize: 18, color: "#FF3D3D", fontWeight: "700" },
  blackoutSOS: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "#FF3D3D",
    justifyContent: "center",
    alignItems: "center",
  },
  blackoutSOSText: { fontSize: 44, fontWeight: "900", color: "#FFFFFF", letterSpacing: 4 },
  blackoutCall: {
    backgroundColor: "#22C55E",
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 48,
  },
  blackoutCallText: { fontSize: 24, fontWeight: "800", color: "#FFFFFF" },
  blackoutExit: { marginTop: 8 },
  blackoutExitText: { fontSize: 14, color: "#666", textDecorationLine: "underline" },
});
