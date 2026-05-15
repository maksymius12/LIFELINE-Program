import { Text, View, Pressable, FlatList, StyleSheet } from "react-native";
import { useState, useEffect, useRef } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { MEDICAL_AI_CONVERSATION, MEDICAL_AI_DIAGNOSIS } from "@/constants/emergency-data";
import { haptic } from "@/lib/haptics";
import { speakInstruction } from "@/lib/speech";
import { Linking } from "react-native";

interface ChatMessage {
  id: string;
  role: "ai" | "user";
  text: string;
}

export default function MedicalScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [showDiagnosis, setShowDiagnosis] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    // Start conversation
    addAIMessage(0);
  }, []);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (showGuide && timerSeconds < MEDICAL_AI_DIAGNOSIS.timerSeconds) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [showGuide, timerSeconds]);

  const addAIMessage = (index: number) => {
    setIsTyping(true);
    setTimeout(() => {
      const msg = MEDICAL_AI_CONVERSATION[index];
      if (msg) {
        setMessages((prev) => [
          ...prev,
          { id: `ai-${index}`, role: "ai", text: msg.text },
        ]);
        speakInstruction(msg.text);
      }
      setIsTyping(false);
    }, 1200);
  };

  const handleResponse = (response: "YES" | "NO") => {
    haptic.light();
    const newMsg: ChatMessage = {
      id: `user-${questionIndex}`,
      role: "user",
      text: response,
    };
    setMessages((prev) => [...prev, newMsg]);

    const nextIndex = questionIndex + 1;
    setQuestionIndex(nextIndex);

    if (nextIndex >= MEDICAL_AI_CONVERSATION.length) {
      setIsTyping(true);
      setTimeout(() => {
        setShowDiagnosis(true);
        setIsTyping(false);
      }, 1500);
    } else {
      addAIMessage(nextIndex);
    }
  };

  const handleGuide = () => {
    haptic.heavy();
    setShowGuide(true);
    speakInstruction(MEDICAL_AI_DIAGNOSIS.instruction);
  };

  const handleCall = () => {
    Linking.openURL("tel:103");
  };

  const handleReset = () => {
    haptic.medium();
    setMessages([]);
    setQuestionIndex(0);
    setShowDiagnosis(false);
    setShowGuide(false);
    setTimerSeconds(0);
    setTimeout(() => addAIMessage(0), 300);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const progress = timerSeconds / MEDICAL_AI_DIAGNOSIS.timerSeconds;

  const renderMessage = ({ item }: { item: ChatMessage }) => (
    <View
      style={[
        styles.bubble,
        item.role === "ai" ? styles.aiBubble : styles.userBubble,
      ]}
    >
      <Text
        style={[
          styles.bubbleText,
          item.role === "user" && styles.userBubbleText,
        ]}
      >
        {item.text}
      </Text>
    </View>
  );

  return (
    <ScreenContainer containerClassName="bg-background">
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerText}>🩺 MEDICAL AI — Active</Text>
        </View>

        {/* Chat Area */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.chatList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: true })
          }
        />

        {/* Typing Indicator */}
        {isTyping && (
          <View style={styles.typingContainer}>
            <Text style={styles.typingText}>🤖 AI preparing guide…</Text>
          </View>
        )}

        {/* Diagnosis Card */}
        {showDiagnosis && !showGuide && (
          <View style={styles.diagnosisCard}>
            <Text style={styles.diagnosisEmoji}>{MEDICAL_AI_DIAGNOSIS.emoji}</Text>
            <Text style={styles.diagnosisTitle}>{MEDICAL_AI_DIAGNOSIS.title}</Text>
            <Text style={styles.diagnosisInstruction}>
              {MEDICAL_AI_DIAGNOSIS.instruction}
            </Text>
            <View style={styles.diagnosisActions}>
              <Pressable
                onPress={handleGuide}
                style={({ pressed }) => [
                  styles.guideButton,
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Text style={styles.guideButtonText}>YES — Guide me</Text>
              </Pressable>
              <Pressable
                onPress={handleCall}
                style={({ pressed }) => [
                  styles.callButton,
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Text style={styles.callButtonText}>📞 Call 103</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Timer Guide */}
        {showGuide && (
          <View style={styles.timerCard}>
            <Text style={styles.timerLabel}>{MEDICAL_AI_DIAGNOSIS.timerLabel}</Text>
            <Text style={styles.timerValue}>{formatTime(timerSeconds)}</Text>
            <View style={styles.timerBarContainer}>
              <View style={[styles.timerBarFill, { width: `${Math.min(progress * 100, 100)}%` }]} />
            </View>
            <Pressable
              onPress={handleReset}
              style={({ pressed }) => [
                styles.resetButton,
                pressed && { opacity: 0.8 },
              ]}
            >
              <Text style={styles.resetText}>Start New Assessment</Text>
            </Pressable>
          </View>
        )}

        {/* YES/NO Buttons */}
        {!showDiagnosis && !isTyping && messages.length > 0 && (
          <View style={styles.responseRow}>
            <Pressable
              onPress={() => handleResponse("YES")}
              style={({ pressed }) => [
                styles.yesButton,
                pressed && { opacity: 0.8 },
              ]}
            >
              <Text style={styles.responseText}>YES</Text>
            </Pressable>
            <Pressable
              onPress={() => handleResponse("NO")}
              style={({ pressed }) => [
                styles.noButton,
                pressed && { opacity: 0.8 },
              ]}
            >
              <Text style={styles.responseText}>NO</Text>
            </Pressable>
          </View>
        )}

        {/* Call Bar */}
        <Pressable
          onPress={handleCall}
          style={({ pressed }) => [
            styles.bottomCallBar,
            pressed && { opacity: 0.8 },
          ]}
        >
          <Text style={styles.bottomCallText}>📞 Call 103</Text>
        </Pressable>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
  },
  header: {
    backgroundColor: "#0D6E6E",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  headerText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
  },
  chatList: {
    gap: 8,
    paddingBottom: 8,
  },
  bubble: {
    maxWidth: "80%",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  aiBubble: {
    alignSelf: "flex-start",
    backgroundColor: "#1d2e3d",
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: "#FF3D3D",
  },
  bubbleText: {
    fontSize: 15,
    color: "#FFFFFF",
    lineHeight: 20,
  },
  userBubbleText: {
    fontWeight: "700",
  },
  typingContainer: {
    paddingVertical: 8,
  },
  typingText: {
    fontSize: 13,
    color: "#4a9d9c",
    fontStyle: "italic",
  },
  diagnosisCard: {
    backgroundColor: "#1d2e3d",
    borderRadius: 14,
    padding: 18,
    borderWidth: 2,
    borderColor: "#FF3D3D",
    marginVertical: 8,
    alignItems: "center",
  },
  diagnosisEmoji: {
    fontSize: 32,
    marginBottom: 6,
  },
  diagnosisTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FF3D3D",
    marginBottom: 4,
  },
  diagnosisInstruction: {
    fontSize: 15,
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 14,
  },
  diagnosisActions: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
  },
  guideButton: {
    flex: 1,
    backgroundColor: "#FF3D3D",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  guideButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  callButton: {
    flex: 1,
    backgroundColor: "#0D6E6E",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  callButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  timerCard: {
    backgroundColor: "#1d2e3d",
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: "#354656",
    marginVertical: 8,
    alignItems: "center",
  },
  timerLabel: {
    fontSize: 14,
    color: "#e0e0e0",
    marginBottom: 8,
  },
  timerValue: {
    fontSize: 40,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 12,
  },
  timerBarContainer: {
    width: "100%",
    height: 8,
    backgroundColor: "#354656",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 14,
  },
  timerBarFill: {
    height: "100%",
    backgroundColor: "#22C55E",
    borderRadius: 4,
  },
  resetButton: {
    backgroundColor: "#354656",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  resetText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  responseRow: {
    flexDirection: "row",
    gap: 12,
    marginVertical: 8,
  },
  yesButton: {
    flex: 1,
    backgroundColor: "#22C55E",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  noButton: {
    flex: 1,
    backgroundColor: "#FF3D3D",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  responseText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  bottomCallBar: {
    backgroundColor: "#22C55E",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 4,
  },
  bottomCallText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
