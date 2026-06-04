import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { DocumentsService } from '../documents/documents.service';

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

const SYSTEM_PROMPT = `You are a helpful AI tutor. A student is asking you questions about a document they uploaded.

Rules:
- Answer ONLY based on the document context provided below.
- Be conversational, clear, and concise.
- If the answer is not in the context, say "I couldn't find that in the document — try rephrasing or ask about something else."
- Do NOT make up information.
- Keep answers to 2-4 sentences unless the question requires more detail.`;

@Injectable()
export class ChatService {
  private readonly genai: GoogleGenerativeAI;

  constructor(
    private readonly config: ConfigService,
    private readonly documentsService: DocumentsService,
  ) {
    this.genai = new GoogleGenerativeAI(config.get<string>('GEMINI_API_KEY') ?? '');
  }

  async ask(
    message: string,
    userId: string,
    subjectId: string,
    sessionId: string | undefined,
    history: ChatTurn[] = [],
  ): Promise<string> {
    // When sessionId is omitted, search across all docs in the subject
    const context = await this.documentsService.retrieveContext(
      message,
      userId,
      subjectId,
      sessionId,
      sessionId ? 6 : 12,
    );

    if (!context.trim()) {
      return "I couldn't find any content for this document. Make sure the document was uploaded and processed successfully.";
    }

    // ── 2. Build prompt with history ─────────────────────────────────────────
    const MAX_HISTORY = 10; // keep last 10 turns to stay within context window
    const recentHistory = history.slice(-MAX_HISTORY);

    const historyText = recentHistory.length
      ? recentHistory
          .map((t) => `${t.role === 'user' ? 'Student' : 'Tutor'}: ${t.content}`)
          .join('\n')
      : '';

    const prompt = [
      SYSTEM_PROMPT,
      '',
      'DOCUMENT CONTEXT:',
      context,
      '',
      historyText ? 'CONVERSATION SO FAR:' : '',
      historyText,
      '',
      `Student: ${message}`,
      'Tutor:',
    ]
      .filter((l) => l !== null && l !== undefined)
      .join('\n');

    // ── 3. Generate ──────────────────────────────────────────────────────────
    try {
      const model = this.genai.getGenerativeModel({
        model: 'gemini-3.5-flash',
        generationConfig: { temperature: 0.5, maxOutputTokens: 512 },
      });

      const result = await model.generateContent(prompt);
      return result.response.text().trim();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new InternalServerErrorException(`Gemini error: ${msg}`);
    }
  }
}
