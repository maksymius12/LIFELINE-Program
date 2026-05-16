/**
 * EmergencyMap.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Shows the user's GPS position, a danger radius circle, and an AI-generated
 * evacuation route polyline on a map.
 *
 * Uses react-native-maps (MapView) which works in Expo Go without an API key.
 * Falls back to a "GPS unavailable" placeholder on web.
 */

import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from "react-native";
import * as Location from "expo-location";

export interface Coords {
  latitude: number;
  longitude: number;
}

interface EmergencyMapProps {
  /** Disaster type — used to colour the danger circle */
  emergencyType: string;
  /** AI-generated evacuation route waypoints (optional) */
  aiRoute?: Coords[] | null;
  /** Short instruction text shown below the map */
  aiInstruction?: string | null;
  /** Called once when GPS is acquired */
  onMapReady?: (coords: Coords) => void;
  /** Height of the map view (default 200) */
  height?: number;
}

const DANGER_COLORS: Record<string, string> = {
  fire: "#FF3D3D",
  flood: "#3D9BFF",
  quake: "#F59E0B",
  toxic: "#22C55E",
  injury: "#FF3D3D",
  blackout: "#9B59B6",
  medical: "#FF3D3D",
  unknown: "#FF3D3D",
};

export function EmergencyMap({
  emergencyType,
  aiRoute,
  aiInstruction,
  onMapReady,
  height = 200,
}: EmergencyMapProps) {
  const [userCoords, setUserCoords] = useState<Coords | null>(null);
  const [gpsError, setGpsError] = useState(false);
  const [loading, setLoading] = useState(true);
  const notifiedRef = useRef(false);

  const dangerColor = DANGER_COLORS[emergencyType] ?? "#FF3D3D";

  useEffect(() => {
    if (Platform.OS === "web") {
      setLoading(false);
      setGpsError(true);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          if (!cancelled) { setGpsError(true); setLoading(false); }
          return;
        }
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        if (!cancelled) {
          const coords: Coords = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          };
          setUserCoords(coords);
          setLoading(false);
          if (!notifiedRef.current && onMapReady) {
            notifiedRef.current = true;
            onMapReady(coords);
          }
        }
      } catch {
        if (!cancelled) { setGpsError(true); setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Web / GPS error fallback ───────────────────────────────────────────────
  if (Platform.OS === "web" || gpsError) {
    return (
      <View style={[styles.placeholder, { height }]}>
        <Text style={styles.placeholderIcon}>📍</Text>
        <Text style={styles.placeholderText}>GPS unavailable</Text>
        {aiInstruction && (
          <Text style={styles.instructionText}>{aiInstruction}</Text>
        )}
      </View>
    );
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading || !userCoords) {
    return (
      <View style={[styles.placeholder, { height }]}>
        <ActivityIndicator size="small" color="#4a9d9c" />
        <Text style={styles.placeholderText}>Getting location…</Text>
      </View>
    );
  }

  // ── Native map (iOS / Android) ─────────────────────────────────────────────
  // Dynamic import to avoid web crash (MapView is native-only)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const MapView = require("react-native-maps").default;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Marker, Circle, Polyline } = require("react-native-maps");

  const region = {
    latitude: userCoords.latitude,
    longitude: userCoords.longitude,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  };

  // Build polyline: start from user, through waypoints
  const routeCoords: Coords[] = aiRoute && aiRoute.length > 0
    ? [userCoords, ...aiRoute]
    : [];

  return (
    <View style={[styles.mapWrapper, { height }]}>
      <MapView
        style={StyleSheet.absoluteFillObject}
        initialRegion={region}
        showsUserLocation={false}
        showsMyLocationButton={false}
        mapType="standard"
      >
        {/* User position marker */}
        <Marker
          coordinate={userCoords}
          title="You are here"
          pinColor="#4a9d9c"
        />

        {/* Danger radius circle */}
        <Circle
          center={userCoords}
          radius={150}
          fillColor={`${dangerColor}30`}
          strokeColor={dangerColor}
          strokeWidth={2}
        />

        {/* AI evacuation route polyline */}
        {routeCoords.length > 1 && (
          <Polyline
            coordinates={routeCoords}
            strokeColor="#4a9d9c"
            strokeWidth={3}
            lineDashPattern={[8, 4]}
          />
        )}

        {/* Destination marker */}
        {aiRoute && aiRoute.length > 0 && (
          <Marker
            coordinate={aiRoute[aiRoute.length - 1]}
            title="Safe zone"
            pinColor="#22C55E"
          />
        )}
      </MapView>

      {/* Instruction overlay */}
      {aiInstruction && (
        <View style={styles.instructionBanner}>
          <Text style={styles.instructionBannerText} numberOfLines={2}>
            {aiInstruction}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  mapWrapper: {
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#354656",
    position: "relative",
  },
  placeholder: {
    borderRadius: 16,
    backgroundColor: "#1d2e3d",
    borderWidth: 1,
    borderColor: "#354656",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    gap: 6,
  },
  placeholderIcon: { fontSize: 28 },
  placeholderText: { fontSize: 13, color: "#9BA1A6", fontWeight: "600" },
  instructionText: {
    fontSize: 12,
    color: "#4a9d9c",
    textAlign: "center",
    paddingHorizontal: 16,
    lineHeight: 18,
  },
  instructionBanner: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.72)",
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  instructionBannerText: {
    fontSize: 13,
    color: "#FFFFFF",
    fontWeight: "700",
    textAlign: "center",
  },
});
