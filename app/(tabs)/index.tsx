/**
 * HOME SCREEN — Voice-First Emergency
 *
 * ONLY 3 ELEMENTS:
 *   1. Header: LIFELINE title + OFFLINE AI badge
 *   2. Giant SOS button (mic icon + animated voice bars)
 *   3. Call 103 bar — always at bottom
 *
 * NO text inputs. NO menus. NO category grid. NO navigation buttons.
 * A person with shaking hands must be able to press SOS with one tap.
 */
import { Text, View, Pressable, Linking, StyleSheet, Animated } from "react-native";
import { useRouter } from "expo-router";
import { useRef, useEffect } from "react";
import Svg, { Path, Rect, Line } from "react-native-svg";
import { ScreenContainer } from "@/components/screen-container";
import { haptic } from "@/lib/haptics";
import { useAppContext } from "@/lib/app-context";
import { isLocalLLMReady } from "@/lib/local-llm";

export default function HomeScreen() {
  const router = useRouter();
  const { blackoutMode, toggleBlackoutMode } = useAppContext();

  // Scale animation on SOS press
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Outer ring pulse — slow, calm, always running
  const ringAnim = useRef(new Animated.Value(1)).current;
  const ringOpacity = useRef(new Animated.Value(0.35)).current;

  // Voice bars inside button — staggered pulse
  const voiceBars = useRef(Array.from({ length: 5 }, () => new Animated.Value(0.3))).current;

  useEffect(() => {
    // Ring pulse
    const ring = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(ringAnim, { toValue: 1.22, duration: 1400, useNativeDriver: true }),
          Animated.timing(ringAnim, { toValue: 1, duration: 1400, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(ringOpacity, { toValue: 0, duration: 1400, useNativeDriver: true }),
          Animated.timing(ringOpacity, { toValue: 0.35, duration: 1400, useNativeDriver: true }),
        ]),
      ])
    );
    ring.start();

    // Voice bars
    const bars = Animated.loop(
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
    bars.start();

    return () => { ring.stop(); bars.stop(); };
  }, []);

  const handleSOS = () => {
    haptic.heavy();
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.92, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
    router.push("/sos");
  };

  const handleCall = () => Linking.openURL("tel:103");

  // ── Blackout mode: pure black, only SOS + call ────────────────────────────────
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

  const llmReady = isLocalLLMReady();

  return (
    <ScreenContainer containerClassName="bg-[#0a0f14]" edges={["top", "left", "right"]}>
      <View style={styles.container}>

        {/* ── 1. Header ─────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <Text style={styles.title}>LIFELINE</Text>
          <View style={[styles.aiBadge, llmReady ? styles.aiBadgeOnline : styles.aiBadgeOffline]}>
            <View style={[styles.aiBadgeDot, { backgroundColor: llmReady ? "#22C55E" : "#F59E0B" }]} />
            <Text style={styles.aiBadgeText}>
              {llmReady ? "GEMMA ON-DEVICE" : "OFFLINE AI"}
            </Text>
          </View>
        </View>

        {/* ── 2. SOS Button ─────────────────────────────────────────────────── */}
        <View style={styles.sosWrap}>
          <Text style={styles.sosHint}>Press and speak</Text>

          {/* Expanding ring behind button */}
          <View style={styles.ringContainer}>
            <Animated.View
              style={[
                styles.ring,
                {
                  transform: [{ scale: ringAnim }],
                  opacity: ringOpacity,
                },
              ]}
            />

            {/* The button itself */}
            <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
              <Pressable
                onPress={handleSOS}
                style={({ pressed }) => [styles.sosBtn, pressed && { opacity: 0.88 }]}
              >
                {/* Mic SVG */}
                <Svg width={68} height={68} viewBox="0 0 64 64" fill="none">
                  <Rect x="22" y="6" width="20" height="32" rx="10" fill="white" />
                  <Path
                    d="M14 32 C14 46 50 46 50 32"
                    stroke="white"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    fill="none"
                  />
                  <Line x1="32" y1="46" x2="32" y2="56" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
                  <Line x1="22" y1="56" x2="42" y2="56" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
                </Svg>

                {/* Animated voice bars */}
                <View style={styles.voiceBarsRow}>
                  {voiceBars.map((bar, i) => (
                    <Animated.View
                      key={i}
                      style={[styles.voiceBar, { transform: [{ scaleY: bar }] }]}
                    />
                  ))}
                </View>
              </Pressable>
            </Animated.View>
          </View>

          <Text style={styles.sosDesc}>AI guides you step by step — hands free</Text>
        </View>

        {/* ── 3. Call 103 bar ───────────────────────────────────────────────── */}
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

const SOS_SIZE = 240;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
  },
  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 0,
  },
  title: {
    fontSize: 30,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 4,
  },
  aiBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  aiBadgeOnline: {
    backgroundColor: "#0d2a1a",
    borderColor: "#22C55E55",
  },
  aiBadgeOffline: {
    backgroundColor: "#1a1200",
    borderColor: "#F59E0B55",
  },
  aiBadgeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  aiBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 1,
  },
  // SOS
  sosWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 20,
  },
  sosHint: {
    fontSize: 16,
    color: "#9BA1A6",
    fontWeight: "500",
    letterSpacing: 0.5,
  },
  ringContainer: {
    width: SOS_SIZE + 60,
    height: SOS_SIZE + 60,
    justifyContent: "center",
    alignItems: "center",
  },
  ring: {
    position: "absolute",
    width: SOS_SIZE,
    height: SOS_SIZE,
    borderRadius: SOS_SIZE / 2,
    backgroundColor: "#FF3D3D",
  },
  sosBtn: {
    width: SOS_SIZE,
    height: SOS_SIZE,
    borderRadius: SOS_SIZE / 2,
    backgroundColor: "#FF3D3D",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#FF3D3D",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 44,
    elevation: 24,
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
    color: "#4a5568",
    fontWeight: "400",
    textAlign: "center",
  },
  // Call bar
  callBar: {
    backgroundColor: "#22C55E",
    borderRadius: 16,
    paddingVertical: 20,
    alignItems: "center",
  },
  callText: {
    fontSize: 22,
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
  blackoutSOSText: { fontSize: 56, fontWeight: "900", color: "#FFF", letterSpacing: 4 },
  blackoutCall: {
    backgroundColor: "#22C55E",
    borderRadius: 14,
    paddingVertical: 20,
    paddingHorizontal: 56,
  },
  blackoutCallText: { fontSize: 26, fontWeight: "800", color: "#FFF" },
  blackoutExit: { marginTop: 8 },
  blackoutExitText: { fontSize: 13, color: "#555", textDecorationLine: "underline" },
});
