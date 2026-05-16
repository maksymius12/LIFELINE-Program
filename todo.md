# Project TODO

## Initial Build (v1.0)

- [x] Configure theme colors (brand palette) in theme.config.js and tailwind.config.js
- [x] Set up tab navigation (Emergency / Training / My Kit / Settings)
- [x] Add icon mappings for all tabs
- [x] Create emergency data JSON constants
- [x] Build Home screen with SOS button, disaster grid, and call bar
- [x] Build Panic Mode screen with step-by-step guidance
- [x] Integrate expo-haptics for DONE button feedback
- [x] Integrate expo-speech for TTS on instruction load
- [x] Build Training Mode screen with scenario cards and progress
- [x] Build Medical AI screen with chat interface
- [x] Add battery level detection and low-battery mode
- [x] Add "Call 103" persistent button on all screens
- [x] Generate custom app logo
- [x] Update app.config.ts with branding

## Voice AI SOS Update (v1.1)

- [x] Install expo-sms, expo-location, expo-keep-awake dependencies
- [x] Update app.config.ts with microphone, location, SMS permissions
- [x] Create AI analysis service (Gemma local API + keyword fallback)
- [x] Create family SMS service with GPS location
- [x] Create AsyncStorage family contact hook
- [x] Build SOS screen with idle/listening/processing/response states
- [x] Integrate voice recording via expo-audio
- [x] Integrate speech transcription (manus-speech-to-text as bridge)
- [x] Auto-navigate to Panic Mode after AI response
- [x] Update Settings screen with family contact input + test SMS button
- [x] Show emergency contact on Home screen
- [x] Add expo-keep-awake to SOS flow
- [x] Test all states and error handling

## Full Functionality Update (v1.2)

- [x] Install expo-battery, expo-sensors
- [x] Permissions flow on first launch (mic + location)
- [x] SOS: TTS reads spokenResponse immediately and loudly
- [x] SOS: haptics.notificationAsync(Error) on critical severity
- [x] SOS: auto-navigate to panic/[type] after response
- [x] SOS: pulsing ring animation on home SOS button
- [x] SOS: animated sound-wave bars during listening state
- [x] SOS: rotating spinner during processing state
- [x] Panic Mode: TTS auto-reads instruction on mount
- [x] Panic Mode: DONE button with Heavy haptic
- [x] Panic Mode: animated progress dots
- [x] Panic Mode: completion screen (green, "You did great")
- [x] Panic Mode: "Can't do it" → Gemma alternative or hardcoded fallback
- [x] Panic Mode: keep-awake active
- [x] Medical AI: full YES/NO decision tree (5 diagnoses)
- [x] Medical AI: protocol steps one at a time with TTS
- [x] Medical AI: countdown timer for timed steps
- [x] Medical AI: keep-awake active
- [x] Training Mode: interactive scenario session screen
- [x] Training Mode: voice answer + Gemma evaluation
- [x] Training Mode: streak counter in AsyncStorage
- [x] SMS: correct AsyncStorage key (lifeline_family_number)
- [x] SMS: sendFamilySMS alias for Settings screen
- [x] Speech: respect ttsEnabled setting from AsyncStorage
- [x] Home: blackout mode (pure black UI), battery badge, panic banner
- [x] Home: yellow warning if no emergency contact set
- [x] Battery awareness: disable animations < 20%, blackout mode < 15%
- [x] Panic Detector: accelerometer shake + rapid tap detection
- [x] Blackout Mode: pure black/white UI, voice-first
- [x] Keep-awake on all emergency screens (SOS, Panic, Medical)
- [x] TypeScript check passes (0 errors)
- [x] All 22 tests pass

## Emergency UX Simplification (v1.3)

- [x] Home: remove tagline, shrink badge, keep only SOS + grid + call bar
- [x] Home: enlarge disaster grid cards (larger emoji, larger label)
- [x] Home: make Call 103 bar taller and more prominent
- [x] SOS: remove info card text, keep only circle + status + call bar
- [x] SOS: remove AI bar label, simplify header
- [x] Panic Mode: show one instruction at a time, full-screen, huge text
- [x] Panic Mode: DONE and Can't Do It buttons must be thumb-sized (min 64px height)
- [x] Panic Mode: remove step counter text, keep only dots
- [x] Medical AI: show only question text + YES / NO buttons, nothing else
- [x] Medical AI: YES/NO buttons must be full-width, min 80px height
- [x] Medical AI: protocol steps — one per screen, huge text, single NEXT button
- [x] Training: simplify card list, remove tag/step count clutter
- [x] Settings: remove About section and Voice AI info card
- [x] Settings: keep only family number input + TTS toggle + haptics toggle
