import {
  Text,
  View,
  Pressable,
  StyleSheet,
  Linking,
  ActivityIndicator,
  Animated,
  ScrollView,
} from "react-native";
import { useState, useEffect, useRef, useCallback } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useKeepAwake } from "expo-keep-awake";
import { ScreenContainer } from "@/components/screen-container";
import { EMERGENCY_DATA, type DisasterType } from "@/constants/emergency-data";
import { haptic } from "@/lib/haptics";
import { speakInstruction, stopSpeech } from "@/lib/speech";
import { analyzeEmergency } from "@/lib/ai-analysis";
import { useAppContext } from "@/lib/app-context";
import { EmergencyMap, type Coords } from "@/components/EmergencyMap";
import { sendEmergencySMS } from "@/lib/family-sms";
import { trpc } from "@/lib/trpc";

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

  // Map / evacuation state
  const [userCoords, setUserCoords] = useState<Coords | null>(null);
  const [aiRoute, setAiRoute] = useState<Coords[] | null>(null);
  const [aiRouteInstruction, setAiRouteInstruction] = useState<string | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(false);

  const dotAnims = useRef(steps.map(() => new Animated.Value(1))).current;

  const evacuationMutation = trpc.emergency.evacuation.useMutation();

  // ── Dot animation ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!animationsEnabled || completed) return;
    Animated.spring(dotAnims[currentStep], {
      toValue: 1.5,
      useNativeDriver: true,
      damping: 10,
    }).start();
    return () => { dotAnims[currentStep].setValue(1); };
  }, [currentStep, completed, animationsEnabled]);

  // ── TTS on step change ─────────────────────────────────────────────────────
  useEffect(() => {
    if (completed) {
      speakInstruction("You did great. Stay calm.", { panicMode: panicDetected });
      return;
    }
    const text = altInstruction ?? steps[currentStep]?.instruction;
    if (text) speakInstruction(text, { panicMode: panicDetected });
    return () => stopSpeech();
  }, [currentStep, altInstruction, completed, panicDetected]);

  // ── Request evacuation route once GPS is ready ─────────────────────────────
  const handleMapReady = useCallback(async (coords: Coords) => {
    setUserCoords(coords);
    setLoadingRoute(true);
    try {
      const result = await evacuationMutation.mutateAsync({
        latitude: coords.latitude,
        longitude: coords.longitude,
        emergencyType: disasterType,
      });
      if (result.waypoints && result.waypoints.length > 0) {
        setAiRoute(result.waypoints);
        setAiRouteInstruction(result.instruction);
        // Speak the evacuation direction
        speakInstruction(result.instruction, { panicMode: panicDetected });
        // Include route in SMS
        const mapsLink = `https://maps.google.com/?q=${result.waypoints[result.waypoints.length - 1].latitude},${result.waypoints[result.waypoints.length - 1].longitude}`;
        sendEmergencySMS(
          `LIFELINE ALERT: ${scenario.title} emergency. Evacuation route: ${result.instruction}. Destination: ${mapsLink}`
        ).catch(() => {});
      }
    } catch {
      // silently fail — map still shows user position
    } finally {
      setLoadingRoute(false);
    }
  }, [disasterType, panicDetected, scenario.title]);

  // ── Step handlers ──────────────────────────────────────────────────────────
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

  // ── Completion screen ──────────────────────────────────────────────────────
  if (completed) {
    return (
      <ScreenContainer containerClassName="bg-background" edges={["top", "left", "right", "bottom"]}>
        <View style={styles.completionWrap}>
          <Text style={styles.completionEmoji}>✅</Text>
          <Text style={styles.completionTitle}>You did great.</Text>
          <Text style={styles.completionSub}>Stay calm. Help is on the way.</Text>
          {userCoords && (
            <EmergencyMap
              emergencyType={disasterType}
              aiRoute={aiRoute}
              aiInstruction={aiRouteInstruction}
            />
          )}
          <Pressable
            onPress={handleCall}
            style={({ pressed }) => [styles.callBar, pressed && { opacity: 0.8 }]}
          >
            <Text style={styles.callText}>📞  Call 103</Text>
          </Pressable>
          <Pressable onPress={handleBack} style={styles.backLink}>
            <Text style={styles.backLinkText}>← Back to Home</Text>
          </Pressable>
        </View>
      </ScreenContainer>
    );
  }

  // ── Step screen ────────────────────────────────────────────────────────────
  const instructionFontSize = panicDetected ? 30 : 26;

  return (
    <ScreenContainer containerClassName="bg-background" edges={["top", "left", "right", "bottom"]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Minimal header: back + type label */}
        <View style={styles.header}>
          <Pressable onPress={handleBack} style={styles.backBtn}>
            <Text style={styles.backBtnText}>←</Text>
          </Pressable>
          <Text style={[styles.typeLabel, { color: scenario.color }]}>
            {isTraining ? "🎯 TRAINING" : scenario.title}
          </Text>
          <Text style={styles.stepNum}>{currentStep + 1}/{steps.length}</Text>
        </View>

        {/* Progress dots */}
        <View style={styles.dotsRow}>
          {steps.map((_, i) => (
            <Animated.View
              key={i}
              style={[
                styles.dot,
                i < currentStep ? styles.dotDone
                  : i === currentStep ? styles.dotActive
                  : styles.dotPending,
                i === currentStep && animationsEnabled && { transform: [{ scale: dotAnims[i] }] },
              ]}
            />
          ))}
        </View>

        {/* Emergency Map */}
        <EmergencyMap
          emergencyType={disasterType}
          aiRoute={aiRoute}
          aiInstruction={
            loadingRoute
              ? "Getting evacuation route…"
              : aiRouteInstruction
          }
          onMapReady={handleMapReady}
        />

        {/* Instruction card */}
        <View style={styles.card}>
          <Text style={styles.emoji}>{steps[currentStep]?.emoji}</Text>
          <Text style={[styles.instruction, { fontSize: instructionFontSize, lineHeight: instructionFontSize * 1.35 }]}>
            {altInstruction ?? steps[currentStep]?.instruction}
          </Text>
          {altInstruction && (
            <Text style={styles.altLabel}>🔄 Alternative</Text>
          )}
        </View>

        {/* DONE — giant, full-width */}
        <Pressable
          onPress={handleDone}
          style={({ pressed }) => [
            styles.doneBtn,
            pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 },
          ]}
        >
          <Text style={styles.doneBtnText}>✓  DONE</Text>
        </Pressable>

        {/* Can't do it */}
        <Pressable
          onPress={handleCantDo}
          disabled={loadingAlt}
          style={({ pressed }) => [styles.cantBtn, pressed && { opacity: 0.7 }]}
        >
          {loadingAlt
            ? <ActivityIndicator size="small" color="#4a9d9c" />
            : <Text style={styles.cantBtnText}>Can't do it</Text>
          }
        </Pressable>

        {/* Call 103 */}
        <Pressable
          onPress={handleCall}
          style={({ pressed }) => [styles.callBar, pressed && { opacity: 0.8 }]}
        >
          <Text style={styles.callText}>📞  Call 103</Text>
        </Pressable>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 20 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  backBtn: { paddingVertical: 6, paddingRight: 10, minWidth: 36 },
  backBtnText: { fontSize: 24, color: "#4a9d9c", fontWeight: "700" },
  typeLabel: { fontSize: 15, fontWeight: "800", letterSpacing: 0.5 },
  stepNum: { fontSize: 15, color: "#e0e0e0", fontWeight: "700", minWidth: 36, textAlign: "right" },
  dotsRow: { flexDirection: "row", justifyContent: "center", gap: 10, marginBottom: 4 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  dotDone: { backgroundColor: "#22C55E" },
  dotActive: { backgroundColor: "#FF3D3D" },
  dotPending: { backgroundColor: "#354656" },
  card: {
    backgroundColor: "#1d2e3d",
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 28,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#354656",
    marginBottom: 12,
    marginTop: 4,
    minHeight: 180,
  },
  emoji: { fontSize: 64, marginBottom: 16 },
  instruction: { fontWeight: "800", color: "#FFFFFF", textAlign: "center" },
  altLabel: { marginTop: 12, fontSize: 13, color: "#4a9d9c", fontWeight: "700" },
  doneBtn: {
    backgroundColor: "#22C55E",
    borderRadius: 16,
    paddingVertical: 22,
    alignItems: "center",
    marginBottom: 10,
  },
  doneBtnText: { fontSize: 22, fontWeight: "900", color: "#FFFFFF", letterSpacing: 2 },
  cantBtn: {
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 10,
  },
  cantBtnText: { fontSize: 15, color: "#4a9d9c", fontWeight: "600" },
  callBar: {
    backgroundColor: "#22C55E",
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: "center",
  },
  callText: { fontSize: 20, fontWeight: "800", color: "#FFFFFF", letterSpacing: 1 },
  // Completion
  completionWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingBottom: 20,
    gap: 16,
  },
  completionEmoji: { fontSize: 80 },
  completionTitle: { fontSize: 36, fontWeight: "900", color: "#22C55E", textAlign: "center" },
  completionSub: { fontSize: 18, color: "#e0e0e0", textAlign: "center", lineHeight: 26 },
  backLink: { paddingVertical: 10 },
  backLinkText: { fontSize: 15, color: "#4a9d9c", fontWeight: "600" },
});
