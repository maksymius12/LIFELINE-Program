import { Text, View, Pressable, Linking, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { DISASTER_BUTTONS } from "@/constants/emergency-data";
import { haptic } from "@/lib/haptics";

export default function HomeScreen() {
  const router = useRouter();

  const handleSOS = () => {
    haptic.heavy();
    router.push("/panic?type=fire");
  };

  const handleDisaster = (type: string) => {
    haptic.medium();
    router.push(`/panic?type=${type}`);
  };

  const handleCall = () => {
    Linking.openURL("tel:103");
  };

  return (
    <ScreenContainer containerClassName="bg-background">
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>LIFELINE</Text>
            <Text style={styles.tagline}>AI Survival Companion</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>● OFFLINE AI</Text>
          </View>
        </View>

        {/* SOS Button */}
        <View style={styles.sosContainer}>
          <Pressable
            onPress={handleSOS}
            style={({ pressed }) => [
              styles.sosButton,
              pressed && { transform: [{ scale: 0.95 }], opacity: 0.9 },
            ]}
          >
            <Text style={styles.sosText}>SOS</Text>
            <Text style={styles.sosSubtext}>TAP FOR HELP</Text>
          </Pressable>
        </View>

        {/* Disaster Grid */}
        <View style={styles.grid}>
          {DISASTER_BUTTONS.map((item) => (
            <Pressable
              key={item.type}
              onPress={() => handleDisaster(item.type)}
              style={({ pressed }) => [
                styles.gridItem,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={styles.gridEmoji}>{item.emoji}</Text>
              <Text style={styles.gridLabel}>{item.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Emergency Call Bar */}
        <Pressable
          onPress={handleCall}
          style={({ pressed }) => [
            styles.callBar,
            pressed && { opacity: 0.8 },
          ]}
        >
          <Text style={styles.callText}>📞 Call Emergency — 103</Text>
        </Pressable>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 2,
  },
  tagline: {
    fontSize: 14,
    color: "#e0e0e0",
    marginTop: 2,
  },
  badge: {
    backgroundColor: "#0D6E6E",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
  },
  badgeText: {
    color: "#afffff",
    fontSize: 11,
    fontWeight: "700",
  },
  sosContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    minHeight: 180,
  },
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
  sosText: {
    fontSize: 36,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 3,
  },
  sosSubtext: {
    fontSize: 10,
    fontWeight: "600",
    color: "#FFFFFF",
    marginTop: 4,
    opacity: 0.9,
  },
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
  gridEmoji: {
    fontSize: 28,
    marginBottom: 6,
  },
  gridLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  callBar: {
    backgroundColor: "#22C55E",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  callText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
