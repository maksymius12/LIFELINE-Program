# LIFELINE — AI Emergency Companion

> **Your AI-powered 911 operator. Works offline. No signal required.**

LIFELINE is a React Native mobile app that acts as an on-device emergency response companion. Press the SOS button, speak your emergency, and the AI guides you to safety — step by step, in real time, even without internet.

---

## Quick Start with Expo Go

### Prerequisites

| Requirement | Version |
|---|---|
| Node.js | 18 or later |
| pnpm | 9.x (`npm install -g pnpm`) |
| Expo Go app | Latest — [iOS App Store](https://apps.apple.com/app/expo-go/id982107779) · [Google Play](https://play.google.com/store/apps/details?id=host.exp.exponent) |

### 1. Clone and install

```bash
git clone https://github.com/your-org/lifeline.git
cd lifeline
pnpm install
```

### 2. Start the development server

```bash
pnpm dev
```

This starts both the Metro bundler (port 8081) and the API server (port 3000) concurrently.

### 3. Open in Expo Go

After the server starts, you will see a QR code in the terminal.

- **iOS** — open the Camera app and scan the QR code. Tap the Expo Go banner that appears.
- **Android** — open Expo Go, tap **Scan QR code**, and scan the code from the terminal.

> **Note:** Your phone and development machine must be on the same Wi-Fi network for Expo Go to connect.

### 4. Test the AI

Once the app loads, tap the large red **SOS** button on the main screen. The AI operator will greet you. Speak your emergency (or type it using the text input below the button) and the AI will respond with voice instructions and an interactive step-by-step guide.

---

## Features

### SOS — AI 911 Operator

The core of LIFELINE. Press SOS, speak your emergency, and the AI responds like a calm 911 dispatcher — assessing the situation, giving immediate instructions, and continuing the conversation until you are safe.

| Feature | Description |
|---|---|
| Multi-turn conversation | Continuous voice turns, like a real 911 call |
| Voice recording | `expo-audio` records your speech and uploads to Whisper for transcription |
| AI response | Manus built-in LLM generates structured JSON: spoken text + on-screen instruction + action |
| Text fallback | Type your emergency if voice is unavailable |
| TTS | Every AI response is spoken aloud via `expo-speech` |
| SMS + GPS | Automatically sends your location to a saved family contact |
| Call 103 | One-tap emergency services button always visible |

### E-Script Engine — Agentic UI

When the AI determines an interactive component is needed, it renders one of four dynamic UI types instead of plain text:

| Component | When used |
|---|---|
| `UI_RENDER_POLL` | Diagnostic YES/NO questions (e.g., "Is the person breathing?") |
| `UI_SHOW_SCHEME` | Step-by-step protocol cards (e.g., tourniquet application) |
| `COUNTER_TIMEOUT` | Timed actions (e.g., "Hold pressure for 30 seconds") |
| `HARDWARE_TRIGGER` | Device hardware (flashlight SOS Morse, vibration pulse, audio alarm) |

### Panic Mode

Full-screen step-by-step guidance for 6 emergency types: fire, injury, flood, earthquake, blackout, and toxic exposure. Each step is spoken aloud via TTS. The **DONE** button advances to the next step with a heavy haptic. A **"Can't do it"** link asks the AI for an alternative.

### Emergency Map

Embedded in Panic Mode — shows your GPS position, a danger radius circle, and an AI-generated evacuation route as a dashed polyline. The AI determines the safest direction based on emergency type (fire = upwind, flood = uphill, etc.). The destination coordinates are included in the family SMS.

### Prepare Tab

- **Training scenarios** — 4 interactive practice sessions. Speak your answer, the AI evaluates it and gives feedback.
- **My Kit checklist** — tap-to-check emergency supply list (water, first aid kit, flashlight, power bank, documents) persisted in AsyncStorage.

### Battery Awareness

- Below 20%: animations disabled to save power.
- Below 15%: **Blackout Mode** activates — screen dims to minimum brightness, only essential UI is shown.

### Panic Detector

Detects when the user is in distress via accelerometer shake or rapid screen taps. Enlarges instruction text and increases TTS speed automatically.

### Apple Watch / WearOS Bridge (stub)

A phone-side listener stub is included in `lib/watch-bridge.ts`. When a native Watch module is compiled into the APK/IPA, it receives SOS signals from the Watch (manual button, fall detection, or abnormal heart rate) and triggers the SOS flow automatically.

---

## Architecture

```
app/
  (tabs)/
    index.tsx        ← Home screen — large SOS button
    training.tsx     ← Prepare tab (training + kit)
    settings.tsx     ← Family contact, TTS, haptics
  sos.tsx            ← 911-call conversation screen
  panic.tsx          ← Step-by-step Panic Mode with map

lib/
  ai-analysis.ts     ← tRPC client for Manus LLM
  transcription.ts   ← Audio upload + Whisper transcription
  EScriptEngine.ts   ← JSON protocol parser + 4 mock scenarios
  voice-commands.ts  ← Voice command matcher (EN + UA)
  family-sms.ts      ← SMS + GPS dispatch
  HardwareBridge.ts  ← Flashlight, vibration, audio alarm
  watch-bridge.ts    ← Apple Watch / WearOS phone-side stub
  app-context.tsx    ← Battery, panic detector, blackout mode
  speech.ts          ← TTS wrapper (expo-speech)
  haptics.ts         ← Haptic feedback patterns

components/
  escripts/
    EScriptRenderer.tsx    ← Routes between chat and agentic UI
    PollComponent.tsx      ← YES/NO diagnostic questions
    SchemeComponent.tsx    ← Step-by-step protocol cards
    CountdownComponent.tsx ← Timed action countdown
    HardwareTriggerComponent.tsx ← Hardware feedback screen
  EmergencyMap.tsx         ← GPS map with evacuation route

server/
  routers.ts         ← tRPC routes: emergency.chat, .escript, .evacuation, .transcribe
  _core/llm.ts       ← Manus LLM integration
  _core/voiceTranscription.ts ← Whisper integration
```

### AI Flow

```
User speaks
    ↓
expo-audio records → uploads to server (multipart)
    ↓
Whisper transcribes audio → text
    ↓
Manus LLM (OPERATOR_SYSTEM_PROMPT) → structured JSON response
    ↓
EScriptEngine.parseAndExecute() → route to correct UI component
    ↓
TTS speaks the response + UI renders instruction
    ↓
User responds → next turn
```

---

## Environment

No API keys are required. The app uses the Manus built-in LLM and Whisper — both are provided automatically when running in the Manus sandbox or deployed via the Manus platform.

---

## Building a Production APK

1. Create a checkpoint in the Manus UI.
2. Click the **Publish** button in the top-right of the Management UI.
3. The platform builds an Android APK and an iOS archive automatically.

> Do not run `expo build` manually — it will exhaust sandbox resources.

---

## Voice Commands

After each AI instruction, the user can respond by voice without touching the screen:

| Say | Action |
|---|---|
| "Done" / "Готово" | Advance to next step |
| "Repeat" / "Повтори" | Repeat current instruction |
| "Can't" / "Не можу" | Request alternative from AI |
| "Go back" / "Назад" | Return to previous screen |
| "Call 103" / "Виклич" | Open emergency dialer |
| "Yes" / "Так" | Confirm YES/NO question |
| "No" / "Ні" | Deny YES/NO question |

---

## License

MIT — see `LICENSE` for details.
