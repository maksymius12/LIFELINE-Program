/**
 * On-Device Emergency Chat
 *
 * Uses Gemma 3 1B running locally via llama.rn.
 * Falls back to the remote forge API if the model isn't loaded yet.
 *
 * This replaces the `chatWithOperator` function in ai-analysis.ts
 * with a version that prefers on-device inference.
 */
import { localCompletion, isLocalLLMReady } from "./local-llm";
import {
  chatWithOperator as remoteChat,
  type ConversationMessage,
  type OperatorResponse,
} from "./ai-analysis";

// ─── System Prompt (same as server) ──────────────────────────────────────────

const OPERATOR_SYSTEM_PROMPT = `You are LIFELINE, an AI emergency response operator — exactly like a 911 dispatcher.
Your job: listen to the user's emergency, assess the situation, and guide them to safety step by step.

RESPONSE FORMAT — always respond with valid JSON only, no markdown, no explanation:
{
  "spoken": "What you say out loud to the user (1-2 short sentences, calm, direct)",
  "instruction": "The single most important action right now (max 12 words)",
  "action": "CONTINUE",
  "steps": [],
  "severity": "low",
  "emergencyType": "unknown"
}

action must be one of: CONTINUE, CALL_103, SMS_FAMILY, SHOW_STEPS, DONE
severity must be one of: low, medium, critical
emergencyType must be one of: fire, injury, flood, quake, blackout, toxic, medical, unknown

Rules:
- First message with no user text: greet and ask "LIFELINE. What's your emergency?"
- Keep responses SHORT. User is panicking.
- Never ask more than one question per turn.
- If unsure: assume worst case.
- Respond ONLY with the JSON object. No other text.`;

// ─── Parse LLM output ─────────────────────────────────────────────────────────

function parseOperatorResponse(raw: string): OperatorResponse | null {
  try {
    // Extract JSON from response (model may add extra text)
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const data = JSON.parse(match[0]);
    return {
      spoken: data.spoken ?? "Stay calm. I'm here to help.",
      instruction: data.instruction ?? "Stay calm",
      action: data.action ?? "CONTINUE",
      steps: data.steps ?? [],
      severity: data.severity ?? "medium",
      emergencyType: data.emergencyType ?? "unknown",
      transcript: null,
    };
  } catch {
    return null;
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Send a turn in the emergency conversation.
 * Uses on-device Gemma 3 if loaded, otherwise falls back to remote API.
 */
export async function chatWithOperatorLocal(
  history: ConversationMessage[],
  audioUrl?: string,
  userText?: string,
  onToken?: (token: string) => void
): Promise<OperatorResponse & { usedLocalModel: boolean }> {
  // If audio URL provided, we still need the server to transcribe it
  // (Whisper transcription requires the server for now)
  // But we can run the LLM part locally after getting the transcript
  if (audioUrl) {
    const remote = await remoteChat(history, audioUrl, userText);
    return { ...remote, usedLocalModel: false };
  }

  // Try on-device first
  if (isLocalLLMReady()) {
    try {
      const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
        { role: "system", content: OPERATOR_SYSTEM_PROMPT },
      ];

      for (const msg of history) {
        messages.push({ role: msg.role, content: msg.content });
      }

      if (userText && (history.length === 0 || history[history.length - 1]?.role !== "user")) {
        messages.push({ role: "user", content: userText });
      }

      if (messages.length === 1) {
        messages.push({ role: "user", content: "start" });
      }

      const raw = await localCompletion(messages, onToken);
      if (raw) {
        const parsed = parseOperatorResponse(raw);
        if (parsed) {
          return { ...parsed, usedLocalModel: true };
        }
      }
    } catch {
      // fall through to remote
    }
  }

  // Fallback to remote API
  const remote = await remoteChat(history, undefined, userText);
  return { ...remote, usedLocalModel: false };
}
