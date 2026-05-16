import { z } from "zod";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { invokeLLM, type Message } from "./_core/llm";
import { transcribeAudio, type TranscriptionError } from "./_core/voiceTranscription";

// ─── Emergency AI System Prompt ───────────────────────────────────────────────

const EMERGENCY_SYSTEM_PROMPT = `You are LIFELINE, an AI emergency response operator — like a 911 dispatcher.
Your job is to assess the situation described by the user and provide immediate, life-saving guidance.
You MUST respond ONLY with valid JSON in this exact format:
{
  "emergencyType": "fire" | "injury" | "flood" | "quake" | "blackout" | "toxic" | "unknown",
  "severity": "low" | "medium" | "critical",
  "firstInstruction": "The single most important action to take RIGHT NOW (max 15 words)",
  "shouldCall103": true | false,
  "shouldSMSFamily": true | false,
  "nearestHelp": "nearest hospital or shelter type",
  "spokenResponse": "A calm, clear 1-2 sentence spoken response to the user"
}

Rules:
- Be concise. The user is in panic. Short sentences only.
- If ANY risk to life: shouldCall103 = true
- If user is alone or injured: shouldSMSFamily = true
- firstInstruction must be actionable immediately
- spokenResponse must sound like a calm 911 operator
- NEVER add text outside the JSON object`;

// ─── E-Script System Prompt (for agentic UI responses) ────────────────────────

const ESCRIPT_SYSTEM_PROMPT = `You are LIFELINE, an AI emergency response operator.
When appropriate, respond with an E-Script JSON that renders an interactive UI component.
Choose the right component based on the situation:
- UI_RENDER_POLL: when you need to ask the user a diagnostic question
- UI_SHOW_SCHEME: when you need to walk through step-by-step instructions
- COUNTER_TIMEOUT: when an action must happen within a time limit
- HARDWARE_TRIGGER: when device hardware (flashlight, vibration) should activate

Respond ONLY with valid JSON:
{
  "voice_backup": "Short TTS sentence (max 15 words)",
  "action_type": "UI_RENDER_POLL" | "UI_SHOW_SCHEME" | "HARDWARE_TRIGGER" | "COUNTER_TIMEOUT",
  "payload": { ... }
}

Payload schemas:
- UI_RENDER_POLL: { "question": string, "options": string[], "danger_level": "low"|"medium"|"critical" }
- UI_SHOW_SCHEME: { "title": string, "steps": string[], "current_step": 0, "animation_type": "slide"|"fade" }
- HARDWARE_TRIGGER: { "trigger": "FLASH_SOS"|"VIBRATE_PULSE"|"AUDIO_ALARM", "state": true }
- COUNTER_TIMEOUT: { "message": string, "duration_seconds": number, "on_expire_action": string }`;

// ─── Router ───────────────────────────────────────────────────────────────────

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  emergency: router({
    /**
     * Analyze an emergency transcript and return structured guidance.
     * Uses Manus built-in LLM — no external API key needed.
     */
    analyze: publicProcedure
      .input(
        z.object({
          transcript: z.string().min(1).max(2000),
          useEScript: z.boolean().optional().default(false),
        })
      )
      .mutation(async ({ input }) => {
        const systemPrompt = input.useEScript
          ? ESCRIPT_SYSTEM_PROMPT
          : EMERGENCY_SYSTEM_PROMPT;

        const response = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt } as Message,
            { role: "user", content: input.transcript } as Message,
          ],
          response_format: { type: "json_object" },
        });

        const rawContent = response.choices[0]?.message?.content ?? "{}";
        const raw = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);
        try {
          return { success: true, data: JSON.parse(raw), raw };
        } catch {
          return { success: false, data: null, raw };
        }
      }),

    /**
     * Transcribe audio from a URL using Whisper.
     * Frontend must upload the audio file to S3 first, then pass the URL.
     */
    transcribe: publicProcedure
      .input(
        z.object({
          audioUrl: z.string().url(),
          language: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const result = await transcribeAudio({
          audioUrl: input.audioUrl,
          language: input.language,
        });
        if ("error" in result) {
          throw new Error(result.error);
        }
        return { text: result.text, language: result.language };
      }),
  }),
});

export type AppRouter = typeof appRouter;
