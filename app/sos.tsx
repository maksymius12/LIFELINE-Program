/**
 * SOS Screen — 911-style AI Operator Call
 *
 * The AI acts as a 911 dispatcher:
 *   1. User presses SOS → AI greets: "LIFELINE. What's your emergency?"
 *   2. User speaks → audio uploaded → Whisper transcribes → LLM responds
 *   3. AI speaks response via TTS + shows instruction on screen
 *   4. User can speak again for follow-up turns (continuous conversation)
 *   5. AI may trigger: Call 103, SMS family, show step-by-step guide
 *
 * On web or when mic is unavailable, a text input fallback is shown.
 */
import {
  Text,
  View,
  Pressable,
  StyleSheet,
  Linking,
  Animated,
  Platform,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
} from "react-native";
import { useState, useEffect, useRef, useCallback } from "react";
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
import {
  chatWithOperator,
  type ConversationMessage,
  type OperatorResponse,
} from "@/lib/ai-analysis";
import { uploadAudioUri } from "@/lib/transcription";
import { sendEmergencySMS } from "@/lib/family-sms";
import { useAppContext } from "@/lib/app-context";
import { parseAndExecute, MOCK_SCENARIOS, type EScript } from "@/lib/EScriptEngine";
import { EScriptRenderer } from "@/components/escripts/EScriptRenderer";

// ─── Types ────────────────────────────────────────────────────────────────────

type CallState = "idle" | "connecting" | "listening" | "processing" | "active";

interface DisplayMessage {
  role: "ai" | "user";
  text: string;
  instruction?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SOSScreen() {
  useKeepAwake();
  const router = useRouter();
  const { panicDetected, registerTap, animationsEnabled } = useAppContext();

  const [callState, setCallState] = useState<CallState>("idle");
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [history, setHistory] = useState<ConversationMessage[]>([]);
  const [currentInstruction, setCurrentInstruction] = useState<string>("");
  const [errorText, setErrorText] = useState<string | null>(null);
  const [micAvailable, setMicAvailable] = useState(true);
  const [textInput, setTextInput] = useState("");
  const [activeScript, setActiveScript] = useState<EScript | null>(null);
  const [showMockMenu, setShowMockMenu] = useState(false);

  const scrollRef = useRef<ScrollView>(null);

  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const waveAnims = useRef(Array.from({ length: 5 }, () => new Animated.Value(0.3))).current;
  const spinAnim = useRef(new Animated.Value(0)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);
  const waveLoop = useRef<Animated.CompositeAnimation | null>(null);
  const spinLoop = useRef<Animated.CompositeAnimation | null>(null);

  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  useAudioRecorderState(audioRecorder);

  // ── Permission setup ────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      if (Platform.OS === "web") { setMicAvailable(false); return; }
      const { granted } = await requestRecordingPermissionsAsync();
      setMicAvailable(granted);
      if (granted) {
        await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      }
    })();
  }, []);

  // ── Pulse animation (idle) ──────────────────────────────────────────────────
  useEffect(() => {
    if (!animationsEnabled) return;
    if (callState === "idle") {
      pulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.12, duration: 900, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
        ])
      );
      pulseLoop.current.start();
    } else {
      pulseLoop.current?.stop();
      pulseAnim.setValue(1);
    }
    return () => pulseLoop.current?.stop();
  }, [callState, animationsEnabled]);

  // ── Wave animation (listening) ──────────────────────────────────────────────
  useEffect(() => {
    if (callState === "listening" && animationsEnabled) {
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
  }, [callState, animationsEnabled]);

  // ── Spin animation (processing) ─────────────────────────────────────────────
  useEffect(() => {
    if (callState === "processing" && animationsEnabled) {
      spinLoop.current = Animated.loop(
        Animated.timing(spinAnim, { toValue: 1, duration: 900, useNativeDriver: true })
      );
      spinLoop.current.start();
    } else {
      spinLoop.current?.stop();
      spinAnim.setValue(0);
    }
    return () => spinLoop.current?.stop();
  }, [callState, animationsEnabled]);

  // ── Scroll to bottom when new message arrives ───────────────────────────────
  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages]);

  // ─── Start the call ──────────────────────────────────────────────────────────
  const startCall = useCallback(async () => {
    haptic.heavy();
    registerTap();
    setCallState("connecting");
    setMessages([]);
    setHistory([]);
    setCurrentInstruction("");
    setErrorText(null);

    // First turn: empty history → AI greets with "What's your emergency?"
    try {
      const response = await chatWithOperator([], undefined, undefined);
      applyResponse(response, []);
    } catch {
      setErrorText("Cannot reach AI — check connection");
      setCallState("idle");
    }
  }, []);

  // ─── Apply AI response to UI ─────────────────────────────────────────────────
  const applyResponse = useCallback(
    (response: OperatorResponse, currentHistory: ConversationMessage[]) => {
      const aiMsg: DisplayMessage = {
        role: "ai",
        text: response.spoken,
        instruction: response.instruction,
      };
      setMessages((prev) => [...prev, aiMsg]);
      setCurrentInstruction(response.instruction);

      const newHistory: ConversationMessage[] = [
        ...currentHistory,
        { role: "assistant", content: response.spoken },
      ];
      setHistory(newHistory);

      speakInstruction(response.spoken, { panicMode: panicDetected });

      if (response.severity === "critical") haptic.error();
      else haptic.success();

      // Side effects
      if (response.action === "CALL_103") {
        setTimeout(() => Linking.openURL("tel:103"), 1500);
      }
      if (response.action === "SMS_FAMILY") {
        sendEmergencySMS().catch(() => {});
      }
      if (response.action === "SHOW_STEPS" && response.steps.length > 0) {
        // Convert steps to an EScript scheme
        const schemeScript = JSON.stringify({
          voice_backup: response.spoken,
          action_type: "UI_SHOW_SCHEME",
          payload: {
            title: response.instruction,
            steps: response.steps,
            current_step: 0,
            animation_type: "slide",
          },
        });
        const parsed = parseAndExecute(schemeScript);
        if (parsed.success) {
          setActiveScript(parsed.script);
          setCallState("active");
          return;
        }
      }

      setCallState("active");
    },
    [panicDetected]
  );

  // ─── Start recording a voice reply ──────────────────────────────────────────
  const startListening = useCallback(async () => {
    if (callState !== "active") return;
    haptic.medium();
    setCallState("listening");
    stopSpeech();
    try {
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
    } catch {
      setErrorText("Mic unavailable — type your message below");
      setCallState("active");
    }
  }, [callState]);

  // ─── Stop recording and send to AI ──────────────────────────────────────────
  const stopListeningAndSend = useCallback(async () => {
    if (callState !== "listening") return;
    haptic.medium();
    setCallState("processing");
    stopSpeech();

    try {
      await audioRecorder.stop();
      const uri = audioRecorder.uri;

      // Upload audio to S3 so server can transcribe it
      const audioUrl = uri ? await uploadAudioUri(uri) : null;

      // Add placeholder user message while processing
      setMessages((prev) => [...prev, { role: "user", text: "🎤 …" }]);

      const response = await chatWithOperator(history, audioUrl ?? undefined, undefined);

      // Replace placeholder with actual transcript if available
      if (response.transcript) {
        setMessages((prev) => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          if (updated[lastIdx]?.text === "🎤 …") {
            updated[lastIdx] = { role: "user", text: response.transcript! };
          }
          return updated;
        });
      }

      const newHistory: ConversationMessage[] = [
        ...history,
        ...(response.transcript ? [{ role: "user" as const, content: response.transcript }] : []),
      ];

      applyResponse(response, newHistory);
    } catch {
      setErrorText("Failed to send — try typing below");
      setCallState("active");
    }
  }, [callState, history, applyResponse]);

  // ─── Send typed text ─────────────────────────────────────────────────────────
  const sendText = useCallback(async () => {
    const text = textInput.trim();
    if (!text || callState !== "active") return;
    setTextInput("");
    haptic.light();
    stopSpeech();
    setCallState("processing");

    const userMsg: DisplayMessage = { role: "user", text };
    setMessages((prev) => [...prev, userMsg]);

    const newHistory: ConversationMessage[] = [...history, { role: "user", content: text }];
    setHistory(newHistory);

    try {
      const response = await chatWithOperator(newHistory);
      applyResponse(response, newHistory);
    } catch {
      setErrorText("AI failed — try again");
      setCallState("active");
    }
  }, [textInput, callState, history, applyResponse]);

  // ─── EScript handlers ────────────────────────────────────────────────────────
  const handleScriptComplete = useCallback(
    async (context: string) => {
      setActiveScript(null);
      setCallState("processing");
      stopSpeech();

      const newHistory: ConversationMessage[] = [...history, { role: "user", content: context }];
      setHistory(newHistory);
      setMessages((prev) => [...prev, { role: "user", text: context }]);

      try {
        const response = await chatWithOperator(newHistory);
        applyResponse(response, newHistory);
      } catch {
        setCallState("active");
      }
    },
    [history, applyResponse]
  );

  const handleScriptDismiss = useCallback(() => {
    setActiveScript(null);
    setCallState("active");
  }, []);

  // ─── Mock demo ───────────────────────────────────────────────────────────────
  const handleMockScenario = (key: string) => {
    setShowMockMenu(false);
    haptic.medium();
    const raw = MOCK_SCENARIOS[key];
    if (!raw) return;
    const result = parseAndExecute(raw);
    if (result.success) {
      speakInstruction(result.script.voice_backup, { panicMode: panicDetected });
      setActiveScript(result.script);
      setCallState("active");
    }
  };

  const handleBack = () => {
    stopSpeech();
    audioRecorder.stop().catch(() => {});
    router.back();
  };

  // ─── Mic button press ────────────────────────────────────────────────────────
  const handleMicPress = () => {
    if (callState === "listening") stopListeningAndSend();
    else if (callState === "active") startListening();
  };

  // ─── Render: EScript active ──────────────────────────────────────────────────
  if (activeScript) {
    return (
      <EScriptRenderer
        script={activeScript}
        onComplete={handleScriptComplete}
        onDismiss={handleScriptDismiss}
      />
    );
  }

  // ─── Render: Mock menu ───────────────────────────────────────────────────────
  if (showMockMenu) {
    return (
      <ScreenContainer containerClassName="bg-background" edges={["top", "left", "right", "bottom"]}>
        <View style={styles.mockContainer}>
          <Text style={styles.mockTitle}>🧪 Demo Scenarios</Text>
          {Object.keys(MOCK_SCENARIOS).map((key) => (
            <Pressable
              key={key}
              onPress={() => handleMockScenario(key)}
              style={({ pressed }) => [styles.mockBtn, pressed && { opacity: 0.8 }]}
            >
              <Text style={styles.mockBtnText}>{MOCK_LABELS[key] ?? key}</Text>
            </Pressable>
          ))}
          <Pressable onPress={() => setShowMockMenu(false)} style={styles.mockCancel}>
            <Text style={styles.mockCancelText}>Cancel</Text>
          </Pressable>
        </View>
      </ScreenContainer>
    );
  }

  // ─── Render: Idle (before call starts) ──────────────────────────────────────
  if (callState === "idle") {
    return (
      <ScreenContainer containerClassName="bg-background" edges={["top", "left", "right", "bottom"]}>
        <View style={styles.idleContainer}>
          <View style={styles.idleHeader}>
            <Pressable onPress={handleBack} style={styles.backBtn}>
              <Text style={styles.backText}>← Back</Text>
            </Pressable>
            <Pressable onPress={() => setShowMockMenu(true)} style={styles.demoBtn}>
              <Text style={styles.demoBtnText}>Demo</Text>
            </Pressable>
          </View>

          <View style={styles.idleCenter}>
            <Text style={styles.idleTitle}>LIFELINE</Text>
            <Text style={styles.idleSubtitle}>AI Emergency Operator</Text>

            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <Pressable onPress={startCall} style={styles.startBtn}>
                <Text style={styles.startBtnLabel}>SOS</Text>
                <Text style={styles.startBtnHint}>TAP TO CONNECT</Text>
              </Pressable>
            </Animated.View>

            <Text style={styles.idleDesc}>
              AI will listen and guide you step by step
            </Text>
          </View>

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

  // ─── Render: Active call ─────────────────────────────────────────────────────
  const isListening = callState === "listening";
  const isProcessing = callState === "processing" || callState === "connecting";
  const spinInterp = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  return (
    <ScreenContainer containerClassName="bg-[#0a0f14]" edges={["top", "left", "right", "bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.callContainer}>

          {/* Call header */}
          <View style={styles.callHeader}>
            <View style={styles.callStatus}>
              <View style={[styles.callDot, { backgroundColor: isProcessing ? "#FF9500" : "#22C55E" }]} />
              <Text style={styles.callStatusText}>
                {callState === "connecting" ? "Connecting…"
                  : callState === "processing" ? "Processing…"
                  : callState === "listening" ? "Listening…"
                  : "LIFELINE Active"}
              </Text>
            </View>
            <Pressable onPress={handleBack} style={styles.endCallBtn}>
              <Text style={styles.endCallText}>End</Text>
            </Pressable>
          </View>

          {/* Current instruction — large, prominent */}
          {currentInstruction ? (
            <View style={styles.instructionCard}>
              <Text style={styles.instructionText}>{currentInstruction}</Text>
            </View>
          ) : null}

          {/* Conversation transcript */}
          <ScrollView
            ref={scrollRef}
            style={styles.transcript}
            contentContainerStyle={styles.transcriptContent}
            showsVerticalScrollIndicator={false}
          >
            {messages.map((msg, i) => (
              <View
                key={i}
                style={[
                  styles.bubble,
                  msg.role === "ai" ? styles.aiBubble : styles.userBubble,
                ]}
              >
                {msg.role === "ai" && (
                  <Text style={styles.bubbleLabel}>LIFELINE</Text>
                )}
                <Text style={[styles.bubbleText, msg.role === "user" && styles.userBubbleText]}>
                  {msg.text}
                </Text>
              </View>
            ))}
          </ScrollView>

          {/* Error */}
          {errorText && (
            <Text style={styles.errorText}>⚠ {errorText}</Text>
          )}

          {/* Mic / voice input area */}
          <View style={styles.inputArea}>
            {micAvailable ? (
              <View style={styles.micRow}>
                {/* Speak again button */}
                <Pressable
                  onPress={handleMicPress}
                  disabled={isProcessing}
                  style={[styles.micBtn, isListening && styles.micBtnActive, isProcessing && styles.micBtnDisabled]}
                >
                  {isListening ? (
                    <View style={styles.waveRow}>
                      {waveAnims.map((anim, i) => (
                        <Animated.View key={i} style={[styles.waveBar, { transform: [{ scaleY: anim }] }]} />
                      ))}
                    </View>
                  ) : isProcessing ? (
                    <Animated.View style={[styles.spinner, { transform: [{ rotate: spinInterp }] }]} />
                  ) : (
                    <Text style={styles.micIcon}>🎤</Text>
                  )}
                </Pressable>
                <Text style={styles.micHint}>
                  {isListening ? "Tap to send" : isProcessing ? "Processing…" : "Tap to speak"}
                </Text>
              </View>
            ) : (
              /* Text fallback for web or no mic */
              <View style={styles.textRow}>
                <TextInput
                  style={styles.textIn}
                  value={textInput}
                  onChangeText={setTextInput}
                  placeholder="Type your message…"
                  placeholderTextColor="#555"
                  returnKeyType="send"
                  onSubmitEditing={sendText}
                  editable={!isProcessing}
                />
                <Pressable
                  onPress={sendText}
                  disabled={isProcessing || !textInput.trim()}
                  style={({ pressed }) => [styles.sendBtn, pressed && { opacity: 0.8 }]}
                >
                  <Text style={styles.sendBtnText}>Send</Text>
                </Pressable>
              </View>
            )}

            {/* Also show text input as fallback even when mic is available */}
            {micAvailable && callState === "active" && (
              <View style={[styles.textRow, { marginTop: 8 }]}>
                <TextInput
                  style={styles.textIn}
                  value={textInput}
                  onChangeText={setTextInput}
                  placeholder="Or type your message…"
                  placeholderTextColor="#444"
                  returnKeyType="send"
                  onSubmitEditing={sendText}
                />
                <Pressable
                  onPress={sendText}
                  disabled={!textInput.trim()}
                  style={({ pressed }) => [styles.sendBtn, pressed && { opacity: 0.8 }]}
                >
                  <Text style={styles.sendBtnText}>Send</Text>
                </Pressable>
              </View>
            )}
          </View>

          {/* Call 103 */}
          <Pressable
            onPress={() => Linking.openURL("tel:103")}
            style={({ pressed }) => [styles.callBar, pressed && { opacity: 0.8 }]}
          >
            <Text style={styles.callText}>📞  Call 103</Text>
          </Pressable>

        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

// ─── Labels ───────────────────────────────────────────────────────────────────

const MOCK_LABELS: Record<string, string> = {
  poll_critical:     "🔴 Poll — Critical diagnosis",
  scheme_tourniquet: "🩹 Scheme — Tourniquet steps",
  countdown_sos:     "⏱ Countdown — SOS in 30s",
  hardware_flash:    "🔦 Hardware — SOS Flash",
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Idle ──
  idleContainer: { flex: 1, paddingHorizontal: 20, paddingTop: 6, paddingBottom: 12 },
  idleHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  idleCenter: { flex: 1, justifyContent: "center", alignItems: "center", gap: 20 },
  idleTitle: { fontSize: 36, fontWeight: "900", color: "#FFFFFF", letterSpacing: 5 },
  idleSubtitle: { fontSize: 15, color: "#9BA1A6", fontWeight: "500", letterSpacing: 0.5 },
  startBtn: {
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "#FF3D3D",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#FF3D3D",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 50,
    elevation: 24,
  },
  startBtnLabel: { fontSize: 64, fontWeight: "900", color: "#FFF", letterSpacing: 6 },
  startBtnHint: { fontSize: 11, fontWeight: "700", color: "#FFF", marginTop: 6, opacity: 0.85, letterSpacing: 2 },
  idleDesc: { fontSize: 14, color: "#687076", textAlign: "center", paddingHorizontal: 32 },

  // ── Active call ──
  callContainer: { flex: 1, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  callHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  callStatus: { flexDirection: "row", alignItems: "center", gap: 8 },
  callDot: { width: 10, height: 10, borderRadius: 5 },
  callStatusText: { fontSize: 14, fontWeight: "700", color: "#FFFFFF" },
  endCallBtn: {
    backgroundColor: "#FF3D3D",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  endCallText: { fontSize: 14, fontWeight: "800", color: "#FFF" },

  // Instruction card
  instructionCard: {
    backgroundColor: "#1a2a1a",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#22C55E40",
  },
  instructionText: {
    fontSize: 22,
    fontWeight: "800",
    color: "#22C55E",
    textAlign: "center",
    lineHeight: 30,
  },

  // Transcript
  transcript: { flex: 1 },
  transcriptContent: { gap: 10, paddingBottom: 8 },
  bubble: { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, maxWidth: "88%" },
  aiBubble: {
    backgroundColor: "#141e2a",
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#2a3a4a",
  },
  userBubble: {
    backgroundColor: "#1a2e1a",
    alignSelf: "flex-end",
    borderWidth: 1,
    borderColor: "#22C55E40",
  },
  bubbleLabel: { fontSize: 10, fontWeight: "800", color: "#4a9d9c", marginBottom: 3, letterSpacing: 1 },
  bubbleText: { fontSize: 15, color: "#D0D8E0", lineHeight: 22 },
  userBubbleText: { color: "#FFFFFF" },

  // Error
  errorText: { fontSize: 13, color: "#FF3D3D", textAlign: "center", marginVertical: 4 },

  // Input area
  inputArea: { marginTop: 8, marginBottom: 8 },
  micRow: { alignItems: "center", gap: 8 },
  micBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#1d2e3d",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#4a9d9c",
  },
  micBtnActive: { backgroundColor: "#4a9d9c", borderColor: "#4a9d9c" },
  micBtnDisabled: { opacity: 0.5 },
  micIcon: { fontSize: 30 },
  micHint: { fontSize: 12, color: "#687076", fontWeight: "600" },
  waveRow: { flexDirection: "row", alignItems: "center", gap: 4, height: 36 },
  waveBar: { width: 5, height: 28, borderRadius: 3, backgroundColor: "#FFFFFF" },
  spinner: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: "#FF9500",
    borderTopColor: "transparent",
  },
  textRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  textIn: {
    flex: 1,
    backgroundColor: "#141e2a",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#FFFFFF",
    fontSize: 15,
    borderWidth: 1,
    borderColor: "#2a3a4a",
  },
  sendBtn: {
    backgroundColor: "#4a9d9c",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sendBtnText: { fontSize: 14, fontWeight: "800", color: "#FFF" },

  // Call bar
  callBar: {
    backgroundColor: "#22C55E",
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: "center",
  },
  callText: { fontSize: 20, fontWeight: "800", color: "#FFFFFF", letterSpacing: 1 },

  // Common
  backBtn: { paddingVertical: 8, paddingRight: 8 },
  backText: { fontSize: 16, color: "#4a9d9c", fontWeight: "600" },
  demoBtn: {
    backgroundColor: "#1d2e3d",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#354656",
  },
  demoBtnText: { fontSize: 13, color: "#4a9d9c", fontWeight: "700" },

  // Mock menu
  mockContainer: { flex: 1, paddingHorizontal: 20, paddingTop: 20, gap: 12 },
  mockTitle: { fontSize: 26, fontWeight: "900", color: "#FFFFFF", marginBottom: 8 },
  mockBtn: {
    backgroundColor: "#1d2e3d",
    borderRadius: 14,
    paddingVertical: 20,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: "#354656",
  },
  mockBtnText: { fontSize: 17, fontWeight: "700", color: "#FFFFFF" },
  mockCancel: { paddingVertical: 14, alignItems: "center" },
  mockCancelText: { fontSize: 16, color: "#687076", fontWeight: "600" },
});
