import { describe, it, expect } from "vitest";
import {
  EMERGENCY_DATA,
  DISASTER_BUTTONS,
  TRAINING_SCENARIOS,
  MEDICAL_AI_CONVERSATION,
  MEDICAL_AI_DIAGNOSIS,
} from "../constants/emergency-data";

describe("Emergency Data", () => {
  it("should have all 6 disaster types", () => {
    const types = Object.keys(EMERGENCY_DATA);
    expect(types).toHaveLength(6);
    expect(types).toContain("fire");
    expect(types).toContain("injury");
    expect(types).toContain("blackout");
    expect(types).toContain("quake");
    expect(types).toContain("flood");
    expect(types).toContain("toxic");
  });

  it("each disaster type should have exactly 3 steps", () => {
    Object.values(EMERGENCY_DATA).forEach((scenario) => {
      expect(scenario.steps).toHaveLength(3);
    });
  });

  it("each step should have instruction, emoji, and audio fields", () => {
    Object.values(EMERGENCY_DATA).forEach((scenario) => {
      scenario.steps.forEach((step) => {
        expect(step.instruction).toBeTruthy();
        expect(step.emoji).toBeTruthy();
        expect(step.audio).toBe(true);
      });
    });
  });

  it("instructions should be max 6 words", () => {
    Object.values(EMERGENCY_DATA).forEach((scenario) => {
      scenario.steps.forEach((step) => {
        const wordCount = step.instruction.trim().split(/\s+/).length;
        expect(wordCount).toBeLessThanOrEqual(6);
      });
    });
  });
});

describe("Disaster Buttons", () => {
  it("should have 6 buttons", () => {
    expect(DISASTER_BUTTONS).toHaveLength(6);
  });

  it("each button should have type, emoji, and label", () => {
    DISASTER_BUTTONS.forEach((btn) => {
      expect(btn.type).toBeTruthy();
      expect(btn.emoji).toBeTruthy();
      expect(btn.label).toBeTruthy();
    });
  });

  it("button types should match emergency data keys", () => {
    DISASTER_BUTTONS.forEach((btn) => {
      expect(EMERGENCY_DATA[btn.type]).toBeDefined();
    });
  });
});

describe("Training Scenarios", () => {
  it("should have 4 scenarios", () => {
    expect(TRAINING_SCENARIOS).toHaveLength(4);
  });

  it("each scenario should have required fields", () => {
    TRAINING_SCENARIOS.forEach((scenario) => {
      expect(scenario.id).toBeTruthy();
      expect(scenario.title).toBeTruthy();
      expect(scenario.description).toBeTruthy();
      expect(scenario.tag).toBeTruthy();
      expect(scenario.tagColor).toBeTruthy();
      expect(scenario.steps).toBeGreaterThan(0);
    });
  });
});

describe("Medical AI", () => {
  it("should have conversation messages", () => {
    expect(MEDICAL_AI_CONVERSATION.length).toBeGreaterThan(0);
  });

  it("all conversation messages should be from AI", () => {
    MEDICAL_AI_CONVERSATION.forEach((msg) => {
      expect(msg.role).toBe("ai");
      expect(msg.text).toBeTruthy();
    });
  });

  it("diagnosis should have required fields", () => {
    expect(MEDICAL_AI_DIAGNOSIS.title).toBeTruthy();
    expect(MEDICAL_AI_DIAGNOSIS.emoji).toBeTruthy();
    expect(MEDICAL_AI_DIAGNOSIS.instruction).toBeTruthy();
    expect(MEDICAL_AI_DIAGNOSIS.timerSeconds).toBeGreaterThan(0);
    expect(MEDICAL_AI_DIAGNOSIS.timerLabel).toBeTruthy();
  });
});
