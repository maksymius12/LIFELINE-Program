import { describe, it, expect } from "vitest";
import {
  parseAndExecute,
  MOCK_SCENARIOS,
  type EScript,
  type PollPayload,
  type SchemePayload,
  type CountdownPayload,
  type HardwarePayload,
} from "../lib/EScriptEngine";

// ─── parseAndExecute ──────────────────────────────────────────────────────────

describe("parseAndExecute", () => {
  it("parses a valid UI_RENDER_POLL script", () => {
    const raw = JSON.stringify({
      voice_backup: "Is the person conscious?",
      action_type: "UI_RENDER_POLL",
      payload: {
        question: "Is the person conscious?",
        options: ["YES", "NO"],
        danger_level: "critical",
      },
    });
    const result = parseAndExecute(raw);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.script.action_type).toBe("UI_RENDER_POLL");
    const p = result.script.payload as PollPayload;
    expect(p.question).toBe("Is the person conscious?");
    expect(p.options).toHaveLength(2);
    expect(p.danger_level).toBe("critical");
  });

  it("parses a valid UI_SHOW_SCHEME script", () => {
    const raw = JSON.stringify({
      voice_backup: "Follow the steps.",
      action_type: "UI_SHOW_SCHEME",
      payload: {
        title: "CPR",
        steps: ["Check breathing", "30 compressions", "2 breaths"],
        current_step: 0,
        animation_type: "fade",
      },
    });
    const result = parseAndExecute(raw);
    expect(result.success).toBe(true);
    if (!result.success) return;
    const p = result.script.payload as SchemePayload;
    expect(p.steps).toHaveLength(3);
    expect(p.animation_type).toBe("fade");
  });

  it("parses a valid COUNTER_TIMEOUT script", () => {
    const raw = JSON.stringify({
      voice_backup: "SOS in 30 seconds.",
      action_type: "COUNTER_TIMEOUT",
      payload: {
        message: "Sending SOS",
        duration_seconds: 30,
        on_expire_action: "SEND_SOS_PACKET",
      },
    });
    const result = parseAndExecute(raw);
    expect(result.success).toBe(true);
    if (!result.success) return;
    const p = result.script.payload as CountdownPayload;
    expect(p.duration_seconds).toBe(30);
    expect(p.on_expire_action).toBe("SEND_SOS_PACKET");
  });

  it("parses a valid HARDWARE_TRIGGER script", () => {
    const raw = JSON.stringify({
      voice_backup: "Activating SOS flash.",
      action_type: "HARDWARE_TRIGGER",
      payload: { trigger: "FLASH_SOS", state: true },
    });
    const result = parseAndExecute(raw);
    expect(result.success).toBe(true);
    if (!result.success) return;
    const p = result.script.payload as HardwarePayload;
    expect(p.trigger).toBe("FLASH_SOS");
    expect(p.state).toBe(true);
  });

  it("extracts JSON from markdown code block", () => {
    const raw = "```json\n" + JSON.stringify({
      voice_backup: "test",
      action_type: "HARDWARE_TRIGGER",
      payload: { trigger: "VIBRATE_PULSE", state: false },
    }) + "\n```";
    const result = parseAndExecute(raw);
    expect(result.success).toBe(true);
  });

  it("returns ParseError for empty string", () => {
    const result = parseAndExecute("");
    expect(result.success).toBe(false);
  });

  it("returns ParseError for malformed JSON", () => {
    const result = parseAndExecute("{ broken json }}}");
    expect(result.success).toBe(false);
  });

  it("returns ParseError for unknown action_type", () => {
    const raw = JSON.stringify({
      voice_backup: "test",
      action_type: "UNKNOWN_ACTION",
      payload: {},
    });
    const result = parseAndExecute(raw);
    expect(result.success).toBe(false);
  });

  it("returns ParseError for missing payload", () => {
    const raw = JSON.stringify({
      voice_backup: "test",
      action_type: "UI_RENDER_POLL",
    });
    const result = parseAndExecute(raw);
    expect(result.success).toBe(false);
  });

  it("returns ParseError for poll with missing options", () => {
    const raw = JSON.stringify({
      voice_backup: "test",
      action_type: "UI_RENDER_POLL",
      payload: { question: "test?" },
    });
    const result = parseAndExecute(raw);
    expect(result.success).toBe(false);
  });

  it("returns ParseError for hardware trigger with wrong state type", () => {
    const raw = JSON.stringify({
      voice_backup: "test",
      action_type: "HARDWARE_TRIGGER",
      payload: { trigger: "FLASH_SOS", state: "yes" }, // state should be boolean
    });
    const result = parseAndExecute(raw);
    expect(result.success).toBe(false);
  });
});

// ─── Mock Scenarios ───────────────────────────────────────────────────────────

describe("MOCK_SCENARIOS", () => {
  it("poll_critical parses successfully", () => {
    const result = parseAndExecute(MOCK_SCENARIOS.poll_critical);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.script.action_type).toBe("UI_RENDER_POLL");
    const p = result.script.payload as PollPayload;
    expect(p.danger_level).toBe("critical");
    expect(p.options.length).toBeGreaterThan(0);
  });

  it("scheme_tourniquet parses successfully with 5 steps", () => {
    const result = parseAndExecute(MOCK_SCENARIOS.scheme_tourniquet);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.script.action_type).toBe("UI_SHOW_SCHEME");
    const p = result.script.payload as SchemePayload;
    expect(p.steps).toHaveLength(5);
    expect(p.animation_type).toBe("slide");
  });

  it("countdown_sos parses with 30 second duration", () => {
    const result = parseAndExecute(MOCK_SCENARIOS.countdown_sos);
    expect(result.success).toBe(true);
    if (!result.success) return;
    const p = result.script.payload as CountdownPayload;
    expect(p.duration_seconds).toBe(30);
    expect(p.on_expire_action).toBe("SEND_SOS_PACKET");
  });

  it("hardware_flash parses with FLASH_SOS trigger and state true", () => {
    const result = parseAndExecute(MOCK_SCENARIOS.hardware_flash);
    expect(result.success).toBe(true);
    if (!result.success) return;
    const p = result.script.payload as HardwarePayload;
    expect(p.trigger).toBe("FLASH_SOS");
    expect(p.state).toBe(true);
  });

  it("all 4 mock scenarios parse without error", () => {
    for (const [key, raw] of Object.entries(MOCK_SCENARIOS)) {
      const result = parseAndExecute(raw);
      expect(result.success, `Mock scenario "${key}" should parse successfully`).toBe(true);
    }
  });
});
