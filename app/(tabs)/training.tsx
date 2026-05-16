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
import { transcribeAudioUri } from "@/lib/transcription";

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

  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [session, setSession] = useState<SessionState | null>(null);

  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  useAudioRecorderState(audioRecorder);

  useEffect(() => {
    (async () => {
      const c = await AsyncStorage.getItem(COMPLETED_KEY);
      if (c) setCompletedIds(JSON.parse(c));
    })();
  }, []);

  const handleStartScenario = async (scenarioId: string) => {
    haptic.medium();
    const scenario = TRAINING_SCENARIOS.find((s) => s.id === scenarioId);
    if (!scenario) return;
    setSession({ scenarioId, phase: "prompt", evaluation: null, feedback: "", correctAnswer: scenario.correctAnswer });
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
      const rawTranscript = uri ? await transcribeAudioUri(uri) : null;
      await evaluateAnswer(rawTranscript ?? "I don't know");
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
        evaluation = "correct"; feedback = "Great answer!";
      } else if (resp.includes("partial")) {
        evaluation = "partial"; feedback = "Partially correct.";
      } else {
        evaluation = "incorrect"; feedback = "Not quite. See correct answer below.";
      }
    } catch {
      const lower = transcript.toLowerCase();
      const matches = scenario.correctKeywords.filter((kw) => lower.includes(kw.toLowerCase()));
      if (matches.length >= 2) { evaluation = "correct"; feedback = "Great answer!"; }
      else if (matches.length === 1) { evaluation = "partial"; feedback = "Partially correct."; }
      else { evaluation = "incorrect"; feedback = "Not quite. See correct answer below."; }
    }

    setSession((prev) => prev ? { ...prev, phase: "result", evaluation, feedback, correctAnswer: scenario.correctAnswer } : prev);

    const ttsText = evaluation === "correct" ? "Correct! Well done." : evaluation === "partial" ? "Partially correct. " + scenario.correctAnswer : "Incorrect. " + scenario.correctAnswer;
    speakInstruction(ttsText, { panicMode: panicDetected });

    if (evaluation === "correct") {
      haptic.success();
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

  // ── Session overlay ────────────────────────────────────────────────────────
  if (session) {
    const scenario = TRAINING_SCENARIOS.find((s) => s.id === session.scenarioId);
    return (
      <ScreenContainer containerClassName="bg-background" edges={["top", "left", "right", "bottom"]}>
        <View style={styles.sessionContainer}>
          {/* Header */}
          <View style={styles.sessionHeader}>
            <Pressable onPress={handleCloseSession} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
            <Text style={styles.sessionTitle}>{scenario?.title}</Text>
          </View>

          {/* Scenario prompt — fills screen */}
          <View style={styles.promptCard}>
            <Text style={styles.promptText}>{scenario?.prompt}</Text>
          </View>

          {session.phase === "prompt" && (
            <Pressable
              onPress={handleStartRecording}
              style={({ pressed }) => [styles.actionBtn, styles.recordBtn, pressed && { transform: [{ scale: 0.97 }] }]}
            >
              <Text style={styles.actionBtnText}>🎙  Record Answer</Text>
            </Pressable>
          )}

          {session.phase === "recording" && (
            <Pressable
              onPress={handleStopRecording}
              style={({ pressed }) => [styles.actionBtn, styles.stopBtn, pressed && { transform: [{ scale: 0.97 }] }]}
            >
              <Text style={styles.actionBtnText}>⏹  Stop & Evaluate</Text>
            </Pressable>
          )}

          {session.phase === "evaluating" && (
            <View style={styles.evaluatingWrap}>
              <ActivityIndicator size="large" color="#4a9d9c" />
              <Text style={styles.evaluatingText}>Evaluating…</Text>
            </View>
          )}

          {session.phase === "result" && (
            <>
              <View style={[
                styles.resultCard,
                session.evaluation === "correct" ? styles.resultCorrect
                  : session.evaluation === "partial" ? styles.resultPartial
                  : styles.resultIncorrect,
              ]}>
                <Text style={styles.resultEmoji}>
                  {session.evaluation === "correct" ? "✅" : session.evaluation === "partial" ? "⚠️" : "❌"}
                </Text>
                <Text style={styles.resultLabel}>
                  {session.evaluation === "correct" ? "CORRECT" : session.evaluation === "partial" ? "PARTIAL" : "INCORRECT"}
                </Text>
                {session.evaluation !== "correct" && (
                  <Text style={styles.correctAnswerText}>{session.correctAnswer}</Text>
                )}
              </View>
              <Pressable
                onPress={handleCloseSession}
                style={({ pressed }) => [styles.actionBtn, styles.doneBtn, pressed && { opacity: 0.8 }]}
              >
                <Text style={styles.actionBtnText}>✓  Done</Text>
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
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>🎯 Training</Text>
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
                  pressed && { opacity: 0.8 },
                  isCompleted && styles.scenarioCardDone,
                ]}
              >
                <View style={styles.scenarioLeft}>
                  <Text style={styles.scenarioTitle}>{item.title}</Text>
                  <Text style={styles.scenarioDesc} numberOfLines={2}>{item.description}</Text>
                </View>
                <Text style={styles.scenarioIcon}>{isCompleted ? "✅" : "▶"}</Text>
              </Pressable>
            );
          }}
        />

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
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  headerTitle: { fontSize: 22, fontWeight: "800", color: "#FFFFFF" },
  listContent: { gap: 10, paddingBottom: 12 },
  scenarioCard: {
    backgroundColor: "#1d2e3d",
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#354656",
  },
  scenarioCardDone: { borderColor: "#22C55E50", backgroundColor: "#22C55E10" },
  scenarioLeft: { flex: 1 },
  scenarioTitle: { fontSize: 17, fontWeight: "800", color: "#FFFFFF", marginBottom: 4 },
  scenarioDesc: { fontSize: 13, color: "#9BA1A6", lineHeight: 18 },
  scenarioIcon: { fontSize: 22, color: "#4a9d9c", paddingLeft: 12 },
  callBar: {
    backgroundColor: "#22C55E",
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: "center",
  },
  callText: { fontSize: 20, fontWeight: "800", color: "#FFFFFF", letterSpacing: 1 },
  // Session
  sessionContainer: { flex: 1, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 10 },
  sessionHeader: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  closeBtn: { paddingRight: 14, paddingVertical: 6 },
  closeBtnText: { fontSize: 22, color: "#FF3D3D", fontWeight: "700" },
  sessionTitle: { fontSize: 18, fontWeight: "800", color: "#FFFFFF", flex: 1 },
  promptCard: {
    flex: 1,
    backgroundColor: "#1d2e3d",
    borderRadius: 20,
    padding: 24,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#354656",
    marginBottom: 14,
  },
  promptText: { fontSize: 20, fontWeight: "700", color: "#FFFFFF", lineHeight: 30, textAlign: "center" },
  actionBtn: { borderRadius: 16, paddingVertical: 22, alignItems: "center", marginBottom: 0 },
  actionBtnText: { fontSize: 20, fontWeight: "900", color: "#FFFFFF", letterSpacing: 1 },
  recordBtn: { backgroundColor: "#4a9d9c" },
  stopBtn: { backgroundColor: "#FF3D3D" },
  doneBtn: { backgroundColor: "#22C55E" },
  evaluatingWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  evaluatingText: { fontSize: 16, color: "#4a9d9c", fontWeight: "600" },
  resultCard: {
    flex: 1,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    marginBottom: 14,
  },
  resultCorrect: { backgroundColor: "#22C55E20", borderColor: "#22C55E" },
  resultPartial: { backgroundColor: "#F59E0B20", borderColor: "#F59E0B" },
  resultIncorrect: { backgroundColor: "#FF3D3D20", borderColor: "#FF3D3D" },
  resultEmoji: { fontSize: 64, marginBottom: 12 },
  resultLabel: { fontSize: 22, fontWeight: "900", color: "#FFFFFF", marginBottom: 10 },
  correctAnswerText: { fontSize: 15, color: "#e0e0e0", textAlign: "center", lineHeight: 22 },
});
