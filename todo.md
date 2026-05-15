# Project TODO

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
- [x] Final testing and checkpoint

## Voice AI SOS Update

- [x] Install expo-av, expo-sms, expo-location, expo-keep-awake dependencies
- [x] Update app.config.ts with microphone, location, SMS permissions
- [x] Create AI analysis service (Gemma local API + keyword fallback)
- [x] Create family SMS service with GPS location
- [x] Create AsyncStorage family contact hook
- [x] Build SOS screen with idle/listening/processing/response states
- [x] Integrate voice recording via expo-av
- [x] Integrate speech transcription (manus-speech-to-text as bridge)
- [x] Auto-navigate to Panic Mode after AI response
- [x] Update Settings screen with family contact input + test SMS button
- [x] Show emergency contact on Home screen
- [x] Add expo-keep-awake to SOS flow
- [x] Test all states and error handling
