import { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
} from "react-native";
import {
  hasAskedPermissions,
  requestAllPermissions,
  type PermissionStatus,
} from "@/lib/permissions";

export function PermissionsGate() {
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState<PermissionStatus | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (Platform.OS === "web") return;
    hasAskedPermissions().then((asked) => {
      if (!asked) setVisible(true);
    });
  }, []);

  const handleRequest = async () => {
    const result = await requestAllPermissions();
    setStatus(result);
    setDone(true);
  };

  const handleClose = () => {
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Welcome to LIFELINE</Text>
          <Text style={styles.subtitle}>
            LIFELINE works best with these permissions. We never share your data.
          </Text>

          {!done ? (
            <>
              <View style={styles.permRow}>
                <Text style={styles.permIcon}>🎙</Text>
                <View style={styles.permText}>
                  <Text style={styles.permTitle}>Microphone</Text>
                  <Text style={styles.permDesc}>Required for Voice SOS</Text>
                </View>
              </View>
              <View style={styles.permRow}>
                <Text style={styles.permIcon}>📍</Text>
                <View style={styles.permText}>
                  <Text style={styles.permTitle}>Location</Text>
                  <Text style={styles.permDesc}>For GPS coordinates in emergency SMS</Text>
                </View>
              </View>

              <Pressable
                onPress={handleRequest}
                style={({ pressed }) => [
                  styles.allowBtn,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text style={styles.allowBtnText}>Allow Permissions</Text>
              </Pressable>
              <Pressable onPress={handleClose} style={styles.skipBtn}>
                <Text style={styles.skipText}>Skip — I'll do this later</Text>
              </Pressable>
            </>
          ) : (
            <>
              <View style={styles.resultRow}>
                <Text style={styles.resultIcon}>
                  {status?.microphone ? "✅" : "⚠️"}
                </Text>
                <Text style={styles.resultText}>
                  Microphone:{" "}
                  {status?.microphone ? "Granted" : "Denied — Voice SOS disabled"}
                </Text>
              </View>
              <View style={styles.resultRow}>
                <Text style={styles.resultIcon}>
                  {status?.location ? "✅" : "⚠️"}
                </Text>
                <Text style={styles.resultText}>
                  Location:{" "}
                  {status?.location ? "Granted" : "Denied — SMS will have no GPS"}
                </Text>
              </View>
              <Pressable
                onPress={handleClose}
                style={({ pressed }) => [
                  styles.allowBtn,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text style={styles.allowBtnText}>Continue to LIFELINE</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    backgroundColor: "#1d2e3d",
    borderRadius: 20,
    padding: 24,
    width: "100%",
    maxWidth: 380,
    borderWidth: 1,
    borderColor: "#354656",
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: "#e0e0e0",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  permRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
    backgroundColor: "#0D1F2D",
    borderRadius: 10,
    padding: 12,
  },
  permIcon: {
    fontSize: 28,
    marginRight: 12,
  },
  permText: {
    flex: 1,
  },
  permTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  permDesc: {
    fontSize: 12,
    color: "#e0e0e0",
    marginTop: 2,
  },
  allowBtn: {
    backgroundColor: "#22C55E",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  allowBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  skipBtn: {
    paddingVertical: 12,
    alignItems: "center",
  },
  skipText: {
    fontSize: 13,
    color: "#e0e0e0",
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  resultIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  resultText: {
    fontSize: 14,
    color: "#e0e0e0",
    flex: 1,
  },
});
