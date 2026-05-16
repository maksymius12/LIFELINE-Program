/**
 * watch-bridge.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Phone-side Apple Watch / WearOS bridge for LIFELINE.
 *
 * This module provides a stub that:
 *  1. Detects whether a native Watch bridge module is available at runtime
 *     (requires a custom native module compiled into the APK/IPA — not
 *     available in Expo Go).
 *  2. Exposes a `listenForWatchSOS()` function that registers a callback
 *     invoked when the Watch sends an SOS signal.
 *  3. Falls back gracefully (no-op) when running in Expo Go or on web.
 *
 * ── Integration path (for production APK) ────────────────────────────────────
 * 1. Add the `react-native-watch-connectivity` npm package.
 * 2. On iOS: add the WatchKit extension target in Xcode and implement
 *    `WCSession` message sending from the Watch app.
 * 3. On Android: use the Wearable Data Layer API with a `MessageClient`.
 * 4. Replace the `NativeModules.LifelineWatch` check below with the actual
 *    `WatchConnectivity` import from `react-native-watch-connectivity`.
 *
 * ── Current behaviour in Expo Go ─────────────────────────────────────────────
 * All functions are no-ops. The app works normally without a Watch.
 */

import { NativeModules, Platform } from "react-native";

interface LifelineWatchModule {
  listenForSOS: (callback: (payload: WatchSOSPayload) => void) => () => void;
  sendHeartbeat: () => void;
}

export interface WatchSOSPayload {
  /** Timestamp of the SOS trigger on the Watch */
  timestamp: number;
  /** Heart rate at time of trigger (if available from Watch health sensors) */
  heartRate?: number;
  /** GPS coordinates from Watch (if available) */
  latitude?: number;
  longitude?: number;
  /** Type of trigger: "button" (manual) | "fall" (fall detection) | "heart" (abnormal HR) */
  triggerType: "button" | "fall" | "heart";
}

const watchModule: LifelineWatchModule | null =
  Platform.OS !== "web" && NativeModules.LifelineWatch
    ? (NativeModules.LifelineWatch as LifelineWatchModule)
    : null;

/** Returns true if the native Watch bridge is available (not in Expo Go). */
export const isWatchAvailable = (): boolean => watchModule !== null;

/**
 * Register a callback for Watch SOS signals.
 * Returns an unsubscribe function.
 * No-op in Expo Go / web.
 */
export const listenForWatchSOS = (
  callback: (payload: WatchSOSPayload) => void
): (() => void) => {
  if (!watchModule) {
    if (__DEV__) {
      console.log(
        "[WatchBridge] Native Watch module not available. " +
        "Build a custom APK/IPA to enable Watch SOS integration."
      );
    }
    return () => {};
  }
  return watchModule.listenForSOS(callback);
};

/** Send a heartbeat to the Watch to confirm the phone app is active. No-op in Expo Go. */
export const sendWatchHeartbeat = (): void => {
  watchModule?.sendHeartbeat();
};
