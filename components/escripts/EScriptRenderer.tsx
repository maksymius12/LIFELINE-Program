/**
 * EScriptRenderer — UI State Manager
 *
 * The central router for the E-Script Engine.
 * Receives a parsed EScript and renders the appropriate component
 * on an OLED-black (#000000) background, hiding the standard chat UI.
 *
 * When the user completes an action (answers poll, finishes scheme,
 * countdown expires, hardware stopped), it calls onComplete(context)
 * so the parent can feed the result back into the AI conversation.
 */
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useEffect } from "react";
import type { EScript, PollPayload, SchemePayload, HardwarePayload, CountdownPayload } from "@/lib/EScriptEngine";
import { PollComponent } from "./PollComponent";
import { SchemeComponent } from "./SchemeComponent";
import { CountdownComponent } from "./CountdownComponent";
import { HardwareTriggerComponent } from "./HardwareTriggerComponent";
import { speakInstruction, stopSpeech } from "@/lib/speech";
import { haptic } from "@/lib/haptics";

interface EScriptRendererProps {
  script: EScript;
  /** Called when the user completes the current action. context = user's response/result */
  onComplete: (context: string) => void;
  /** Called to dismiss agentic UI and return to chat */
  onDismiss: () => void;
}

export function EScriptRenderer({ script, onComplete, onDismiss }: EScriptRendererProps) {
  const { voice_backup, action_type, payload } = script;

  // Speak voice_backup on mount
  useEffect(() => {
    if (voice_backup) {
      speakInstruction(voice_backup);
    }
    return () => stopSpeech();
  }, [voice_backup]);

  const handleDismiss = () => {
    haptic.light();
    stopSpeech();
    onDismiss();
  };

  return (
    <View style={styles.root}>
      {/* OLED black background fills entire screen */}

      {/* Minimal header — action type badge + dismiss */}
      <View style={styles.header}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{ACTION_LABELS[action_type]}</Text>
        </View>
        <Pressable onPress={handleDismiss} style={styles.dismissBtn}>
          <Text style={styles.dismissText}>✕</Text>
        </Pressable>
      </View>

      {/* Component area */}
      <View style={styles.content}>
        {action_type === "UI_RENDER_POLL" && (
          <PollComponent
            payload={payload as PollPayload}
            onAnswer={(answer) => {
              haptic.success();
              onComplete(`User selected: ${answer}`);
            }}
          />
        )}

        {action_type === "UI_SHOW_SCHEME" && (
          <SchemeComponent
            payload={payload as SchemePayload}
            onComplete={() => {
              haptic.success();
              onComplete("Scheme completed");
            }}
          />
        )}

        {action_type === "COUNTER_TIMEOUT" && (
          <CountdownComponent
            payload={payload as CountdownPayload}
            onExpire={(action) => {
              onComplete(`Expired: ${action}`);
            }}
            onCancel={() => {
              onComplete("Countdown cancelled by user");
            }}
          />
        )}

        {action_type === "HARDWARE_TRIGGER" && (
          <HardwareTriggerComponent
            payload={payload as HardwarePayload}
            voiceBackup={voice_backup}
            onStop={() => {
              onComplete(`Hardware stopped: ${(payload as HardwarePayload).trigger}`);
            }}
          />
        )}
      </View>
    </View>
  );
}

const ACTION_LABELS: Record<string, string> = {
  UI_RENDER_POLL:   "● DIAGNOSIS",
  UI_SHOW_SCHEME:   "● INSTRUCTIONS",
  COUNTER_TIMEOUT:  "● COUNTDOWN",
  HARDWARE_TRIGGER: "● HARDWARE",
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000000", // OLED black
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  badge: {
    backgroundColor: "#FF3D3D20",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "#FF3D3D60",
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#FF3D3D",
    letterSpacing: 1.5,
  },
  dismissBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  dismissText: {
    fontSize: 18,
    color: "#687076",
    fontWeight: "600",
  },
  content: {
    flex: 1,
  },
});
