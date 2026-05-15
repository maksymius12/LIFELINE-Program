import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fetch to simulate Gemma offline
global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

// We need to import after mocking
const { analyzeEmergency } = await import("../lib/ai-analysis");

describe("AI Analysis — Keyword Fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockRejectedValue(new Error("Gemma offline"));
  });

  it("detects fire from transcript", async () => {
    const result = await analyzeEmergency("there is fire and smoke everywhere");
    expect(result.emergencyType).toBe("fire");
    expect(result.shouldCall103).toBe(true);
    expect(result.firstInstruction).toBeTruthy();
    expect(result.spokenResponse).toBeTruthy();
  });

  it("detects injury from blood keyword", async () => {
    const result = await analyzeEmergency("I am bleeding badly from my arm");
    expect(result.emergencyType).toBe("injury");
    expect(result.firstInstruction).toBeTruthy();
  });

  it("detects blackout from power keyword", async () => {
    const result = await analyzeEmergency("the power went out and no light");
    expect(result.emergencyType).toBe("blackout");
  });

  it("detects earthquake from quake keyword", async () => {
    const result = await analyzeEmergency("earthquake shaking everything");
    expect(result.emergencyType).toBe("quake");
  });

  it("detects flood from water keyword", async () => {
    const result = await analyzeEmergency("water is flooding the street");
    expect(result.emergencyType).toBe("flood");
  });

  it("detects toxic from gas keyword", async () => {
    const result = await analyzeEmergency("there is a gas leak and toxic smell");
    expect(result.emergencyType).toBe("toxic");
  });

  it("returns unknown for unrecognized transcript", async () => {
    const result = await analyzeEmergency("I need emergency help");
    expect(result.emergencyType).toBe("unknown");
    expect(result.shouldCall103).toBe(true);
  });

  it("marks critical severity for critical keywords", async () => {
    const result = await analyzeEmergency("person is dying and not breathing");
    expect(result.severity).toBe("critical");
    expect(result.shouldSMSFamily).toBe(true);
  });

  it("result always has required fields", async () => {
    const result = await analyzeEmergency("help");
    expect(result.emergencyType).toBeDefined();
    expect(result.severity).toBeDefined();
    expect(result.firstInstruction).toBeDefined();
    expect(typeof result.shouldCall103).toBe("boolean");
    expect(typeof result.shouldSMSFamily).toBe("boolean");
    expect(typeof result.nearestHelp).toBe("boolean");
    expect(result.spokenResponse).toBeDefined();
  });
});

describe("AI Analysis — Gemma API (mocked success)", () => {
  it("parses Gemma API response correctly", async () => {
    const mockResponse: import("../lib/ai-analysis").AIAnalysisResult = {
      emergencyType: "fire",
      severity: "critical",
      firstInstruction: "Cover mouth with cloth.",
      shouldCall103: true,
      shouldSMSFamily: true,
      nearestHelp: true,
      spokenResponse: "Fire detected. Move low and exit now.",
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify(mockResponse) } }],
      }),
    });

    const { analyzeEmergency: analyzeWithAPI } = await import("../lib/ai-analysis");
    const result = await analyzeWithAPI("there is a fire in the building");
    expect(result.emergencyType).toBe("fire");
    expect(result.severity).toBe("critical");
    expect(result.shouldCall103).toBe(true);
  });
});
