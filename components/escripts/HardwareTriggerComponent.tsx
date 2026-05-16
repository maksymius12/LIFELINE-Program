/**
 * HARDWARE_TRIGGER — Visual feedback component.
 *
 * Shows the active hardware trigger status with a large visual indicator
 * and a STOP button to deactivate it.
 */
import { Text, View, Pressable, StyleSheet } from "react-native";
import { useEffect } from "react";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import type { HardwarePayload } from "@/lib/EScriptEngine";
import { executeHardwareTrigger, stopAllHardware } from "@/lib/HardwareBridge";
import { haptic } from "@/lib/haptics";
import { speakInstruction } from "@/lib/speech";

interface HardwareTriggerComponentProps {
  payload: HardwarePayload;
  voiceBackup: string;
  onStop: () => void;
}

const TRIGGER_CONFIG = {
  FLASH_SOS: {
    emoji: "🔦",
    label: "SOS FLASH",
    description: "Morse code SOS signal active",
    color: "#F59E0B",
  },
  VIBRATE_PULSE: {
    emoji: "📳",
    label: "VIBRATE PULSE",
    description: "Pulsing vibration signal active",
    color: "#4a9d9c",
  },
  AUDIO_ALARM: {
    emoji: "🔊",
    label: "AUDIO ALARM",
    description: "Emergency alarm signal active",
    color: "#FF3D3D",
  },
};

export function HardwareTriggerComponent({
  payload,
  voiceBackup,
  onStop,
}: HardwareTriggerComponentProps) {
  const { trigger, state } = payload;
  const config = TRIGGER_CONFIG[trigger];

  // Pulsing animation for active state
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(1);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  useEffect(() => {
    if (state) {
      // Start pulse animation
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.15, { duration: 500 }),
          withTiming(1, { duration: 500 })
        ),
        -1,
        false
      );
      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(0.7, { duration: 500 }),
          withTiming(1, { duration: 500 })
        ),
        -1,
        false
      );

      // Execute hardware trigger
      executeHardwareTrigger(payload);
      speakInstruction(voiceBackup);
    }

    return () => {
      stopAllHardware();
    };
  }, []);

  const handleStop = () => {
    haptic.heavy();
    stopAllHardware();
    onStop();
  };

  return (
    <View style={styles.container}>
      {/* Active indicator */}
      <View style={styles.statusRow}>
        <View style={[styles.activeDot, { backgroundColor: config.color }]} />
        <Text style={[styles.statusText, { color: config.color }]}>ACTIVE</Text>
      </View>

      {/* Animated icon */}
      <Animated.View style={[styles.iconWrap, { borderColor: config.color + "60" }, pulseStyle]}>
        <Text style={styles.icon}>{config.emoji}</Text>
      </Animated.View>

      {/* Label */}
      <Text style={[styles.label, { color: config.color }]}>{config.label}</Text>
      <Text style={styles.description}>{config.description}</Text>

      {/* Morse code visual for FLASH_SOS */}
      {trigger === "FLASH_SOS" && (
        <View style={styles.morseRow}>
          {["·", "·", "·", "—", "—", "—", "·", "·", "·"].map((sym, i) => (
            <Text key={i} style={[styles.morseSym, { color: config.color }]}>{sym}</Text>
          ))}
        </View>
      )}

      {/* STOP button */}
      <Pressable
        onPress={handleStop}
        style={({ pressed }) => [
          styles.stopBtn,
          { borderColor: config.color },
          pressed && { opacity: 0.7 },
        ]}
      >
        <Text style={[styles.stopText, { color: config.color }]}>⏹  Stop Signal</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    alignItems: "center",
    justifyContent: "space-evenly",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  activeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusText: {
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 2,
  },
  iconWrap: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0D1F2D",
  },
  icon: {
    fontSize: 72,
  },
  label: {
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: 2,
    textAlign: "center",
  },
  description: {
    fontSize: 16,
    color: "#9BA1A6",
    textAlign: "center",
    lineHeight: 22,
  },
  morseRow: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  morseSym: {
    fontSize: 22,
    fontWeight: "900",
  },
  stopBtn: {
    width: "100%",
    borderRadius: 16,
    paddingVertical: 20,
    alignItems: "center",
    borderWidth: 2,
    backgroundColor: "#0D1F2D",
  },
  stopText: {
    fontSize: 18,
    fontWeight: "800",
  },
});
