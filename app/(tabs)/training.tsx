import {
  Text,
  View,
  Pressable,
  StyleSheet,
  FlatList,
  Linking,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  useAudioRecorder,
  useAudioRecorderState,
  RecordingPresets,
  setAudioModeAsync,
} from "expo-audio";
import { ScreenContainer } from "@/components/screen-container";
import { TRAINING_SCENARIOS } from "@/constants/emergency-data";
import { haptic } from "@/lib/haptics";
import { speakInstruction, stopSpeech } from "@/lib/speech";
import { analyzeEmergency } from "@/lib/ai-analysis";
import { useAppContext } from "@/lib/app-context";

const STREAK_KEY = "training_streak";
const COMPLETED_KEY = "training_completed";

type SessionPhase = "prompt" | "recording" | "evaluating" | "result";

interface SessionState {
  scenarioId: string;
  phase: SessionPhase;
  evaluation: "correct" | "partial" | "incorrect" | null;
  feedback: string;
  correctAnswer: string;
}

export default function TrainingScreen() {
  const { panicDetected } = useAppContext();

  const [streak, setStreak] = useState(0);
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [session, setSession] = useState<SessionState | null>(null);

  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder);

  useEffect(() => {
    (async () => {
      const s = await AsyncStorage.getItem(STREAK_KEY);
      const c = await AsyncStorage.getItem(COMPLETED_KEY);
      if (s) setStreak(parseInt(s, 10));
      if (c) setCompletedIds(JSON.parse(c));
    })();
  }, []);

  const handleStartScenario = async (scenarioId: string) => {
    haptic.medium();
    const scenario = TRAINING_SCENARIOS.find((s) => s.id === scenarioId);
    if (!scenario) return;
    setSession({
      scenarioId,
      phase: "prompt",
      evaluation: null,
      feedback: "",
      correctAnswer: scenario.correctAnswer,
    });
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
    speakInstruction(scenario.prompt, { panicMode: panicDetected });
  };

  const handleStartRecording = async () => {
    haptic.light();
    if (!session) return;
    setSession((prev) => prev ? { ...prev, phase: "recording" } : prev);
    stopSpeech();
    try {
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
    } catch {
      setSession((prev) => prev ? { ...prev, phase: "prompt" } : prev);
    }
  };

  const handleStopRecording = async () => {
    haptic.medium();
    if (!session) return;
    setSession((prev) => prev ? { ...prev, phase: "evaluating" } : prev);
    try {
      await audioRecorder.stop();
      const uri = audioRecorder.uri;
      let transcript = "I don't know";
      if (uri && Platform.OS !== "web") {
        try {
          // Use manus-speech-to-text for transcription
          const { exec } = require("child_process");
          const { promisify } = require("util");
          const execAsync = promisify(exec);
          const { stdout } = await execAsync(`manus-speech-to-text "${uri}"`);
          transcript = stdout.trim() || transcript;
        } catch {
          // Transcription failed — use fallback
        }
      }
      await evaluateAnswer(transcript);
    } catch {
      setSession((prev) => prev ? { ...prev, phase: "prompt" } : prev);
    }
  };

  const evaluateAnswer = async (transcript: string) => {
    if (!session) return;
    const scenario = TRAINING_SCENARIOS.find((s) => s.id === session.scenarioId);
    if (!scenario) return;

    let evaluation: "correct" | "partial" | "incorrect" = "incorrect";
    let feedback = "";

    try {
      const result = await analyzeEmergency(
        `Training evaluation. Scenario: "${scenario.prompt}". User answered: "${transcript}". Correct keywords: ${scenario.correctKeywords.join(", ")}. Evaluate: correct, partial, or incorrect?`
      );
      const resp = result.spokenResponse.toLowerCase();
      if (resp.includes("correct") && !resp.includes("incorrect") && !resp.includes("partial")) {
        evaluation = "correct";
        feedback = "Great answer! You identified the right action.";
      } else if (resp.includes("partial")) {
        evaluation = "partial";
        feedback = "Partially correct. You got part of it right.";
      } else {
        evaluation = "incorrect";
        feedback = "Not quite. Here's what you should do:";
      }
    } catch {
      // Keyword fallback
      const lower = transcript.toLowerCase();
      const matches = scenario.correctKeywords.filter((kw) =>
        lower.includes(kw.toLowerCase())
      );
      if (matches.length >= 2) {
        evaluation = "correct";
        feedback = "Great answer! You identified the right action.";
      } else if (matches.length === 1) {
        evaluation = "partial";
        feedback = "Partially correct. You got part of it right.";
      } else {
        evaluation = "incorrect";
        feedback = "Not quite. Here's what you should do:";
      }
    }

    setSession((prev) =>
      prev ? { ...prev, phase: "result", evaluation, feedback, correctAnswer: scenario.correctAnswer } : prev
    );

    const ttsText =
      evaluation === "correct"
        ? "Correct! Well done."
        : evaluation === "partial"
        ? "Partially correct. " + scenario.correctAnswer
        : "Incorrect. " + scenario.correctAnswer;
    speakInstruction(ttsText, { panicMode: panicDetected });

    if (evaluation === "correct") {
      haptic.success();
      const newStreak = streak + 1;
      setStreak(newStreak);
      await AsyncStorage.setItem(STREAK_KEY, String(newStreak));
      if (!completedIds.includes(session.scenarioId)) {
        const newCompleted = [...completedIds, session.scenarioId];
        setCompletedIds(newCompleted);
        await AsyncStorage.setItem(COMPLETED_KEY, JSON.stringify(newCompleted));
      }
    } else {
      haptic.warning();
    }
  };

  const handleCloseSession = () => {
    stopSpeech();
    audioRecorder.stop().catch(() => {});
    setSession(null);
  };

  const handleCall = () => Linking.openURL("tel:103");

  // ── Session overlay ────────────────────────────────────────────────────────
  if (session) {
    const scenario = TRAINING_SCENARIOS.find((s) => s.id === session.scenarioId);
    return (
      <ScreenContainer containerClassName="bg-background" edges={["top", "left", "right", "bottom"]}>
        <View style={styles.sessionContainer}>
          <View style={styles.sessionHeader}>
            <Pressable onPress={handleCloseSession} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
            <Text style={styles.sessionTitle}>{scenario?.title} Scenario</Text>
          </View>

          <View style={styles.promptCard}>
            <Text style={styles.promptLabel}>SCENARIO</Text>
            <Text style={styles.promptText}>{scenario?.prompt}</Text>
          </View>

          {session.phase === "prompt" && (
            <>
              <View style={styles.instructionCard}>
                <Text style={styles.instructionText}>
                  🎙 Press the button below and speak your answer aloud.
                </Text>
              </View>
              <Pressable
                onPress={handleStartRecording}
                style={({ pressed }) => [styles.recordBtn, pressed && { transform: [{ scale: 0.97 }] }]}
              >
                <Text style={styles.recordBtnText}>🎙 Record Answer</Text>
              </Pressable>
            </>
          )}

          {session.phase === "recording" && (
            <>
              <View style={styles.recordingCard}>
                <Text style={styles.recordingText}>🔴 Recording…</Text>
                <Text style={styles.recordingHint}>Speak your answer, then tap Stop</Text>
              </View>
              <Pressable
                onPress={handleStopRecording}
                style={({ pressed }) => [styles.stopBtn, pressed && { transform: [{ scale: 0.97 }] }]}
              >
                <Text style={styles.stopBtnText}>⏹ Stop & Evaluate</Text>
              </Pressable>
            </>
          )}

          {session.phase === "evaluating" && (
            <View style={styles.evaluatingCard}>
              <ActivityIndicator size="large" color="#4a9d9c" />
              <Text style={styles.evaluatingText}>AI is evaluating your answer…</Text>
            </View>
          )}

          {session.phase === "result" && (
            <>
              <View
                style={[
                  styles.resultCard,
                  session.evaluation === "correct"
                    ? styles.resultCorrect
                    : session.evaluation === "partial"
                    ? styles.resultPartial
                    : styles.resultIncorrect,
                ]}
              >
                <Text style={styles.resultEmoji}>
                  {session.evaluation === "correct" ? "✅" : session.evaluation === "partial" ? "⚠️" : "❌"}
                </Text>
                <Text style={styles.resultLabel}>
                  {session.evaluation === "correct" ? "CORRECT" : session.evaluation === "partial" ? "PARTIALLY CORRECT" : "INCORRECT"}
                </Text>
                <Text style={styles.resultFeedback}>{session.feedback}</Text>
                {session.evaluation !== "correct" && (
                  <View style={styles.correctAnswerBox}>
                    <Text style={styles.correctAnswerLabel}>Correct answer:</Text>
                    <Text style={styles.correctAnswerText}>{session.correctAnswer}</Text>
                  </View>
                )}
              </View>
              <Pressable
                onPress={handleCloseSession}
                style={({ pressed }) => [styles.doneBtn, pressed && { opacity: 0.8 }]}
              >
                <Text style={styles.doneBtnText}>✓ Done</Text>
              </Pressable>
            </>
          )}
        </View>
      </ScreenContainer>
    );
  }

  // ── Scenario list ──────────────────────────────────────────────────────────
  return (
    <ScreenContainer containerClassName="bg-background">
      <View style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>🎯 Training Mode</Text>
            <Text style={styles.headerSubtitle}>
              {completedIds.length} / {TRAINING_SCENARIOS.length} completed
            </Text>
          </View>
          <View style={styles.streakBadge}>
            <Text style={styles.streakText}>🔥 {streak}</Text>
            <Text style={styles.streakLabel}>streak</Text>
          </View>
        </View>

        <FlatList
          data={TRAINING_SCENARIOS}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const isCompleted = completedIds.includes(item.id);
            return (
              <Pressable
                onPress={() => handleStartScenario(item.id)}
                style={({ pressed }) => [
                  styles.scenarioCard,
                  pressed && { opacity: 0.85 },
                  isCompleted && styles.scenarioCardDone,
                ]}
              >
                <View style={styles.scenarioLeft}>
                  <View style={[styles.scenarioTag, { backgroundColor: item.tagColor + "30", borderColor: item.tagColor }]}>
                    <Text style={[styles.scenarioTagText, { color: item.tagColor }]}>{item.tag}</Text>
                  </View>
                  <Text style={styles.scenarioTitle}>{item.title}</Text>
                  <Text style={styles.scenarioDesc}>{item.description}</Text>
                </View>
                <View style={styles.scenarioRight}>
                  {isCompleted ? (
                    <Text style={styles.completedIcon}>✅</Text>
                  ) : (
                    <Text style={styles.startIcon}>▶</Text>
                  )}
                </View>
              </Pressable>
            );
          }}
        />

        <Pressable
          onPress={handleCall}
          style={({ pressed }) => [styles.callBar, pressed && { opacity: 0.8 }]}
        >
          <Text style={styles.callText}>📞 Call 103</Text>
        </Pressable>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  headerTitle: { fontSize: 22, fontWeight: "800", color: "#FFFFFF" },
  headerSubtitle: { fontSize: 13, color: "#e0e0e0", marginTop: 2 },
  streakBadge: {
    backgroundColor: "#FF3D3D20",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#FF3D3D",
  },
  streakText: { fontSize: 18, fontWeight: "800", color: "#FF3D3D" },
  streakLabel: { fontSize: 10, color: "#e0e0e0", marginTop: 1 },
  listContent: { gap: 12, paddingBottom: 12 },
  scenarioCard: {
    backgroundColor: "#1d2e3d",
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#354656",
  },
  scenarioCardDone: { borderColor: "#22C55E50", backgroundColor: "#22C55E10" },
  scenarioLeft: { flex: 1 },
  scenarioTag: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    marginBottom: 6,
  },
  scenarioTagText: { fontSize: 11, fontWeight: "700" },
  scenarioTitle: { fontSize: 17, fontWeight: "800", color: "#FFFFFF", marginBottom: 3 },
  scenarioDesc: { fontSize: 13, color: "#e0e0e0" },
  scenarioRight: { paddingLeft: 12 },
  completedIcon: { fontSize: 24 },
  startIcon: { fontSize: 22, color: "#4a9d9c" },
  callBar: {
    backgroundColor: "#FF3D3D",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  callText: { fontSize: 16, fontWeight: "700", color: "#FFFFFF" },
  // Session
  sessionContainer: { flex: 1, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  sessionHeader: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  closeBtn: { paddingRight: 12 },
  closeBtnText: { fontSize: 20, color: "#FF3D3D", fontWeight: "700" },
  sessionTitle: { fontSize: 18, fontWeight: "800", color: "#FFFFFF" },
  promptCard: {
    backgroundColor: "#1d2e3d",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#354656",
    marginBottom: 16,
  },
  promptLabel: { fontSize: 11, color: "#4a9d9c", fontWeight: "700", letterSpacing: 2, marginBottom: 8 },
  promptText: { fontSize: 16, fontWeight: "700", color: "#FFFFFF", lineHeight: 24 },
  instructionCard: {
    backgroundColor: "#0D6E6E20",
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: "#0D6E6E",
    marginBottom: 16,
    flex: 1,
    justifyContent: "center",
  },
  instructionText: { fontSize: 15, color: "#afffff", textAlign: "center" },
  recordBtn: {
    backgroundColor: "#4a9d9c",
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: "center",
  },
  recordBtnText: { fontSize: 18, fontWeight: "800", color: "#FFFFFF" },
  recordingCard: {
    flex: 1,
    backgroundColor: "#FF3D3D20",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#FF3D3D",
    marginBottom: 16,
  },
  recordingText: { fontSize: 20, fontWeight: "800", color: "#FF3D3D", marginBottom: 8 },
  recordingHint: { fontSize: 14, color: "#e0e0e0" },
  stopBtn: {
    backgroundColor: "#FF3D3D",
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: "center",
  },
  stopBtnText: { fontSize: 18, fontWeight: "800", color: "#FFFFFF" },
  evaluatingCard: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  evaluatingText: { fontSize: 16, color: "#4a9d9c", fontWeight: "600" },
  resultCard: {
    flex: 1,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    marginBottom: 16,
  },
  resultCorrect: { backgroundColor: "#22C55E20", borderColor: "#22C55E" },
  resultPartial: { backgroundColor: "#F59E0B20", borderColor: "#F59E0B" },
  resultIncorrect: { backgroundColor: "#FF3D3D20", borderColor: "#FF3D3D" },
  resultEmoji: { fontSize: 56, marginBottom: 12 },
  resultLabel: { fontSize: 20, fontWeight: "900", color: "#FFFFFF", marginBottom: 8 },
  resultFeedback: { fontSize: 15, color: "#e0e0e0", textAlign: "center", marginBottom: 12 },
  correctAnswerBox: {
    backgroundColor: "#0D1F2D",
    borderRadius: 10,
    padding: 12,
    width: "100%",
    borderWidth: 1,
    borderColor: "#354656",
  },
  correctAnswerLabel: { fontSize: 11, color: "#4a9d9c", fontWeight: "700", marginBottom: 4 },
  correctAnswerText: { fontSize: 14, color: "#FFFFFF", lineHeight: 20 },
  doneBtn: {
    backgroundColor: "#22C55E",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  doneBtnText: { fontSize: 17, fontWeight: "800", color: "#FFFFFF" },
});
