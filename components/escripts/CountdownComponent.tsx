/**
 * COUNTER_TIMEOUT — Emergency action countdown timer.
 *
 * Displays a large digital countdown. When it reaches 0, fires
 * onExpire(on_expire_action) so the parent can handle the action
 * (e.g. "SEND_SOS_PACKET"). The user can cancel at any time.
 */
import { Text, View, Pressable, StyleSheet } from "react-native";
import { useState, useEffect, useRef } from "react";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import type { CountdownPayload } from "@/lib/EScriptEngine";
import { haptic } from "@/lib/haptics";
import { speakInstruction, stopSpeech } from "@/lib/speech";
import { useKeepAwake } from "expo-keep-awake";

interface CountdownComponentProps {
  payload: CountdownPayload;
  onExpire: (action: string) => void;
  onCancel: () => void;
}

export function CountdownComponent({ payload, onExpire, onCancel }: CountdownComponentProps) {
  useKeepAwake();
  const { message, duration_seconds, on_expire_action } = payload;
  const [seconds, setSeconds] = useState(duration_seconds);
  const [expired, setExpired] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Pulse animation for last 5 seconds
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  useEffect(() => {
    speakInstruction(message);
    timerRef.current = setInterval(() => {
      setSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      stopSpeech();
    };
  }, []);

  // Trigger expire when seconds hits 0
  useEffect(() => {
    if (seconds === 0 && !expired) {
      setExpired(true);
      haptic.error();
      onExpire(on_expire_action);
    }
  }, [seconds, expired]);

  // Pulse + haptic for last 5 seconds
  useEffect(() => {
    if (seconds <= 5 && seconds > 0) {
      haptic.warning();
      scale.value = withSequence(
        withTiming(1.08, { duration: 200 }),
        withTiming(1, { duration: 200 })
      );
    }
  }, [seconds]);

  const handleCancel = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    stopSpeech();
    haptic.medium();
    onCancel();
  };

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0
      ? `${m}:${sec.toString().padStart(2, "0")}`
      : `${sec}`;
  };

  const isUrgent = seconds <= 10;
  const timerColor = expired ? "#22C55E" : isUrgent ? "#FF3D3D" : "#FFFFFF";

  return (
    <View style={styles.container}>
      {/* Message */}
      <View style={styles.messageCard}>
        <Text style={styles.messageText}>{message}</Text>
      </View>

      {/* Timer */}
      <View style={styles.timerWrap}>
        <Animated.Text style={[styles.timerText, { color: timerColor }, animatedStyle]}>
          {expired ? "✓" : fmt(seconds)}
        </Animated.Text>
        {isUrgent && !expired && (
          <Text style={styles.urgentLabel}>SECONDS REMAINING</Text>
        )}
        {expired && (
          <Text style={styles.expiredLabel}>ACTION TRIGGERED</Text>
        )}
      </View>

      {/* Action label */}
      <View style={styles.actionBadge}>
        <Text style={styles.actionLabel}>ON EXPIRE:</Text>
        <Text style={styles.actionText}>{on_expire_action.replace(/_/g, " ")}</Text>
      </View>

      {/* Cancel button — always visible */}
      {!expired && (
        <Pressable
          onPress={handleCancel}
          style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.cancelText}>✕  Cancel</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    alignItems: "center",
    justifyContent: "space-between",
  },
  messageCard: {
    width: "100%",
    backgroundColor: "#1d2e3d",
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderWidth: 1,
    borderColor: "#354656",
  },
  messageText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
    lineHeight: 26,
  },
  timerWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  timerText: {
    fontSize: 120,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
    lineHeight: 130,
  },
  urgentLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FF3D3D",
    letterSpacing: 2,
  },
  expiredLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#22C55E",
    letterSpacing: 2,
  },
  actionBadge: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    backgroundColor: "#0D1F2D",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#354656",
    marginBottom: 12,
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#4a9d9c",
    letterSpacing: 1,
  },
  actionText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  cancelBtn: {
    width: "100%",
    backgroundColor: "#1d2e3d",
    borderRadius: 16,
    paddingVertical: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#FF3D3D",
  },
  cancelText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FF3D3D",
  },
});
