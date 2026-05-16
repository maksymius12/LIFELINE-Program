/**
 * Client-side voice transcription helper.
 *
 * Flow:
 * 1. POST multipart/form-data to /api/upload-audio → get S3 URL
 * 2. POST to /api/trpc/emergency.transcribe (Whisper) → get text
 *
 * Falls back to a placeholder string on any error so the app never crashes.
 */
import { Platform } from "react-native";
import { getApiBaseUrl } from "@/constants/oauth";
import * as Auth from "@/lib/_core/auth";

const FALLBACK = "emergency help needed";

/**
 * Upload a local audio file URI to the server and transcribe it with Whisper.
 * Returns the transcript text, or the fallback string on failure.
 */
export async function transcribeAudioUri(uri: string): Promise<string> {
  if (!uri || Platform.OS === "web") return FALLBACK;

  try {
    const baseUrl = getApiBaseUrl();
    const token = await Auth.getSessionToken();

    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    // 1. Upload audio — React Native FormData supports { uri, name, type }
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

    if (!uploadRes.ok) return FALLBACK;
    const { url: audioUrl } = (await uploadRes.json()) as { url: string };
    if (!audioUrl) return FALLBACK;

    // 2. Transcribe via Whisper tRPC route
    const transcribeRes = await fetch(`${baseUrl}/api/trpc/emergency.transcribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      credentials: "include",
      body: JSON.stringify({ json: { audioUrl } }),
      signal: AbortSignal.timeout(30000),
    });

    if (!transcribeRes.ok) return FALLBACK;
    const json = (await transcribeRes.json()) as any;
    // tRPC response shape: { result: { data: { json: { text, language } } } }
    const text: string =
      json?.result?.data?.json?.text ?? json?.text ?? "";

    return text.trim() || FALLBACK;
  } catch {
    return FALLBACK;
  }
}
