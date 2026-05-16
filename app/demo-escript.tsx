/**
 * DemoEScriptScreen
 *
 * Full-screen agentic UI for hackathon demo.
 * Bypasses live AI — directly renders hardcoded E-Script payload.
 *
 * Layout:
 *   - OLED black background
 *   - Protocol badge (e.g. "● FIRE PROTOCOL")
 *   - 3 MASSIVE high-contrast action buttons with neon borders
 *   - Screen flash animation on mount (simulates voice synthesis trigger)
 *   - Haptic feedback on load and on each button press
 *   - "Call 103" bar always visible at bottom
 */
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  Linking,
  Platform,
} from "react-native";
import { useEffect, useRef, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useKeepAwake } from "expo-keep-awake";
import { ScreenContainer } from "@/components/screen-container";
import { haptic } from "@/lib/haptics";
import { speakInstruction, stopSpeech } from "@/lib/speech";
import { DEMO_SCRIPTS, type DemoScript } from "@/lib/demo-scripts";

export default function DemoEScriptScreen() {
  useKeepAwake();
  const router = useRouter();
  const { type } = useLocalSearchParams<{ type: string }>();

  const script: DemoScript = DEMO_SCRIPTS[type ?? "fire"] ?? DEMO_SCRIPTS.fire;

  const [checkedActions, setCheckedActions] = useState<boolean[]>([false, false, false]);
  const [allDone, setAllDone] = useState(false);

  // Flash animation — simulates voice synthesis trigger
  const flashAnim = useRef(new Animated.Value(0)).current;
  // Pulse animation for unchecked buttons
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Screen flash on mount
    if (script.voice_synthesis_trigger === "active") {
      Animated.sequence([
        Animated.timing(flashAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
        Animated.timing(flashAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(flashAnim, { toValue: 0.6, duration: 100, useNativeDriver: true }),
        Animated.timing(flashAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }

    // Haptic burst on load
    haptic.error();
    setTimeout(() => haptic.heavy(), 200);

    // Speak voice text
    speakInstruction(script.voiceText, { panicMode: true });

    // Pulse loop for action buttons
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.015, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();

    return () => {
      loop.stop();
      stopSpeech();
    };
  }, []);

  const handleActionPress = (index: number) => {
    haptic.heavy();
    const next = [...checkedActions];
    next[index] = !next[index];
    setCheckedActions(next);
    if (next.every(Boolean)) {
      setAllDone(true);
      haptic.success();
      speakInstruction("All steps completed. Stay safe. Call 103 if you need further help.", {});
    }
  };

  const handleBack = () => {
    stopSpeech();
    router.back();
  };

  const flashColor = flashAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(0,0,0,0)", `${script.color}55`],
  });

  return (
    <ScreenContainer containerClassName="bg-[#000000]" edges={["top", "left", "right", "bottom"]}>
      {/* Flash overlay */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFillObject, { backgroundColor: flashColor, zIndex: 10 }]}
      />

      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={handleBack} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </Pressable>
          <View style={[styles.badge, { borderColor: script.color + "80", backgroundColor: script.color + "18" }]}>
            <Text style={[styles.badgeText, { color: script.color }]}>
              ● {script.title}
            </Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.emojiLarge}>{script.emoji}</Text>
          </View>
        </View>

        {/* Cognitive state indicator */}
        <View style={styles.stateRow}>
          <View style={[styles.stateDot, { backgroundColor: script.color }]} />
          <Text style={styles.stateText}>
            {script.cognitive_state === "panic_detected"
              ? "PANIC DETECTED — AGENTIC MODE ACTIVE"
              : "ALERT MODE — AGENTIC MODE ACTIVE"}
          </Text>
        </View>

        {/* E-Script label */}
        <Text style={styles.escriptLabel}>E-SCRIPT ENGINE  ·  layout_format: agentic_binary_oversized</Text>

        {/* 3 GIANT ACTION BUTTONS */}
        <View style={styles.actionsContainer}>
          {script.actions.map((action, i) => {
            const done = checkedActions[i];
            return (
              <Animated.View
                key={i}
                style={[
                  { transform: [{ scale: done ? 1 : pulseAnim }] },
                ]}
              >
                <Pressable
                  onPress={() => handleActionPress(i)}
                  style={({ pressed }) => [
                    styles.actionBtn,
                    {
                      borderColor: done ? "#22C55E" : script.color,
                      backgroundColor: done ? "#0D2A1A" : script.color + "12",
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <View style={styles.actionBtnInner}>
                    <View style={[styles.actionIndex, { backgroundColor: done ? "#22C55E" : script.color }]}>
                      <Text style={styles.actionIndexText}>{done ? "✓" : String(i + 1)}</Text>
                    </View>
                    <Text style={[styles.actionText, done && styles.actionTextDone]}>
                      {action}
                    </Text>
                  </View>
                </Pressable>
              </Animated.View>
            );
          })}
        </View>

        {/* Completion banner */}
        {allDone && (
          <View style={styles.doneBanner}>
            <Text style={styles.doneBannerText}>✅ ALL STEPS COMPLETE — STAY SAFE</Text>
          </View>
        )}

        {/* JSON payload preview — shows E-Script engine is working */}
        <View style={styles.jsonPreview}>
          <Text style={styles.jsonLabel}>E-SCRIPT PAYLOAD</Text>
          <Text style={styles.jsonText} numberOfLines={3}>
            {`{ "cognitive_state": "${script.cognitive_state}", "layout_format": "${script.layout_format}", "voice_synthesis_trigger": "${script.voice_synthesis_trigger}", "actions": [${script.actions.length}] }`}
          </Text>
        </View>

        {/* Call 103 */}
        <Pressable
          onPress={() => Linking.openURL("tel:103")}
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
    paddingBottom: 12,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  backBtn: { paddingVertical: 8, paddingRight: 8 },
  backText: { fontSize: 15, color: "#4a9d9c", fontWeight: "600" },
  badge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    flex: 1,
    marginHorizontal: 8,
    alignItems: "center",
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  headerRight: { width: 36, alignItems: "center" },
  emojiLarge: { fontSize: 26 },

  // State row
  stateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  stateDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stateText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#FF3D3D",
    letterSpacing: 1,
  },

  // E-Script label
  escriptLabel: {
    fontSize: 9,
    color: "#354656",
    fontWeight: "600",
    letterSpacing: 0.5,
    marginBottom: 14,
  },

  // Action buttons
  actionsContainer: {
    flex: 1,
    gap: 12,
    justifyContent: "center",
  },
  actionBtn: {
    borderRadius: 18,
    borderWidth: 2,
    paddingVertical: 22,
    paddingHorizontal: 20,
  },
  actionBtnInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  actionIndex: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  actionIndexText: {
    fontSize: 18,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  actionText: {
    flex: 1,
    fontSize: 20,
    fontWeight: "800",
    color: "#FFFFFF",
    lineHeight: 28,
  },
  actionTextDone: {
    color: "#22C55E",
    textDecorationLine: "line-through",
    opacity: 0.8,
  },

  // Done banner
  doneBanner: {
    backgroundColor: "#0D2A1A",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#22C55E",
    marginBottom: 10,
  },
  doneBannerText: {
    fontSize: 14,
    fontWeight: "900",
    color: "#22C55E",
    letterSpacing: 1,
  },

  // JSON preview
  jsonPreview: {
    backgroundColor: "#0a0f14",
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#1d2e3d",
  },
  jsonLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: "#354656",
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  jsonText: {
    fontSize: 10,
    color: "#4a9d9c",
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
    lineHeight: 15,
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
});
