import * as SMS from "expo-sms";
import * as Location from "expo-location";
import { Platform } from "react-native";

export const sendFamilySMS = async (familyNumber: string): Promise<boolean> => {
  if (!familyNumber) return false;

  try {
    const isAvailable = await SMS.isAvailableAsync();
    if (!isAvailable) return false;

    let messageBody = "🆘 LIFELINE ALERT: I need help. Please call me or emergency services.";

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const { latitude, longitude } = location.coords;
        const mapsLink = `https://maps.google.com/?q=${latitude},${longitude}`;
        messageBody = `🆘 LIFELINE ALERT: I need help. My location: ${mapsLink}`;
      }
    } catch {
      // GPS unavailable — send without location
    }

    const { result } = await SMS.sendSMSAsync([familyNumber], messageBody);
    return result === "sent" || result === "unknown";
  } catch {
    return false;
  }
};

export const openNearestHospital = async () => {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === "granted") {
      const location = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = location.coords;
      const url = `https://maps.google.com/?q=hospital+near+me&center=${latitude},${longitude}`;
      const { Linking } = require("react-native");
      await Linking.openURL(url);
    } else {
      const { Linking } = require("react-native");
      await Linking.openURL("https://maps.google.com/?q=hospital+near+me");
    }
  } catch {
    // Silently fail
  }
};
