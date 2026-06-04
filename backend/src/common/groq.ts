/**
 * Groq Chat Completions API (OpenAI-compatible).
 * Free tier: ~30 RPM, TPM limits vary by model — see console.groq.com
 */

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

/** 8B model: lower TPM use, higher free-tier headroom. Override with GROQ_MODEL. */
export const DEFAULT_GROQ_MODEL = 'llama-3.1-8b-instant';

export interface GroqMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface GroqOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  maxRetries?: number;
}

function parseRetryDelayMs(errorBody: string): number {
  const msMatch = errorBody.match(/try again in (\d+)\s*ms/i);
  if (msMatch) return Number(msMatch[1]) + 500;

  const secMatch = errorBody.match(/try again in ([\d.]+)\s*s/i);
  if (secMatch) return Math.ceil(Number(secMatch[1]) * 1000) + 500;

  return 4_000;
}

export async function callGroq(
  apiKey: string,
  messages: GroqMessage[],
  options: GroqOptions = {},
): Promise<string> {
  const {
    model = process.env.GROQ_MODEL ?? DEFAULT_GROQ_MODEL,
    temperature = 0.3,
    maxTokens = 4096,
    jsonMode = false,
    maxRetries = 5,
  } = options;

  const body: Record<string, unknown> = {
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
  };

  if (jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  let lastError = '';

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const data = (await res.json()) as {
        choices: Array<{ message: { content: string } }>;
      };
      return data.choices[0]?.message?.content ?? '';
    }

    lastError = await res.text();

    if (res.status === 429 && attempt < maxRetries) {
      const waitMs = parseRetryDelayMs(lastError);
      console.warn(`[Groq] Rate limited (${model}), retry ${attempt + 1}/${maxRetries} in ${waitMs}ms`);
      await new Promise((r) => setTimeout(r, waitMs));
      continue;
    }

    throw new Error(`Groq API error ${res.status}: ${lastError}`);
  }

  throw new Error(`Groq API error 429: ${lastError}`);
}
