import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the modules that ai-analysis.ts imports from native/expo context
vi.mock("@/constants/oauth", () => ({
  getApiBaseUrl: () => "http://localhost:3000",
}));

vi.mock("@/lib/_core/auth", () => ({
  getSessionToken: async () => null,
}));

// Mock fetch to simulate server offline (falls back to keyword detection)
global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

const { analyzeEmergency } = await import("../lib/ai-analysis");

describe("AI Analysis — Keyword Fallback (server offline)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockRejectedValue(new Error("Server offline"));
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

describe("AI Analysis — Server LLM (mocked success)", () => {
  it("parses server LLM response correctly via tRPC format", async () => {
    const mockData = {
      emergencyType: "fire",
      severity: "critical",
      firstInstruction: "Cover mouth with cloth.",
      shouldCall103: true,
      shouldSMSFamily: true,
      nearestHelp: "fire station",
      spokenResponse: "Fire detected. Move low and exit now.",
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        result: {
          data: {
            json: {
              success: true,
              data: mockData,
              raw: JSON.stringify(mockData),
            },
          },
        },
      }),
    });

    const { analyzeEmergency: analyzeWithServer } = await import("../lib/ai-analysis");
    const result = await analyzeWithServer("there is a fire in the building");
    expect(result.emergencyType).toBe("fire");
    expect(result.severity).toBe("critical");
    expect(result.shouldCall103).toBe(true);
    expect(result.nearestHelp).toBe(true); // non-empty string → truthy → Boolean = true
  });

  it("falls back to keywords when server returns success:false", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        result: { data: { json: { success: false, data: null, raw: "" } } },
      }),
    });

    const { analyzeEmergency: analyzeWithFallback } = await import("../lib/ai-analysis");
    const result = await analyzeWithFallback("fire everywhere");
    // Keyword fallback should still detect fire
    expect(result.emergencyType).toBe("fire");
  });
});
