/**
 * UI_SHOW_SCHEME — Step-by-step algorithm visualizer.
 *
 * Renders a simplified card with numbered steps (e.g. first aid, tourniquet).
 * Large BACK and NEXT buttons allow step navigation.
 * Animated step transitions via react-native-reanimated (fade / slide / pulse).
 */
import { Text, View, Pressable, StyleSheet } from "react-native";
import { useState, useEffect } from "react";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  Easing,
} from "react-native-reanimated";
import type { SchemePayload } from "@/lib/EScriptEngine";
import { haptic } from "@/lib/haptics";
import { speakInstruction, stopSpeech } from "@/lib/speech";

interface SchemeComponentProps {
  payload: SchemePayload;
  onComplete: () => void;
}

export function SchemeComponent({ payload, onComplete }: SchemeComponentProps) {
  const { title, steps, animation_type } = payload;
  const [currentStep, setCurrentStep] = useState(payload.current_step ?? 0);

  // Animation values
  const opacity = useSharedValue(1);
  const translateX = useSharedValue(0);
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: translateX.value },
      { scale: scale.value },
    ],
  }));

  // Speak step on mount and on step change
  useEffect(() => {
    const step = steps[currentStep];
    if (step) {
      speakInstruction(`Step ${currentStep + 1}. ${step}`);
    }
    return () => stopSpeech();
  }, [currentStep]);

  const animateTransition = (direction: "forward" | "back", callback: () => void) => {
    const dist = direction === "forward" ? -30 : 30;

    if (animation_type === "slide") {
      opacity.value = withTiming(0, { duration: 150 }, () => {
        translateX.value = dist;
        callback();
        translateX.value = withTiming(0, { duration: 200, easing: Easing.out(Easing.quad) });
        opacity.value = withTiming(1, { duration: 200 });
      });
    } else if (animation_type === "pulse") {
      scale.value = withSequence(
        withTiming(0.95, { duration: 100 }),
        withTiming(1, { duration: 150 })
      );
      callback();
    } else {
      // fade (default)
      opacity.value = withTiming(0, { duration: 150 }, () => {
        callback();
        opacity.value = withTiming(1, { duration: 200 });
      });
    }
  };

  const handleNext = () => {
    haptic.medium();
    if (currentStep < steps.length - 1) {
      animateTransition("forward", () => {
        setCurrentStep((prev) => prev + 1);
      });
    } else {
      haptic.success();
      onComplete();
    }
  };

  const handleBack = () => {
    haptic.light();
    if (currentStep > 0) {
      animateTransition("back", () => {
        setCurrentStep((prev) => prev - 1);
      });
    }
  };

  const isLast = currentStep === steps.length - 1;
  const isFirst = currentStep === 0;

  return (
    <View style={styles.container}>
      {/* Title */}
      <Text style={styles.title}>{title}</Text>

      {/* Progress dots */}
      <View style={styles.dotsRow}>
        {steps.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i < currentStep ? styles.dotDone
                : i === currentStep ? styles.dotActive
                : styles.dotPending,
            ]}
          />
        ))}
      </View>

      {/* Step card — animated */}
      <Animated.View style={[styles.stepCard, animatedStyle]}>
        <View style={styles.stepNumBadge}>
          <Text style={styles.stepNumText}>{currentStep + 1} / {steps.length}</Text>
        </View>
        <Text style={styles.stepText}>{steps[currentStep]}</Text>
      </Animated.View>

      {/* Navigation buttons */}
      <View style={styles.navRow}>
        <Pressable
          onPress={handleBack}
          disabled={isFirst}
          style={({ pressed }) => [
            styles.navBtn,
            styles.backBtn,
            isFirst && styles.navBtnDisabled,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text style={[styles.navBtnText, isFirst && styles.navBtnTextDisabled]}>← Back</Text>
        </Pressable>

        <Pressable
          onPress={handleNext}
          style={({ pressed }) => [
            styles.navBtn,
            isLast ? styles.doneBtn : styles.nextBtn,
            pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 },
          ]}
        >
          <Text style={styles.navBtnText}>
            {isLast ? "✓ Done" : "Next →"}
          </Text>
        </Pressable>
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
  title: {
    fontSize: 22,
    fontWeight: "900",
    color: "#FFFFFF",
    textAlign: "center",
    letterSpacing: 0.5,
  },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotDone: { backgroundColor: "#22C55E" },
  dotActive: { backgroundColor: "#4a9d9c" },
  dotPending: { backgroundColor: "#354656" },
  stepCard: {
    flex: 1,
    backgroundColor: "#0D1F2D",
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#4a9d9c",
    paddingHorizontal: 24,
    paddingVertical: 28,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  stepNumBadge: {
    backgroundColor: "#4a9d9c20",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#4a9d9c",
  },
  stepNumText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#4a9d9c",
    letterSpacing: 1,
  },
  stepText: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
    lineHeight: 32,
  },
  navRow: {
    flexDirection: "row",
    gap: 12,
  },
  navBtn: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 20,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 64,
  },
  backBtn: {
    backgroundColor: "#1d2e3d",
    borderWidth: 1,
    borderColor: "#354656",
  },
  nextBtn: {
    backgroundColor: "#4a9d9c",
  },
  doneBtn: {
    backgroundColor: "#22C55E",
  },
  navBtnDisabled: {
    opacity: 0.3,
  },
  navBtnText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  navBtnTextDisabled: {
    color: "#687076",
  },
});
