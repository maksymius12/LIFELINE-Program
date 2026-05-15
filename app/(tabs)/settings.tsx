import { Text, View, Pressable, StyleSheet, Switch } from "react-native";
import { useState } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { haptic } from "@/lib/haptics";

export default function SettingsScreen() {
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [hapticsEnabled, setHapticsEnabled] = useState(true);
  const [highContrast, setHighContrast] = useState(true);

  return (
    <ScreenContainer containerClassName="bg-background">
      <View style={styles.container}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>Configure LIFELINE behavior</Text>

        <View style={styles.section}>
          <View style={styles.row}>
            <View>
              <Text style={styles.rowTitle}>Text-to-Speech</Text>
              <Text style={styles.rowDesc}>Read instructions aloud</Text>
            </View>
            <Switch
              value={ttsEnabled}
              onValueChange={(val) => {
                haptic.selection();
                setTtsEnabled(val);
              }}
              trackColor={{ false: "#354656", true: "#0D6E6E" }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.row}>
            <View>
              <Text style={styles.rowTitle}>Haptic Feedback</Text>
              <Text style={styles.rowDesc}>Vibrate on actions</Text>
            </View>
            <Switch
              value={hapticsEnabled}
              onValueChange={(val) => {
                haptic.selection();
                setHapticsEnabled(val);
              }}
              trackColor={{ false: "#354656", true: "#0D6E6E" }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.row}>
            <View>
              <Text style={styles.rowTitle}>High Contrast Mode</Text>
              <Text style={styles.rowDesc}>Maximum visibility</Text>
            </View>
            <Switch
              value={highContrast}
              onValueChange={(val) => {
                haptic.selection();
                setHighContrast(val);
              }}
              trackColor={{ false: "#354656", true: "#0D6E6E" }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>About LIFELINE</Text>
          <Text style={styles.infoText}>
            In disasters, information is useless if the human brain cannot process it.
          </Text>
          <Text style={styles.infoText}>
            LIFELINE helps humans think when panic disables cognition.
          </Text>
          <Text style={styles.version}>Version 1.0.0 • Offline First</Text>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
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
  section: {
    backgroundColor: "#1d2e3d",
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#354656",
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
    padding: 18,
    marginTop: 24,
    borderWidth: 1,
    borderColor: "#354656",
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 10,
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
