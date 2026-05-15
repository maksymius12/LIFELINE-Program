import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  requestRecordingPermissionsAsync,
  getRecordingPermissionsAsync,
} from "expo-audio";
import * as Location from "expo-location";

const PERMISSIONS_ASKED_KEY = "lifeline_permissions_asked";

export interface PermissionStatus {
  microphone: boolean;
  location: boolean;
}

export const requestAllPermissions = async (): Promise<PermissionStatus> => {
  if (Platform.OS === "web") {
    return { microphone: true, location: true };
  }

  const micResult = await requestRecordingPermissionsAsync();
  const locResult = await Location.requestForegroundPermissionsAsync();

  await AsyncStorage.setItem(PERMISSIONS_ASKED_KEY, "true");

  return {
    microphone: micResult.granted,
    location: locResult.status === "granted",
  };
};

export const getPermissionStatus = async (): Promise<PermissionStatus> => {
  if (Platform.OS === "web") {
    return { microphone: true, location: true };
  }
  const micResult = await getRecordingPermissionsAsync();
  const locResult = await Location.getForegroundPermissionsAsync();
  return {
    microphone: micResult.granted,
    location: locResult.status === "granted",
  };
};

export const hasAskedPermissions = async (): Promise<boolean> => {
  const val = await AsyncStorage.getItem(PERMISSIONS_ASKED_KEY);
  return val === "true";
};
