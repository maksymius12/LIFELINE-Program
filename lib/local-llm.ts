/**
 * local-llm.ts — stub (llama.rn removed for Expo Go compatibility)
 *
 * All AI now goes through Gemini API (see lib/gemini.ts).
 * This file exists so imports don't break.
 */

export type LLMStatus = "idle" | "downloading" | "loading" | "ready" | "error";

export function isLocalLLMReady(): boolean {
  return false;
}

export function getLLMStatus(): LLMStatus {
  return "idle";
}

export function onLLMStatus(fn: (s: LLMStatus, progress?: number) => void): () => void {
  fn("idle");
  return () => {};
}

export async function initLocalLLM(): Promise<void> {
  // no-op: llama.rn removed
}

export async function localCompletion(): Promise<string | null> {
  return null;
}
