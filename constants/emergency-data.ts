export interface EmergencyStep {
  instruction: string;
  emoji: string;
  audio: boolean;
}

export interface EmergencyScenario {
  steps: EmergencyStep[];
}

export type DisasterType = 'fire' | 'injury' | 'blackout' | 'quake' | 'flood' | 'toxic';

export const EMERGENCY_DATA: Record<DisasterType, EmergencyScenario> = {
  fire: {
    steps: [
      { instruction: "Cover mouth with cloth.", emoji: "🧣", audio: true },
      { instruction: "Move low, below smoke.", emoji: "🧎", audio: true },
      { instruction: "Do not use elevator.", emoji: "🚫", audio: true },
    ],
  },
  injury: {
    steps: [
      { instruction: "Press cloth on wound.", emoji: "🩹", audio: true },
      { instruction: "Lift arm above heart.", emoji: "💪", audio: true },
      { instruction: "Do not release pressure.", emoji: "✋", audio: true },
    ],
  },
  blackout: {
    steps: [
      { instruction: "Turn off gas immediately.", emoji: "🔴", audio: true },
      { instruction: "Open window wide.", emoji: "🪟", audio: true },
      { instruction: "Exit to stairwell now.", emoji: "🚪", audio: true },
    ],
  },
  quake: {
    steps: [
      { instruction: "Drop to the floor.", emoji: "⬇️", audio: true },
      { instruction: "Cover head and neck.", emoji: "🙇", audio: true },
      { instruction: "Hold until shaking stops.", emoji: "✋", audio: true },
    ],
  },
  flood: {
    steps: [
      { instruction: "Move to higher ground.", emoji: "⬆️", audio: true },
      { instruction: "Avoid all moving water.", emoji: "🌊", audio: true },
      { instruction: "Call 103 immediately.", emoji: "📞", audio: true },
    ],
  },
  toxic: {
    steps: [
      { instruction: "Cover mouth and nose.", emoji: "😷", audio: true },
      { instruction: "Move upwind fast.", emoji: "💨", audio: true },
      { instruction: "Do not go back inside.", emoji: "🚫", audio: true },
    ],
  },
};

export const DISASTER_BUTTONS = [
  { type: 'fire' as DisasterType, emoji: '🔥', label: 'Fire' },
  { type: 'injury' as DisasterType, emoji: '🩸', label: 'Injury' },
  { type: 'quake' as DisasterType, emoji: '🌪', label: 'Earthquake' },
  { type: 'blackout' as DisasterType, emoji: '⚡', label: 'Blackout' },
  { type: 'flood' as DisasterType, emoji: '🌊', label: 'Flood' },
  { type: 'toxic' as DisasterType, emoji: '☣', label: 'Toxic Air' },
];

export const TRAINING_SCENARIOS = [
  {
    id: 'air-alert',
    title: 'Air Alert',
    description: 'What to do when sirens sound',
    tag: 'Safety',
    tagColor: '#0D6E6E',
    steps: 3,
  },
  {
    id: 'blackout',
    title: 'Blackout',
    description: 'Power outage survival steps',
    tag: 'Survival',
    tagColor: '#F59E0B',
    steps: 3,
  },
  {
    id: 'trauma',
    title: 'Trauma',
    description: 'First aid for injuries',
    tag: 'Medical',
    tagColor: '#FF3D3D',
    steps: 3,
  },
  {
    id: 'fire',
    title: 'Fire',
    description: 'Escape a burning building',
    tag: 'Emergency',
    tagColor: '#FF3D3D',
    steps: 3,
  },
];

export const MEDICAL_AI_CONVERSATION = [
  { role: 'ai' as const, text: "I'm Medical AI. What's the emergency?" },
  { role: 'ai' as const, text: "Is there visible bleeding?" },
  { role: 'ai' as const, text: "Is the blood bright red and pulsing?" },
  { role: 'ai' as const, text: "Is the wound on a limb (arm or leg)?" },
];

export const MEDICAL_AI_DIAGNOSIS = {
  title: "ARTERIAL BLEEDING",
  emoji: "⚠",
  instruction: "Apply tourniquet above wound",
  timerSeconds: 600,
  timerLabel: "Hold pressure for 10 minutes",
};
