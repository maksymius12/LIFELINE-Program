/**
 * On-Device LLM Service — Gemma 3 1B via llama.rn
 *
 * Downloads the Gemma 3 1B Q4_K_M GGUF model on first launch (~770 MB),
 * caches it in the app's document directory, and runs inference entirely
 * on-device using llama.cpp (Metal on iOS, OpenCL/CPU on Android).
 *
 * No network required after the initial model download.
 * Falls back to the remote forge API if the model is not yet loaded.
 */
import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import { initLlama, type LlamaContext } from "llama.rn";

// ─── Config ───────────────────────────────────────────────────────────────────

const MODEL_URL =
  "https://huggingface.co/ggml-org/gemma-3-1b-it-GGUF/resolve/main/gemma-3-1b-it-Q4_K_M.gguf";

const MODEL_FILENAME = "gemma-3-1b-it-Q4_K_M.gguf";

const getModelPath = () =>
  `${FileSystem.documentDirectory}llm-models/${MODEL_FILENAME}`;

// ─── State ────────────────────────────────────────────────────────────────────

let _context: LlamaContext | null = null;
let _loading = false;
let _loadError: string | null = null;
let _downloadProgress = 0;

export type LLMStatus =
  | "idle"
  | "downloading"
  | "loading"
  | "ready"
  | "error";

let _status: LLMStatus = "idle";
let _statusListeners: Array<(s: LLMStatus, progress?: number) => void> = [];

const emit = (s: LLMStatus, progress?: number) => {
  _status = s;
  _statusListeners.forEach((fn) => fn(s, progress));
};

export function onLLMStatus(
  fn: (s: LLMStatus, progress?: number) => void
): () => void {
  _statusListeners.push(fn);
  // Immediately emit current state
  fn(_status, _downloadProgress);
  return () => {
    _statusListeners = _statusListeners.filter((l) => l !== fn);
  };
}

export function getLLMStatus(): LLMStatus {
  return _status;
}

// ─── Model Download ───────────────────────────────────────────────────────────

async function ensureModelExists(): Promise<string> {
  const modelPath = getModelPath();
  const dir = `${FileSystem.documentDirectory}llm-models/`;

  // Ensure directory exists
  const dirInfo = await FileSystem.getInfoAsync(dir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }

  // Check if model already downloaded
  const fileInfo = await FileSystem.getInfoAsync(modelPath);
  if (fileInfo.exists && (fileInfo as any).size > 100_000_000) {
    return modelPath;
  }

  // Download model
  emit("downloading", 0);
  const downloadResumable = FileSystem.createDownloadResumable(
    MODEL_URL,
    modelPath,
    {},
    (progress) => {
      const pct =
        progress.totalBytesExpectedToWrite > 0
          ? progress.totalBytesWritten / progress.totalBytesExpectedToWrite
          : 0;
      _downloadProgress = pct;
      emit("downloading", pct);
    }
  );

  const result = await downloadResumable.downloadAsync();
  if (!result?.uri) {
    throw new Error("Model download failed — no URI returned");
  }
  return result.uri;
}

// ─── Init ─────────────────────────────────────────────────────────────────────

/**
 * Initialize the on-device Gemma model.
 * Safe to call multiple times — only loads once.
 */
export async function initLocalLLM(): Promise<void> {
  if (_context || _loading) return;
  if (Platform.OS === "web") return; // Web not supported

  _loading = true;
  _loadError = null;

  try {
    const modelPath = await ensureModelExists();
    emit("loading");

    _context = await initLlama({
      model: modelPath,
      use_mlock: true,
      n_ctx: 2048,
      n_gpu_layers: Platform.OS === "ios" ? 99 : 0, // Metal on iOS, CPU on Android for safety
    });

    emit("ready");
  } catch (err) {
    _loadError = String(err);
    emit("error");
    _context = null;
  } finally {
    _loading = false;
  }
}

// ─── Inference ────────────────────────────────────────────────────────────────

export interface LocalMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

const STOP_WORDS = [
  "<end_of_turn>",
  "<eos>",
  "<|end|>",
  "<|eot_id|>",
  "<|end_of_text|>",
  "<|im_end|>",
  "<|EOT|>",
  "<|END_OF_TURN_TOKEN|>",
  "<|end_of_turn|>",
  "<|endoftext|>",
];

/**
 * Run a chat completion on-device.
 * Returns the generated text, or null if the model isn't loaded.
 */
export async function localCompletion(
  messages: LocalMessage[],
  onToken?: (token: string) => void
): Promise<string | null> {
  if (!_context) return null;

  try {
    const result = await _context.completion(
      {
        messages,
        n_predict: 512,
        temperature: 0.7,
        top_p: 0.9,
        stop: STOP_WORDS,
      },
      (data) => {
        if (onToken && data.token) onToken(data.token);
      }
    );
    return result.text?.trim() ?? null;
  } catch {
    return null;
  }
}

/**
 * Check if the on-device model is ready to use.
 */
export function isLocalLLMReady(): boolean {
  return _context !== null && _status === "ready";
}
