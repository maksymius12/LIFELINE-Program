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

const GEMMA_API_URL = "http://localhost:8080/v1/chat/completions";

const SYSTEM_PROMPT = `You are an emergency AI. Analyze the situation and respond ONLY with valid JSON.
Response format:
{
  "emergencyType": "fire|injury|blackout|quake|flood|toxic|unknown",
  "severity": "critical|serious|moderate",
  "firstInstruction": "max 6 words action",
  "shouldCall103": true/false,
  "shouldSMSFamily": true/false,
  "nearestHelp": true/false,
  "spokenResponse": "calm short sentence to say aloud"
}`;

export const analyzeEmergency = async (transcript: string): Promise<AIAnalysisResult> => {
  try {
    const response = await fetch(GEMMA_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gemma3",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: transcript },
        ],
        temperature: 0.1,
        max_tokens: 200,
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) throw new Error(`Gemma API error: ${response.status}`);

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty response from Gemma");

    const parsed = JSON.parse(content);
    return parsed as AIAnalysisResult;
  } catch {
    // Fallback to keyword detection
    return keywordFallback(transcript);
  }
};

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
  } else if (/light|світло|blackout|power|electricity|no power/.test(lower)) {
    emergencyType = "blackout";
    firstInstruction = "Turn off gas immediately.";
    spokenResponse = "Blackout detected. Turn off gas and open windows.";
  } else if (/quake|earthquake|shaking|тряс|земля/.test(lower)) {
    emergencyType = "quake";
    firstInstruction = "Drop to the floor.";
    spokenResponse = "Earthquake detected. Drop, cover, and hold on.";
  } else if (/flood|water|flood|вода|затоп/.test(lower)) {
    emergencyType = "flood";
    firstInstruction = "Move to higher ground.";
    spokenResponse = "Flood detected. Move to higher ground immediately.";
  } else if (/toxic|gas|chemical|poison|smell|toxic|газ/.test(lower)) {
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
