# LIFELINE — Mobile App Interface Design

## Core Concept
LIFELINE is an AI survival companion that helps people function during emergencies when their brain is overwhelmed by stress. The app solves cognitive collapse by presenting ONE action at a time with maximum clarity.

## Color Palette (Brand Colors)
| Token | Hex | Usage |
|-------|-----|-------|
| primary-100 | #0D6E6E | Primary teal — safe/info backgrounds |
| primary-200 | #4a9d9c | Secondary teal — lighter info elements |
| primary-300 | #afffff | Bright cyan — badges, highlights |
| accent-100 | #FF3D3D | Red — act now, SOS, danger |
| accent-200 | #ffe0c8 | Warm peach — soft accent |
| text-100 | #FFFFFF | Primary text on dark backgrounds |
| text-200 | #e0e0e0 | Secondary/muted text |
| bg-100 | #0D1F2D | Main background (dark navy) |
| bg-200 | #1d2e3d | Card/surface background |
| bg-300 | #354656 | Elevated surface/border |

## Screen List

### 1. Home Screen (Emergency Hub)
- **Header**: App title "LIFELINE" in bold white + tagline "AI Survival Companion" in text-200
- **Badge**: Top-right corner "● OFFLINE AI" in primary-300 text on primary-100 pill
- **SOS Button**: Large circle (120px diameter), accent-100 background, centered, with vibration on press
- **Disaster Grid**: 2x3 grid of disaster type buttons below SOS — each is a rounded card with emoji + label
  - 🔥 Fire | 🩸 Injury | 🌪 Earthquake | ⚡ Blackout | 🌊 Flood | ☣ Toxic Air
- **Emergency Call Bar**: Green bar at bottom "📞 Call Emergency — 103" (always visible)
- **Tab Navigation**: 4 tabs — Emergency / Training / My Kit / Settings

### 2. Panic Mode Screen (Dynamic — receives disaster type param)
- **Red Top Bar**: Shows active mode (e.g. "🔥 FIRE MODE — ACTIVE") in white on accent-100
- **Progress Dots**: Horizontal dots showing current step (e.g. Step 1 of 3)
- **Emoji Card**: Large centered emoji animation card (bg-200 rounded card, 80px emoji)
- **Instruction Text**: ONE big instruction (max 6 words), min 24sp font, white on bg-100
- **DONE Button**: Full-width, accent-100 background, "DONE ✓" text, haptic on press → next step
- **Alternative Button**: "Can't do it" in text-200 → shows alternative action
- **AI Listening Bar**: "🤖 AI listening… speak your status" in primary-100 bar
- **Call Bar**: "📞 Call 103" always visible at bottom
- **Battery Warning**: Yellow banner if battery < 20%

### 3. Training Mode Screen
- **Header**: "Training Mode" title
- **Scenario Cards**: 4 vertical cards in a scrollable list
  - Air Alert / Blackout / Trauma / Fire
  - Each card: tag badge (colored pill), title, description, progress bar, "X/3 steps completed"
- **Stats Row**: Bottom row with completed count + streak counter with 🔥

### 4. Medical AI Screen
- **Header**: "🩺 MEDICAL AI — Active" in primary-100 bar
- **Chat Interface**: Scrollable chat with:
  - AI messages: left-aligned bubbles in bg-200
  - User messages: right-aligned bubbles in accent-100
  - YES/NO quick-reply buttons
- **Decision Card**: Appears after diagnosis — warning card with action (e.g. "⚠ ARTERIAL BLEEDING — Apply tourniquet")
- **Action Buttons**: "YES — Guide me" (accent-100) + "📞 Call 103" (primary-100)
- **Countdown Timer**: Progress bar for timed actions (e.g. hold pressure for 10 min)
- **Typing Indicator**: "🤖 AI preparing guide…" animated dots

## Key User Flows

### Emergency Flow
1. User opens app → Home screen
2. Taps SOS button OR specific disaster type → Panic Mode screen
3. Sees Step 1 instruction (TTS reads aloud) → Taps DONE
4. Sees Step 2 → DONE → Step 3 → DONE → Completion
5. "📞 Call 103" always available at any step

### Training Flow
1. User taps Training tab → Training Mode screen
2. Selects scenario card → enters practice Panic Mode (same UI, no urgency styling)
3. Completes steps → progress saved, streak updated

### Medical AI Flow
1. User taps Medical AI (from My Kit tab or dedicated entry)
2. AI asks questions via chat bubbles
3. User responds YES/NO
4. AI provides diagnosis card with guided action
5. Countdown timer for timed procedures

## Typography
- App title: 32sp bold
- Instruction text: 24sp bold (minimum 20sp per UX rules)
- Button text: 18sp semibold
- Body text: 16sp regular
- Badge/label text: 12sp medium

## Layout Principles
- Portrait orientation only (9:16)
- One-handed usage — primary actions in thumb zone (bottom 60% of screen)
- High contrast only — no gradients, no decorative colors
- Color = status: Red = act now, Teal = safe/info
- Maximum 1 action visible at a time during emergency
