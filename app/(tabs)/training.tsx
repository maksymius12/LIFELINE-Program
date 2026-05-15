import { Text, View, Pressable, FlatList, StyleSheet } from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { TRAINING_SCENARIOS } from "@/constants/emergency-data";
import { haptic } from "@/lib/haptics";

export default function TrainingScreen() {
  const router = useRouter();
  const [completedSteps, setCompletedSteps] = useState<Record<string, number>>({
    'air-alert': 0,
    'blackout': 0,
    'trauma': 0,
    'fire': 0,
  });
  const [streak, setStreak] = useState(3);

  const totalCompleted = Object.values(completedSteps).filter((v) => v === 3).length;

  const handleScenario = (id: string) => {
    haptic.light();
    const typeMap: Record<string, string> = {
      'air-alert': 'toxic',
      'blackout': 'blackout',
      'trauma': 'injury',
      'fire': 'fire',
    };
    router.push(`/panic?type=${typeMap[id] || 'fire'}&training=true`);
  };

  const renderItem = ({ item }: { item: typeof TRAINING_SCENARIOS[0] }) => {
    const completed = completedSteps[item.id] || 0;
    const progress = completed / item.steps;

    return (
      <Pressable
        onPress={() => handleScenario(item.id)}
        style={({ pressed }) => [
          styles.card,
          pressed && { opacity: 0.7 },
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.tag, { backgroundColor: item.tagColor }]}>
            <Text style={styles.tagText}>{item.tag}</Text>
          </View>
        </View>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text style={styles.cardDesc}>{item.description}</Text>
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${progress * 100}%`, backgroundColor: item.tagColor },
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            {completed}/{item.steps} steps
          </Text>
        </View>
      </Pressable>
    );
  };

  return (
    <ScreenContainer containerClassName="bg-background">
      <View style={styles.container}>
        <Text style={styles.title}>Training Mode</Text>
        <Text style={styles.subtitle}>Practice emergency responses safely</Text>

        <FlatList
          data={TRAINING_SCENARIOS}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{totalCompleted}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>🔥 {streak}</Text>
            <Text style={styles.statLabel}>Day Streak</Text>
          </View>
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
    marginBottom: 16,
  },
  list: {
    gap: 12,
    paddingBottom: 12,
  },
  card: {
    backgroundColor: "#1d2e3d",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#354656",
  },
  cardHeader: {
    flexDirection: "row",
    marginBottom: 8,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 13,
    color: "#e0e0e0",
    marginBottom: 12,
  },
  progressContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: "#354656",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: "#e0e0e0",
    fontWeight: "600",
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "#1d2e3d",
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#354656",
  },
  statItem: {
    alignItems: "center",
  },
  statValue: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  statLabel: {
    fontSize: 12,
    color: "#e0e0e0",
    marginTop: 2,
  },
});
