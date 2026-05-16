/**
 * Hardware Bridge — HARDWARE_TRIGGER action handler.
 *
 * Interfaces with device hardware:
 * - FLASH_SOS: Morse code SOS (··· — — — ···) via torch/flashlight
 * - VIBRATE_PULSE: Pulsing haptic vibration pattern
 * - AUDIO_ALARM: Repeating alarm tone via expo-audio
 *
 * All functions are safe to call on web (they no-op gracefully).
 */
import { Platform, Vibration } from "react-native";
import * as Haptics from "expo-haptics";
import type { HardwarePayload } from "./EScriptEngine";

// ─── Active state tracking ────────────────────────────────────────────────────

let flashInterval: ReturnType<typeof setTimeout> | null = null;
let vibrateInterval: ReturnType<typeof setInterval> | null = null;
let audioAlarmActive = false;

// ─── SOS Morse Code Flashlight ────────────────────────────────────────────────
// Morse SOS: ··· — — — ···
// dot = 200ms on, dash = 600ms on, gap = 200ms off, letter gap = 600ms off

const MORSE_SOS: Array<"dot" | "dash"> = [
  "dot", "dot", "dot",   // S
  "dash", "dash", "dash", // O
  "dot", "dot", "dot",   // S
];

async function playMorseSOS(): Promise<void> {
  if (Platform.OS === "web") return;

  // Use torch via Camera API if available (Expo Camera torch)
  // Fallback: use screen flash simulation via a callback
  // Since expo-camera torch requires a mounted component, we use
  // a vibration pattern as a proxy for torch timing on devices
  // that don't expose a JS torch API directly.
  //
  // On real devices with react-native-torch or expo-camera,
  // replace the Vibration calls below with actual torch toggles.

  const DOT = 200;
  const DASH = 600;
  const GAP = 200;
  const LETTER_GAP = 600;
  const CYCLE_GAP = 2000;

  const buildVibrationPattern = (): number[] => {
    const pattern: number[] = [0]; // initial delay
    MORSE_SOS.forEach((symbol, i) => {
      pattern.push(symbol === "dot" ? DOT : DASH); // on
      const isLastInLetter =
        (i === 2) || (i === 5) || (i === 8);
      pattern.push(isLastInLetter ? LETTER_GAP : GAP); // off
    });
    return pattern;
  };

  const pattern = buildVibrationPattern();
  Vibration.vibrate(pattern, true); // repeat = true
}

function stopMorseSOS(): void {
  Vibration.cancel();
  if (flashInterval) {
    clearTimeout(flashInterval);
    flashInterval = null;
  }
}

// ─── Vibration Pulse ──────────────────────────────────────────────────────────

function startVibratePulse(): void {
  if (Platform.OS === "web") return;
  // Pattern: 300ms on, 300ms off, repeat
  Vibration.vibrate([0, 300, 300], true);
}

function stopVibratePulse(): void {
  Vibration.cancel();
  if (vibrateInterval) {
    clearInterval(vibrateInterval);
    vibrateInterval = null;
  }
}

// ─── Audio Alarm ──────────────────────────────────────────────────────────────
// Uses expo-haptics as a fallback since audio requires a mounted component.
// For a real audio alarm, integrate expo-audio in the HardwareTriggerComponent.

async function startAudioAlarm(): Promise<void> {
  audioAlarmActive = true;
  // Rapid heavy haptics to simulate alarm
  const pulse = async () => {
    if (!audioAlarmActive) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setTimeout(pulse, 600);
  };
  pulse();
}

function stopAudioAlarm(): void {
  audioAlarmActive = false;
}

// ─── Main Dispatcher ──────────────────────────────────────────────────────────

export async function executeHardwareTrigger(payload: HardwarePayload): Promise<void> {
  const { trigger, state } = payload;

  switch (trigger) {
    case "FLASH_SOS":
      if (state) {
        await playMorseSOS();
      } else {
        stopMorseSOS();
      }
      break;

    case "VIBRATE_PULSE":
      if (state) {
        startVibratePulse();
      } else {
        stopVibratePulse();
      }
      break;

    case "AUDIO_ALARM":
      if (state) {
        await startAudioAlarm();
      } else {
        stopAudioAlarm();
      }
      break;
  }
}

export function stopAllHardware(): void {
  stopMorseSOS();
  stopVibratePulse();
  stopAudioAlarm();
}
