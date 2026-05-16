/**
 * SOS ACTIVE EMERGENCY SCREEN — Voice-Only
 *
 * ONLY 4 ELEMENTS:
 *   1. Call 103 bar — always at top
 *   2. Map with user position (expo-location + react-native-maps)
 *   3. Single instruction — large, high-contrast, max 8 words
 *   4. Listening indicator ("~~~~ listening ~~~~")
 *
 * VOICE LOOP:
 *   Press SOS → AI says "Tell me what happened"
 *   → expo-audio records → Whisper transcribes → Gemma responds
 *   → expo-speech reads response LOUDLY and IMMEDIATELY
 *   → auto-starts listening again
 *   → user says "done" → next step
 *   → loop never stops until "stop" / "home" / "назад"
 *
 * NO text inputs. NO chat bubbles. NO keyboard. NO menus. NO scrolling.
 * NO buttons except Call 103 and End (hidden, top-right, small).
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
import { chatWithOperatorLocal } from "@/lib/local-emergency-chat";
import { initLocalLLM } from "@/lib/local-llm";
import { uploadAudioUri } from "@/lib/transcription";
import { sendEmergencySMS } from "@/lib/family-sms";
import { useAppContext } from "@/lib/app-context";
import { EmergencyMap } from "@/components/EmergencyMap";
import type { ConversationMessage, OperatorResponse } from "@/lib/ai-analysis";

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = "idle" | "connecting" | "listening" | "processing" | "speaking";

interface Coords { latitude: number; longitude: number; }

// ─── TTS helper — always loud, slightly slow ──────────────────────────────────

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

function detectCommand(text: string): "done" | "repeat" | "cant" | "call" | "stop" | null {
  const t = text.toLowerCase().trim();
  if (/\b(done|готово|ok|okay|next|далі)\b/.test(t)) return "done";
  if (/\b(repeat|повтори|again|ще раз)\b/.test(t)) return "repeat";
  if (/\b(can'?t|cannot|не можу|unable)\b/.test(t)) return "cant";
  if (/\b(call|виклик|103|emergency)\b/.test(t)) return "call";
  if (/\b(stop|home|назад|back|cancel|end)\b/.test(t)) return "stop";
  return null;
}

// ─── Silence detection ────────────────────────────────────────────────────────
const SILENCE_MS = 3500;

// ─── Component ────────────────────────────────────────────────────────────────

export default function SOSScreen() {
  useKeepAwake();
  const router = useRouter();
  const { panicDetected } = useAppContext();

  const [phase, setPhase] = useState<Phase>("idle");
  const [instruction, setInstruction] = useState("");
  const [lastInstruction, setLastInstruction] = useState("");
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
    initLocalLLM().catch(() => {});

    (async () => {
      // Mic permission
      if (Platform.OS !== "web") {
        const { granted } = await requestRecordingPermissionsAsync();
        setMicAvailable(granted);
        if (granted) {
          await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
        }
      } else {
        setMicAvailable(false);
      }

      // Location
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
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
    // Small delay so screen renders first
    const t = setTimeout(() => startCall(), 600);
    return () => clearTimeout(t);
  }, []);

  // ── Start listening (auto-record) ─────────────────────────────────────────────
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
    (response: OperatorResponse & { usedLocalModel?: boolean }, currentHistory: ConversationMessage[]) => {
      const instr = response.instruction || response.spoken;
      setInstruction(instr);
      setLastInstruction(instr);

      const newHistory: ConversationMessage[] = [
        ...currentHistory,
        { role: "assistant", content: response.spoken },
      ];
      setHistory(newHistory);

      if (response.severity === "critical") haptic.error();
      else haptic.success();

      if (response.action === "CALL_103") {
        setTimeout(() => Linking.openURL("tel:103"), 1500);
      }
      if (response.action === "SMS_FAMILY") {
        sendEmergencySMS().catch(() => {});
      }

      // Parse route from steps if available
      if (response.steps && response.steps.length > 0 && coords) {
        // Simple: show a northward route arrow from current position
        const routePoint = {
          latitude: coords.latitude + 0.002,
          longitude: coords.longitude,
        };
        setAiRoute([coords, routePoint]);
      }

      setPhase("speaking");
      speak(response.spoken, () => {
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

    try {
      const response = await chatWithOperatorLocal([], undefined, undefined);
      applyResponse(response, []);
    } catch {
      setInstruction("AI unavailable. Call 103.");
      setPhase("speaking");
      speak("AI is unavailable. Please call 103 for emergency services.");
    }
  }, [applyResponse]);

  // ── Stop recording and send to AI ─────────────────────────────────────────────
  const stopAndSend = useCallback(async () => {
    if (silenceTimer.current) { clearTimeout(silenceTimer.current); silenceTimer.current = null; }
    setPhase("processing");
    setInstruction("Processing…");
    Speech.stop();

    try {
      await audioRecorder.stop();
      const uri = audioRecorder.uri;
      const audioUrl = uri ? await uploadAudioUri(uri) : null;

      const currentHistory = historyRef.current;
      const response = await chatWithOperatorLocal(currentHistory, audioUrl ?? undefined, undefined);

      // Voice command detection
      if (response.transcript) {
        const cmd = detectCommand(response.transcript);
        if (cmd === "stop") { handleBack(); return; }
        if (cmd === "call") { Linking.openURL("tel:103"); return; }
        if (cmd === "repeat") {
          setPhase("speaking");
          speak(lastInstruction, () => {
            setPhase("listening");
            setTimeout(() => startListening(), 400);
          });
          return;
        }
        // "done" and "cant" fall through to normal AI response
      }

      const newHistory: ConversationMessage[] = [
        ...historyRef.current,
        ...(response.transcript ? [{ role: "user" as const, content: response.transcript }] : []),
      ];
      applyResponse(response, newHistory);
    } catch {
      setInstruction("Didn't catch that. Speak again.");
      setPhase("speaking");
      speak("I didn't catch that. Please speak again.", () => {
        setPhase("listening");
        setTimeout(() => startListening(), 400);
      });
    }
  }, [lastInstruction, applyResponse, startListening]);

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
          height={220}
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
        ) : (
          <Text style={styles.speakingText}>🔊 speaking…</Text>
        )}
      </View>

    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  // Top bar
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
  // Map
  mapContainer: {
    marginHorizontal: 0,
    overflow: "hidden",
  },
  // Instruction
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
  // Listening indicator
  listenWrap: {
    paddingBottom: 24,
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
});
