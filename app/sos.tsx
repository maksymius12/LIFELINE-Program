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
  const recorderState = useAudioRecorderState(audioRecorder);

  // Pulse animation for idle state
  useEffect(() => {
    if (!animationsEnabled) return;
    if (sosState === "idle") {
      pulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.12,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 900,
            useNativeDriver: true,
          }),
        ])
      );
      pulseLoop.current.start();
    } else {
      pulseLoop.current?.stop();
      pulseAnim.setValue(1);
    }
    return () => pulseLoop.current?.stop();
  }, [sosState, animationsEnabled]);

  // Wave animation for listening state
  useEffect(() => {
    if (sosState === "listening" && animationsEnabled) {
      waveLoop.current = Animated.loop(
        Animated.parallel(
          waveAnims.map((anim, i) =>
            Animated.sequence([
              Animated.delay(i * 80),
              Animated.loop(
                Animated.sequence([
                  Animated.timing(anim, {
                    toValue: 0.3 + Math.random() * 0.7,
                    duration: 200 + Math.random() * 200,
                    useNativeDriver: true,
                  }),
                  Animated.timing(anim, {
                    toValue: 0.3,
                    duration: 200 + Math.random() * 200,
                    useNativeDriver: true,
                  }),
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

  // Spin animation for processing state
  useEffect(() => {
    if (sosState === "processing" && animationsEnabled) {
      spinLoop.current = Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        })
      );
      spinLoop.current.start();
    } else {
      spinLoop.current?.stop();
      spinAnim.setValue(0);
    }
    return () => spinLoop.current?.stop();
  }, [sosState, animationsEnabled]);

  // Request mic permission on mount
  useEffect(() => {
    (async () => {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        setErrorText("Microphone permission denied. Voice AI unavailable.");
      }
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
    })();
  }, []);

  const handleSOSPress = async () => {
    registerTap();
    if (sosState === "idle") {
      await startListening();
    } else if (sosState === "listening") {
      await stopListening();
    }
  };

  const startListening = async () => {
    haptic.heavy();
    setSosState("listening");
    setStatusText("Listening… tell me what happened");
    setErrorText(null);
    speakInstruction("Tell me what happened", { panicMode: panicDetected });
    try {
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
    } catch {
      setErrorText("Could not start recording. Check microphone permission.");
      setSosState("idle");
      setStatusText("Press and speak");
    }
  };

  const stopListening = async () => {
    haptic.medium();
    setSosState("processing");
    setStatusText("AI is understanding your situation…");
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
        } catch {
          // Transcription failed — use generic phrase
        }
      }
      await processTranscript(transcript);
    } catch {
      setErrorText("Recording failed. Using manual mode.");
      setSosState("idle");
      setStatusText("Press and speak");
    }
  };

  const processTranscript = async (transcript: string) => {
    try {
      const result = await analyzeEmergency(transcript);

      setSosState("response");
      setStatusText(result.spokenResponse);

      // A) TTS reads spokenResponse immediately and loudly
      speakInstruction(result.spokenResponse, { panicMode: panicDetected });

      // C) Heavy haptic for critical severity
      if (result.severity === "critical") {
        haptic.error();
      } else {
        haptic.success();
      }

      // Execute D, E simultaneously
      const actions: Promise<unknown>[] = [];

      // D) SMS to family with GPS
      if (result.shouldSMSFamily) {
        actions.push(sendEmergencySMS());
      }

      // E) Call 103
      if (result.shouldCall103) {
        actions.push(Linking.openURL("tel:103"));
      }

      await Promise.allSettled(actions);

      // B) Navigate to correct panic screen
      const targetType =
        result.emergencyType !== "unknown" ? result.emergencyType : "injury";
      setTimeout(() => {
        stopSpeech();
        router.push(`/panic?type=${targetType}`);
      }, 2500);
    } catch {
      setErrorText("AI analysis failed. Please select emergency type manually.");
      setSosState("idle");
      setStatusText("Press and speak");
    }
  };

  const handleCall = () => {
    Linking.openURL("tel:103");
  };

  const handleBack = () => {
    stopSpeech();
    audioRecorder.stop().catch(() => {});
    router.back();
  };

  const circleColor =
    sosState === "listening"
      ? "#4a9d9c"
      : sosState === "processing"
      ? "#FF3D3D"
      : sosState === "response"
      ? "#22C55E"
      : "#FF3D3D";

  const spinInterpolate = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const fontSize = panicDetected ? 24 : 20;
  const btnScale = panicDetected ? 1.2 : 1;

  return (
    <ScreenContainer
      containerClassName="bg-background"
      edges={["top", "left", "right", "bottom"]}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          {sosState === "idle" && (
            <Pressable onPress={handleBack} style={styles.backBtn}>
              <Text style={styles.backBtnText}>← Back</Text>
            </Pressable>
          )}
          <Text style={styles.title}>VOICE SOS</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>● AI READY</Text>
          </View>
        </View>

        {/* Main SOS Circle */}
        <View style={styles.circleContainer}>
          {/* Pulse ring (idle) */}
          {sosState === "idle" && animationsEnabled && (
            <Animated.View
              style={[
                styles.pulseRing,
                {
                  backgroundColor: circleColor + "30",
                  transform: [{ scale: pulseAnim }],
                },
              ]}
            />
          )}

          {/* Spin ring (processing) */}
          {sosState === "processing" && animationsEnabled && (
            <Animated.View
              style={[
                styles.spinRing,
                { transform: [{ rotate: spinInterpolate }] },
              ]}
            />
          )}

          <Pressable
            onPress={handleSOSPress}
            disabled={sosState === "processing" || sosState === "response"}
            style={[
              styles.sosCircle,
              { backgroundColor: circleColor, transform: [{ scale: btnScale }] },
            ]}
          >
            {sosState === "listening" ? (
              <View style={styles.waveContainer}>
                {waveAnims.map((anim, i) => (
                  <Animated.View
                    key={i}
                    style={[
                      styles.waveBar,
                      { transform: [{ scaleY: anim }] },
                    ]}
                  />
                ))}
              </View>
            ) : sosState === "processing" ? (
              <Text style={styles.sosIcon}>⏳</Text>
            ) : sosState === "response" ? (
              <Text style={styles.sosIcon}>✅</Text>
            ) : (
              <>
                <Text style={styles.sosLabel}>SOS</Text>
                <Text style={styles.sosSubLabel}>PRESS & SPEAK</Text>
              </>
            )}
          </Pressable>
        </View>

        {/* Status Text */}
        <Text style={[styles.statusText, { fontSize }]}>{statusText}</Text>

        {/* Error */}
        {errorText && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>⚠ {errorText}</Text>
          </View>
        )}

        {/* Panic detected banner */}
        {panicDetected && (
          <View style={styles.panicBanner}>
            <Text style={styles.panicText}>
              🫁 Panic detected — UI enlarged. Breathe slowly.
            </Text>
          </View>
        )}

        {/* State info cards */}
        {sosState === "idle" && !panicDetected && (
          <View style={styles.infoCard}>
            <Text style={styles.infoText}>
              Press the SOS button and describe your emergency. AI will analyze and guide you.
            </Text>
          </View>
        )}
        {sosState === "listening" && (
          <View style={styles.listeningCard}>
            <Text style={styles.listeningText}>🎙 Recording your voice…</Text>
            <Text style={styles.listeningHint}>Tap the circle again when done speaking</Text>
          </View>
        )}
        {sosState === "processing" && (
          <View style={styles.processingCard}>
            <Text style={styles.processingText}>🤖 Analyzing emergency situation…</Text>
            <Text style={styles.processingHint}>Identifying type • Severity • Actions</Text>
          </View>
        )}
        {sosState === "response" && (
          <View style={styles.responseCard}>
            <Text style={styles.responseTitle}>AI Response Ready</Text>
            <Text style={styles.responseHint}>Navigating to emergency guide…</Text>
          </View>
        )}

        {/* AI bar */}
        <View style={styles.aiBar}>
          <Text style={styles.aiBarText}>🤖 Gemma AI • Offline capable</Text>
        </View>

        {/* Call 103 */}
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
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  backBtn: { paddingVertical: 4, paddingRight: 8 },
  backBtnText: { fontSize: 15, color: "#4a9d9c", fontWeight: "600" },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 2,
  },
  badge: {
    backgroundColor: "#0D6E6E",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: { color: "#afffff", fontSize: 11, fontWeight: "700" },
  circleContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    minHeight: 200,
  },
  pulseRing: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
  },
  spinRing: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 3,
    borderColor: "#FF3D3D",
    borderTopColor: "transparent",
  },
  sosCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#FF3D3D",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 12,
  },
  sosLabel: {
    fontSize: 38,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 3,
  },
  sosIcon: { fontSize: 48 },
  sosSubLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FFFFFF",
    marginTop: 4,
    opacity: 0.9,
  },
  waveContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    height: 60,
  },
  waveBar: {
    width: 6,
    height: 50,
    backgroundColor: "#afffff",
    borderRadius: 3,
  },
  statusText: {
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 12,
    lineHeight: 30,
    paddingHorizontal: 10,
  },
  errorContainer: {
    backgroundColor: "#FF3D3D20",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#FF3D3D",
    marginBottom: 10,
  },
  errorText: { fontSize: 13, color: "#FF3D3D", textAlign: "center", fontWeight: "600" },
  panicBanner: {
    backgroundColor: "#FF3D3D20",
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "#FF3D3D",
    marginBottom: 10,
  },
  panicText: { fontSize: 13, color: "#FF3D3D", textAlign: "center", fontWeight: "600" },
  infoCard: {
    backgroundColor: "#1d2e3d",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#354656",
  },
  infoText: { fontSize: 14, color: "#e0e0e0", textAlign: "center", lineHeight: 20 },
  listeningCard: {
    backgroundColor: "#0D6E6E30",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#0D6E6E",
    alignItems: "center",
  },
  listeningText: { fontSize: 16, color: "#afffff", fontWeight: "700", marginBottom: 4 },
  listeningHint: { fontSize: 12, color: "#e0e0e0" },
  processingCard: {
    backgroundColor: "#1d2e3d",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#354656",
    alignItems: "center",
  },
  processingText: { fontSize: 15, color: "#FFFFFF", fontWeight: "700", marginBottom: 4 },
  processingHint: { fontSize: 12, color: "#4a9d9c" },
  responseCard: {
    backgroundColor: "#22C55E20",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#22C55E",
    alignItems: "center",
  },
  responseTitle: { fontSize: 14, color: "#22C55E", fontWeight: "700", marginBottom: 4 },
  responseHint: { fontSize: 12, color: "#e0e0e0" },
  aiBar: {
    backgroundColor: "#0D6E6E",
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: "center",
    marginBottom: 8,
  },
  aiBarText: { fontSize: 13, color: "#afffff", fontWeight: "600" },
  callBar: {
    backgroundColor: "#22C55E",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  callText: { fontSize: 16, fontWeight: "700", color: "#FFFFFF" },
});
