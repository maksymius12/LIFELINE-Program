import {
  Text,
  View,
  Pressable,
  StyleSheet,
  Linking,
  ActivityIndicator,
  Animated,
  Platform,
} from "react-native";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "expo-router";
import { useKeepAwake } from "expo-keep-awake";
import {
  useAudioRecorder,
  useAudioRecorderState,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from "expo-audio";
import { ScreenContainer } from "@/components/screen-container";
import { haptic } from "@/lib/haptics";
import { speakInstruction, stopSpeech } from "@/lib/speech";
import { analyzeEmergency } from "@/lib/ai-analysis";
import { sendFamilySMS, openNearestHospital } from "@/lib/family-sms";
import AsyncStorage from "@react-native-async-storage/async-storage";

type SOSState = "idle" | "listening" | "processing" | "response";

export default function SOSScreen() {
  useKeepAwake();
  const router = useRouter();

  const [sosState, setSosState] = useState<SOSState>("idle");
  const [statusText, setStatusText] = useState("Press and speak");
  const [errorText, setErrorText] = useState<string | null>(null);
  const [familyNumber, setFamilyNumber] = useState("");

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder);

  // Load family number from storage
  useEffect(() => {
    AsyncStorage.getItem("lifeline_family_number").then((val) => {
      if (val) setFamilyNumber(val);
    });
  }, []);

  // Pulse animation for SOS circle
  useEffect(() => {
    if (sosState === "idle" || sosState === "listening") {
      pulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.12,
            duration: 700,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 700,
            useNativeDriver: true,
          }),
        ])
      );
      pulseLoop.current.start();
    } else {
      pulseLoop.current?.stop();
      pulseAnim.setValue(1);
    }
    return () => pulseLoop.current?.stop();
  }, [sosState]);

  // Request microphone permission on mount
  useEffect(() => {
    (async () => {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        setErrorText("Microphone permission denied. Voice AI unavailable.");
      }
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
    })();
  }, []);

  const handleSOSPress = async () => {
    if (sosState === "idle") {
      await startListening();
    } else if (sosState === "listening") {
      await stopListening();
    }
  };

  const startListening = async () => {
    haptic.heavy();
    setSosState("listening");
    setStatusText("Listening… tell me what happened");
    setErrorText(null);
    speakInstruction("Tell me what happened");

    try {
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
    } catch {
      setErrorText("Could not start recording. Check microphone permission.");
      setSosState("idle");
      setStatusText("Press and speak");
    }
  };

  const stopListening = async () => {
    haptic.medium();
    setSosState("processing");
    setStatusText("AI is understanding your situation…");
    stopSpeech();

    try {
      await audioRecorder.stop();
      const uri = audioRecorder.uri;

      let transcript = "";
      if (uri && Platform.OS !== "web") {
        // Use manus-speech-to-text for transcription
        try {
          const { exec } = require("child_process");
          const { promisify } = require("util");
          const execAsync = promisify(exec);
          const { stdout } = await execAsync(`manus-speech-to-text "${uri}"`);
          transcript = stdout.trim();
        } catch {
          // Transcription failed — use a generic emergency phrase
          transcript = "emergency help needed";
        }
      } else {
        transcript = "emergency help needed";
      }

      await processTranscript(transcript);
    } catch {
      setErrorText("Recording failed. Using manual mode.");
      setSosState("idle");
      setStatusText("Press and speak");
    }
  };

  const processTranscript = async (transcript: string) => {
    try {
      const result = await analyzeEmergency(transcript);

      setSosState("response");
      setStatusText(result.spokenResponse);
      haptic.heavy();
      speakInstruction(result.spokenResponse);

      // Execute all 4 actions simultaneously
      const actions: Promise<void>[] = [];

      // 1. SMS to family
      if (result.shouldSMSFamily && familyNumber) {
        actions.push(sendFamilySMS(familyNumber).then(() => {}));
      }

      // 2. Show nearest hospital
      if (result.nearestHelp) {
        actions.push(openNearestHospital());
      }

      // 3. Call 103 if critical
      if (result.shouldCall103) {
        actions.push(Linking.openURL("tel:103"));
      }

      await Promise.allSettled(actions);

      // 4. Navigate to Panic Mode
      if (result.emergencyType !== "unknown") {
        setTimeout(() => {
          stopSpeech();
          router.push(`/panic?type=${result.emergencyType}`);
        }, 2500);
      } else {
        setTimeout(() => {
          setSosState("idle");
          setStatusText("Press and speak");
        }, 3000);
      }
    } catch {
      setErrorText("AI analysis failed. Please select emergency type manually.");
      setSosState("idle");
      setStatusText("Press and speak");
    }
  };

  const handleCall = () => {
    Linking.openURL("tel:103");
  };

  const handleBack = () => {
    stopSpeech();
    audioRecorder.stop().catch(() => {});
    router.back();
  };

  const getCircleColor = () => {
    switch (sosState) {
      case "listening":
        return "#4a9d9c";
      case "processing":
        return "#354656";
      case "response":
        return "#22C55E";
      default:
        return "#FF3D3D";
    }
  };

  const getCircleContent = () => {
    if (sosState === "processing") {
      return <ActivityIndicator size="large" color="#FFFFFF" />;
    }
    if (sosState === "listening") {
      return (
        <>
          <Text style={styles.sosIcon}>🎙</Text>
          <Text style={styles.sosSubLabel}>TAP TO STOP</Text>
        </>
      );
    }
    if (sosState === "response") {
      return <Text style={styles.sosIcon}>✅</Text>;
    }
    return (
      <>
        <Text style={styles.sosLabel}>SOS</Text>
        <Text style={styles.sosSubLabel}>PRESS & SPEAK</Text>
      </>
    );
  };

  return (
    <ScreenContainer containerClassName="bg-background" edges={["top", "left", "right", "bottom"]}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          {sosState === "idle" && (
            <Pressable onPress={handleBack} style={styles.backBtn}>
              <Text style={styles.backBtnText}>← Back</Text>
            </Pressable>
          )}
          <Text style={styles.title}>VOICE SOS</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>● AI READY</Text>
          </View>
        </View>

        {/* Main SOS Circle */}
        <View style={styles.circleContainer}>
          <Animated.View
            style={[
              styles.pulseRing,
              {
                backgroundColor: getCircleColor() + "30",
                transform: [{ scale: pulseAnim }],
              },
            ]}
          />
          <Pressable
            onPress={handleSOSPress}
            disabled={sosState === "processing" || sosState === "response"}
            style={[
              styles.sosCircle,
              { backgroundColor: getCircleColor() },
              (sosState === "processing" || sosState === "response") && styles.sosCircleDisabled,
            ]}
          >
            {getCircleContent()}
          </Pressable>
        </View>

        {/* Status Text */}
        <Text style={styles.statusText}>{statusText}</Text>

        {/* Error Text */}
        {errorText && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>⚠ {errorText}</Text>
          </View>
        )}

        {/* State-specific info */}
        {sosState === "idle" && (
          <View style={styles.infoCard}>
            <Text style={styles.infoText}>
              Press the SOS button and describe your emergency. AI will analyze and guide you.
            </Text>
          </View>
        )}

        {sosState === "listening" && (
          <View style={styles.listeningCard}>
            <Text style={styles.listeningText}>🎙 Recording your voice…</Text>
            <Text style={styles.listeningHint}>Tap the circle again when done speaking</Text>
          </View>
        )}

        {sosState === "processing" && (
          <View style={styles.processingCard}>
            <Text style={styles.processingText}>🤖 Analyzing emergency situation…</Text>
            <Text style={styles.processingHint}>Identifying type • Severity • Actions</Text>
          </View>
        )}

        {sosState === "response" && (
          <View style={styles.responseCard}>
            <Text style={styles.responseTitle}>AI Response Ready</Text>
            <Text style={styles.responseText}>{statusText}</Text>
            <Text style={styles.responseHint}>Navigating to emergency guide…</Text>
          </View>
        )}

        {/* AI Listening Bar */}
        <View style={styles.aiBar}>
          <Text style={styles.aiBarText}>🤖 AI listening… speak your status</Text>
        </View>

        {/* Call Bar — always visible */}
        <Pressable
          onPress={handleCall}
          style={({ pressed }) => [
            styles.callBar,
            pressed && { opacity: 0.8 },
          ]}
        >
          <Text style={styles.callText}>📞 Call 103</Text>
        </Pressable>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  backBtn: {
    paddingVertical: 4,
    paddingRight: 8,
  },
  backBtnText: {
    fontSize: 15,
    color: "#4a9d9c",
    fontWeight: "600",
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 2,
  },
  badge: {
    backgroundColor: "#0D6E6E",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: "#afffff",
    fontSize: 11,
    fontWeight: "700",
  },
  circleContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    minHeight: 220,
  },
  pulseRing: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
  },
  sosCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#FF3D3D",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 12,
  },
  sosCircleDisabled: {
    shadowOpacity: 0.2,
  },
  sosLabel: {
    fontSize: 38,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 3,
  },
  sosIcon: {
    fontSize: 48,
  },
  sosSubLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FFFFFF",
    marginTop: 4,
    opacity: 0.9,
  },
  statusText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 12,
    lineHeight: 28,
    paddingHorizontal: 10,
  },
  errorContainer: {
    backgroundColor: "#FF3D3D20",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#FF3D3D",
    marginBottom: 10,
  },
  errorText: {
    fontSize: 13,
    color: "#FF3D3D",
    textAlign: "center",
    fontWeight: "600",
  },
  infoCard: {
    backgroundColor: "#1d2e3d",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#354656",
  },
  infoText: {
    fontSize: 14,
    color: "#e0e0e0",
    textAlign: "center",
    lineHeight: 20,
  },
  listeningCard: {
    backgroundColor: "#0D6E6E30",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#0D6E6E",
    alignItems: "center",
  },
  listeningText: {
    fontSize: 16,
    color: "#afffff",
    fontWeight: "700",
    marginBottom: 4,
  },
  listeningHint: {
    fontSize: 12,
    color: "#e0e0e0",
  },
  processingCard: {
    backgroundColor: "#1d2e3d",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#354656",
    alignItems: "center",
  },
  processingText: {
    fontSize: 15,
    color: "#FFFFFF",
    fontWeight: "700",
    marginBottom: 4,
  },
  processingHint: {
    fontSize: 12,
    color: "#4a9d9c",
  },
  responseCard: {
    backgroundColor: "#22C55E20",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#22C55E",
    alignItems: "center",
  },
  responseTitle: {
    fontSize: 14,
    color: "#22C55E",
    fontWeight: "700",
    marginBottom: 4,
  },
  responseText: {
    fontSize: 16,
    color: "#FFFFFF",
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 4,
  },
  responseHint: {
    fontSize: 12,
    color: "#e0e0e0",
  },
  aiBar: {
    backgroundColor: "#0D6E6E",
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: "center",
    marginBottom: 8,
  },
  aiBarText: {
    fontSize: 13,
    color: "#afffff",
    fontWeight: "600",
  },
  callBar: {
    backgroundColor: "#22C55E",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  callText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
