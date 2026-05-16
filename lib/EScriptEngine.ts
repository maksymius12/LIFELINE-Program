/**
 * Lifeline E-Script Engine
 *
 * Parses JSON responses from the Gemma AI model and dispatches
 * them to the appropriate UI renderer or hardware bridge.
 * All parsing is wrapped in try/catch — if the AI returns malformed
 * JSON, the engine falls back to plain-text display without crashing.
 */

// ─── Protocol Types ───────────────────────────────────────────────────────────

export type DangerLevel = "low" | "medium" | "critical";
export type HardwareTriggerType = "FLASH_SOS" | "VIBRATE_PULSE" | "AUDIO_ALARM";
export type AnimationType = "fade" | "slide" | "pulse";

export interface PollPayload {
  question: string;
  options: string[];
  danger_level: DangerLevel;
}

export interface SchemePayload {
  title: string;
  steps: string[];
  current_step: number;
  animation_type: AnimationType;
}

export interface HardwarePayload {
  trigger: HardwareTriggerType;
  state: boolean;
}

export interface CountdownPayload {
  message: string;
  duration_seconds: number;
  on_expire_action: string;
}

export type ActionType =
  | "UI_RENDER_POLL"
  | "UI_SHOW_SCHEME"
  | "HARDWARE_TRIGGER"
  | "COUNTER_TIMEOUT";

export interface EScript {
  voice_backup: string;
  action_type: ActionType;
  payload: PollPayload | SchemePayload | HardwarePayload | CountdownPayload;
}

export interface ParseResult {
  success: true;
  script: EScript;
}

export interface ParseError {
  success: false;
  fallback_text: string;
  raw: string;
}

export type EngineResult = ParseResult | ParseError;

// ─── Parser ───────────────────────────────────────────────────────────────────

/**
 * Parses a raw JSON string from the AI model.
 * On any error, returns a ParseError with the raw string for fallback display.
 */
export function parseAndExecute(rawJsonString: string): EngineResult {
  try {
    if (!rawJsonString || typeof rawJsonString !== "string") {
      throw new Error("Empty or non-string input");
    }

    // Extract JSON from the string — model may wrap it in markdown code blocks
    const jsonMatch = rawJsonString.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON object found in response");

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate required top-level fields
    if (!parsed.action_type || !parsed.payload) {
      throw new Error("Missing required fields: action_type or payload");
    }

    const validActions: ActionType[] = [
      "UI_RENDER_POLL",
      "UI_SHOW_SCHEME",
      "HARDWARE_TRIGGER",
      "COUNTER_TIMEOUT",
    ];
    if (!validActions.includes(parsed.action_type)) {
      throw new Error(`Unknown action_type: ${parsed.action_type}`);
    }

    // Validate payload per action type
    validatePayload(parsed.action_type, parsed.payload);

    return {
      success: true,
      script: {
        voice_backup: parsed.voice_backup ?? "",
        action_type: parsed.action_type,
        payload: parsed.payload,
      },
    };
  } catch (err) {
    return {
      success: false,
      fallback_text:
        typeof rawJsonString === "string" && rawJsonString.length < 500
          ? rawJsonString
          : "AI response received. Follow verbal instructions.",
      raw: String(rawJsonString).slice(0, 200),
    };
  }
}

function validatePayload(actionType: ActionType, payload: Record<string, unknown>): void {
  switch (actionType) {
    case "UI_RENDER_POLL":
      if (!payload.question || !Array.isArray(payload.options)) {
        throw new Error("UI_RENDER_POLL: missing question or options");
      }
      break;
    case "UI_SHOW_SCHEME":
      if (!payload.title || !Array.isArray(payload.steps)) {
        throw new Error("UI_SHOW_SCHEME: missing title or steps");
      }
      break;
    case "HARDWARE_TRIGGER":
      if (!payload.trigger || typeof payload.state !== "boolean") {
        throw new Error("HARDWARE_TRIGGER: missing trigger or state");
      }
      break;
    case "COUNTER_TIMEOUT":
      if (!payload.message || typeof payload.duration_seconds !== "number") {
        throw new Error("COUNTER_TIMEOUT: missing message or duration_seconds");
      }
      break;
  }
}

// ─── Mock Scenarios ───────────────────────────────────────────────────────────
// Use these for demo/testing without a live AI connection.

export const MOCK_SCENARIOS: Record<string, string> = {
  poll_critical: JSON.stringify({
    voice_backup: "Is the person conscious? Answer YES or NO.",
    action_type: "UI_RENDER_POLL",
    payload: {
      question: "Is the person conscious?",
      options: ["YES — responds", "NO — unresponsive", "Partially — confused"],
      danger_level: "critical",
    },
  }),

  scheme_tourniquet: JSON.stringify({
    voice_backup: "Apply tourniquet. Follow the steps on screen.",
    action_type: "UI_SHOW_SCHEME",
    payload: {
      title: "Tourniquet Application",
      steps: [
        "Position tourniquet 5–7 cm above the wound",
        "Pull the strap tight — no slack",
        "Twist the windlass until bleeding stops",
        "Lock the windlass in the clip",
        "Write the time on the tourniquet or skin",
      ],
      current_step: 0,
      animation_type: "slide",
    },
  }),

  countdown_sos: JSON.stringify({
    voice_backup: "SOS signal will be sent in 30 seconds. Tap Cancel to abort.",
    action_type: "COUNTER_TIMEOUT",
    payload: {
      message: "Sending SOS to emergency services and family contact",
      duration_seconds: 30,
      on_expire_action: "SEND_SOS_PACKET",
    },
  }),

  hardware_flash: JSON.stringify({
    voice_backup: "Activating SOS flashlight signal.",
    action_type: "HARDWARE_TRIGGER",
    payload: {
      trigger: "FLASH_SOS",
      state: true,
    },
  }),
};
