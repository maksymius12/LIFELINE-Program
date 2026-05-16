import * as Speech from "expo-speech";
import AsyncStorage from "@react-native-async-storage/async-storage";

const TTS_KEY = "lifeline_tts_enabled";

const isTTSEnabled = async (): Promise<boolean> => {
  try {
    const val = await AsyncStorage.getItem(TTS_KEY);
    return val !== "false"; // default true
  } catch {
    return true;
  }
};

export const speakInstruction = async (
  text: string,
  options?: { panicMode?: boolean; rate?: number; onDone?: () => void }
) => {
  const enabled = await isTTSEnabled();
  if (!enabled) {
    // Still call onDone so voice loop continues even when TTS is off
    options?.onDone?.();
    return;
  }
  Speech.stop();
  Speech.speak(text, {
    rate: options?.panicMode ? 0.8 : (options?.rate ?? 0.85),
    pitch: 1.0,
    language: "en-US",
    volume: 1.0,
    onDone: options?.onDone,
    onStopped: options?.onDone, // also fire if speech is interrupted
  });
};

export const stopSpeech = () => {
  Speech.stop();
};
