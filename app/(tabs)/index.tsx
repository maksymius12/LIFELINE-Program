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
  const { blackoutMode, toggleBlackoutMode, batteryLevel } = useAppContext();

  const handleSOS = () => {
    haptic.heavy();
    router.push("/sos");
  };

  const handleDisaster = (type: string) => {
    haptic.medium();
    router.push(`/panic?type=${type}`);
  };

  const handleCall = () => Linking.openURL("tel:103");

  // Blackout mode: pure black, only SOS + call
  if (blackoutMode) {
    return (
      <ScreenContainer containerClassName="bg-[#000000]" edges={["top", "left", "right", "bottom"]}>
        <View style={styles.blackout}>
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
          <Pressable onPress={toggleBlackoutMode} style={styles.blackoutExit}>
            <Text style={styles.blackoutExitText}>Exit Blackout</Text>
          </Pressable>
        </View>
      </ScreenContainer>
    );
  }

  const batteryPct = Math.round(batteryLevel * 100);

  return (
    <ScreenContainer containerClassName="bg-background">
      <View style={styles.container}>

        {/* Minimal header */}
        <View style={styles.header}>
          <Text style={styles.title}>LIFELINE</Text>
          {batteryPct <= 30 && (
            <Pressable onPress={toggleBlackoutMode} style={styles.batteryBtn}>
              <Text style={[styles.batteryText, { color: batteryPct <= 15 ? "#FF3D3D" : "#F59E0B" }]}>
                🔋 {batteryPct}%
              </Text>
            </Pressable>
          )}
        </View>

        {/* No-contact warning — one line only */}
        {!settings.familyNumber && (
          <Pressable
            onPress={() => router.push("/(tabs)/settings")}
            style={({ pressed }) => [styles.noContact, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.noContactText}>⚠ Add emergency contact</Text>
          </Pressable>
        )}

        {/* SOS button — dominant element */}
        <View style={styles.sosWrap}>
          <Pressable
            onPress={handleSOS}
            style={({ pressed }) => [
              styles.sosBtn,
              pressed && { transform: [{ scale: 0.95 }] },
            ]}
          >
            <Text style={styles.sosLabel}>SOS</Text>
            <Text style={styles.sosHint}>PRESS & SPEAK</Text>
          </Pressable>
        </View>

        {/* Disaster grid — 2 columns, large tap targets */}
        <View style={styles.grid}>
          {DISASTER_BUTTONS.map((item) => (
            <Pressable
              key={item.type}
              onPress={() => handleDisaster(item.type)}
              style={({ pressed }) => [styles.gridItem, pressed && { opacity: 0.65 }]}
            >
              <Text style={styles.gridEmoji}>{item.emoji}</Text>
              <Text style={styles.gridLabel}>{item.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Call bar — always visible at bottom */}
        <Pressable
          onPress={handleCall}
          style={({ pressed }) => [styles.callBar, pressed && { opacity: 0.8 }]}
        >
          <Text style={styles.callText}>📞  Call 103</Text>
        </Pressable>

      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 10,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 3,
  },
  batteryBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#F59E0B",
  },
  batteryText: {
    fontSize: 12,
    fontWeight: "700",
  },
  noContact: {
    backgroundColor: "#FF3D3D18",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#FF3D3D60",
    alignItems: "center",
  },
  noContactText: {
    fontSize: 13,
    color: "#FF3D3D",
    fontWeight: "700",
  },
  sosWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    minHeight: 150,
  },
  sosBtn: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "#FF3D3D",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#FF3D3D",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 24,
    elevation: 12,
  },
  sosLabel: {
    fontSize: 40,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 4,
  },
  sosHint: {
    fontSize: 9,
    fontWeight: "700",
    color: "#FFFFFF",
    marginTop: 4,
    opacity: 0.85,
    letterSpacing: 1,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 10,
  },
  gridItem: {
    width: "31%",
    backgroundColor: "#1d2e3d",
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#354656",
  },
  gridEmoji: {
    fontSize: 30,
    marginBottom: 6,
  },
  gridLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  callBar: {
    backgroundColor: "#22C55E",
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: "center",
  },
  callText: {
    fontSize: 20,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 1,
  },
  // Blackout
  blackout: {
    flex: 1,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
    paddingHorizontal: 24,
  },
  blackoutSOS: {
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: "#FF3D3D",
    justifyContent: "center",
    alignItems: "center",
  },
  blackoutSOSText: {
    fontSize: 48,
    fontWeight: "900",
    color: "#FFF",
    letterSpacing: 4,
  },
  blackoutCall: {
    backgroundColor: "#22C55E",
    borderRadius: 14,
    paddingVertical: 20,
    paddingHorizontal: 56,
  },
  blackoutCallText: {
    fontSize: 26,
    fontWeight: "800",
    color: "#FFF",
  },
  blackoutExit: { marginTop: 8 },
  blackoutExitText: { fontSize: 13, color: "#555", textDecorationLine: "underline" },
});
