/**
 * PREPARE SCREEN — Voice-Only Training
 *
 * 4 scenario cards. User SPEAKS the scenario name to start.
 * Gemma generates scenario prompt aloud.
 * User answers by speaking.
 * Gemma evaluates and responds aloud.
 *
 * NO text input. NO keyboard. NO streak counter.
 * Progress bars only.
 */
import {
  Text,
  View,
  Pressable,
  StyleSheet,
  Platform,
} from "react-native";
import { useState, useEffect, useRef, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  useAudioRecorder,
  useAudioRecorderState,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from "expo-audio";
import * as Speech from "expo-speech";
import { ScreenContainer } from "@/components/screen-container";
import { TRAINING_SCENARIOS } from "@/constants/emergency-data";
import { haptic } from "@/lib/haptics";
import { chatWithOperatorLocal } from "@/lib/local-emergency-chat";
import { uploadAudioUri } from "@/lib/transcription";
import type { ConversationMessage } from "@/lib/ai-analysis";

const COMPLETED_KEY = "training_completed";
const SILENCE_MS = 3500;

type SessionPhase = "intro" | "listening" | "processing" | "feedback";

interface Session {
  scenarioId: string;
  phase: SessionPhase;
  feedback: string;
  history: ConversationMessage[];
}

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

export default function PrepareScreen() {
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [micAvailable, setMicAvailable] = useState(true);

  const silenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  useAudioRecorderState(audioRecorder);
  const sessionRef = useRef<Session | null>(null);
  sessionRef.current = session;

  useEffect(() => {
    (async () => {
      const c = await AsyncStorage.getItem(COMPLETED_KEY);
      if (c) setCompletedIds(JSON.parse(c));

      if (Platform.OS !== "web") {
        const { granted } = await requestRecordingPermissionsAsync();
        setMicAvailable(granted);
        if (granted) {
          await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
        }
      } else {
        setMicAvailable(false);
      }
    })();

    return () => {
      Speech.stop();
      if (silenceTimer.current) clearTimeout(silenceTimer.current);
    };
  }, []);

  // ── Start scenario ────────────────────────────────────────────────────────────
  const startScenario = useCallback((scenarioId: string) => {
    haptic.medium();
    const scenario = TRAINING_SCENARIOS.find((s) => s.id === scenarioId);
    if (!scenario) return;

    const newSession: Session = {
      scenarioId,
      phase: "intro",
      feedback: "",
      history: [],
    };
    setSession(newSession);
    sessionRef.current = newSession;

    speak(scenario.prompt, () => {
      startListening(newSession);
    });
  }, []);

  // ── Start listening ───────────────────────────────────────────────────────────
  const startListening = useCallback(async (currentSession: Session) => {
    if (!micAvailable) return;
    const updated = { ...currentSession, phase: "listening" as SessionPhase };
    setSession(updated);
    sessionRef.current = updated;

    try {
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      if (silenceTimer.current) clearTimeout(silenceTimer.current);
      silenceTimer.current = setTimeout(() => stopAndEvaluate(), SILENCE_MS);
    } catch {
      setSession((s) => s ? { ...s, phase: "feedback", feedback: "Microphone unavailable." } : null);
    }
  }, [micAvailable]);

  // ── Stop and evaluate ─────────────────────────────────────────────────────────
  const stopAndEvaluate = useCallback(async () => {
    if (silenceTimer.current) { clearTimeout(silenceTimer.current); silenceTimer.current = null; }
    const current = sessionRef.current;
    if (!current) return;

    const updated = { ...current, phase: "processing" as SessionPhase };
    setSession(updated);
    sessionRef.current = updated;
    Speech.stop();

    try {
      await audioRecorder.stop();
      const uri = audioRecorder.uri;
      const audioUrl = uri ? await uploadAudioUri(uri) : null;

      const scenario = TRAINING_SCENARIOS.find((s) => s.id === current.scenarioId);
      const systemContext = scenario
        ? `You are a training evaluator for emergency preparedness. The scenario is: "${scenario.title}". Evaluate the user's response and give brief, encouraging feedback. Keep it under 2 sentences.`
        : undefined;

      const response = await chatWithOperatorLocal(current.history, audioUrl ?? undefined, systemContext);

      const newHistory: ConversationMessage[] = [
        ...current.history,
        ...(response.transcript ? [{ role: "user" as const, content: response.transcript }] : []),
        { role: "assistant" as const, content: response.spoken },
      ];

      // Check if correct (keyword match)
      const transcript = (response.transcript || "").toLowerCase();
      const isCorrect = scenario?.correctKeywords?.some((kw) => transcript.includes(kw.toLowerCase())) ?? false;

      if (isCorrect) {
        const newCompleted = [...completedIds, current.scenarioId].filter((v, i, a) => a.indexOf(v) === i);
        setCompletedIds(newCompleted);
        await AsyncStorage.setItem(COMPLETED_KEY, JSON.stringify(newCompleted));
      }

      const withFeedback = { ...updated, phase: "feedback" as SessionPhase, feedback: response.spoken, history: newHistory };
      setSession(withFeedback);
      sessionRef.current = withFeedback;

      speak(response.spoken, () => {
        // After feedback, auto-listen again for next answer
        setTimeout(() => {
          if (sessionRef.current?.phase === "feedback") {
            startListening(withFeedback);
          }
        }, 800);
      });
    } catch {
      const err = { ...updated, phase: "feedback" as SessionPhase, feedback: "Could not process. Try again." };
      setSession(err);
      speak("I couldn't process that. Please try again.", () => startListening(err));
    }
  }, [completedIds, startListening]);

  // ── End session ───────────────────────────────────────────────────────────────
  const endSession = useCallback(() => {
    Speech.stop();
    if (silenceTimer.current) clearTimeout(silenceTimer.current);
    haptic.light();
    setSession(null);
  }, []);

  // ── Render: Active session ────────────────────────────────────────────────────
  if (session) {
    const scenario = TRAINING_SCENARIOS.find((s) => s.id === session.scenarioId);
    const phaseLabel =
      session.phase === "intro" ? "🔊 Reading scenario…"
      : session.phase === "listening" ? "~~~~ listening ~~~~"
      : session.phase === "processing" ? "● processing…"
      : "🔊 feedback…";

    return (
      <ScreenContainer containerClassName="bg-[#0a0f14]" edges={["top", "left", "right", "bottom"]}>
        <View style={styles.sessionContainer}>
          <View style={styles.sessionHeader}>
            <Text style={styles.sessionTitle}>{scenario?.title ?? "Training"}</Text>
            <Pressable onPress={endSession} style={styles.endBtn}>
              <Text style={styles.endBtnText}>End</Text>
            </Pressable>
          </View>

          <View style={styles.sessionBody}>
            <Text style={styles.sessionPrompt}>{scenario?.prompt ?? ""}</Text>
            <Text style={[
              styles.phaseLabel,
              session.phase === "listening" && styles.phaseListen,
              session.phase === "processing" && styles.phaseProcess,
            ]}>
              {phaseLabel}
            </Text>
            {session.feedback ? (
              <View style={styles.feedbackCard}>
                <Text style={styles.feedbackText}>{session.feedback}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </ScreenContainer>
    );
  }

  // ── Render: Scenario list ─────────────────────────────────────────────────────
  return (
    <ScreenContainer containerClassName="bg-[#0a0f14]" edges={["top", "left", "right"]}>
      <View style={styles.container}>
        <Text style={styles.screenTitle}>Training</Text>
        <Text style={styles.screenSub}>Tap a scenario to begin — AI guides you by voice</Text>

        <View style={styles.cardGrid}>
          {TRAINING_SCENARIOS.map((scenario) => {
            const done = completedIds.includes(scenario.id);
            const progress = done ? 1 : 0;
            return (
              <Pressable
                key={scenario.id}
                onPress={() => startScenario(scenario.id)}
                style={({ pressed }) => [styles.card, pressed && { opacity: 0.75 }]}
              >
                <View style={styles.cardTop}>
                  <View style={[styles.tag, { backgroundColor: scenario.tagColor + "33" }]}>
                    <Text style={[styles.tagText, { color: scenario.tagColor }]}>{scenario.tag}</Text>
                  </View>
                  {done && <Text style={styles.doneCheck}>✓</Text>}
                </View>
                <Text style={styles.cardTitle}>{scenario.title}</Text>
                <Text style={styles.cardDesc} numberOfLines={2}>{scenario.description}</Text>

                {/* Progress bar — no numbers, no streak */}
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${progress * 100}%` as any, backgroundColor: scenario.tagColor }]} />
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 2,
    marginBottom: 4,
  },
  screenSub: {
    fontSize: 13,
    color: "#687076",
    marginBottom: 16,
  },
  cardGrid: {
    gap: 12,
  },
  card: {
    backgroundColor: "#111820",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1C2B38",
    gap: 6,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  doneCheck: {
    fontSize: 18,
    color: "#22C55E",
    fontWeight: "900",
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  cardDesc: {
    fontSize: 13,
    color: "#687076",
    lineHeight: 18,
  },
  progressTrack: {
    height: 3,
    backgroundColor: "#1C2B38",
    borderRadius: 2,
    marginTop: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: 3,
    borderRadius: 2,
  },
  // Session
  sessionContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  sessionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  sessionTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 1,
  },
  endBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#334155",
  },
  endBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#9BA1A6",
  },
  sessionBody: {
    flex: 1,
    justifyContent: "center",
    gap: 24,
  },
  sessionPrompt: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
    lineHeight: 32,
  },
  phaseLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#9BA1A6",
    textAlign: "center",
    letterSpacing: 2,
  },
  phaseListen: {
    color: "#4a9d9c",
  },
  phaseProcess: {
    color: "#F59E0B",
  },
  feedbackCard: {
    backgroundColor: "#111820",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1C2B38",
  },
  feedbackText: {
    fontSize: 16,
    color: "#ECEDEE",
    lineHeight: 24,
    textAlign: "center",
  },
});
