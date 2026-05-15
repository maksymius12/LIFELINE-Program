import { Text, View, Pressable, StyleSheet, Linking } from "react-native";
import { useState, useEffect } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { EMERGENCY_DATA, type DisasterType } from "@/constants/emergency-data";
import { haptic } from "@/lib/haptics";
import { speakInstruction, stopSpeech } from "@/lib/speech";

const MODE_LABELS: Record<string, string> = {
  fire: "🔥 FIRE MODE — ACTIVE",
  injury: "🩸 INJURY MODE — ACTIVE",
  quake: "🌪 EARTHQUAKE MODE — ACTIVE",
  blackout: "⚡ BLACKOUT MODE — ACTIVE",
  flood: "🌊 FLOOD MODE — ACTIVE",
  toxic: "☣ TOXIC AIR MODE — ACTIVE",
};

const ALT_INSTRUCTIONS: Record<string, string[]> = {
  fire: ["Breathe through shirt.", "Crawl to nearest exit.", "Stay away from windows."],
  injury: ["Use any clean fabric.", "Keep arm elevated.", "Apply more pressure."],
  blackout: ["Close gas valve.", "Use flashlight on phone.", "Go to hallway."],
  quake: ["Get under table.", "Protect your head.", "Stay still, don't run."],
  flood: ["Go upstairs now.", "Stay off the road.", "Signal for help."],
  toxic: ["Use wet cloth as mask.", "Run against the wind.", "Stay in open air."],
};

export default function PanicScreen() {
  const { type, training } = useLocalSearchParams<{ type: string; training?: string }>();
  const router = useRouter();
  const disasterType = (type || "fire") as DisasterType;
  const scenario = EMERGENCY_DATA[disasterType];
  const steps = scenario?.steps || [];
  const totalSteps = steps.length;

  const [currentStep, setCurrentStep] = useState(0);
  const [showAlt, setShowAlt] = useState(false);
  const [completed, setCompleted] = useState(false);

  const isTraining = training === "true";

  useEffect(() => {
    if (steps[currentStep] && !completed) {
      speakInstruction(steps[currentStep].instruction);
    }
    return () => stopSpeech();
  }, [currentStep, completed]);

  const handleDone = () => {
    haptic.heavy();
    if (currentStep < totalSteps - 1) {
      setCurrentStep((prev) => prev + 1);
      setShowAlt(false);
    } else {
      setCompleted(true);
      speakInstruction("All steps completed. Stay safe.");
    }
  };

  const handleCantDoIt = () => {
    haptic.medium();
    setShowAlt(true);
    const altText = ALT_INSTRUCTIONS[disasterType]?.[currentStep] || "Try another way.";
    speakInstruction(altText);
  };

  const handleCall = () => {
    Linking.openURL("tel:103");
  };

  const handleBack = () => {
    stopSpeech();
    router.back();
  };

  if (completed) {
    return (
      <ScreenContainer containerClassName="bg-background">
        <View style={styles.container}>
          <View style={styles.completedContainer}>
            <Text style={styles.completedEmoji}>✅</Text>
            <Text style={styles.completedTitle}>ALL STEPS COMPLETED</Text>
            <Text style={styles.completedSubtitle}>
              {isTraining ? "Great practice! You're prepared." : "Stay calm. Help is available."}
            </Text>
            <Pressable
              onPress={handleBack}
              style={({ pressed }) => [
                styles.backButton,
                pressed && { opacity: 0.8 },
              ]}
            >
              <Text style={styles.backButtonText}>← Back to Home</Text>
            </Pressable>
          </View>
          <Pressable
            onPress={handleCall}
            style={({ pressed }) => [
              styles.callBar,
              pressed && { opacity: 0.8 },
            ]}
          >
            <Text style={styles.callText}>📞 Call 103</Text>
          </Pressable>
        </View>
      </ScreenContainer>
    );
  }

  const currentInstruction = steps[currentStep];
  const altInstruction = ALT_INSTRUCTIONS[disasterType]?.[currentStep];

  return (
    <ScreenContainer containerClassName="bg-background" edges={["top", "left", "right", "bottom"]}>
      <View style={styles.container}>
        {/* Red Top Bar */}
        <View style={[styles.topBar, isTraining && styles.topBarTraining]}>
          <Pressable onPress={handleBack} style={styles.backArrow}>
            <Text style={styles.backArrowText}>←</Text>
          </Pressable>
          <Text style={styles.topBarText}>
            {isTraining ? "🎯 TRAINING — " + MODE_LABELS[disasterType]?.split(" — ")[0] : MODE_LABELS[disasterType] || "EMERGENCY MODE"}
          </Text>
        </View>

        {/* Progress Dots */}
        <View style={styles.progressRow}>
          {steps.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === currentStep && styles.dotActive,
                i < currentStep && styles.dotCompleted,
              ]}
            />
          ))}
          <Text style={styles.stepLabel}>
            Step {currentStep + 1} of {totalSteps}
          </Text>
        </View>

        {/* Main Instruction Area */}
        <View style={styles.instructionArea}>
          {/* Emoji Card */}
          <View style={styles.emojiCard}>
            <Text style={styles.emoji}>{currentInstruction.emoji}</Text>
          </View>

          {/* Instruction Text */}
          <Text style={styles.instruction}>{currentInstruction.instruction}</Text>

          {/* Alternative */}
          {showAlt && altInstruction && (
            <View style={styles.altContainer}>
              <Text style={styles.altLabel}>Alternative:</Text>
              <Text style={styles.altText}>{altInstruction}</Text>
            </View>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          {/* DONE Button */}
          <Pressable
            onPress={handleDone}
            style={({ pressed }) => [
              styles.doneButton,
              pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 },
            ]}
          >
            <Text style={styles.doneText}>DONE ✓</Text>
          </Pressable>

          {/* Can't do it */}
          <Pressable
            onPress={handleCantDoIt}
            style={({ pressed }) => [
              styles.cantButton,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={styles.cantText}>Can't do it — show alternative</Text>
          </Pressable>
        </View>

        {/* AI Listening Bar */}
        <View style={styles.aiBar}>
          <Text style={styles.aiBarText}>🤖 AI listening… speak your status</Text>
        </View>

        {/* Call Bar */}
        <Pressable
          onPress={handleCall}
          style={({ pressed }) => [
            styles.callBar,
            pressed && { opacity: 0.8 },
          ]}
        >
          <Text style={styles.callText}>📞 Call 103</Text>
        </Pressable>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  topBar: {
    backgroundColor: "#FF3D3D",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  topBarTraining: {
    backgroundColor: "#0D6E6E",
  },
  backArrow: {
    marginRight: 10,
  },
  backArrowText: {
    fontSize: 20,
    color: "#FFFFFF",
    fontWeight: "700",
  },
  topBarText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 1,
    flex: 1,
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#354656",
  },
  dotActive: {
    backgroundColor: "#FF3D3D",
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  dotCompleted: {
    backgroundColor: "#22C55E",
  },
  stepLabel: {
    fontSize: 12,
    color: "#e0e0e0",
    marginLeft: "auto",
    fontWeight: "600",
  },
  instructionArea: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 10,
  },
  emojiCard: {
    backgroundColor: "#1d2e3d",
    borderRadius: 20,
    width: 120,
    height: 120,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
    borderWidth: 2,
    borderColor: "#354656",
  },
  emoji: {
    fontSize: 56,
  },
  instruction: {
    fontSize: 26,
    fontWeight: "800",
    color: "#FFFFFF",
    textAlign: "center",
    lineHeight: 34,
  },
  altContainer: {
    marginTop: 16,
    backgroundColor: "#1d2e3d",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#4a9d9c",
  },
  altLabel: {
    fontSize: 11,
    color: "#4a9d9c",
    fontWeight: "700",
    marginBottom: 4,
  },
  altText: {
    fontSize: 16,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  actions: {
    gap: 10,
    marginBottom: 10,
  },
  doneButton: {
    backgroundColor: "#FF3D3D",
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: "center",
  },
  doneText: {
    fontSize: 20,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 1,
  },
  cantButton: {
    backgroundColor: "#354656",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  cantText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#e0e0e0",
  },
  aiBar: {
    backgroundColor: "#0D6E6E",
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: "center",
    marginBottom: 8,
  },
  aiBarText: {
    fontSize: 13,
    color: "#afffff",
    fontWeight: "600",
  },
  callBar: {
    backgroundColor: "#22C55E",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  callText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  completedContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  completedEmoji: {
    fontSize: 64,
  },
  completedTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: "#22C55E",
  },
  completedSubtitle: {
    fontSize: 15,
    color: "#e0e0e0",
    textAlign: "center",
  },
  backButton: {
    backgroundColor: "#0D6E6E",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 12,
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
