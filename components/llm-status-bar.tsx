/**
 * LLMStatusBar
 *
 * Shows a small indicator of the on-device Gemma model status.
 * Displayed at the top of the SOS screen so judges can see the AI engine.
 *
 * States:
 *   idle       → "Gemma 3 · Loading…"
 *   downloading→ "Gemma 3 · Downloading model X%"
 *   loading    → "Gemma 3 · Initializing…"
 *   ready      → "● Gemma 3 1B · On-device" (green)
 *   error      → "Gemma 3 · Cloud fallback" (yellow)
 */
import { View, Text, StyleSheet } from "react-native";
import { useEffect, useState } from "react";
import { onLLMStatus, type LLMStatus } from "@/lib/local-llm";

export function LLMStatusBar() {
  const [status, setStatus] = useState<LLMStatus>("idle");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const unsub = onLLMStatus((s, p) => {
      setStatus(s);
      if (p !== undefined) setProgress(p);
    });
    return unsub;
  }, []);

  const label = (() => {
    switch (status) {
      case "downloading":
        return `Gemma 3 · Downloading ${Math.round(progress * 100)}%`;
      case "loading":
        return "Gemma 3 · Initializing…";
      case "ready":
        return "● Gemma 3 1B · On-device";
      case "error":
        return "Gemma 3 · Cloud fallback";
      default:
        return "Gemma 3 · Loading…";
    }
  })();

  const color = status === "ready" ? "#22C55E" : status === "error" ? "#F59E0B" : "#9BA1A6";

  return (
    <View style={styles.bar}>
      <Text style={[styles.text, { color }]}>{label}</Text>
      {status === "downloading" && (
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` as any }]} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: "#0a0f14",
    borderBottomWidth: 1,
    borderBottomColor: "#1d2e3d",
    gap: 4,
  },
  text: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  progressTrack: {
    height: 2,
    backgroundColor: "#1d2e3d",
    borderRadius: 1,
    overflow: "hidden",
  },
  progressFill: {
    height: 2,
    backgroundColor: "#4a9d9c",
    borderRadius: 1,
  },
});
