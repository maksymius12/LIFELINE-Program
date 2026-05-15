import * as SMS from "expo-sms";
import * as Location from "expo-location";
import { Linking, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const FAMILY_NUMBER_KEY = "lifeline_family_number";

export const sendEmergencySMS = async (): Promise<boolean> => {
  if (Platform.OS === "web") return false;

  const isAvailable = await SMS.isAvailableAsync();
  if (!isAvailable) return false;

  const familyNumber = await AsyncStorage.getItem(FAMILY_NUMBER_KEY);
  if (!familyNumber) return false;

  let locationText = "Location unavailable";
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === "granted") {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      locationText = `https://maps.google.com/?q=${loc.coords.latitude},${loc.coords.longitude}`;
    }
  } catch {
    // GPS unavailable — send without location
  }

  await SMS.sendSMSAsync(
    [familyNumber],
    `🆘 LIFELINE ALERT\nI need help. My location: ${locationText}\nSent automatically by LIFELINE app.`
  );
  return true;
};

export const sendTestSMS = async (familyNumber: string): Promise<boolean> => {
  if (Platform.OS === "web") return false;
  const isAvailable = await SMS.isAvailableAsync();
  if (!isAvailable) return false;
  await SMS.sendSMSAsync(
    [familyNumber],
    "LIFELINE test message. You are set as emergency contact."
  );
  return true;
};

export const openNearestHospital = async () => {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === "granted") {
      const loc = await Location.getCurrentPositionAsync({});
      const url = `https://maps.google.com/?q=hospital+near+me&center=${loc.coords.latitude},${loc.coords.longitude}`;
      await Linking.openURL(url);
    } else {
      await Linking.openURL("https://maps.google.com/?q=hospital+near+me");
    }
  } catch {
    // Silently fail
  }
};

// Alias for Settings screen
export const sendFamilySMS = sendTestSMS;
