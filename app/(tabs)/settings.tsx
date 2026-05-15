import {
  Text,
  View,
  Pressable,
  StyleSheet,
  Switch,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useSettings } from "@/hooks/use-settings";
import { ScreenContainer } from "@/components/screen-container";
import { haptic } from "@/lib/haptics";
import { sendFamilySMS } from "@/lib/family-sms";

export default function SettingsScreen() {
  const { settings, updateFamilyNumber, updateTTS, updateHaptics } = useSettings();

  const handleTestSMS = async () => {
    if (!settings.familyNumber) {
      Alert.alert("No Contact", "Please enter a family phone number first.");
      return;
    }
    haptic.medium();
    const sent = await sendFamilySMS(settings.familyNumber);
    if (sent) {
      Alert.alert("SMS Sent", "Test message sent to " + settings.familyNumber);
    } else {
      Alert.alert(
        "SMS Unavailable",
        "SMS is not available on this device or simulator. It will work on a real device."
      );
    }
  };

  return (
    <ScreenContainer containerClassName="bg-background">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Settings</Text>
          <Text style={styles.subtitle}>Configure LIFELINE behavior</Text>

          {/* Family Contact Section */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Emergency Contact</Text>
          </View>
          <View style={styles.section}>
            <View style={styles.inputRow}>
              <Text style={styles.inputLabel}>Family phone number</Text>
              <TextInput
                style={styles.input}
                value={settings.familyNumber}
                onChangeText={updateFamilyNumber}
                placeholder="+380XXXXXXXXX"
                placeholderTextColor="#354656"
                keyboardType="phone-pad"
                returnKeyType="done"
                maxLength={20}
              />
              <Text style={styles.inputHint}>
                Will receive SMS with your GPS location during SOS
              </Text>
            </View>
            <Pressable
              onPress={handleTestSMS}
              style={({ pressed }) => [
                styles.testButton,
                pressed && { opacity: 0.8 },
              ]}
            >
              <Text style={styles.testButtonText}>📱 Send Test SMS</Text>
            </Pressable>
          </View>

          {/* App Behavior Section */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>App Behavior</Text>
          </View>
          <View style={styles.section}>
            <View style={styles.row}>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>Text-to-Speech</Text>
                <Text style={styles.rowDesc}>Read instructions aloud</Text>
              </View>
              <Switch
                value={settings.ttsEnabled}
                onValueChange={(val) => {
                  haptic.selection();
                  updateTTS(val);
                }}
                trackColor={{ false: "#354656", true: "#0D6E6E" }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={[styles.row, styles.rowLast]}>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>Haptic Feedback</Text>
                <Text style={styles.rowDesc}>Vibrate on actions</Text>
              </View>
              <Switch
                value={settings.hapticsEnabled}
                onValueChange={(val) => {
                  haptic.selection();
                  updateHaptics(val);
                }}
                trackColor={{ false: "#354656", true: "#0D6E6E" }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>

          {/* Voice AI Section */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Voice AI (SOS)</Text>
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.infoRow}>🎙 Voice recording via microphone</Text>
            <Text style={styles.infoRow}>🤖 Gemma 3 local AI analysis</Text>
            <Text style={styles.infoRow}>📍 GPS location in SMS alerts</Text>
            <Text style={styles.infoRow}>🔄 Keyword fallback if AI offline</Text>
            <Text style={styles.infoNote}>
              Gemma AI requires local server running at localhost:8080. If unavailable, keyword detection activates automatically.
            </Text>
          </View>

          {/* About Section */}
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>About LIFELINE</Text>
            <Text style={styles.infoText}>
              "In disasters, information is useless if the human brain cannot process it."
            </Text>
            <Text style={styles.infoText}>
              "LIFELINE helps humans think when panic disables cognition."
            </Text>
            <Text style={styles.version}>Version 1.1.0 • Offline First • Voice AI</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  subtitle: {
    fontSize: 14,
    color: "#e0e0e0",
    marginTop: 4,
    marginBottom: 20,
  },
  sectionHeader: {
    marginBottom: 8,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#4a9d9c",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  section: {
    backgroundColor: "#1d2e3d",
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#354656",
    marginBottom: 20,
  },
  inputRow: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#354656",
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#0D1F2D",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#354656",
  },
  inputHint: {
    fontSize: 11,
    color: "#e0e0e0",
    marginTop: 6,
  },
  testButton: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: "center",
  },
  testButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#4a9d9c",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#354656",
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowText: {
    flex: 1,
    marginRight: 12,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  rowDesc: {
    fontSize: 12,
    color: "#e0e0e0",
    marginTop: 2,
  },
  infoCard: {
    backgroundColor: "#1d2e3d",
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#354656",
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 10,
  },
  infoRow: {
    fontSize: 13,
    color: "#e0e0e0",
    marginBottom: 6,
  },
  infoNote: {
    fontSize: 11,
    color: "#4a9d9c",
    marginTop: 8,
    fontStyle: "italic",
    lineHeight: 16,
  },
  infoText: {
    fontSize: 13,
    color: "#e0e0e0",
    lineHeight: 20,
    marginBottom: 6,
    fontStyle: "italic",
  },
  version: {
    fontSize: 12,
    color: "#4a9d9c",
    marginTop: 10,
    fontWeight: "600",
  },
});
