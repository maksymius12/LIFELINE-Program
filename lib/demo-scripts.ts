/**
 * DEMO E-SCRIPT PAYLOADS
 *
 * Hardcoded structured JSON that mimics the exact payload our local Gemma
 * model would output. Used for hackathon demo to bypass live AI calls.
 *
 * Each entry maps a DisasterType to a DemoScript with:
 *   - cognitive_state: panic detection signal
 *   - layout_format: "agentic_binary_oversized" → 3 giant action buttons
 *   - voice_synthesis_trigger: "active" → visual flash + haptic on load
 *   - actions: exactly 3 high-contrast action strings
 *   - color: neon border color for the action buttons
 *   - voiceText: what gets spoken via TTS
 */

export interface DemoScript {
  cognitive_state: "panic_detected" | "calm" | "alert";
  layout_format: "agentic_binary_oversized";
  voice_synthesis_trigger: "active" | "passive";
  actions: [string, string, string];
  color: string;
  voiceText: string;
  title: string;
  emoji: string;
}

export const DEMO_SCRIPTS: Record<string, DemoScript> = {
  fire: {
    cognitive_state: "panic_detected",
    layout_format: "agentic_binary_oversized",
    voice_synthesis_trigger: "active",
    title: "FIRE PROTOCOL",
    emoji: "🔥",
    color: "#FF3D3D",
    voiceText: "Fire detected. Cover your mouth. Stay low. Do not use elevators. Head to exit now.",
    actions: [
      "Cover your mouth with damp fabric",
      "Stay low — below the smoke line",
      "Do NOT use elevators — head to exit",
    ],
  },

  injury: {
    cognitive_state: "panic_detected",
    layout_format: "agentic_binary_oversized",
    voice_synthesis_trigger: "active",
    title: "INJURY PROTOCOL",
    emoji: "🩸",
    color: "#FF3D3D",
    voiceText: "Severe injury. Apply direct pressure immediately. Do not remove cloth. Call 103.",
    actions: [
      "Press cloth HARD on the wound",
      "Lift the limb above heart level",
      "Do NOT remove — add more cloth on top",
    ],
  },

  quake: {
    cognitive_state: "panic_detected",
    layout_format: "agentic_binary_oversized",
    voice_synthesis_trigger: "active",
    title: "EARTHQUAKE PROTOCOL",
    emoji: "🌪",
    color: "#F59E0B",
    voiceText: "Earthquake. Drop to the floor. Cover your head and neck. Hold until shaking stops.",
    actions: [
      "DROP to the floor immediately",
      "Cover HEAD and NECK with arms",
      "HOLD — do not move until still",
    ],
  },

  blackout: {
    cognitive_state: "alert",
    layout_format: "agentic_binary_oversized",
    voice_synthesis_trigger: "active",
    title: "BLACKOUT PROTOCOL",
    emoji: "⚡",
    color: "#F59E0B",
    voiceText: "Power blackout. Turn off gas. Open windows. Exit to stairwell now.",
    actions: [
      "Turn OFF gas valve immediately",
      "Open ALL windows — ventilate now",
      "Exit to stairwell — do not use lift",
    ],
  },

  flood: {
    cognitive_state: "alert",
    layout_format: "agentic_binary_oversized",
    voice_synthesis_trigger: "active",
    title: "FLOOD PROTOCOL",
    emoji: "🌊",
    color: "#4a9d9c",
    voiceText: "Flooding detected. Move to higher ground. Avoid all moving water. Call 103.",
    actions: [
      "Move to HIGHER GROUND now",
      "Avoid ALL moving water — even 6 inches kills",
      "Call 103 — signal from roof if needed",
    ],
  },

  toxic: {
    cognitive_state: "panic_detected",
    layout_format: "agentic_binary_oversized",
    voice_synthesis_trigger: "active",
    title: "TOXIC AIR PROTOCOL",
    emoji: "☣",
    color: "#22C55E",
    voiceText: "Toxic air detected. Cover mouth and nose. Move upwind fast. Do not go back inside.",
    actions: [
      "Cover MOUTH and NOSE — wet cloth best",
      "Move UPWIND fast — away from source",
      "Do NOT go back inside — wait for all-clear",
    ],
  },
};
