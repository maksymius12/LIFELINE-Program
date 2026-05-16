/**
 * Client-side audio upload helper.
 *
 * Uploads a local audio file URI to the server's /api/upload-audio endpoint
 * and returns the public S3 URL. The URL is then passed to emergency.chat
 * so the server can transcribe it with Whisper in the same round trip.
 *
 * Returns null on any failure — callers should handle null gracefully.
 */
import { Platform } from "react-native";
import { getApiBaseUrl } from "@/constants/oauth";
import * as Auth from "@/lib/_core/auth";

/**
 * Upload a local audio file URI to S3 and return the public URL.
 * Returns null if the upload fails or we're on web.
 */
export async function uploadAudioUri(uri: string): Promise<string | null> {
  if (!uri || Platform.OS === "web") return null;

  try {
    const baseUrl = getApiBaseUrl();
    const token = await Auth.getSessionToken();

    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const formData = new FormData();
    formData.append("audio", {
      uri,
      name: "recording.m4a",
      type: "audio/m4a",
    } as any);

    const uploadRes = await fetch(`${baseUrl}/api/upload-audio`, {
      method: "POST",
      headers,
      body: formData,
      credentials: "include",
      signal: AbortSignal.timeout(20000),
    });

    if (!uploadRes.ok) return null;
    const { url } = (await uploadRes.json()) as { url?: string };
    return url ?? null;
  } catch {
    return null;
  }
}

/**
 * Alias for uploadAudioUri — kept for backward compatibility with training.tsx.
 * Uploads audio and returns the S3 URL (not a transcript string).
 * The server transcribes it when the URL is passed to emergency.chat.
 */
export const transcribeAudioUri = uploadAudioUri;
