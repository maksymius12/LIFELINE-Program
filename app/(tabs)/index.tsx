import { Text, View, Pressable, Linking, StyleSheet, Animated } from "react-native";
import { useRouter } from "expo-router";
import { useRef, useState, useEffect } from "react";
import Svg, { Path, Rect, Line } from "react-native-svg";
import { ScreenContainer } from "@/components/screen-container";
import { DISASTER_BUTTONS } from "@/constants/emergency-data";
import { haptic } from "@/lib/haptics";
import { useSettings } from "@/hooks/use-settings";
import { useAppContext } from "@/lib/app-context";

export default function HomeScreen() {
  const router = useRouter();
  const { settings } = useSettings();
  const { blackoutMode, toggleBlackoutMode, batteryLevel } = useAppContext();
  const [showManual, setShowManual] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  // Voice bar animations for the SOS button idle state
  const voiceBars = useRef(Array.from({ length: 5 }, () => new Animated.Value(0.3))).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.parallel(
        voiceBars.map((bar, i) =>
          Animated.sequence([
            Animated.delay(i * 120),
            Animated.loop(
              Animated.sequence([
                Animated.timing(bar, { toValue: 1, duration: 350 + i * 60, useNativeDriver: true }),
                Animated.timing(bar, { toValue: 0.25, duration: 350 + i * 60, useNativeDriver: true }),
              ])
            ),
          ])
        )
      )
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const handleSOS = () => {
    haptic.heavy();
    // Pulse animation on press
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.93, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
    router.push("/sos");
  };

  const handleDisaster = (type: string) => {
    haptic.medium();
    // DEMO MODE: bypass live AI, go directly to E-Script agentic UI
    router.push(`/demo-escript?type=${type}`);
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

        {/* No-contact warning */}
        {!settings.familyNumber && (
          <Pressable
            onPress={() => router.push("/(tabs)/settings")}
            style={({ pressed }) => [styles.noContact, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.noContactText}>⚠ Add emergency contact</Text>
          </Pressable>
        )}

        {/* SOS button — dominant, takes most of the screen */}
        <View style={styles.sosWrap}>
          <Text style={styles.sosSubtitle}>Speak to AI operator</Text>
          <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <Pressable
              onPress={handleSOS}
              style={({ pressed }) => [
                styles.sosBtn,
                pressed && { opacity: 0.9 },
              ]}
            >
              {/* Microphone icon */}
              <Svg width={64} height={64} viewBox="0 0 64 64" fill="none">
                {/* Mic body */}
                <Rect x="22" y="6" width="20" height="32" rx="10" fill="white" />
                {/* Mic stand arc */}
                <Path
                  d="M14 32 C14 46 50 46 50 32"
                  stroke="white"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  fill="none"
                />
                {/* Mic stand line */}
                <Line x1="32" y1="46" x2="32" y2="56" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
                {/* Base */}
                <Line x1="22" y1="56" x2="42" y2="56" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
              </Svg>

              {/* Animated voice bars */}
              <View style={styles.voiceBarsRow}>
                {voiceBars.map((bar, i) => (
                  <Animated.View
                    key={i}
                    style={[
                      styles.voiceBar,
                      { transform: [{ scaleY: bar }] },
                    ]}
                  />
                ))}
              </View>
            </Pressable>
          </Animated.View>
          <Text style={styles.sosDesc}>AI will guide you step by step</Text>
        </View>

        {/* Manual mode — collapsed by default */}
        <View style={styles.manualSection}>
          <Pressable
            onPress={() => { haptic.light(); setShowManual(v => !v); }}
            style={({ pressed }) => [styles.manualToggle, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.manualToggleText}>
              {showManual ? "▲ Hide manual mode" : "▾ Can't speak? Manual mode"}
            </Text>
          </Pressable>

          {showManual && (
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
          )}
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
  // SOS — large and dominant
  sosWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  sosSubtitle: {
    fontSize: 15,
    color: "#9BA1A6",
    fontWeight: "500",
    letterSpacing: 0.5,
  },
  sosBtn: {
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "#FF3D3D",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#FF3D3D",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.75,
    shadowRadius: 40,
    elevation: 20,
  },
  voiceBarsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 14,
    height: 28,
  },
  voiceBar: {
    width: 5,
    height: 28,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.85)",
  },
  sosDesc: {
    fontSize: 13,
    color: "#687076",
    fontWeight: "400",
  },
  // Manual section
  manualSection: {
    marginBottom: 10,
  },
  manualToggle: {
    alignItems: "center",
    paddingVertical: 10,
  },
  manualToggleText: {
    fontSize: 13,
    color: "#687076",
    fontWeight: "600",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 4,
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
    fontSize: 28,
    marginBottom: 5,
  },
  gridLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  // Call bar
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
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "#FF3D3D",
    justifyContent: "center",
    alignItems: "center",
  },
  blackoutSOSText: {
    fontSize: 56,
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
