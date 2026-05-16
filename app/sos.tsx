import {
  Text,
  View,
  Pressable,
  StyleSheet,
  Linking,
  Animated,
  Platform,
  ScrollView,
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
import {
  parseAndExecute,
  MOCK_SCENARIOS,
  type EScript,
} from "@/lib/EScriptEngine";
import { EScriptRenderer } from "@/components/escripts/EScriptRenderer";

type SOSState = "idle" | "listening" | "processing" | "response";

// Conversation message for chat fallback
interface ChatMessage {
  role: "ai" | "user";
  text: string;
}

export default function SOSScreen() {
  useKeepAwake();
  const router = useRouter();
  const { panicDetected, registerTap, animationsEnabled } = useAppContext();

  const [sosState, setSosState] = useState<SOSState>("idle");
  const [statusText, setStatusText] = useState("Press and speak");
  const [errorText, setErrorText] = useState<string | null>(null);
  const [activeScript, setActiveScript] = useState<EScript | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [showMockMenu, setShowMockMenu] = useState(false);

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

  /**
   * Core processing: sends transcript to AI, tries to parse as EScript.
   * If EScript is valid → render agentic UI.
   * If EScript fails → fall back to classic text response + navigate to Panic Mode.
   */
  const processTranscript = async (transcript: string) => {
    try {
      // Add user message to chat history
      setChatHistory((prev) => [...prev, { role: "user", text: transcript }]);

      const result = await analyzeEmergency(transcript);
      setSosState("response");

      // Try to parse AI response as an EScript
      const engineResult = parseAndExecute(JSON.stringify(result));

      if (engineResult.success) {
        // Agentic UI mode — hide chat, render EScript component
        speakInstruction(engineResult.script.voice_backup, { panicMode: panicDetected });
        setActiveScript(engineResult.script);
      } else {
        // Fallback: classic text response
        const responseText = result.spokenResponse;
        setStatusText(responseText);
        setChatHistory((prev) => [...prev, { role: "ai", text: responseText }]);
        speakInstruction(responseText, { panicMode: panicDetected });

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
      }
    } catch {
      setErrorText("AI failed — select type manually");
      setSosState("idle");
      setStatusText("Press and speak");
    }
  };

  /** Called when user completes an EScript action — feed result back to AI */
  const handleScriptComplete = (context: string) => {
    setActiveScript(null);
    setSosState("processing");
    setStatusText("Processing…");
    setChatHistory((prev) => [...prev, { role: "user", text: context }]);
    processTranscript(context);
  };

  /** Called when user dismisses the EScript UI */
  const handleScriptDismiss = () => {
    setActiveScript(null);
    setSosState("idle");
    setStatusText("Press and speak");
  };

  /** Load a mock scenario for demo purposes */
  const handleMockScenario = (key: string) => {
    setShowMockMenu(false);
    haptic.medium();
    const raw = MOCK_SCENARIOS[key];
    if (!raw) return;
    const result = parseAndExecute(raw);
    if (result.success) {
      speakInstruction(result.script.voice_backup, { panicMode: panicDetected });
      setActiveScript(result.script);
      setSosState("response");
    }
  };

  const handleBack = () => {
    stopSpeech();
    audioRecorder.stop().catch(() => {});
    router.back();
  };

  // ── If an EScript is active, render agentic UI (full screen, OLED black) ──
  if (activeScript) {
    return (
      <EScriptRenderer
        script={activeScript}
        onComplete={handleScriptComplete}
        onDismiss={handleScriptDismiss}
      />
    );
  }

  // ── Mock demo menu overlay ─────────────────────────────────────────────────
  if (showMockMenu) {
    return (
      <ScreenContainer containerClassName="bg-background" edges={["top", "left", "right", "bottom"]}>
        <View style={styles.mockMenuContainer}>
          <Text style={styles.mockMenuTitle}>🧪 Demo Mode</Text>
          <Text style={styles.mockMenuSubtitle}>Select a mock scenario to test</Text>
          {Object.keys(MOCK_SCENARIOS).map((key) => (
            <Pressable
              key={key}
              onPress={() => handleMockScenario(key)}
              style={({ pressed }) => [styles.mockBtn, pressed && { opacity: 0.8 }]}
            >
              <Text style={styles.mockBtnText}>{MOCK_LABELS[key] ?? key}</Text>
            </Pressable>
          ))}
          <Pressable onPress={() => setShowMockMenu(false)} style={styles.mockCancelBtn}>
            <Text style={styles.mockCancelText}>Cancel</Text>
          </Pressable>
        </View>
      </ScreenContainer>
    );
  }

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

        {/* Header: back + title + demo button */}
        <View style={styles.header}>
          <Pressable onPress={handleBack} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </Pressable>
          <Text style={styles.title}>VOICE SOS</Text>
          <Pressable onPress={() => setShowMockMenu(true)} style={styles.demoBtn}>
            <Text style={styles.demoBtnText}>Demo</Text>
          </Pressable>
        </View>

        {/* Central circle */}
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

        {/* Status */}
        <Text style={[styles.status, panicDetected && styles.statusLarge]}>
          {statusText}
        </Text>

        {/* Error */}
        {errorText && <Text style={styles.error}>⚠ {errorText}</Text>}

        {/* Chat history — shows previous AI/user exchanges */}
        {chatHistory.length > 0 && (
          <ScrollView
            style={styles.chatScroll}
            contentContainerStyle={styles.chatContent}
            showsVerticalScrollIndicator={false}
          >
            {chatHistory.map((msg, i) => (
              <View
                key={i}
                style={[
                  styles.chatBubble,
                  msg.role === "ai" ? styles.aiBubble : styles.userBubble,
                ]}
              >
                <Text style={[styles.chatText, msg.role === "user" && styles.userText]}>
                  {msg.text}
                </Text>
              </View>
            ))}
          </ScrollView>
        )}

        <View style={{ flex: 1 }} />

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

const MOCK_LABELS: Record<string, string> = {
  poll_critical:     "🔴 Poll — Critical diagnosis",
  scheme_tourniquet: "🩹 Scheme — Tourniquet steps",
  countdown_sos:     "⏱ Countdown — SOS in 30s",
  hardware_flash:    "🔦 Hardware — SOS Flash",
};

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
  demoBtn: {
    backgroundColor: "#1d2e3d",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#354656",
    minWidth: 60,
    alignItems: "center",
  },
  demoBtnText: { fontSize: 13, color: "#4a9d9c", fontWeight: "700" },
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
  chatScroll: {
    maxHeight: 160,
    marginTop: 12,
  },
  chatContent: { gap: 8, paddingBottom: 4 },
  chatBubble: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: "90%",
  },
  aiBubble: {
    backgroundColor: "#1d2e3d",
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#354656",
  },
  userBubble: {
    backgroundColor: "#4a9d9c20",
    alignSelf: "flex-end",
    borderWidth: 1,
    borderColor: "#4a9d9c60",
  },
  chatText: {
    fontSize: 14,
    color: "#E0E0E0",
    lineHeight: 20,
  },
  userText: { color: "#FFFFFF" },
  callBar: {
    backgroundColor: "#22C55E",
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: "center",
  },
  callText: { fontSize: 20, fontWeight: "800", color: "#FFFFFF", letterSpacing: 1 },
  // Mock menu
  mockMenuContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    gap: 12,
  },
  mockMenuTitle: { fontSize: 26, fontWeight: "900", color: "#FFFFFF", marginBottom: 4 },
  mockMenuSubtitle: { fontSize: 15, color: "#9BA1A6", marginBottom: 8 },
  mockBtn: {
    backgroundColor: "#1d2e3d",
    borderRadius: 14,
    paddingVertical: 20,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: "#354656",
  },
  mockBtnText: { fontSize: 17, fontWeight: "700", color: "#FFFFFF" },
  mockCancelBtn: { paddingVertical: 14, alignItems: "center" },
  mockCancelText: { fontSize: 16, color: "#687076", fontWeight: "600" },
});
