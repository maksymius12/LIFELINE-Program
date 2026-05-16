import {
  Text,
  View,
  Pressable,
  StyleSheet,
  Linking,
  Animated,
  Platform,
} from "react-native";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "expo-router";
import { useKeepAwake } from "expo-keep-awake";
import {
  useAudioRecorder,
  useAudioRecorderState,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from "expo-audio";
import { ScreenContainer } from "@/components/screen-container";
import { haptic } from "@/lib/haptics";
import { speakInstruction, stopSpeech } from "@/lib/speech";
import { analyzeEmergency } from "@/lib/ai-analysis";
import { sendEmergencySMS } from "@/lib/family-sms";
import { useAppContext } from "@/lib/app-context";

type SOSState = "idle" | "listening" | "processing" | "response";

export default function SOSScreen() {
  useKeepAwake();
  const router = useRouter();
  const { panicDetected, registerTap, animationsEnabled } = useAppContext();

  const [sosState, setSosState] = useState<SOSState>("idle");
  const [statusText, setStatusText] = useState("Press and speak");
  const [errorText, setErrorText] = useState<string | null>(null);

  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);
  const spinAnim = useRef(new Animated.Value(0)).current;
  const spinLoop = useRef<Animated.CompositeAnimation | null>(null);
  const waveAnims = useRef(
    Array.from({ length: 5 }, () => new Animated.Value(0.3))
  ).current;
  const waveLoop = useRef<Animated.CompositeAnimation | null>(null);

  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  useAudioRecorderState(audioRecorder);

  useEffect(() => {
    if (!animationsEnabled) return;
    if (sosState === "idle") {
      pulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.14, duration: 900, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
        ])
      );
      pulseLoop.current.start();
    } else {
      pulseLoop.current?.stop();
      pulseAnim.setValue(1);
    }
    return () => pulseLoop.current?.stop();
  }, [sosState, animationsEnabled]);

  useEffect(() => {
    if (sosState === "listening" && animationsEnabled) {
      waveLoop.current = Animated.loop(
        Animated.parallel(
          waveAnims.map((anim, i) =>
            Animated.sequence([
              Animated.delay(i * 80),
              Animated.loop(
                Animated.sequence([
                  Animated.timing(anim, { toValue: 0.3 + Math.random() * 0.7, duration: 200 + Math.random() * 200, useNativeDriver: true }),
                  Animated.timing(anim, { toValue: 0.3, duration: 200 + Math.random() * 200, useNativeDriver: true }),
                ])
              ),
            ])
          )
        )
      );
      waveLoop.current.start();
    } else {
      waveLoop.current?.stop();
      waveAnims.forEach((a) => a.setValue(0.3));
    }
    return () => waveLoop.current?.stop();
  }, [sosState, animationsEnabled]);

  useEffect(() => {
    if (sosState === "processing" && animationsEnabled) {
      spinLoop.current = Animated.loop(
        Animated.timing(spinAnim, { toValue: 1, duration: 1000, useNativeDriver: true })
      );
      spinLoop.current.start();
    } else {
      spinLoop.current?.stop();
      spinAnim.setValue(0);
    }
    return () => spinLoop.current?.stop();
  }, [sosState, animationsEnabled]);

  useEffect(() => {
    (async () => {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) setErrorText("Mic denied — voice unavailable");
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
    })();
  }, []);

  const handleSOSPress = async () => {
    registerTap();
    if (sosState === "idle") await startListening();
    else if (sosState === "listening") await stopListening();
  };

  const startListening = async () => {
    haptic.heavy();
    setSosState("listening");
    setStatusText("Speak now");
    setErrorText(null);
    speakInstruction("Tell me what happened", { panicMode: panicDetected });
    try {
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
    } catch {
      setErrorText("Cannot record — check mic permission");
      setSosState("idle");
      setStatusText("Press and speak");
    }
  };

  const stopListening = async () => {
    haptic.medium();
    setSosState("processing");
    setStatusText("Analyzing…");
    stopSpeech();
    try {
      await audioRecorder.stop();
      const uri = audioRecorder.uri;
      let transcript = "emergency help needed";
      if (uri && Platform.OS !== "web") {
        try {
          const { exec } = require("child_process");
          const { promisify } = require("util");
          const execAsync = promisify(exec);
          const { stdout } = await execAsync(`manus-speech-to-text "${uri}"`);
          transcript = stdout.trim() || transcript;
        } catch { /* use fallback */ }
      }
      await processTranscript(transcript);
    } catch {
      setErrorText("Recording failed — select type manually");
      setSosState("idle");
      setStatusText("Press and speak");
    }
  };

  const processTranscript = async (transcript: string) => {
    try {
      const result = await analyzeEmergency(transcript);
      setSosState("response");
      setStatusText(result.spokenResponse);
      speakInstruction(result.spokenResponse, { panicMode: panicDetected });
      if (result.severity === "critical") haptic.error();
      else haptic.success();

      const actions: Promise<unknown>[] = [];
      if (result.shouldSMSFamily) actions.push(sendEmergencySMS());
      if (result.shouldCall103) actions.push(Linking.openURL("tel:103"));
      await Promise.allSettled(actions);

      const targetType = result.emergencyType !== "unknown" ? result.emergencyType : "injury";
      setTimeout(() => {
        stopSpeech();
        router.push(`/panic?type=${targetType}`);
      }, 2500);
    } catch {
      setErrorText("AI failed — select type manually");
      setSosState("idle");
      setStatusText("Press and speak");
    }
  };

  const handleBack = () => {
    stopSpeech();
    audioRecorder.stop().catch(() => {});
    router.back();
  };

  const circleColor =
    sosState === "listening" ? "#4a9d9c"
    : sosState === "processing" ? "#FF9500"
    : sosState === "response" ? "#22C55E"
    : "#FF3D3D";

  const spinInterpolate = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <ScreenContainer containerClassName="bg-background" edges={["top", "left", "right", "bottom"]}>
      <View style={styles.container}>

        {/* Minimal header: back + title only */}
        <View style={styles.header}>
          <Pressable onPress={handleBack} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </Pressable>
          <Text style={styles.title}>VOICE SOS</Text>
          <View style={{ width: 60 }} />
        </View>

        {/* Central circle — dominant */}
        <View style={styles.circleWrap}>
          {sosState === "idle" && animationsEnabled && (
            <Animated.View
              style={[styles.pulseRing, { backgroundColor: circleColor + "28", transform: [{ scale: pulseAnim }] }]}
            />
          )}
          {sosState === "processing" && animationsEnabled && (
            <Animated.View style={[styles.spinRing, { transform: [{ rotate: spinInterpolate }] }]} />
          )}
          <Pressable
            onPress={handleSOSPress}
            disabled={sosState === "processing" || sosState === "response"}
            style={[styles.circle, { backgroundColor: circleColor }]}
          >
            {sosState === "listening" ? (
              <View style={styles.waveRow}>
                {waveAnims.map((anim, i) => (
                  <Animated.View key={i} style={[styles.waveBar, { transform: [{ scaleY: anim }] }]} />
                ))}
              </View>
            ) : sosState === "processing" ? (
              <Text style={styles.circleIcon}>⏳</Text>
            ) : sosState === "response" ? (
              <Text style={styles.circleIcon}>✅</Text>
            ) : (
              <>
                <Text style={styles.circleLabel}>SOS</Text>
                <Text style={styles.circleHint}>PRESS & SPEAK</Text>
              </>
            )}
          </Pressable>
        </View>

        {/* Status — large, readable */}
        <Text style={[styles.status, panicDetected && styles.statusLarge]}>
          {statusText}
        </Text>

        {/* Error — only if present */}
        {errorText && (
          <Text style={styles.error}>⚠ {errorText}</Text>
        )}

        {/* Spacer */}
        <View style={{ flex: 1 }} />

        {/* Call 103 — always at bottom */}
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
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 6, paddingBottom: 12 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  backBtn: { paddingVertical: 8, paddingRight: 8, minWidth: 60 },
  backText: { fontSize: 16, color: "#4a9d9c", fontWeight: "600" },
  title: { fontSize: 20, fontWeight: "800", color: "#FFFFFF", letterSpacing: 2 },
  circleWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    minHeight: 220,
  },
  pulseRing: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
  },
  spinRing: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 4,
    borderColor: "#FF9500",
    borderTopColor: "transparent",
  },
  circle: {
    width: 180,
    height: 180,
    borderRadius: 90,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#FF3D3D",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 28,
    elevation: 14,
  },
  circleLabel: { fontSize: 44, fontWeight: "900", color: "#FFF", letterSpacing: 4 },
  circleHint: { fontSize: 10, fontWeight: "700", color: "#FFF", marginTop: 4, opacity: 0.85 },
  circleIcon: { fontSize: 52 },
  waveRow: { flexDirection: "row", alignItems: "center", gap: 6, height: 64 },
  waveBar: { width: 7, height: 52, borderRadius: 4, backgroundColor: "#FFFFFF" },
  status: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
    paddingHorizontal: 16,
    lineHeight: 28,
    marginTop: 8,
  },
  statusLarge: { fontSize: 26, lineHeight: 34 },
  error: {
    fontSize: 14,
    color: "#FF3D3D",
    textAlign: "center",
    marginTop: 8,
    paddingHorizontal: 16,
  },
  callBar: {
    backgroundColor: "#22C55E",
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: "center",
  },
  callText: { fontSize: 20, fontWeight: "800", color: "#FFFFFF", letterSpacing: 1 },
});
