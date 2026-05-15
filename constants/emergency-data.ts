export interface EmergencyStep {
  instruction: string;
  emoji: string;
  audio: boolean;
  alternative: string; // hardcoded fallback if Gemma offline
}

export interface EmergencyScenario {
  title: string;
  color: string;
  steps: EmergencyStep[];
}

export type DisasterType = "fire" | "injury" | "blackout" | "quake" | "flood" | "toxic";

export const EMERGENCY_DATA: Record<DisasterType, EmergencyScenario> = {
  fire: {
    title: "🔥 Fire",
    color: "#FF3D3D",
    steps: [
      {
        instruction: "Cover mouth with cloth.",
        emoji: "🧣",
        audio: true,
        alternative: "Hold breath for short bursts. Move fast.",
      },
      {
        instruction: "Move low, below smoke.",
        emoji: "🧎",
        audio: true,
        alternative: "Crawl on hands and knees to exit.",
      },
      {
        instruction: "Do not use elevator.",
        emoji: "🚫",
        audio: true,
        alternative: "Find stairwell or window exit.",
      },
    ],
  },
  injury: {
    title: "🩸 Injury",
    color: "#FF3D3D",
    steps: [
      {
        instruction: "Press cloth on wound.",
        emoji: "🩹",
        audio: true,
        alternative: "Use bare hand if no cloth. Press hard.",
      },
      {
        instruction: "Lift arm above heart.",
        emoji: "💪",
        audio: true,
        alternative: "Lay person flat, elevate injured limb.",
      },
      {
        instruction: "Do not release pressure.",
        emoji: "✋",
        audio: true,
        alternative: "Add more cloth on top. Never remove first layer.",
      },
    ],
  },
  blackout: {
    title: "⚡ Blackout",
    color: "#F59E0B",
    steps: [
      {
        instruction: "Turn off gas immediately.",
        emoji: "🔴",
        audio: true,
        alternative: "If you cannot reach gas valve, open all windows.",
      },
      {
        instruction: "Open window wide.",
        emoji: "🪟",
        audio: true,
        alternative: "Move to hallway or stairwell for ventilation.",
      },
      {
        instruction: "Exit to stairwell now.",
        emoji: "🚪",
        audio: true,
        alternative: "Stay on your floor if stairwell is blocked.",
      },
    ],
  },
  quake: {
    title: "🌪 Earthquake",
    color: "#F59E0B",
    steps: [
      {
        instruction: "Drop to the floor.",
        emoji: "⬇️",
        audio: true,
        alternative: "If you cannot drop, brace against a wall.",
      },
      {
        instruction: "Cover head and neck.",
        emoji: "🙇",
        audio: true,
        alternative: "Use a bag, pillow, or arms to shield head.",
      },
      {
        instruction: "Hold until shaking stops.",
        emoji: "✋",
        audio: true,
        alternative: "Count to 60 slowly. Do not move until still.",
      },
    ],
  },
  flood: {
    title: "🌊 Flood",
    color: "#4a9d9c",
    steps: [
      {
        instruction: "Move to higher ground.",
        emoji: "⬆️",
        audio: true,
        alternative: "Climb to second floor or roof if trapped.",
      },
      {
        instruction: "Avoid all moving water.",
        emoji: "🌊",
        audio: true,
        alternative: "6 inches of water can knock you down. Stay put.",
      },
      {
        instruction: "Call 103 immediately.",
        emoji: "📞",
        audio: true,
        alternative: "Signal from window or roof if phone is dead.",
      },
    ],
  },
  toxic: {
    title: "☣ Toxic Air",
    color: "#22C55E",
    steps: [
      {
        instruction: "Cover mouth and nose.",
        emoji: "😷",
        audio: true,
        alternative: "Wet cloth is better than dry. Use any fabric.",
      },
      {
        instruction: "Move upwind fast.",
        emoji: "💨",
        audio: true,
        alternative: "If wind direction unknown, move perpendicular to source.",
      },
      {
        instruction: "Do not go back inside.",
        emoji: "🚫",
        audio: true,
        alternative: "Wait for official all-clear signal.",
      },
    ],
  },
};

export const DISASTER_BUTTONS = [
  { type: "fire" as DisasterType, emoji: "🔥", label: "Fire" },
  { type: "injury" as DisasterType, emoji: "🩸", label: "Injury" },
  { type: "quake" as DisasterType, emoji: "🌪", label: "Earthquake" },
  { type: "blackout" as DisasterType, emoji: "⚡", label: "Blackout" },
  { type: "flood" as DisasterType, emoji: "🌊", label: "Flood" },
  { type: "toxic" as DisasterType, emoji: "☣", label: "Toxic Air" },
];

// Training scenarios with full interactive data
export const TRAINING_SCENARIOS = [
  {
    id: "air-alert",
    title: "Air Alert",
    description: "What to do when sirens sound",
    tag: "Safety",
    tagColor: "#0D6E6E",
    steps: 3,
    prompt:
      "Imagine: you are home alone. An air raid siren starts. What do you do first?",
    correctKeywords: ["shelter", "basement", "cover", "hide", "interior", "away from windows"],
    correctAnswer:
      "Move to the most interior room or basement, away from windows. Lie low.",
  },
  {
    id: "blackout",
    title: "Blackout",
    description: "Power outage survival steps",
    tag: "Survival",
    tagColor: "#F59E0B",
    steps: 3,
    prompt:
      "Imagine: the power goes out at night. You smell something odd. What do you do first?",
    correctKeywords: ["gas", "window", "open", "ventilate", "outside", "exit"],
    correctAnswer:
      "Turn off the gas valve, open windows immediately, and move outside.",
  },
  {
    id: "trauma",
    title: "Trauma",
    description: "First aid for injuries",
    tag: "Medical",
    tagColor: "#FF3D3D",
    steps: 3,
    prompt:
      "Imagine: someone next to you is bleeding heavily from their arm. What do you do first?",
    correctKeywords: ["press", "pressure", "cloth", "tourniquet", "stop bleeding", "compress"],
    correctAnswer:
      "Apply direct pressure with a cloth. Press firmly and do not release.",
  },
  {
    id: "fire",
    title: "Fire",
    description: "Escape a burning building",
    tag: "Emergency",
    tagColor: "#FF3D3D",
    steps: 3,
    prompt:
      "Imagine: you wake up to smoke in your apartment. The door handle is hot. What do you do?",
    correctKeywords: ["window", "low", "crawl", "do not open", "signal", "shout"],
    correctAnswer:
      "Do NOT open the door. Seal the gap, go to a window, and signal for help.",
  },
];

// Medical AI decision tree
export interface MedicalNode {
  id: string;
  question?: string;
  diagnosis?: string;
  protocol?: MedicalProtocolStep[];
  yes?: string;
  no?: string;
}

export interface MedicalProtocolStep {
  instruction: string;
  emoji: string;
  timerSeconds?: number;
  timerLabel?: string;
}

export const MEDICAL_TREE: Record<string, MedicalNode> = {
  q1: {
    id: "q1",
    question: "Is there blood?",
    yes: "q2_blood",
    no: "q2_breathing",
  },
  q2_blood: {
    id: "q2_blood",
    question: "Is it pulsing and bright red?",
    yes: "dx_arterial",
    no: "dx_venous",
  },
  q2_breathing: {
    id: "q2_breathing",
    question: "Is the person breathing?",
    yes: "q3_conscious",
    no: "dx_cpr",
  },
  q3_conscious: {
    id: "q3_conscious",
    question: "Are they conscious?",
    yes: "dx_shock",
    no: "dx_unconscious",
  },
  dx_arterial: {
    id: "dx_arterial",
    diagnosis: "ARTERIAL BLEEDING",
    protocol: [
      { instruction: "Apply tourniquet above wound.", emoji: "🩹", timerSeconds: 0 },
      { instruction: "Tighten until bleeding stops.", emoji: "✋" },
      { instruction: "Write time applied on skin.", emoji: "✍️" },
      { instruction: "Keep limb elevated.", emoji: "💪" },
      { instruction: "Hold pressure — do not release.", emoji: "🛑", timerSeconds: 600, timerLabel: "Hold for 10 min" },
    ],
  },
  dx_venous: {
    id: "dx_venous",
    diagnosis: "VENOUS BLEEDING",
    protocol: [
      { instruction: "Press cloth directly on wound.", emoji: "🩹", timerSeconds: 180, timerLabel: "Hold for 3 min" },
      { instruction: "Do not remove cloth.", emoji: "✋" },
      { instruction: "Elevate above heart level.", emoji: "💪" },
    ],
  },
  dx_cpr: {
    id: "dx_cpr",
    diagnosis: "NO BREATHING — CPR",
    protocol: [
      { instruction: "Tilt head, lift chin.", emoji: "🫁" },
      { instruction: "Give 2 rescue breaths.", emoji: "💨" },
      { instruction: "30 chest compressions.", emoji: "🫀", timerSeconds: 20, timerLabel: "20 sec compressions" },
      { instruction: "Repeat until help arrives.", emoji: "🔁" },
    ],
  },
  dx_shock: {
    id: "dx_shock",
    diagnosis: "SHOCK",
    protocol: [
      { instruction: "Lay person flat on back.", emoji: "🛏️" },
      { instruction: "Elevate legs 30 cm.", emoji: "⬆️" },
      { instruction: "Keep warm with blanket.", emoji: "🧣" },
    ],
  },
  dx_unconscious: {
    id: "dx_unconscious",
    diagnosis: "UNCONSCIOUS",
    protocol: [
      { instruction: "Place on stable side position.", emoji: "🫀" },
      { instruction: "Tilt head back slightly.", emoji: "↩️" },
      { instruction: "Monitor breathing every minute.", emoji: "👁️", timerSeconds: 60, timerLabel: "Check every 60 sec" },
    ],
  },
};

export const MEDICAL_AI_CONVERSATION = [
  { role: "ai" as const, text: "I'm Medical AI. What's the emergency?" },
];

export const MEDICAL_AI_DIAGNOSIS = {
  title: "ARTERIAL BLEEDING",
  emoji: "⚠",
  instruction: "Apply tourniquet above wound",
  timerSeconds: 600,
  timerLabel: "Hold pressure for 10 minutes",
};
