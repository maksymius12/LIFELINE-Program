import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { Platform } from "react-native";
import * as Battery from "expo-battery";
import { Accelerometer } from "expo-sensors";

export interface AppContextValue {
  batteryLevel: number;
  blackoutMode: boolean;
  panicDetected: boolean;
  animationsEnabled: boolean;
  toggleBlackoutMode: () => void;
  registerTap: () => void;
  resetPanic: () => void;
}

const AppContext = createContext<AppContextValue>({
  batteryLevel: 1,
  blackoutMode: false,
  panicDetected: false,
  animationsEnabled: true,
  toggleBlackoutMode: () => {},
  registerTap: () => {},
  resetPanic: () => {},
});

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [batteryLevel, setBatteryLevel] = useState(1);
  const [blackoutMode, setBlackoutMode] = useState(false);
  const [panicDetected, setPanicDetected] = useState(false);

  // Derived: disable animations when battery is low
  const animationsEnabled = batteryLevel >= 0.2 && !blackoutMode;

  // Rapid-tap panic detection
  const tapTimestamps = useRef<number[]>([]);

  const registerTap = useCallback(() => {
    const now = Date.now();
    tapTimestamps.current.push(now);
    // Keep only last 5 taps
    if (tapTimestamps.current.length > 5) tapTimestamps.current.shift();
    // Check if last 3 taps were within 300ms each
    if (tapTimestamps.current.length >= 3) {
      const recent = tapTimestamps.current.slice(-3);
      const allRapid =
        recent[1] - recent[0] < 300 && recent[2] - recent[1] < 300;
      if (allRapid) setPanicDetected(true);
    }
  }, []);

  const resetPanic = useCallback(() => {
    setPanicDetected(false);
    tapTimestamps.current = [];
  }, []);

  const toggleBlackoutMode = useCallback(() => {
    setBlackoutMode((prev) => !prev);
  }, []);

  // Battery monitoring
  useEffect(() => {
    if (Platform.OS === "web") return;
    Battery.getBatteryLevelAsync().then((level) => {
      setBatteryLevel(level);
      if (level < 0.15) setBlackoutMode(true);
    });
    const sub = Battery.addBatteryLevelListener(({ batteryLevel: level }) => {
      setBatteryLevel(level);
      if (level < 0.15) setBlackoutMode(true);
    });
    return () => sub.remove();
  }, []);

  // Accelerometer shake detection
  useEffect(() => {
    if (Platform.OS === "web") return;
    Accelerometer.setUpdateInterval(200);
    const sub = Accelerometer.addListener(({ x, y, z }) => {
      const magnitude = Math.sqrt(x * x + y * y + z * z);
      if (magnitude > 2.5) setPanicDetected(true);
    });
    return () => sub.remove();
  }, []);

  return (
    <AppContext.Provider
      value={{
        batteryLevel,
        blackoutMode,
        panicDetected,
        animationsEnabled,
        toggleBlackoutMode,
        registerTap,
        resetPanic,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  return useContext(AppContext);
}
