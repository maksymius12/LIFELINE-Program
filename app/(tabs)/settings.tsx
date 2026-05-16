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
      Alert.alert("No Contact", "Enter a family phone number first.");
      return;
    }
    haptic.medium();
    const sent = await sendFamilySMS(settings.familyNumber);
    if (sent) {
      Alert.alert("Sent", "Test SMS sent to " + settings.familyNumber);
    } else {
      Alert.alert("Unavailable", "SMS not available on this device. Will work on a real phone.");
    }
  };

  return (
    <ScreenContainer containerClassName="bg-background">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Settings</Text>

          {/* Emergency Contact */}
          <Text style={styles.sectionLabel}>EMERGENCY CONTACT</Text>
          <View style={styles.card}>
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
            <Pressable
              onPress={handleTestSMS}
              style={({ pressed }) => [styles.testBtn, pressed && { opacity: 0.8 }]}
            >
              <Text style={styles.testBtnText}>📱  Send Test SMS</Text>
            </Pressable>
          </View>

          {/* Behavior toggles */}
          <Text style={styles.sectionLabel}>BEHAVIOR</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.rowTitle}>Text-to-Speech</Text>
              <Switch
                value={settings.ttsEnabled}
                onValueChange={(val) => { haptic.selection(); updateTTS(val); }}
                trackColor={{ false: "#354656", true: "#0D6E6E" }}
                thumbColor="#FFFFFF"
              />
            </View>
            <View style={[styles.row, { borderBottomWidth: 0 }]}>
              <Text style={styles.rowTitle}>Haptic Feedback</Text>
              <Switch
                value={settings.hapticsEnabled}
                onValueChange={(val) => { haptic.selection(); updateHaptics(val); }}
                trackColor={{ false: "#354656", true: "#0D6E6E" }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32 },
  title: { fontSize: 28, fontWeight: "800", color: "#FFFFFF", marginBottom: 20 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#4a9d9c",
    letterSpacing: 1.5,
    marginBottom: 8,
    marginTop: 4,
  },
  card: {
    backgroundColor: "#1d2e3d",
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#354656",
    marginBottom: 24,
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 18,
    color: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#354656",
  },
  testBtn: {
    paddingVertical: 16,
    alignItems: "center",
  },
  testBtnText: { fontSize: 16, fontWeight: "700", color: "#4a9d9c" },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#354656",
  },
  rowTitle: { fontSize: 16, fontWeight: "600", color: "#FFFFFF" },
});
