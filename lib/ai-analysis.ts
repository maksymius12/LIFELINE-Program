/**
 * Emergency AI Analysis Service
 *
 * Calls the Manus built-in LLM via the server tRPC route.
 * Previously called localhost:8080 (Gemma) — now uses the
 * platform-provided LLM which is always available.
 *
 * Falls back to keyword detection if the server call fails.
 */
import { getApiBaseUrl } from "@/constants/oauth";
import * as Auth from "@/lib/_core/auth";
import type { DisasterType } from "@/constants/emergency-data";

export interface AIAnalysisResult {
  emergencyType: DisasterType | "unknown";
  severity: "critical" | "serious" | "moderate";
  firstInstruction: string;
  shouldCall103: boolean;
  shouldSMSFamily: boolean;
  nearestHelp: boolean;
  spokenResponse: string;
}

// ─── Main Analysis Function ───────────────────────────────────────────────────

export const analyzeEmergency = async (transcript: string): Promise<AIAnalysisResult> => {
  try {
    const result = await callServerLLM(transcript);
    if (result) return result;
  } catch {
    // fall through to keyword fallback
  }
  return keywordFallback(transcript);
};

// ─── Server LLM Call via tRPC HTTP ───────────────────────────────────────────

async function callServerLLM(transcript: string): Promise<AIAnalysisResult | null> {
  const baseUrl = getApiBaseUrl();
  const token = await Auth.getSessionToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const response = await fetch(`${baseUrl}/api/trpc/emergency.analyze`, {
    method: "POST",
    headers,
    credentials: "include",
    body: JSON.stringify({
      json: { transcript, useEScript: false },
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) return null;

  const json = await response.json();
  // tRPC response shape: { result: { data: { json: { success, data } } } }
  const trpcData = json?.result?.data?.json ?? json;
  if (!trpcData?.success || !trpcData?.data) return null;

  const d = trpcData.data;
  if (!d.emergencyType || !d.spokenResponse) return null;

  return {
    emergencyType: d.emergencyType ?? "unknown",
    severity: d.severity ?? "serious",
    firstInstruction: d.firstInstruction ?? "Stay calm and assess the situation",
    shouldCall103: d.shouldCall103 ?? false,
    shouldSMSFamily: d.shouldSMSFamily ?? false,
    nearestHelp: Boolean(d.nearestHelp),
    spokenResponse: d.spokenResponse ?? "I'm here to help. What happened?",
  };
}

// ─── E-Script Analysis (for agentic UI) ──────────────────────────────────────

export async function analyzeForEScript(transcript: string): Promise<string | null> {
  try {
    const baseUrl = getApiBaseUrl();
    const token = await Auth.getSessionToken();

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const response = await fetch(`${baseUrl}/api/trpc/emergency.analyze`, {
      method: "POST",
      headers,
      credentials: "include",
      body: JSON.stringify({
        json: { transcript, useEScript: true },
      }),
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

// ─── Keyword Fallback ─────────────────────────────────────────────────────────

const keywordFallback = (transcript: string): AIAnalysisResult => {
  const lower = transcript.toLowerCase();

  let emergencyType: DisasterType | "unknown" = "unknown";
  let firstInstruction = "Call 103 immediately.";
  let spokenResponse = "Stay calm. Calling for help now.";

  if (/fire|пожежа|smoke|горить|burn/.test(lower)) {
    emergencyType = "fire";
    firstInstruction = "Cover mouth with cloth.";
    spokenResponse = "Fire detected. Cover your mouth and move low.";
  } else if (/blood|кров|bleed|wound|injury|hurt|cut/.test(lower)) {
    emergencyType = "injury";
    firstInstruction = "Press cloth on wound.";
    spokenResponse = "Injury detected. Apply pressure to the wound now.";
  } else if (/light|світло|blackout|power|electricity/.test(lower)) {
    emergencyType = "blackout";
    firstInstruction = "Turn off gas immediately.";
    spokenResponse = "Blackout detected. Turn off gas and open windows.";
  } else if (/quake|earthquake|shaking|тряс|земля/.test(lower)) {
    emergencyType = "quake";
    firstInstruction = "Drop to the floor.";
    spokenResponse = "Earthquake detected. Drop, cover, and hold on.";
  } else if (/flood|water|вода|затоп/.test(lower)) {
    emergencyType = "flood";
    firstInstruction = "Move to higher ground.";
    spokenResponse = "Flood detected. Move to higher ground immediately.";
  } else if (/toxic|gas|chemical|poison|газ/.test(lower)) {
    emergencyType = "toxic";
    firstInstruction = "Cover mouth and nose.";
    spokenResponse = "Toxic air detected. Cover your face and move upwind.";
  }

  const isCritical = /critical|dying|unconscious|not breathing|heart/.test(lower);

  return {
    emergencyType,
    severity: isCritical ? "critical" : "serious",
    firstInstruction,
    shouldCall103: true,
    shouldSMSFamily: isCritical,
    nearestHelp: emergencyType !== "unknown",
    spokenResponse,
  };
};
