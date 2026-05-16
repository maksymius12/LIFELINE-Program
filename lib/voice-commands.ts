/**
 * Voice Command Engine
 *
 * Matches a transcript string against known command patterns in both
 * English and Ukrainian. Used after every AI instruction to let the user
 * advance, repeat, get an alternative, go back, or call 103 — entirely
 * by voice, without touching the screen.
 */

export type VoiceCommand =
  | "next"
  | "repeat"
  | "alternative"
  | "back"
  | "call"
  | "confirm"
  | "deny"
  | "none";

const VOICE_COMMANDS: Record<VoiceCommand, string[]> = {
  next: ["done", "готово", "next", "ok", "okay", "yes", "так", "finish", "complete", "далі", "вперед"],
  repeat: ["repeat", "повтори", "say again", "what", "again", "ще раз", "не чув", "не почув"],
  alternative: ["can't", "cannot", "не можу", "alternative", "other way", "impossible", "інший", "інакше", "не виходить"],
  back: ["go back", "назад", "home", "menu", "cancel", "скасувати", "вийти", "back"],
  call: ["call 103", "виклик", "ambulance", "emergency call", "зателефонуй", "виклич", "103"],
  confirm: ["yes", "так", "confirm", "підтверджую", "agree", "correct", "right", "вірно"],
  deny: ["no", "ні", "not yet", "wait", "зачекай", "ні ще", "не зараз"],
  none: [],
};

/**
 * Match a transcript to a voice command.
 * Returns the matched command or "none" if no match found.
 */
export function matchVoiceCommand(transcript: string): VoiceCommand {
  const t = transcript.toLowerCase().trim();

  for (const [command, keywords] of Object.entries(VOICE_COMMANDS) as [VoiceCommand, string[]][]) {
    if (command === "none") continue;
    for (const kw of keywords) {
      if (t.includes(kw.toLowerCase())) {
        return command;
      }
    }
  }

  return "none";
}

/**
 * Check if a transcript is a navigation command (back/call) that should
 * interrupt the current flow regardless of context.
 */
export function isGlobalCommand(transcript: string): VoiceCommand | null {
  const cmd = matchVoiceCommand(transcript);
  if (cmd === "back" || cmd === "call") return cmd;
  return null;
}

/**
 * Check if a transcript is a confirmation (yes/no) for a YES/NO question.
 */
export function isConfirmation(transcript: string): "yes" | "no" | null {
  const cmd = matchVoiceCommand(transcript);
  if (cmd === "confirm") return "yes";
  if (cmd === "deny") return "no";
  // Also check for direct yes/no
  const t = transcript.toLowerCase().trim();
  if (t === "yes" || t === "так") return "yes";
  if (t === "no" || t === "ні") return "no";
  return null;
}
