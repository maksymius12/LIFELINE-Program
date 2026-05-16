/**
 * Emergency AI Analysis Service
 *
 * Uses the Manus built-in LLM via the server tRPC route.
 * Supports multi-turn conversation (911-call style) and single-turn legacy calls.
 * Falls back to keyword detection if the server call fails.
 */
import { getApiBaseUrl } from "@/constants/oauth";
import * as Auth from "@/lib/_core/auth";
import type { DisasterType } from "@/constants/emergency-data";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

export interface OperatorResponse {
  spoken: string;
  instruction: string;
  action: "CONTINUE" | "CALL_103" | "SMS_FAMILY" | "SHOW_STEPS" | "DONE";
  steps: string[];
  severity: "low" | "medium" | "critical";
  emergencyType: DisasterType | "unknown";
  transcript?: string | null;
}

/** Legacy single-turn result shape (kept for backward compat) */
export interface AIAnalysisResult {
  emergencyType: DisasterType | "unknown";
  severity: "critical" | "serious" | "moderate";
  firstInstruction: string;
  shouldCall103: boolean;
  shouldSMSFamily: boolean;
  nearestHelp: boolean;
  spokenResponse: string;
}

// ─── Multi-turn Chat (primary) ────────────────────────────────────────────────

/**
 * Send a turn in the 911-operator conversation.
 * @param history  Previous messages in the conversation
 * @param audioUrl Optional S3 URL of a recorded audio clip to transcribe
 * @param userText Optional pre-transcribed text (used when no audio)
 */
export async function chatWithOperator(
  history: ConversationMessage[],
  audioUrl?: string,
  userText?: string
): Promise<OperatorResponse> {
  try {
    const result = await callChatRoute(history, audioUrl, userText);
    if (result) return result;
  } catch {
    // fall through to keyword fallback
  }
  // Build fallback from last user message or generic
  const lastUser = [...history].reverse().find((m) => m.role === "user");
  return operatorFallback(lastUser?.content ?? userText ?? "emergency");
}

async function callChatRoute(
  history: ConversationMessage[],
  audioUrl?: string,
  userText?: string
): Promise<OperatorResponse | null> {
  const baseUrl = getApiBaseUrl();
  const token = await Auth.getSessionToken();

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  // Build history — if userText is provided and not already last, append it
  let finalHistory = [...history];
  if (
    userText &&
    (finalHistory.length === 0 || finalHistory[finalHistory.length - 1]?.role !== "user")
  ) {
    finalHistory = [...finalHistory, { role: "user", content: userText }];
  }

  const body: Record<string, unknown> = { history: finalHistory };
  if (audioUrl) body.audioUrl = audioUrl;

  const response = await fetch(`${baseUrl}/api/trpc/emergency.chat`, {
    method: "POST",
    headers,
    credentials: "include",
    body: JSON.stringify({ json: body }),
    signal: AbortSignal.timeout(20000),
  });

  if (!response.ok) return null;

  const json = await response.json();
  const trpcData = json?.result?.data?.json ?? json;
  if (!trpcData?.success || !trpcData?.data) return null;

  const d = trpcData.data;
  return {
    spoken: d.spoken ?? "Stay calm. I'm here to help.",
    instruction: d.instruction ?? "Stay calm",
    action: d.action ?? "CONTINUE",
    steps: d.steps ?? [],
    severity: d.severity ?? "medium",
    emergencyType: d.emergencyType ?? "unknown",
    transcript: trpcData.transcript ?? null,
  };
}

// ─── Legacy single-turn (kept for backward compat) ───────────────────────────

export const analyzeEmergency = async (transcript: string): Promise<AIAnalysisResult> => {
  const result = await chatWithOperator([], undefined, transcript);
  return {
    emergencyType: result.emergencyType,
    severity: result.severity === "critical" ? "critical" : result.severity === "medium" ? "serious" : "moderate",
    firstInstruction: result.instruction,
    shouldCall103: result.action === "CALL_103",
    shouldSMSFamily: result.action === "SMS_FAMILY",
    nearestHelp: result.emergencyType !== "unknown",
    spokenResponse: result.spoken,
  };
};

export async function analyzeForEScript(context: string): Promise<string | null> {
  try {
    const baseUrl = getApiBaseUrl();
    const token = await Auth.getSessionToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const response = await fetch(`${baseUrl}/api/trpc/emergency.escript`, {
      method: "POST",
      headers,
      credentials: "include",
      body: JSON.stringify({ json: { context } }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return null;
    const json = await response.json();
    const trpcData = json?.result?.data?.json ?? json;
    if (!trpcData?.success) return null;
    return trpcData.raw ?? null;
  } catch {
    return null;
  }
}

// ─── Fallback (no network) ────────────────────────────────────────────────────

function operatorFallback(transcript: string): OperatorResponse {
  const lower = transcript.toLowerCase();

  let emergencyType: DisasterType | "unknown" = "unknown";
  let instruction = "Call 103 immediately";
  let spoken = "Stay calm. Calling for help now.";

  if (/fire|пожежа|smoke|горить|burn/.test(lower)) {
    emergencyType = "fire";
    instruction = "Cover mouth and move low";
    spoken = "Fire detected. Cover your mouth and move low to the exit.";
  } else if (/blood|кров|bleed|wound|injury|hurt|cut/.test(lower)) {
    emergencyType = "injury";
    instruction = "Press cloth firmly on wound";
    spoken = "Injury detected. Press a cloth firmly on the wound right now.";
  } else if (/light|світло|blackout|power|electricity/.test(lower)) {
    emergencyType = "blackout";
    instruction = "Turn off gas and open windows";
    spoken = "Blackout detected. Turn off gas and open a window.";
  } else if (/quake|earthquake|shaking|тряс|земля/.test(lower)) {
    emergencyType = "quake";
    instruction = "Drop cover and hold on";
    spoken = "Earthquake. Drop to the floor, take cover, and hold on.";
  } else if (/flood|water|вода|затоп/.test(lower)) {
    emergencyType = "flood";
    instruction = "Move to higher ground now";
    spoken = "Flood detected. Move to higher ground immediately.";
  } else if (/toxic|gas|chemical|poison|газ/.test(lower)) {
    emergencyType = "toxic";
    instruction = "Cover face and move upwind";
    spoken = "Toxic air detected. Cover your face and move upwind.";
  }

  const isCritical = /critical|dying|unconscious|not breathing|heart/.test(lower);

  return {
    emergencyType,
    severity: isCritical ? "critical" : "medium",
    instruction,
    spoken,
    action: "CONTINUE",
    steps: [],
    transcript: null,
  };
}
