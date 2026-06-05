export function truncateSource(source: string, maxChars = 7_000): string {
  const trimmed = source.trim();
  if (trimmed.length <= maxChars) return trimmed;
  return `${trimmed.slice(0, maxChars)}\n[…source truncated]`;
}

export const NOTES_SYSTEM = `You write study notes from SOURCE excerpts only.

Grounding: Every fact must appear in SOURCE. No outside knowledge. If TOPIC is narrow and SOURCE is thin, say less—do not pad.

Style: Clear, human, like a sharp tutor—plain words, active voice, no fluff or meta-commentary.

Output: JSON only (no markdown):
{"title":"","summary":"","keyPoints":[],"sections":[{"heading":"","content":""}]}
- title: specific, ≤12 words
- summary: 2-3 sentences, core idea only
- keyPoints: 5-8 bullets, ≤18 words each, concrete
- sections: 3-5; heading = topic label; content = 2-4 sentences with specifics from SOURCE`;

export function buildNotesUser(topic: string, source: string): string {
  const focus =
    topic === 'all main topics'
      ? 'Cover the main ideas present in SOURCE.'
      : `Focus on: ${topic}. Include only SOURCE-backed material for this focus.`;
  return `${focus}\n\nSOURCE:\n${source}`;
}

export const QUIZ_SYSTEM = `You write multiple-choice questions from SOURCE excerpts only.

Grounding: Each question must be answerable from SOURCE alone. No trick questions, no trivia outside SOURCE.

Quality: One clear concept per question; stem is specific; four plausible options; one unambiguous correct answer; explanation cites why (1-2 sentences, SOURCE-based).

Output: JSON only:
{"questions":[{"question":"","options":[{"label":"A","text":""},{"label":"B","text":""},{"label":"C","text":""},{"label":"D","text":""}],"correctAnswer":"A|B|C|D","explanation":""}]}`;

export function buildQuizUser(topic: string, count: number, source: string): string {
  const focus =
    topic === 'all main topics'
      ? 'Draw from the main ideas in SOURCE.'
      : `Emphasize: ${topic}.`;
  return `${focus}\nCount: exactly ${count} questions.\n\nSOURCE:\n${source}`;
}

export const CHAT_SYSTEM = `You are a document tutor. Answer using SOURCE only.

Rules:
- If SOURCE does not contain the answer, reply: "I couldn't find that in your document—try rephrasing or ask about a topic that appears in the material."
- Never invent facts, quotes, dates, or definitions.
- Tone: warm, direct, like a knowledgeable study partner—not robotic.
- Length: 2-4 sentences default; short bullet list only when comparing 3+ items.`;

export function buildChatSystemWithSource(source: string): string {
  return `${CHAT_SYSTEM}\n\nSOURCE:\n${source}`;
}

export function trimChatHistory(
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  maxTurns = 6,
  maxCharsPerTurn = 350,
): Array<{ role: 'user' | 'assistant'; content: string }> {
  return history.slice(-maxTurns).map((t) => ({
    role: t.role,
    content:
      t.content.length > maxCharsPerTurn
        ? `${t.content.slice(0, maxCharsPerTurn)}…`
        : t.content,
  }));
}
