/**
 * UI_RENDER_POLL — Interactive express-diagnosis poll.
 *
 * Renders large touch buttons (min 64px) suitable for trembling hands.
 * danger_level "critical" applies neon red/emerald borders.
 * Tapping an option calls onAnswer(value) to feed back into AI context.
 */
import { Text, View, Pressable, StyleSheet } from "react-native";
import type { PollPayload } from "@/lib/EScriptEngine";
import { haptic } from "@/lib/haptics";

interface PollComponentProps {
  payload: PollPayload;
  onAnswer: (value: string) => void;
}

const DANGER_COLORS: Record<PollPayload["danger_level"], { border: string; glow: string; bg: string }> = {
  low:      { border: "#22C55E", glow: "#22C55E30", bg: "#22C55E18" },
  medium:   { border: "#F59E0B", glow: "#F59E0B30", bg: "#F59E0B18" },
  critical: { border: "#FF3D3D", glow: "#FF3D3D40", bg: "#FF3D3D18" },
};

export function PollComponent({ payload, onAnswer }: PollComponentProps) {
  const { question, options, danger_level } = payload;
  const colors = DANGER_COLORS[danger_level] ?? DANGER_COLORS.medium;

  const handlePress = (option: string) => {
    if (danger_level === "critical") {
      haptic.heavy();
    } else {
      haptic.medium();
    }
    onAnswer(option);
  };

  return (
    <View style={styles.container}>
      {/* Danger indicator */}
      {danger_level === "critical" && (
        <View style={styles.dangerBanner}>
          <Text style={styles.dangerText}>⚠ CRITICAL SITUATION</Text>
        </View>
      )}

      {/* Question */}
      <View style={[styles.questionCard, { borderColor: colors.border, backgroundColor: colors.bg }]}>
        <Text style={styles.questionText}>{question}</Text>
      </View>

      {/* Options */}
      <View style={styles.optionsContainer}>
        {options.map((option, index) => (
          <Pressable
            key={index}
            onPress={() => handlePress(option)}
            style={({ pressed }) => [
              styles.optionBtn,
              {
                borderColor: colors.border,
                backgroundColor: pressed ? colors.glow : "#0D1F2D",
                shadowColor: colors.border,
              },
              pressed && { transform: [{ scale: 0.98 }] },
            ]}
          >
            <Text style={[styles.optionText, { color: danger_level === "critical" ? "#FFFFFF" : "#E0E0E0" }]}>
              {option}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 12,
  },
  dangerBanner: {
    backgroundColor: "#FF3D3D20",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#FF3D3D",
  },
  dangerText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FF3D3D",
    letterSpacing: 2,
  },
  questionCard: {
    borderRadius: 18,
    borderWidth: 2,
    paddingHorizontal: 22,
    paddingVertical: 24,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 120,
  },
  questionText: {
    fontSize: 24,
    fontWeight: "800",
    color: "#FFFFFF",
    textAlign: "center",
    lineHeight: 34,
  },
  optionsContainer: {
    flex: 1,
    gap: 12,
    justifyContent: "center",
  },
  optionBtn: {
    borderRadius: 16,
    borderWidth: 2,
    paddingVertical: 22,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 64,
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  optionText: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 26,
  },
});
