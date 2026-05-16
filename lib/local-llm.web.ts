/**
 * Web stub for local-llm.ts
 *
 * llama.rn is a native-only module (iOS/Android).
 * On web, all functions are no-ops that immediately fall back to the remote API.
 */
export type LLMStatus = "idle" | "downloading" | "loading" | "ready" | "error";

export function onLLMStatus(
  fn: (s: LLMStatus, progress?: number) => void
): () => void {
  fn("error"); // On web, always show "cloud fallback"
  return () => {};
}

export function getLLMStatus(): LLMStatus {
  return "error";
}

export async function initLocalLLM(): Promise<void> {
  // No-op on web
}

export interface LocalMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function localCompletion(
  _messages: LocalMessage[],
  _onToken?: (token: string) => void
): Promise<string | null> {
  return null; // Always fall back to remote on web
}

export function isLocalLLMReady(): boolean {
  return false;
}
