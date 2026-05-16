import {
  Text,
  View,
  Pressable,
  StyleSheet,
  FlatList,
  Linking,
  ActivityIndicator,
  Platform,
  ScrollView,
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

// ── My Kit checklist ──────────────────────────────────────────────────────────
const KIT_ITEMS = [
  { id: "water", label: "💧 Water (3-day supply)", desc: "3L per person per day" },
  { id: "firstaid", label: "🩹 First Aid Kit", desc: "Bandages, antiseptic, gloves" },
  { id: "flashlight", label: "🔦 Flashlight + batteries", desc: "Or hand-crank / solar" },
  { id: "powerbank", label: "🔋 Power bank (charged)", desc: "10,000 mAh minimum" },
  { id: "documents", label: "📄 Documents (copies)", desc: "ID, insurance, contacts" },
  { id: "cash", label: "💵 Cash (small bills)", desc: "ATMs may be offline" },
  { id: "whistle", label: "📯 Emergency whistle", desc: "Signal rescuers" },
  { id: "meds", label: "💊 Medications (7-day)", desc: "Prescriptions + basics" },
];

const KIT_KEY = "kit_checked";
const COMPLETED_KEY = "training_completed";

type SessionPhase = "prompt" | "recording" | "evaluating" | "result";
type Tab = "kit" | "training";

interface SessionState {
  scenarioId: string;
  phase: SessionPhase;
  evaluation: "correct" | "partial" | "incorrect" | null;
  feedback: string;
  correctAnswer: string;
}

export default function PrepareScreen() {
  const { panicDetected } = useAppContext();

  const [activeTab, setActiveTab] = useState<Tab>("kit");

  // Kit state
  const [checkedIds, setCheckedIds] = useState<string[]>([]);

  // Training state
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [session, setSession] = useState<SessionState | null>(null);

  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  useAudioRecorderState(audioRecorder);

  useEffect(() => {
    (async () => {
      const k = await AsyncStorage.getItem(KIT_KEY);
      if (k) setCheckedIds(JSON.parse(k));
      const c = await AsyncStorage.getItem(COMPLETED_KEY);
      if (c) setCompletedIds(JSON.parse(c));
    })();
  }, []);

  // ── Kit handlers ─────────────────────────────────────────────────────────────
  const toggleKit = async (id: string) => {
    haptic.light();
    const next = checkedIds.includes(id)
      ? checkedIds.filter((i) => i !== id)
      : [...checkedIds, id];
    setCheckedIds(next);
    await AsyncStorage.setItem(KIT_KEY, JSON.stringify(next));
  };

  // ── Training handlers ─────────────────────────────────────────────────────────
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
      const uri = audioRecorder.uri ?? "";
      let transcript = "";
      if (uri) {
        transcript = await transcribeAudioUri(uri);
      }
      if (!transcript) {
        setSession((prev) => prev ? { ...prev, phase: "prompt" } : prev);
        return;
      }
      const scenario = TRAINING_SCENARIOS.find((s) => s.id === session.scenarioId);
      const result = await analyzeEmergency(
        `Training evaluation. Scenario: "${scenario?.prompt}". Correct answer: "${session.correctAnswer}". User answered: "${transcript}". Rate as correct/partial/incorrect and give brief feedback.`
      );
      const evalText = result.spokenResponse.toLowerCase();
      const evaluation: "correct" | "partial" | "incorrect" =
        evalText.includes("correct") ? "correct"
        : evalText.includes("partial") ? "partial"
        : "incorrect";
      if (evaluation === "correct") {
        haptic.success();
        const next = [...new Set([...completedIds, session.scenarioId])];
        setCompletedIds(next);
        await AsyncStorage.setItem(COMPLETED_KEY, JSON.stringify(next));
      } else {
        haptic.error();
      }
      setSession((prev) => prev ? { ...prev, phase: "result", evaluation, feedback: result.spokenResponse } : prev);
    } catch {
      setSession((prev) => prev ? { ...prev, phase: "prompt" } : prev);
    }
  };

  const handleEndSession = () => {
    stopSpeech();
    setSession(null);
  };

  // ── Session view ─────────────────────────────────────────────────────────────
  if (session) {
    const scenario = TRAINING_SCENARIOS.find((s) => s.id === session.scenarioId);
    return (
      <ScreenContainer containerClassName="bg-background" edges={["top", "left", "right", "bottom"]}>
        <View style={styles.sessionContainer}>
          <Pressable onPress={handleEndSession} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← Back</Text>
          </Pressable>

          <Text style={styles.sessionTitle}>{scenario?.title}</Text>

          {/* Prompt */}
          <View style={styles.promptCard}>
            <Text style={styles.promptText}>{scenario?.prompt}</Text>
          </View>

          {session.phase === "prompt" && (
            <Pressable
              onPress={handleStartRecording}
              style={({ pressed }) => [styles.recordBtn, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.recordBtnText}>🎙 Speak Your Answer</Text>
            </Pressable>
          )}

          {session.phase === "recording" && (
            <Pressable
              onPress={handleStopRecording}
              style={({ pressed }) => [styles.stopBtn, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.stopBtnText}>⏹ Stop Recording</Text>
            </Pressable>
          )}

          {session.phase === "evaluating" && (
            <View style={styles.evaluatingRow}>
              <ActivityIndicator color="#4a9d9c" size="large" />
              <Text style={styles.evaluatingText}>Evaluating…</Text>
            </View>
          )}

          {session.phase === "result" && (
            <>
              <View style={[
                styles.resultBadge,
                session.evaluation === "correct" ? styles.resultCorrect
                : session.evaluation === "partial" ? styles.resultPartial
                : styles.resultIncorrect,
              ]}>
                <Text style={styles.resultBadgeText}>
                  {session.evaluation === "correct" ? "✅ Correct" : session.evaluation === "partial" ? "⚠️ Partial" : "❌ Incorrect"}
                </Text>
              </View>
              <Text style={styles.feedbackText}>{session.feedback}</Text>
              <Text style={styles.correctAnswerLabel}>Correct answer:</Text>
              <Text style={styles.correctAnswerText}>{session.correctAnswer}</Text>
              <Pressable
                onPress={handleEndSession}
                style={({ pressed }) => [styles.doneBtn, pressed && { opacity: 0.85 }]}
              >
                <Text style={styles.doneBtnText}>Done</Text>
              </Pressable>
            </>
          )}
        </View>
      </ScreenContainer>
    );
  }

  // ── Main prepare screen ───────────────────────────────────────────────────────
  const kitProgress = checkedIds.length;
  const kitTotal = KIT_ITEMS.length;

  return (
    <ScreenContainer containerClassName="bg-background">
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>🛡 Prepare</Text>
        </View>

        {/* Tab switcher */}
        <View style={styles.tabRow}>
          <Pressable
            onPress={() => setActiveTab("kit")}
            style={[styles.tabBtn, activeTab === "kit" && styles.tabBtnActive]}
          >
            <Text style={[styles.tabBtnText, activeTab === "kit" && styles.tabBtnTextActive]}>My Kit</Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveTab("training")}
            style={[styles.tabBtn, activeTab === "training" && styles.tabBtnActive]}
          >
            <Text style={[styles.tabBtnText, activeTab === "training" && styles.tabBtnTextActive]}>Training</Text>
          </Pressable>
        </View>

        {/* Kit tab */}
        {activeTab === "kit" && (
          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
            <View style={styles.kitProgress}>
              <Text style={styles.kitProgressText}>{kitProgress}/{kitTotal} items ready</Text>
              <View style={styles.kitProgressBar}>
                <View style={[styles.kitProgressFill, { width: `${(kitProgress / kitTotal) * 100}%` as any }]} />
              </View>
            </View>
            {KIT_ITEMS.map((item) => {
              const checked = checkedIds.includes(item.id);
              return (
                <Pressable
                  key={item.id}
                  onPress={() => toggleKit(item.id)}
                  style={({ pressed }) => [
                    styles.kitItem,
                    checked && styles.kitItemChecked,
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <View style={styles.kitItemLeft}>
                    <Text style={styles.kitItemLabel}>{item.label}</Text>
                    <Text style={styles.kitItemDesc}>{item.desc}</Text>
                  </View>
                  <View style={[styles.kitCheckbox, checked && styles.kitCheckboxChecked]}>
                    {checked && <Text style={styles.kitCheckmark}>✓</Text>}
                  </View>
                </Pressable>
              );
            })}
            <View style={{ height: 20 }} />
          </ScrollView>
        )}

        {/* Training tab */}
        {activeTab === "training" && (
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
        )}

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
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  headerTitle: { fontSize: 22, fontWeight: "800", color: "#FFFFFF" },

  // Tab switcher
  tabRow: { flexDirection: "row", backgroundColor: "#1d2e3d", borderRadius: 10, padding: 3, marginBottom: 14 },
  tabBtn: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 8 },
  tabBtnActive: { backgroundColor: "#0D6E6E" },
  tabBtnText: { fontSize: 14, fontWeight: "600", color: "#8E9BAA" },
  tabBtnTextActive: { color: "#FFFFFF" },

  // Kit
  kitProgress: { marginBottom: 12 },
  kitProgressText: { fontSize: 13, color: "#8E9BAA", marginBottom: 6, fontWeight: "600" },
  kitProgressBar: { height: 6, backgroundColor: "#1d2e3d", borderRadius: 3, overflow: "hidden" },
  kitProgressFill: { height: 6, backgroundColor: "#22C55E", borderRadius: 3 },
  kitItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1d2e3d",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#354656",
  },
  kitItemChecked: { borderColor: "#22C55E", backgroundColor: "#0D2A1A" },
  kitItemLeft: { flex: 1 },
  kitItemLabel: { fontSize: 15, fontWeight: "700", color: "#FFFFFF", marginBottom: 2 },
  kitItemDesc: { fontSize: 12, color: "#8E9BAA" },
  kitCheckbox: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 2, borderColor: "#354656",
    alignItems: "center", justifyContent: "center",
  },
  kitCheckboxChecked: { backgroundColor: "#22C55E", borderColor: "#22C55E" },
  kitCheckmark: { fontSize: 16, color: "#FFFFFF", fontWeight: "900" },

  // Training list
  listContent: { gap: 10, paddingBottom: 12 },
  scenarioCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1d2e3d",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: "#354656",
  },
  scenarioCardDone: { borderColor: "#22C55E", backgroundColor: "#0D2A1A" },
  scenarioLeft: { flex: 1 },
  scenarioTitle: { fontSize: 16, fontWeight: "700", color: "#FFFFFF", marginBottom: 4 },
  scenarioDesc: { fontSize: 13, color: "#8E9BAA", lineHeight: 18 },
  scenarioIcon: { fontSize: 22, marginLeft: 12 },

  // Session
  sessionContainer: { flex: 1, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20 },
  backBtn: { paddingVertical: 8, paddingRight: 12, alignSelf: "flex-start" },
  backBtnText: { fontSize: 16, color: "#4a9d9c", fontWeight: "600" },
  sessionTitle: { fontSize: 20, fontWeight: "800", color: "#FFFFFF", marginBottom: 16, marginTop: 8 },
  promptCard: {
    backgroundColor: "#1d2e3d",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#354656",
  },
  promptText: { fontSize: 17, color: "#FFFFFF", lineHeight: 26, fontWeight: "600" },
  recordBtn: {
    backgroundColor: "#0D6E6E",
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: "center",
  },
  recordBtnText: { fontSize: 18, fontWeight: "800", color: "#FFFFFF" },
  stopBtn: {
    backgroundColor: "#FF3D3D",
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: "center",
  },
  stopBtnText: { fontSize: 18, fontWeight: "800", color: "#FFFFFF" },
  evaluatingRow: { alignItems: "center", gap: 12, marginTop: 20 },
  evaluatingText: { fontSize: 16, color: "#8E9BAA", fontWeight: "600" },
  resultBadge: { borderRadius: 12, paddingVertical: 12, paddingHorizontal: 20, alignItems: "center", marginBottom: 16 },
  resultCorrect: { backgroundColor: "#0D2A1A", borderWidth: 1, borderColor: "#22C55E" },
  resultPartial: { backgroundColor: "#1A1400", borderWidth: 1, borderColor: "#F59E0B" },
  resultIncorrect: { backgroundColor: "#1A0000", borderWidth: 1, borderColor: "#FF3D3D" },
  resultBadgeText: { fontSize: 18, fontWeight: "800", color: "#FFFFFF" },
  feedbackText: { fontSize: 15, color: "#e0e0e0", lineHeight: 22, marginBottom: 12 },
  correctAnswerLabel: { fontSize: 13, color: "#8E9BAA", fontWeight: "600", marginBottom: 4 },
  correctAnswerText: { fontSize: 14, color: "#4a9d9c", lineHeight: 20, marginBottom: 20 },
  doneBtn: {
    backgroundColor: "#22C55E",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  doneBtnText: { fontSize: 18, fontWeight: "800", color: "#FFFFFF" },

  // Call bar
  callBar: {
    backgroundColor: "#22C55E",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  callText: { fontSize: 18, fontWeight: "800", color: "#FFFFFF", letterSpacing: 1 },
});
