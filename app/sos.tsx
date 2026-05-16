/**
 * SOS Screen — Fully Voice-Driven 911-style AI Operator
 *
 * VOICE-ONLY MODE:
 *   1. Screen opens → AI immediately greets: "LIFELINE. What's your emergency?"
 *   2. After AI speaks, recording starts AUTOMATICALLY (no tap needed)
 *   3. User speaks → 4-second silence detection → auto-sends to AI
 *   4. AI responds via TTS → auto-starts listening again
 *   5. Continuous loop until user says "end call" or taps End
 *
 * Voice commands work at any point:
 *   "call 103" → dials emergency
 *   "end call" / "back" → exits
 *   "repeat" → replays last AI message
 *
 * Text input is available as a fallback (web / no mic).
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
import { matchVoiceCommand } from "@/lib/voice-commands";

// ─── Types ────────────────────────────────────────────────────────────────────

type CallState = "idle" | "connecting" | "listening" | "processing" | "active" | "speaking";

interface DisplayMessage {
  role: "ai" | "user";
  text: string;
  instruction?: string;
}

// Silence detection: stop recording after N ms of no new audio chunks
const SILENCE_TIMEOUT_MS = 3500;

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
  const [lastAiText, setLastAiText] = useState<string>("");
  const [voiceHint, setVoiceHint] = useState<string>("Tap SOS to connect");

  const scrollRef = useRef<ScrollView>(null);
  const silenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const historyRef = useRef<ConversationMessage[]>([]);
  historyRef.current = history;

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

  // ── Cleanup silence timer on unmount ───────────────────────────────────────
  useEffect(() => {
    return () => {
      if (silenceTimer.current) clearTimeout(silenceTimer.current);
    };
  }, []);

  // ─── Auto-start listening after AI speaks ────────────────────────────────────
  const autoStartListening = useCallback(async () => {
    if (!micAvailable) return;
    setCallState("listening");
    setVoiceHint("Listening… speak now");
    try {
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      // Auto-stop after silence timeout
      if (silenceTimer.current) clearTimeout(silenceTimer.current);
      silenceTimer.current = setTimeout(() => {
        stopListeningAndSend();
      }, SILENCE_TIMEOUT_MS);
    } catch {
      setCallState("active");
      setVoiceHint("Tap mic to speak");
    }
  }, [micAvailable]);

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
      setLastAiText(response.spoken);

      const newHistory: ConversationMessage[] = [
        ...currentHistory,
        { role: "assistant", content: response.spoken },
      ];
      setHistory(newHistory);

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
          // Speak then auto-listen
          speakInstruction(response.spoken, { panicMode: panicDetected });
          return;
        }
      }

      setCallState("speaking");
      setVoiceHint("AI is speaking…");
      // Speak, then auto-start listening
      speakInstruction(response.spoken, {
        panicMode: panicDetected,
        onDone: () => {
          setCallState("active");
          // Small delay then auto-listen
          setTimeout(() => autoStartListening(), 600);
        },
      });
    },
    [panicDetected, autoStartListening]
  );

  // ─── Start the call ──────────────────────────────────────────────────────────
  const startCall = useCallback(async () => {
    haptic.heavy();
    registerTap();
    setCallState("connecting");
    setMessages([]);
    setHistory([]);
    setCurrentInstruction("");
    setErrorText(null);
    setVoiceHint("Connecting…");

    try {
      const response = await chatWithOperator([], undefined, undefined);
      applyResponse(response, []);
    } catch {
      setErrorText("Cannot reach AI — check connection");
      setCallState("idle");
    }
  }, [applyResponse]);

  // ─── Stop recording and send to AI ──────────────────────────────────────────
  const stopListeningAndSend = useCallback(async () => {
    if (silenceTimer.current) {
      clearTimeout(silenceTimer.current);
      silenceTimer.current = null;
    }
    // Guard: only proceed if we're actually listening
    setCallState((prev) => {
      if (prev !== "listening") return prev;
      return "processing";
    });

    stopSpeech();
    setVoiceHint("Processing…");

    try {
      await audioRecorder.stop();
      const uri = audioRecorder.uri;
      const audioUrl = uri ? await uploadAudioUri(uri) : null;

      setMessages((prev) => [...prev, { role: "user", text: "🎤 …" }]);

      const currentHistory = historyRef.current;
      const response = await chatWithOperator(currentHistory, audioUrl ?? undefined, undefined);

      // Check for voice command to end call
      if (response.transcript) {
        const cmd = matchVoiceCommand(response.transcript);
        if (cmd === "back") {
          handleBack();
          return;
        }
        if (cmd === "call") {
          Linking.openURL("tel:103");
          return;
        }
        if (cmd === "repeat" && lastAiText) {
          speakInstruction(lastAiText, { panicMode: panicDetected });
          setCallState("speaking");
          setTimeout(() => autoStartListening(), 600);
          return;
        }
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
        ...currentHistory,
        ...(response.transcript ? [{ role: "user" as const, content: response.transcript }] : []),
      ];

      applyResponse(response, newHistory);
    } catch {
      setErrorText("Failed to process voice — try again");
      setCallState("active");
      setVoiceHint("Tap mic to speak");
    }
  }, [lastAiText, panicDetected, applyResponse, autoStartListening]);

  // ─── Manual mic button (tap to start/stop) ──────────────────────────────────
  const handleMicPress = useCallback(() => {
    if (callState === "listening") {
      if (silenceTimer.current) {
        clearTimeout(silenceTimer.current);
        silenceTimer.current = null;
      }
      stopListeningAndSend();
    } else if (callState === "active" || callState === "speaking") {
      stopSpeech();
      autoStartListening();
    }
  }, [callState, stopListeningAndSend, autoStartListening]);

  // ─── Send typed text ─────────────────────────────────────────────────────────
  const sendText = useCallback(async () => {
    const text = textInput.trim();
    if (!text || (callState !== "active" && callState !== "speaking")) return;
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
    setTimeout(() => autoStartListening(), 400);
  }, [autoStartListening]);

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

  const handleBack = useCallback(() => {
    stopSpeech();
    if (silenceTimer.current) clearTimeout(silenceTimer.current);
    audioRecorder.stop().catch(() => {});
    router.back();
  }, []);

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

            <View style={styles.voiceOnlyBadge}>
              <Text style={styles.voiceOnlyIcon}>🎙</Text>
              <Text style={styles.voiceOnlyText}>Voice-only — no tapping needed</Text>
            </View>

            <Text style={styles.idleDesc}>
              AI listens automatically after every response
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
  const isSpeaking = callState === "speaking";
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
              <View style={[
                styles.callDot,
                { backgroundColor: isProcessing ? "#FF9500" : isListening ? "#4a9d9c" : isSpeaking ? "#22C55E" : "#22C55E" }
              ]} />
              <Text style={styles.callStatusText}>
                {callState === "connecting" ? "Connecting…"
                  : callState === "processing" ? "Processing…"
                  : callState === "listening" ? "🎙 Listening…"
                  : callState === "speaking" ? "🔊 AI Speaking…"
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

          {/* Voice status + mic button */}
          <View style={styles.inputArea}>
            {micAvailable ? (
              <View style={styles.micRow}>
                {/* Large mic button — tap to interrupt or manually trigger */}
                <Pressable
                  onPress={handleMicPress}
                  disabled={isProcessing}
                  style={[
                    styles.micBtn,
                    isListening && styles.micBtnListening,
                    isSpeaking && styles.micBtnSpeaking,
                    isProcessing && styles.micBtnDisabled,
                  ]}
                >
                  {isListening ? (
                    <View style={styles.waveRow}>
                      {waveAnims.map((anim, i) => (
                        <Animated.View key={i} style={[styles.waveBar, { transform: [{ scaleY: anim }] }]} />
                      ))}
                    </View>
                  ) : isProcessing ? (
                    <Animated.View style={[styles.spinner, { transform: [{ rotate: spinInterp }] }]} />
                  ) : isSpeaking ? (
                    <Text style={styles.micIcon}>🔊</Text>
                  ) : (
                    <Text style={styles.micIcon}>🎤</Text>
                  )}
                </Pressable>
                <Text style={styles.voiceHintText}>{voiceHint}</Text>
                <Text style={styles.voiceAutoNote}>
                  {isListening
                    ? "Auto-sends after 3.5s silence • tap to send now"
                    : isSpeaking
                    ? "Tap to interrupt AI and speak"
                    : isProcessing
                    ? ""
                    : "Tap mic to speak • auto-listens after AI responds"}
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

            {/* Text fallback even when mic is available */}
            {micAvailable && (callState === "active" || callState === "speaking") && (
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
  voiceOnlyBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#0D6E6E30",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: "#4a9d9c60",
  },
  voiceOnlyIcon: { fontSize: 16 },
  voiceOnlyText: { fontSize: 13, color: "#4a9d9c", fontWeight: "700" },
  idleDesc: { fontSize: 13, color: "#687076", textAlign: "center", paddingHorizontal: 32 },

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

  // Input area — voice-driven
  inputArea: { marginTop: 8, marginBottom: 8 },
  micRow: { alignItems: "center", gap: 6 },
  micBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#1d2e3d",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#4a9d9c",
  },
  micBtnListening: { backgroundColor: "#4a9d9c", borderColor: "#4a9d9c" },
  micBtnSpeaking: { backgroundColor: "#22C55E30", borderColor: "#22C55E" },
  micBtnDisabled: { opacity: 0.5 },
  micIcon: { fontSize: 32 },
  voiceHintText: { fontSize: 15, color: "#FFFFFF", fontWeight: "700" },
  voiceAutoNote: { fontSize: 11, color: "#687076", textAlign: "center", paddingHorizontal: 20 },
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
  mockCancelText: { fontSize: 15, color: "#687076" },
});
