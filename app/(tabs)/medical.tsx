import {
  Text,
  View,
  Pressable,
  StyleSheet,
  Linking,
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

  useEffect(() => {
    if (phase === "tree" && currentNode?.question) {
      speakInstruction(currentNode.question, { panicMode: panicDetected });
    }
    return () => stopSpeech();
  }, [nodeId, phase, panicDetected]);

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
      speakInstruction(`${nextNode.diagnosis}. Follow these steps.`, { panicMode: panicDetected });
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
      speakInstruction("All steps completed. Stay calm.", { panicMode: panicDetected });
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

  const qFontSize = panicDetected ? 26 : 22;
  const sFontSize = panicDetected ? 28 : 24;

  // ── Done ──────────────────────────────────────────────────────────────────
  if (phase === "done") {
    return (
      <ScreenContainer containerClassName="bg-background">
        <View style={styles.doneWrap}>
          <Text style={styles.doneEmoji}>✅</Text>
          <Text style={styles.doneTitle}>All steps done.</Text>
          <Text style={styles.doneSub}>Stay calm. Help is on the way.</Text>
          <Pressable
            onPress={handleCall}
            style={({ pressed }) => [styles.callBar, pressed && { opacity: 0.8 }]}
          >
            <Text style={styles.callText}>📞  Call 103</Text>
          </Pressable>
          <Pressable onPress={handleReset} style={styles.resetBtn}>
            <Text style={styles.resetText}>↺ New Assessment</Text>
          </Pressable>
        </View>
      </ScreenContainer>
    );
  }

  // ── Protocol ──────────────────────────────────────────────────────────────
  if (phase === "protocol") {
    const step = protocol[protocolStep];
    return (
      <ScreenContainer containerClassName="bg-background">
        <View style={styles.container}>
          {/* Diagnosis label — compact */}
          <View style={styles.diagnosisBanner}>
            <Text style={styles.diagnosisText}>{diagnosis}</Text>
            <Text style={styles.stepNum}>{protocolStep + 1}/{protocol.length}</Text>
          </View>

          {/* Progress dots */}
          <View style={styles.dotsRow}>
            {protocol.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  i < protocolStep ? styles.dotDone
                    : i === protocolStep ? styles.dotActive
                    : styles.dotPending,
                ]}
              />
            ))}
          </View>

          {/* Step card — fills screen */}
          <View style={styles.card}>
            <Text style={styles.cardEmoji}>{step?.emoji}</Text>
            <Text style={[styles.cardInstruction, { fontSize: sFontSize, lineHeight: sFontSize * 1.35 }]}>
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

          {/* DONE — giant */}
          <Pressable
            onPress={handleProtocolDone}
            style={({ pressed }) => [styles.doneBtn, pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 }]}
          >
            <Text style={styles.doneBtnText}>✓  DONE</Text>
          </Pressable>

          <Pressable
            onPress={handleCall}
            style={({ pressed }) => [styles.callBar, pressed && { opacity: 0.8 }]}
          >
            <Text style={styles.callText}>📞  Call 103</Text>
          </Pressable>
        </View>
      </ScreenContainer>
    );
  }

  // ── Decision tree ─────────────────────────────────────────────────────────
  return (
    <ScreenContainer containerClassName="bg-background">
      <View style={styles.container}>
        {/* Screen title — minimal */}
        <Text style={styles.screenTitle}>🏥 Medical AI</Text>

        {/* Question card — fills most of screen */}
        <View style={styles.card}>
          <Text style={styles.cardEmoji}>❓</Text>
          <Text style={[styles.cardInstruction, { fontSize: qFontSize, lineHeight: qFontSize * 1.45 }]}>
            {currentNode?.question}
          </Text>
        </View>

        {/* YES / NO — full-width, stacked, giant */}
        <Pressable
          onPress={() => handleAnswer("yes")}
          style={({ pressed }) => [styles.yesBtn, pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 }]}
        >
          <Text style={styles.yesBtnText}>✓  YES</Text>
        </Pressable>
        <Pressable
          onPress={() => handleAnswer("no")}
          style={({ pressed }) => [styles.noBtn, pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 }]}
        >
          <Text style={styles.noBtnText}>✗  NO</Text>
        </Pressable>

        <Pressable
          onPress={handleCall}
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
  screenTitle: { fontSize: 22, fontWeight: "800", color: "#FFFFFF", marginBottom: 12 },
  card: {
    flex: 1,
    backgroundColor: "#1d2e3d",
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 28,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#354656",
    marginBottom: 12,
  },
  cardEmoji: { fontSize: 64, marginBottom: 18 },
  cardInstruction: { fontWeight: "800", color: "#FFFFFF", textAlign: "center" },
  timerBox: {
    marginTop: 20,
    backgroundColor: "#FF3D3D20",
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#FF3D3D60",
  },
  timerLabel: { fontSize: 13, color: "#e0e0e0", fontWeight: "600", marginBottom: 4 },
  timerValue: { fontSize: 36, fontWeight: "900", color: "#FF3D3D" },
  timerDone: { color: "#22C55E" },
  yesBtn: {
    backgroundColor: "#22C55E",
    borderRadius: 16,
    paddingVertical: 22,
    alignItems: "center",
    marginBottom: 10,
  },
  yesBtnText: { fontSize: 22, fontWeight: "900", color: "#FFFFFF", letterSpacing: 2 },
  noBtn: {
    backgroundColor: "#FF3D3D",
    borderRadius: 16,
    paddingVertical: 22,
    alignItems: "center",
    marginBottom: 10,
  },
  noBtnText: { fontSize: 22, fontWeight: "900", color: "#FFFFFF", letterSpacing: 2 },
  doneBtn: {
    backgroundColor: "#22C55E",
    borderRadius: 16,
    paddingVertical: 22,
    alignItems: "center",
    marginBottom: 10,
  },
  doneBtnText: { fontSize: 22, fontWeight: "900", color: "#FFFFFF", letterSpacing: 2 },
  callBar: {
    backgroundColor: "#22C55E",
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: "center",
  },
  callText: { fontSize: 20, fontWeight: "800", color: "#FFFFFF", letterSpacing: 1 },
  // Diagnosis protocol
  diagnosisBanner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  diagnosisText: { fontSize: 16, fontWeight: "800", color: "#FF3D3D" },
  stepNum: { fontSize: 15, color: "#e0e0e0", fontWeight: "700" },
  dotsRow: { flexDirection: "row", justifyContent: "center", gap: 10, marginBottom: 12 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  dotDone: { backgroundColor: "#22C55E" },
  dotActive: { backgroundColor: "#FF3D3D" },
  dotPending: { backgroundColor: "#354656" },
  // Done screen
  doneWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingBottom: 20,
    gap: 16,
  },
  doneEmoji: { fontSize: 80 },
  doneTitle: { fontSize: 34, fontWeight: "900", color: "#22C55E", textAlign: "center" },
  doneSub: { fontSize: 18, color: "#e0e0e0", textAlign: "center", lineHeight: 26 },
  resetBtn: { paddingVertical: 10 },
  resetText: { fontSize: 15, color: "#4a9d9c", fontWeight: "600" },
});
