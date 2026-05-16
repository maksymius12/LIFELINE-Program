/**
 * SOS ACTIVE EMERGENCY SCREEN — Voice-Only, Expo Go compatible
 *
 * Voice loop:
 *   1. Auto-starts on mount → AI greets
 *   2. Auto-starts recording after AI speaks
 *   3. Silence (3.5s) → stop recording
 *   4. Gemini transcribes audio (base64) → analyzes → responds
 *   5. expo-speech reads response aloud
 *   6. Loop back to step 2
 *
 * Voice commands: "done" / "repeat" / "call" / "stop"
 *
 * NO text inputs. NO chat bubbles. NO keyboard.
 */
import {
  Text,
  View,
  Pressable,
  StyleSheet,
  Linking,
  Animated,
  Platform,
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
import * as Speech from "expo-speech";
import * as Location from "expo-location";
import { ScreenContainer } from "@/components/screen-container";
import { haptic } from "@/lib/haptics";
import {
  analyzeEmergencyWithGemini,
  transcribeWithGemini,
  type GeminiEmergencyResponse,
} from "@/lib/gemini";
import { sendEmergencySMS } from "@/lib/family-sms";
import { useAppContext } from "@/lib/app-context";
import { EmergencyMap } from "@/components/EmergencyMap";
import type { ConversationMessage } from "@/lib/ai-analysis";

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = "idle" | "connecting" | "listening" | "processing" | "speaking";
interface Coords { latitude: number; longitude: number; }

// ─── TTS helper ───────────────────────────────────────────────────────────────

function speak(text: string, onDone?: () => void) {
  Speech.stop();
  Speech.speak(text, {
    language: "en-US",
    pitch: 1.0,
    rate: 0.85,
    volume: 1.0,
    onDone,
    onStopped: onDone,
    onError: onDone,
  });
}

// ─── Voice command detection ──────────────────────────────────────────────────

function detectCommand(text: string): "done" | "repeat" | "call" | "stop" | null {
  const t = text.toLowerCase();
  if (/\b(done|готово|ok|okay|next|далі|finished)\b/.test(t)) return "done";
  if (/\b(repeat|повтори|again|ще раз)\b/.test(t)) return "repeat";
  if (/\b(call|виклик|103|emergency services)\b/.test(t)) return "call";
  if (/\b(stop|home|назад|back|cancel|end|quit)\b/.test(t)) return "stop";
  return null;
}

const SILENCE_MS = 3500;

// ─── Component ────────────────────────────────────────────────────────────────

export default function SOSScreen() {
  useKeepAwake();
  const router = useRouter();
  const { panicDetected } = useAppContext();

  const [phase, setPhase] = useState<Phase>("idle");
  const [instruction, setInstruction] = useState("Connecting…");
  const [lastInstruction, setLastInstruction] = useState("");
  const [lastSpoken, setLastSpoken] = useState("");
  const [coords, setCoords] = useState<Coords | null>(null);
  const [aiRoute, setAiRoute] = useState<Coords[] | undefined>(undefined);
  const [micAvailable, setMicAvailable] = useState(true);
  const [history, setHistory] = useState<ConversationMessage[]>([]);
  const historyRef = useRef<ConversationMessage[]>([]);
  historyRef.current = history;

  const silenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  useAudioRecorderState(audioRecorder);

  // Listening pulse animation
  const listenPulse = useRef(new Animated.Value(0.5)).current;
  const listenLoop = useRef<Animated.CompositeAnimation | null>(null);

  // ── Animations ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase === "listening") {
      listenLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(listenPulse, { toValue: 1, duration: 500, useNativeDriver: true }),
          Animated.timing(listenPulse, { toValue: 0.4, duration: 500, useNativeDriver: true }),
        ])
      );
      listenLoop.current.start();
    } else {
      listenLoop.current?.stop();
      listenPulse.setValue(0.5);
    }
    return () => listenLoop.current?.stop();
  }, [phase]);

  // ── Setup ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      if (Platform.OS !== "web") {
        const { granted } = await requestRecordingPermissionsAsync();
        setMicAvailable(granted);
        if (granted) {
          await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
        }
      } else {
        setMicAvailable(false);
      }

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          setCoords({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        }
      } catch {}
    })();

    return () => {
      Speech.stop();
      if (silenceTimer.current) clearTimeout(silenceTimer.current);
    };
  }, []);

  // ── Auto-start on mount ───────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => startCall(), 700);
    return () => clearTimeout(t);
  }, []);

  // ── Start listening ───────────────────────────────────────────────────────────
  const startListening = useCallback(async () => {
    if (!micAvailable) return;
    setPhase("listening");
    try {
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      if (silenceTimer.current) clearTimeout(silenceTimer.current);
      silenceTimer.current = setTimeout(() => stopAndSend(), SILENCE_MS);
    } catch {
      setPhase("speaking");
    }
  }, [micAvailable]);

  // ── Apply AI response ─────────────────────────────────────────────────────────
  const applyResponse = useCallback(
    (result: GeminiEmergencyResponse, transcript: string, currentHistory: ConversationMessage[]) => {
      const instr = result.firstInstruction;
      const spoken = result.spokenResponse;

      setInstruction(instr);
      setLastInstruction(instr);
      setLastSpoken(spoken);

      const newHistory: ConversationMessage[] = [
        ...currentHistory,
        { role: "assistant", content: spoken },
      ];
      setHistory(newHistory);

      if (result.severity === "critical") haptic.error();
      else haptic.success();

      if (result.shouldCall103) {
        setTimeout(() => Linking.openURL("tel:103"), 2000);
      }
      if (result.shouldSMSFamily) {
        sendEmergencySMS().catch(() => {});
      }

      // Show a simple route indicator on map if we have coords
      if (result.evacuationDirection && coords) {
        const routePoint = {
          latitude: coords.latitude + 0.002,
          longitude: coords.longitude,
        };
        setAiRoute([coords, routePoint]);
      }

      setPhase("speaking");
      speak(spoken, () => {
        setPhase("listening");
        setTimeout(() => startListening(), 400);
      });
    },
    [coords, startListening]
  );

  // ── Start the call ────────────────────────────────────────────────────────────
  const startCall = useCallback(async () => {
    haptic.heavy();
    setPhase("connecting");
    setInstruction("Connecting…");

    const greeting = "LIFELINE active. Tell me what happened.";
    setInstruction("Tell me what happened");
    setLastSpoken(greeting);

    const initHistory: ConversationMessage[] = [
      { role: "assistant", content: greeting },
    ];
    setHistory(initHistory);

    setPhase("speaking");
    speak(greeting, () => {
      setPhase("listening");
      setTimeout(() => startListening(), 400);
    });
  }, [startListening]);

  // ── Stop recording and send to Gemini ─────────────────────────────────────────
  const stopAndSend = useCallback(async () => {
    if (silenceTimer.current) { clearTimeout(silenceTimer.current); silenceTimer.current = null; }
    setPhase("processing");
    setInstruction("Processing…");
    Speech.stop();

    try {
      await audioRecorder.stop();
      const uri = audioRecorder.uri;

      // Transcribe with Gemini
      let transcript = "";
      if (uri && Platform.OS !== "web") {
        transcript = await transcribeWithGemini(uri);
      }

      if (!transcript || transcript.trim().length === 0) {
        setPhase("speaking");
        speak("I didn't catch that. Please speak again.", () => {
          setPhase("listening");
          setTimeout(() => startListening(), 400);
        });
        return;
      }

      // Voice command check
      const cmd = detectCommand(transcript);
      if (cmd === "stop") { handleBack(); return; }
      if (cmd === "call") { Linking.openURL("tel:103"); return; }
      if (cmd === "repeat") {
        setPhase("speaking");
        speak(lastSpoken || lastInstruction, () => {
          setPhase("listening");
          setTimeout(() => startListening(), 400);
        });
        return;
      }

      // Add user message to history
      const currentHistory = historyRef.current;
      const newHistory: ConversationMessage[] = [
        ...currentHistory,
        { role: "user", content: transcript },
      ];
      setHistory(newHistory);

      // Analyze with Gemini
      const result = await analyzeEmergencyWithGemini(
        transcript,
        coords,
        currentHistory
      );

      applyResponse(result, transcript, newHistory);
    } catch (e) {
      console.error("[SOS] stopAndSend error:", e);
      setPhase("speaking");
      speak("I didn't catch that. Please speak again.", () => {
        setPhase("listening");
        setTimeout(() => startListening(), 400);
      });
    }
  }, [lastInstruction, lastSpoken, coords, applyResponse, startListening]);

  // ── Back / end call ───────────────────────────────────────────────────────────
  const handleBack = useCallback(() => {
    Speech.stop();
    if (silenceTimer.current) clearTimeout(silenceTimer.current);
    haptic.medium();
    router.back();
  }, [router]);

  // ── Render ────────────────────────────────────────────────────────────────────
  const isListening = phase === "listening";
  const isProcessing = phase === "processing" || phase === "connecting";
  const isSpeaking = phase === "speaking";

  return (
    <ScreenContainer containerClassName="bg-[#0a0f14]" edges={["top", "left", "right", "bottom"]}>

      {/* ── 1. Call 103 — always at top ─────────────────────────────────────── */}
      <View style={styles.topBar}>
        <Pressable
          onPress={() => Linking.openURL("tel:103")}
          style={({ pressed }) => [styles.callBtn, pressed && { opacity: 0.8 }]}
        >
          <Text style={styles.callBtnText}>📞  Call 103</Text>
        </Pressable>
        <Pressable onPress={handleBack} style={styles.endBtn}>
          <Text style={styles.endBtnText}>End</Text>
        </Pressable>
      </View>

      {/* ── 2. Map ──────────────────────────────────────────────────────────── */}
      <View style={styles.mapContainer}>
        <EmergencyMap
          emergencyType="fire"
          aiRoute={aiRoute}
          aiInstruction={instruction}
          height={200}
          onMapReady={(c) => setCoords(c)}
        />
      </View>

      {/* ── 3. Single instruction ───────────────────────────────────────────── */}
      <View style={styles.instructionWrap}>
        <Text style={styles.instructionText} numberOfLines={4} adjustsFontSizeToFit>
          {instruction || "…"}
        </Text>
      </View>

      {/* ── 4. Listening indicator ──────────────────────────────────────────── */}
      <View style={styles.listenWrap}>
        {isListening ? (
          <Animated.Text style={[styles.listenText, { opacity: listenPulse }]}>
            ~~~~ listening ~~~~
          </Animated.Text>
        ) : isProcessing ? (
          <Text style={styles.processingText}>● processing…</Text>
        ) : isSpeaking ? (
          <Text style={styles.speakingText}>🔊 speaking…</Text>
        ) : (
          <Text style={styles.idleText}>Tap SOS to start</Text>
        )}
      </View>

    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#1C2B38",
  },
  callBtn: {
    flex: 1,
    backgroundColor: "#22C55E",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  callBtnText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  endBtn: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#334155",
  },
  endBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#9BA1A6",
  },
  mapContainer: {
    overflow: "hidden",
  },
  instructionWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  instructionText: {
    fontSize: 32,
    fontWeight: "800",
    color: "#FFFFFF",
    textAlign: "center",
    lineHeight: 42,
    letterSpacing: 0.3,
  },
  listenWrap: {
    paddingBottom: 28,
    alignItems: "center",
  },
  listenText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#4a9d9c",
    letterSpacing: 3,
  },
  processingText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#F59E0B",
    letterSpacing: 1,
  },
  speakingText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#22C55E",
    letterSpacing: 1,
  },
  idleText: {
    fontSize: 14,
    color: "#4a5568",
  },
});
