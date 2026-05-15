import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEYS = {
  FAMILY_NUMBER: "lifeline_family_number",
  TTS_ENABLED: "lifeline_tts_enabled",
  HAPTICS_ENABLED: "lifeline_haptics_enabled",
};

export interface AppSettings {
  familyNumber: string;
  ttsEnabled: boolean;
  hapticsEnabled: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  familyNumber: "",
  ttsEnabled: true,
  hapticsEnabled: true,
};

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const [familyNumber, ttsEnabled, hapticsEnabled] = await Promise.all([
        AsyncStorage.getItem(KEYS.FAMILY_NUMBER),
        AsyncStorage.getItem(KEYS.TTS_ENABLED),
        AsyncStorage.getItem(KEYS.HAPTICS_ENABLED),
      ]);
      setSettings({
        familyNumber: familyNumber ?? "",
        ttsEnabled: ttsEnabled !== "false",
        hapticsEnabled: hapticsEnabled !== "false",
      });
    } catch {
      // Use defaults on error
    } finally {
      setLoaded(true);
    }
  };

  const updateFamilyNumber = useCallback(async (number: string) => {
    setSettings((prev) => ({ ...prev, familyNumber: number }));
    await AsyncStorage.setItem(KEYS.FAMILY_NUMBER, number);
  }, []);

  const updateTTS = useCallback(async (enabled: boolean) => {
    setSettings((prev) => ({ ...prev, ttsEnabled: enabled }));
    await AsyncStorage.setItem(KEYS.TTS_ENABLED, String(enabled));
  }, []);

  const updateHaptics = useCallback(async (enabled: boolean) => {
    setSettings((prev) => ({ ...prev, hapticsEnabled: enabled }));
    await AsyncStorage.setItem(KEYS.HAPTICS_ENABLED, String(enabled));
  }, []);

  return {
    settings,
    loaded,
    updateFamilyNumber,
    updateTTS,
    updateHaptics,
  };
}
