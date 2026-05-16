/**
 * gemini.ts — Gemini 2.0 Flash API service for LIFELINE
 *
 * Handles:
 *   1. Emergency AI analysis (text → structured JSON)
 *   2. Audio transcription (base64 audio → text via Gemini multimodal)
 *
 * Works on real phones (Expo Go compatible — pure fetch, no native code).
 */
import * as FileSystem from "expo-file-system/legacy";
import Constants from "expo-constants";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

function getApiKey(): string {
  // Try Expo extra config first, then process.env
  const key =
    (Constants.expoConfig?.extra?.geminiApiKey as string | undefined) ||
    process.env.EXPO_PUBLIC_GEMINI_API_KEY ||
    "";
  return key;
}

// ─── Emergency AI Analysis ────────────────────────────────────────────────────

export interface GeminiEmergencyResponse {
  emergencyType: "fire" | "injury" | "blackout" | "quake" | "flood" | "toxic" | "unknown";
  severity: "critical" | "serious" | "moderate";
  firstInstruction: string;
  nextSteps: string[];
  shouldCall103: boolean;
  shouldSMSFamily: boolean;
  spokenResponse: string;
  evacuationDirection: string | null;
  mapAction: "show_safe_route" | "show_hospitals" | "show_shelters" | "none";
}

const FALLBACK: GeminiEmergencyResponse = {
  emergencyType: "unknown",
  severity: "serious",
  firstInstruction: "Stay calm. I am here.",
  nextSteps: [],
  shouldCall103: false,
  shouldSMSFamily: false,
  spokenResponse: "I hear you. Tell me what happened.",
  evacuationDirection: null,
  mapAction: "none",
};

export async function analyzeEmergencyWithGemini(
  transcript: string,
  location?: { latitude: number; longitude: number } | null,
  conversationHistory?: Array<{ role: string; content: string }>
): Promise<GeminiEmergencyResponse> {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn("[Gemini] No API key — returning fallback");
    return FALLBACK;
  }

  const locationContext = location
    ? `User GPS: ${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}.`
    : "";

  const historyContext =
    conversationHistory && conversationHistory.length > 0
      ? "\n\nConversation so far:\n" +
        conversationHistory.map((m) => `${m.role}: ${m.content}`).join("\n")
      : "";

  const prompt = `${locationContext}${historyContext}

Emergency situation described by user: "${transcript}"

You are LIFELINE emergency AI. Respond ONLY with valid JSON (no markdown, no code blocks):
{
  "emergencyType": "fire|injury|blackout|quake|flood|toxic|unknown",
  "severity": "critical|serious|moderate",
  "firstInstruction": "max 6 words action",
  "nextSteps": ["step1 max 6 words", "step2", "step3"],
  "shouldCall103": true or false,
  "shouldSMSFamily": true or false,
  "spokenResponse": "calm 1-2 sentence instruction read aloud to user",
  "evacuationDirection": "move north away from smoke" or null,
  "mapAction": "show_safe_route|show_hospitals|show_shelters|none"
}`;

  try {
    const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 400 },
      }),
    });

    if (!res.ok) {
      console.error("[Gemini] HTTP error", res.status);
      return FALLBACK;
    }

    const data = await res.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const clean = raw.replace(/```json|```/g, "").trim();
    return { ...FALLBACK, ...JSON.parse(clean) };
  } catch (e) {
    console.error("[Gemini] analyzeEmergency error:", e);
    return FALLBACK;
  }
}

// ─── Audio Transcription ──────────────────────────────────────────────────────

export async function transcribeWithGemini(audioUri: string): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) return "";

  try {
    // Read audio file as base64
    const base64 = await FileSystem.readAsStringAsync(audioUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Detect mime type from extension
    const ext = audioUri.split(".").pop()?.toLowerCase() ?? "m4a";
    const mimeMap: Record<string, string> = {
      m4a: "audio/mp4",
      mp4: "audio/mp4",
      wav: "audio/wav",
      mp3: "audio/mpeg",
      caf: "audio/x-caf",
      aac: "audio/aac",
      webm: "audio/webm",
    };
    const mimeType = mimeMap[ext] ?? "audio/mp4";

    const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: "Transcribe this audio exactly. Return only the spoken words, nothing else. If nothing was said, return empty string.",
              },
              {
                inlineData: { mimeType, data: base64 },
              },
            ],
          },
        ],
        generationConfig: { temperature: 0, maxOutputTokens: 200 },
      }),
    });

    if (!res.ok) return "";
    const data = await res.json();
    return (data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim();
  } catch (e) {
    console.error("[Gemini] transcribeAudio error:", e);
    return "";
  }
}

// ─── Conversation turn (multi-turn) ──────────────────────────────────────────

export async function chatTurnWithGemini(
  userMessage: string,
  history: Array<{ role: string; content: string }>,
  systemPrompt?: string
): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) return "I hear you. Tell me what happened.";

  const sysCtx = systemPrompt
    ? systemPrompt + "\n\n"
    : "You are LIFELINE, a calm emergency AI assistant. Give short, clear, actionable instructions. Max 2 sentences per response.\n\n";

  const historyText =
    history.length > 0
      ? history.map((m) => `${m.role === "user" ? "User" : "AI"}: ${m.content}`).join("\n") + "\n"
      : "";

  const prompt = `${sysCtx}${historyText}User: ${userMessage}\nAI:`;

  try {
    const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 150 },
      }),
    });

    if (!res.ok) return "I hear you. Stay calm and tell me more.";
    const data = await res.json();
    return (data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim();
  } catch {
    return "I hear you. Stay calm and tell me more.";
  }
}
