import {
  Text,
  View,
  Pressable,
  StyleSheet,
  Linking,
  ScrollView,
} from "react-native";
import { useState, useEffect, useRef } from "react";
import { useKeepAwake } from "expo-keep-awake";
import { ScreenContainer } from "@/components/screen-container";
import {
  MEDICAL_TREE,
  type MedicalProtocolStep,
} from "@/constants/emergency-data";
import { haptic } from "@/lib/haptics";
import { speakInstruction, stopSpeech } from "@/lib/speech";
import { useAppContext } from "@/lib/app-context";

type Phase = "tree" | "protocol" | "done";

export default function MedicalScreen() {
  useKeepAwake();
  const { panicDetected } = useAppContext();

  const [phase, setPhase] = useState<Phase>("tree");
  const [nodeId, setNodeId] = useState("q1");
  const [diagnosis, setDiagnosis] = useState("");
  const [protocol, setProtocol] = useState<MedicalProtocolStep[]>([]);
  const [protocolStep, setProtocolStep] = useState(0);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentNode = MEDICAL_TREE[nodeId];

  // TTS for questions
  useEffect(() => {
    if (phase === "tree" && currentNode?.question) {
      speakInstruction(currentNode.question, { panicMode: panicDetected });
    }
    return () => stopSpeech();
  }, [nodeId, phase, panicDetected]);

  // TTS + timer for protocol steps
  useEffect(() => {
    if (phase !== "protocol") return;
    const step = protocol[protocolStep];
    if (!step) return;
    speakInstruction(step.instruction, { panicMode: panicDetected });
    if (step.timerSeconds && step.timerSeconds > 0) {
      setTimerSeconds(step.timerSeconds);
      setTimerRunning(true);
    } else {
      setTimerSeconds(0);
      setTimerRunning(false);
    }
    return () => stopSpeech();
  }, [protocolStep, phase, panicDetected]);

  // Countdown
  useEffect(() => {
    if (!timerRunning) return;
    timerRef.current = setInterval(() => {
      setTimerSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          setTimerRunning(false);
          haptic.success();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerRunning]);

  const handleAnswer = (answer: "yes" | "no") => {
    haptic.medium();
    const nextId = answer === "yes" ? currentNode?.yes : currentNode?.no;
    if (!nextId) return;
    const nextNode = MEDICAL_TREE[nextId];
    if (!nextNode) return;
    if (nextNode.diagnosis) {
      setDiagnosis(nextNode.diagnosis);
      setProtocol(nextNode.protocol ?? []);
      setProtocolStep(0);
      setPhase("protocol");
      haptic.error();
      speakInstruction(`Diagnosis: ${nextNode.diagnosis}. Follow these steps.`, {
        panicMode: panicDetected,
      });
    } else {
      setNodeId(nextId);
    }
  };

  const handleProtocolDone = () => {
    haptic.heavy();
    if (timerRef.current) clearInterval(timerRef.current);
    setTimerRunning(false);
    if (protocolStep < protocol.length - 1) {
      setProtocolStep((prev) => prev + 1);
    } else {
      setPhase("done");
      speakInstruction("All steps completed. Stay calm. Help is on the way.", {
        panicMode: panicDetected,
      });
    }
  };

  const handleReset = () => {
    stopSpeech();
    if (timerRef.current) clearInterval(timerRef.current);
    setPhase("tree");
    setNodeId("q1");
    setDiagnosis("");
    setProtocol([]);
    setProtocolStep(0);
    setTimerSeconds(0);
    setTimerRunning(false);
  };

  const handleCall = () => Linking.openURL("tel:103");

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    return `${m}:${(s % 60).toString().padStart(2, "0")}`;
  };

  const qFontSize = panicDetected ? 22 : 19;
  const sFontSize = panicDetected ? 24 : 20;

  // ── Done ──────────────────────────────────────────────────────────────────
  if (phase === "done") {
    return (
      <ScreenContainer containerClassName="bg-background">
        <ScrollView contentContainerStyle={styles.doneContainer}>
          <Text style={styles.doneEmoji}>✅</Text>
          <Text style={styles.doneTitle}>All steps completed.</Text>
          <Text style={styles.doneSubtitle}>Stay calm. Help is on the way.</Text>
          <Pressable
            onPress={handleCall}
            style={({ pressed }) => [styles.callBar, pressed && { opacity: 0.8 }]}
          >
            <Text style={styles.callText}>📞 Call 103</Text>
          </Pressable>
          <Pressable
            onPress={handleReset}
            style={({ pressed }) => [styles.resetBtn, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.resetText}>↺ New Assessment</Text>
          </Pressable>
        </ScrollView>
      </ScreenContainer>
    );
  }

  // ── Protocol ──────────────────────────────────────────────────────────────
  if (phase === "protocol") {
    const step = protocol[protocolStep];
    return (
      <ScreenContainer containerClassName="bg-background">
        <View style={styles.container}>
          <View style={styles.diagnosisBanner}>
            <Text style={styles.diagnosisLabel}>DIAGNOSIS</Text>
            <Text style={styles.diagnosisText}>{diagnosis}</Text>
          </View>
          <View style={styles.stepHeader}>
            <Text style={styles.stepCounter}>
              Step {protocolStep + 1} / {protocol.length}
            </Text>
            <View style={styles.dotsRow}>
              {protocol.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    i < protocolStep
                      ? styles.dotDone
                      : i === protocolStep
                      ? styles.dotActive
                      : styles.dotPending,
                  ]}
                />
              ))}
            </View>
          </View>
          <View style={styles.stepCard}>
            <Text style={styles.stepEmoji}>{step?.emoji}</Text>
            <Text style={[styles.stepInstruction, { fontSize: sFontSize, lineHeight: sFontSize * 1.4 }]}>
              {step?.instruction}
            </Text>
            {step?.timerSeconds && step.timerSeconds > 0 ? (
              <View style={styles.timerBox}>
                <Text style={styles.timerLabel}>{step.timerLabel}</Text>
                <Text style={[styles.timerValue, timerSeconds === 0 && styles.timerDone]}>
                  {timerSeconds > 0 ? fmt(timerSeconds) : "✓ Done"}
                </Text>
              </View>
            ) : null}
          </View>
          <Pressable
            onPress={handleProtocolDone}
            style={({ pressed }) => [
              styles.doneBtn,
              pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 },
              panicDetected && styles.doneBtnLarge,
            ]}
          >
            <Text style={[styles.doneBtnText, panicDetected && { fontSize: 22 }]}>
              ✓ DONE
            </Text>
          </Pressable>
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

  // ── Decision tree ─────────────────────────────────────────────────────────
  return (
    <ScreenContainer containerClassName="bg-background">
      <View style={styles.container}>
        <View style={styles.treeHeader}>
          <Text style={styles.treeTitle}>🏥 Medical AI</Text>
          <View style={styles.treeBadge}>
            <Text style={styles.treeBadgeText}>● OFFLINE</Text>
          </View>
        </View>
        <Text style={styles.treeSubtitle}>
          Answer YES or NO to identify the emergency.
        </Text>
        <View style={styles.questionCard}>
          <Text style={styles.questionEmoji}>❓</Text>
          <Text style={[styles.questionText, { fontSize: qFontSize, lineHeight: qFontSize * 1.45 }]}>
            {currentNode?.question}
          </Text>
        </View>
        <View style={styles.answerRow}>
          <Pressable
            onPress={() => handleAnswer("yes")}
            style={({ pressed }) => [
              styles.yesBtn,
              pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 },
              panicDetected && styles.answerBtnLarge,
            ]}
          >
            <Text style={[styles.yesBtnText, panicDetected && { fontSize: 22 }]}>
              ✓ YES
            </Text>
          </Pressable>
          <Pressable
            onPress={() => handleAnswer("no")}
            style={({ pressed }) => [
              styles.noBtn,
              pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 },
              panicDetected && styles.answerBtnLarge,
            ]}
          >
            <Text style={[styles.noBtnText, panicDetected && { fontSize: 22 }]}>
              ✗ NO
            </Text>
          </Pressable>
        </View>
        <View style={styles.hintCard}>
          <Text style={styles.hintText}>
            🤖 AI will identify the diagnosis and guide you step by step.
          </Text>
        </View>
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
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  treeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  treeTitle: { fontSize: 22, fontWeight: "800", color: "#FFFFFF" },
  treeBadge: {
    backgroundColor: "#0D6E6E",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  treeBadgeText: { color: "#afffff", fontSize: 11, fontWeight: "700" },
  treeSubtitle: { fontSize: 14, color: "#e0e0e0", marginBottom: 20 },
  questionCard: {
    flex: 1,
    backgroundColor: "#1d2e3d",
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#354656",
    marginBottom: 20,
  },
  questionEmoji: { fontSize: 56, marginBottom: 16 },
  questionText: { fontWeight: "800", color: "#FFFFFF", textAlign: "center" },
  answerRow: { flexDirection: "row", gap: 12, marginBottom: 12 },
  yesBtn: {
    flex: 1,
    backgroundColor: "#22C55E",
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: "center",
  },
  yesBtnText: { fontSize: 18, fontWeight: "900", color: "#FFFFFF" },
  noBtn: {
    flex: 1,
    backgroundColor: "#FF3D3D",
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: "center",
  },
  noBtnText: { fontSize: 18, fontWeight: "900", color: "#FFFFFF" },
  answerBtnLarge: { paddingVertical: 22 },
  hintCard: {
    backgroundColor: "#0D6E6E20",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#0D6E6E",
    marginBottom: 12,
  },
  hintText: { fontSize: 13, color: "#afffff", textAlign: "center" },
  // Protocol
  diagnosisBanner: {
    backgroundColor: "#FF3D3D20",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#FF3D3D",
    marginBottom: 14,
    alignItems: "center",
  },
  diagnosisLabel: {
    fontSize: 11,
    color: "#FF3D3D",
    fontWeight: "700",
    letterSpacing: 2,
    marginBottom: 4,
  },
  diagnosisText: { fontSize: 18, fontWeight: "900", color: "#FFFFFF" },
  stepHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  stepCounter: { fontSize: 13, color: "#e0e0e0", fontWeight: "600" },
  dotsRow: { flexDirection: "row", gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotDone: { backgroundColor: "#22C55E" },
  dotActive: { backgroundColor: "#FF3D3D" },
  dotPending: { backgroundColor: "#354656" },
  stepCard: {
    flex: 1,
    backgroundColor: "#1d2e3d",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#354656",
    marginBottom: 14,
  },
  stepEmoji: { fontSize: 64, marginBottom: 16 },
  stepInstruction: { fontWeight: "800", color: "#FFFFFF", textAlign: "center" },
  timerBox: {
    marginTop: 20,
    backgroundColor: "#FF3D3D20",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#FF3D3D",
    width: "100%",
  },
  timerLabel: { fontSize: 12, color: "#FF3D3D", fontWeight: "600", marginBottom: 6 },
  timerValue: { fontSize: 36, fontWeight: "900", color: "#FF3D3D" },
  timerDone: { color: "#22C55E" },
  doneBtn: {
    backgroundColor: "#22C55E",
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: "center",
    marginBottom: 10,
  },
  doneBtnLarge: { paddingVertical: 22 },
  doneBtnText: { fontSize: 18, fontWeight: "900", color: "#FFFFFF", letterSpacing: 2 },
  callBar: {
    backgroundColor: "#FF3D3D",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  callText: { fontSize: 16, fontWeight: "700", color: "#FFFFFF" },
  // Done screen
  doneContainer: {
    flex: 1,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  doneEmoji: { fontSize: 80 },
  doneTitle: { fontSize: 28, fontWeight: "900", color: "#22C55E" },
  doneSubtitle: { fontSize: 16, color: "#e0e0e0", textAlign: "center" },
  resetBtn: {
    backgroundColor: "#1d2e3d",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: "#354656",
    marginTop: 8,
  },
  resetText: { fontSize: 14, color: "#4a9d9c", fontWeight: "600" },
});
