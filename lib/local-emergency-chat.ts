/**
 * local-emergency-chat.ts — Emergency conversation using Gemini API
 *
 * Replaces the previous llama.rn + forge server implementation.
 * Works in Expo Go on real phones (pure fetch, no native code).
 */
import {
  analyzeEmergencyWithGemini,
  chatTurnWithGemini,
  type GeminiEmergencyResponse,
} from "./gemini";
import type { ConversationMessage, OperatorResponse } from "./ai-analysis";

/**
 * Main conversation function — replaces chatWithOperator.
 * Accepts conversation history and optional audio transcript.
 */
export async function chatWithOperatorLocal(
  history: ConversationMessage[],
  audioUrl?: string,
  systemContext?: string
): Promise<OperatorResponse & { usedLocalModel: boolean; transcript?: string }> {
  const FALLBACK: OperatorResponse & { usedLocalModel: boolean; transcript?: string } = {
    spoken: "I hear you. Tell me what happened.",
    instruction: "Tell me what happened",
    action: "CONTINUE",
    steps: [],
    severity: "moderate" as any,
    emergencyType: "unknown",
    transcript: undefined,
    usedLocalModel: false,
  };

  try {
    // Opening greeting — no history yet
    if (history.length === 0 && !audioUrl) {
      const greeting: OperatorResponse & { usedLocalModel: boolean; transcript?: string } = {
        spoken: "LIFELINE active. Tell me what happened.",
        instruction: "Tell me what happened",
        action: "CONTINUE",
        steps: [],
        severity: "moderate" as any,
        emergencyType: "unknown",
        transcript: undefined,
        usedLocalModel: false,
      };
      return greeting;
    }

    // Get the last user message as transcript
    const lastUserMsg =
      [...history].reverse().find((m) => m.role === "user")?.content ?? "";

    if (!lastUserMsg) return FALLBACK;

    // Use Gemini to analyze the emergency
    const geminiResult: GeminiEmergencyResponse = await analyzeEmergencyWithGemini(
      lastUserMsg,
      null,
      history
    );

    // Map Gemini result to OperatorResponse shape
    const action: OperatorResponse["action"] = geminiResult.shouldCall103
      ? "CALL_103"
      : geminiResult.shouldSMSFamily
      ? "SMS_FAMILY"
      : geminiResult.nextSteps.length > 0
      ? "SHOW_STEPS"
      : "CONTINUE";

    return {
      spoken: geminiResult.spokenResponse,
      instruction: geminiResult.firstInstruction,
      action,
      steps: geminiResult.nextSteps,
      severity: (geminiResult.severity === "serious" ? "medium" : geminiResult.severity) as any,
      emergencyType: geminiResult.emergencyType,
      transcript: lastUserMsg,
      usedLocalModel: false,
    };
  } catch (e) {
    console.error("[chatWithOperatorLocal] error:", e);
    return FALLBACK;
  }
}
