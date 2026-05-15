import {
  Text,
  View,
  Pressable,
  StyleSheet,
  Linking,
  ActivityIndicator,
  Animated,
} from "react-native";
import { useState, useEffect, useRef } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useKeepAwake } from "expo-keep-awake";
import { ScreenContainer } from "@/components/screen-container";
import { EMERGENCY_DATA, type DisasterType } from "@/constants/emergency-data";
import { haptic } from "@/lib/haptics";
import { speakInstruction, stopSpeech } from "@/lib/speech";
import { analyzeEmergency } from "@/lib/ai-analysis";
import { useAppContext } from "@/lib/app-context";

export default function PanicScreen() {
  useKeepAwake();
  const { type, training } = useLocalSearchParams<{ type: string; training?: string }>();
  const router = useRouter();
  const { panicDetected, registerTap, animationsEnabled } = useAppContext();

  const disasterType = (type || "injury") as DisasterType;
  const scenario = EMERGENCY_DATA[disasterType] || EMERGENCY_DATA.injury;
  const steps = scenario.steps;
  const isTraining = training === "true";

  const [currentStep, setCurrentStep] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [altInstruction, setAltInstruction] = useState<string | null>(null);
  const [loadingAlt, setLoadingAlt] = useState(false);

  // Animated dot scale for active step
  const dotAnims = useRef(steps.map(() => new Animated.Value(1))).current;

  useEffect(() => {
    if (!animationsEnabled || completed) return;
    Animated.spring(dotAnims[currentStep], {
      toValue: 1.4,
      useNativeDriver: true,
      damping: 10,
    }).start();
    return () => {
      dotAnims[currentStep].setValue(1);
    };
  }, [currentStep, completed, animationsEnabled]);

  // TTS: auto-read instruction on step change
  useEffect(() => {
    if (completed) {
      speakInstruction("You did great. Stay calm. Help is on the way.", {
        panicMode: panicDetected,
      });
      return;
    }
    const text = altInstruction ?? steps[currentStep]?.instruction;
    if (text) speakInstruction(text, { panicMode: panicDetected });
    return () => stopSpeech();
  }, [currentStep, altInstruction, completed, panicDetected]);

  const handleDone = () => {
    registerTap();
    haptic.heavy();
    setAltInstruction(null);
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      setCompleted(true);
    }
  };

  const handleCantDo = async () => {
    haptic.medium();
    setLoadingAlt(true);
    const currentInstruction = altInstruction ?? steps[currentStep]?.instruction ?? "";
    try {
      const result = await analyzeEmergency(
        `User cannot do: ${currentInstruction}. What is the alternative?`
      );
      setAltInstruction(result.firstInstruction);
    } catch {
      setAltInstruction(steps[currentStep]?.alternative ?? "Call 103 for guidance.");
    } finally {
      setLoadingAlt(false);
    }
  };

  const handleCall = () => Linking.openURL("tel:103");
  const handleBack = () => { stopSpeech(); router.back(); };

  const fontSize = panicDetected ? 28 : 26;

  // ── Completion screen ──────────────────────────────────────────────────────
  if (completed) {
    return (
      <ScreenContainer
        containerClassName="bg-background"
        edges={["top", "left", "right", "bottom"]}
      >
        <View style={styles.completionContainer}>
          <View style={styles.completionCard}>
            <Text style={styles.completionEmoji}>✅</Text>
            <Text style={styles.completionTitle}>You did great.</Text>
            <Text style={styles.completionSubtitle}>Stay calm. Help is on the way.</Text>
            <Text style={styles.completionHint}>
              All {steps.length} steps completed for {scenario.title}
            </Text>
          </View>
          <Pressable
            onPress={handleCall}
            style={({ pressed }) => [styles.callBar, pressed && { opacity: 0.8 }]}
          >
            <Text style={styles.callText}>📞 Call 103</Text>
          </Pressable>
          <Pressable
            onPress={handleBack}
            style={({ pressed }) => [styles.backBarBtn, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.backBarText}>← Back to Home</Text>
          </Pressable>
        </View>
      </ScreenContainer>
    );
  }

  // ── Step screen ────────────────────────────────────────────────────────────
  return (
    <ScreenContainer
      containerClassName="bg-background"
      edges={["top", "left", "right", "bottom"]}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={handleBack} style={styles.backBtn}>
            <Text style={styles.backBtnText}>←</Text>
          </Pressable>
          <View
            style={[
              styles.typeBadge,
              {
                backgroundColor: scenario.color + "30",
                borderColor: scenario.color,
              },
            ]}
          >
            <Text style={[styles.typeBadgeText, { color: scenario.color }]}>
              {isTraining ? "🎯 TRAINING" : scenario.title}
            </Text>
          </View>
          <Text style={styles.stepCounter}>
            {currentStep + 1} / {steps.length}
          </Text>
        </View>

        {/* Progress dots */}
        <View style={styles.dotsRow}>
          {steps.map((_, i) => (
            <Animated.View
              key={i}
              style={[
                styles.dot,
                i < currentStep
                  ? styles.dotDone
                  : i === currentStep
                  ? styles.dotActive
                  : styles.dotPending,
                i === currentStep &&
                  animationsEnabled && {
                    transform: [{ scale: dotAnims[i] }],
                  },
              ]}
            />
          ))}
        </View>

        {/* Step card */}
        <View style={styles.stepCard}>
          <Text style={styles.stepEmoji}>{steps[currentStep]?.emoji}</Text>
          <Text style={[styles.stepInstruction, { fontSize, lineHeight: fontSize * 1.35 }]}>
            {altInstruction ?? steps[currentStep]?.instruction}
          </Text>
          {altInstruction && (
            <View style={styles.altBadge}>
              <Text style={styles.altBadgeText}>🔄 Alternative instruction</Text>
            </View>
          )}
        </View>

        {/* DONE */}
        <Pressable
          onPress={handleDone}
          style={({ pressed }) => [
            styles.doneBtn,
            pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 },
            panicDetected && styles.doneBtnLarge,
          ]}
        >
          <Text style={[styles.doneBtnText, panicDetected && { fontSize: 22 }]}>
            ✓ DONE
          </Text>
        </Pressable>

        {/* Can't do it */}
        <Pressable
          onPress={handleCantDo}
          disabled={loadingAlt}
          style={({ pressed }) => [styles.cantBtn, pressed && { opacity: 0.7 }]}
        >
          {loadingAlt ? (
            <ActivityIndicator size="small" color="#4a9d9c" />
          ) : (
            <Text style={styles.cantBtnText}>❓ Can't do it — show alternative</Text>
          )}
        </Pressable>

        {/* Call 103 */}
        <Pressable
          onPress={handleCall}
          style={({ pressed }) => [styles.callBar, pressed && { opacity: 0.8 }]}
        >
          <Text style={styles.callText}>📞 Call 103</Text>
        </Pressable>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  backBtn: { paddingVertical: 4, paddingRight: 8 },
  backBtnText: { fontSize: 22, color: "#4a9d9c", fontWeight: "700" },
  typeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
  },
  typeBadgeText: { fontSize: 13, fontWeight: "700" },
  stepCounter: { fontSize: 14, color: "#e0e0e0", fontWeight: "600" },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    marginBottom: 20,
  },
  dot: { width: 12, height: 12, borderRadius: 6 },
  dotDone: { backgroundColor: "#22C55E" },
  dotActive: { backgroundColor: "#FF3D3D" },
  dotPending: { backgroundColor: "#354656" },
  stepCard: {
    flex: 1,
    backgroundColor: "#1d2e3d",
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#354656",
    marginBottom: 16,
  },
  stepEmoji: { fontSize: 72, marginBottom: 20 },
  stepInstruction: { fontWeight: "800", color: "#FFFFFF", textAlign: "center" },
  altBadge: {
    marginTop: 14,
    backgroundColor: "#4a9d9c30",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "#4a9d9c",
  },
  altBadgeText: { fontSize: 12, color: "#4a9d9c", fontWeight: "600" },
  doneBtn: {
    backgroundColor: "#22C55E",
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: "center",
    marginBottom: 10,
  },
  doneBtnLarge: { paddingVertical: 22 },
  doneBtnText: { fontSize: 18, fontWeight: "900", color: "#FFFFFF", letterSpacing: 2 },
  cantBtn: {
    backgroundColor: "#1d2e3d",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#354656",
  },
  cantBtnText: { fontSize: 14, color: "#4a9d9c", fontWeight: "600" },
  callBar: {
    backgroundColor: "#FF3D3D",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  callText: { fontSize: 16, fontWeight: "700", color: "#FFFFFF" },
  // Completion
  completionContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 20,
  },
  completionCard: {
    flex: 1,
    backgroundColor: "#22C55E20",
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#22C55E",
    marginBottom: 20,
  },
  completionEmoji: { fontSize: 80, marginBottom: 20 },
  completionTitle: {
    fontSize: 32,
    fontWeight: "900",
    color: "#22C55E",
    marginBottom: 10,
  },
  completionSubtitle: {
    fontSize: 20,
    color: "#FFFFFF",
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 14,
  },
  completionHint: { fontSize: 14, color: "#e0e0e0", textAlign: "center" },
  backBarBtn: { paddingVertical: 12, alignItems: "center", marginTop: 8 },
  backBarText: { fontSize: 14, color: "#4a9d9c", fontWeight: "600" },
});
