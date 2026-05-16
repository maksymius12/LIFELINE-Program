import { z } from "zod";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { invokeLLM, type Message } from "./_core/llm";
import { transcribeAudio } from "./_core/voiceTranscription";

// ─── 911 Operator System Prompt ───────────────────────────────────────────────
// Used for the multi-turn conversation loop.
// The AI acts as a calm, concise 911 operator — listens, assesses, instructs.

const OPERATOR_SYSTEM_PROMPT = `You are LIFELINE, an AI emergency response operator — exactly like a 911 dispatcher.
Your job: listen to the user's emergency, assess the situation, and guide them to safety step by step.

RESPONSE FORMAT — always respond with valid JSON:
{
  "spoken": "What you say out loud to the user (1-2 short sentences, calm, direct)",
  "instruction": "The single most important action right now (max 12 words)",
  "action": "CONTINUE" | "CALL_103" | "SMS_FAMILY" | "SHOW_STEPS" | "DONE",
  "steps": ["step 1", "step 2", ...],
  "severity": "low" | "medium" | "critical",
  "emergencyType": "fire" | "injury" | "flood" | "quake" | "blackout" | "toxic" | "medical" | "unknown"
}

Field rules:
- "spoken": what the user hears via TTS. Sound like a real 911 operator. Start with acknowledgment if first message.
- "instruction": bold headline shown on screen. Actionable. Present tense. No punctuation.
- "action":
  - CONTINUE = keep the conversation going, ask a follow-up
  - CALL_103 = user needs emergency services immediately
  - SMS_FAMILY = silently alert family contact
  - SHOW_STEPS = render a step-by-step guide (populate "steps")
  - DONE = situation resolved or user is safe
- "steps": only populate when action = SHOW_STEPS. 3-7 steps max.
- "severity": critical if life is at risk right now.

Conversation rules:
- First message: greet briefly, ask what happened ("LIFELINE. What's your emergency?")
- Keep responses SHORT. User is panicking.
- Never ask more than one question per turn.
- If unsure: assume worst case, instruct accordingly.
- Always end with a question or clear instruction so user knows what to do next.`;

// ─── E-Script System Prompt (agentic UI) ──────────────────────────────────────

const ESCRIPT_SYSTEM_PROMPT = `You are LIFELINE, an AI emergency response operator.
Based on the conversation context, respond with an E-Script JSON that renders an interactive UI component.

Choose the right component:
- UI_RENDER_POLL: ask the user a diagnostic YES/NO or multiple-choice question
- UI_SHOW_SCHEME: walk through step-by-step instructions
- COUNTER_TIMEOUT: action must happen within a time limit
- HARDWARE_TRIGGER: activate device hardware (flashlight SOS, vibration)

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
     * Multi-turn 911 operator conversation.
     * Accepts conversation history + optional audio URL.
     * If audioUrl is provided, transcribes it first, then runs the LLM.
     * Returns structured operator response.
     */
    chat: publicProcedure
      .input(
        z.object({
          // Conversation history so far (role + text)
          history: z.array(
            z.object({
              role: z.enum(["user", "assistant"]),
              content: z.string(),
            })
          ),
          // Optional: S3 URL of audio recording to transcribe first
          audioUrl: z.string().url().optional(),
          // Optional: language hint for transcription
          language: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        // 1. Transcribe audio if provided
        let userText: string | null = null;
        if (input.audioUrl) {
          const transcription = await transcribeAudio({
            audioUrl: input.audioUrl,
            language: input.language,
          });
          if (!("error" in transcription) && transcription.text) {
            userText = transcription.text.trim();
          }
        }

        // 2. Build message array for LLM
        const messages: Message[] = [
          { role: "system", content: OPERATOR_SYSTEM_PROMPT },
        ];

        // Add conversation history
        for (const msg of input.history) {
          messages.push({ role: msg.role, content: msg.content });
        }

        // If we transcribed audio and it's not already the last user message, add it
        if (userText && (input.history.length === 0 || input.history[input.history.length - 1]?.role !== "user")) {
          messages.push({ role: "user", content: userText });
        }

        // If no history and no audio, start the conversation
        if (messages.length === 1) {
          messages.push({ role: "user", content: "start" });
        }

        // 3. Call LLM
        const response = await invokeLLM({
          messages,
          response_format: { type: "json_object" },
        });

        const rawContent = response.choices[0]?.message?.content ?? "{}";
        const raw = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);

        try {
          const data = JSON.parse(raw);
          return {
            success: true,
            transcript: userText,
            data: {
              spoken: data.spoken ?? "Stay calm. I'm here to help.",
              instruction: data.instruction ?? "Stay calm",
              action: data.action ?? "CONTINUE",
              steps: data.steps ?? [],
              severity: data.severity ?? "medium",
              emergencyType: data.emergencyType ?? "unknown",
            },
            raw,
          };
        } catch {
          return {
            success: false,
            transcript: userText,
            data: {
              spoken: "Stay calm. Tell me what happened.",
              instruction: "Stay calm",
              action: "CONTINUE" as const,
              steps: [],
              severity: "medium" as const,
              emergencyType: "unknown" as const,
            },
            raw,
          };
        }
      }),

    /**
     * E-Script agentic UI response — for rendering interactive components.
     */
    escript: publicProcedure
      .input(
        z.object({
          context: z.string().min(1).max(2000),
        })
      )
      .mutation(async ({ input }) => {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: ESCRIPT_SYSTEM_PROMPT } as Message,
            { role: "user", content: input.context } as Message,
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
     * Legacy: single-turn analysis (kept for backward compat with tests).
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
          : OPERATOR_SYSTEM_PROMPT;

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
