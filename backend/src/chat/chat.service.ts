import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentsService } from '../documents/documents.service';
import { callGroq, GroqMessage } from '../common/groq';

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
  private readonly groqApiKey: string;

  constructor(
    private readonly config: ConfigService,
    private readonly documentsService: DocumentsService,
  ) {
    this.groqApiKey = config.get<string>('GROQ_API_KEY') ?? '';
  }

  async ask(
    message: string,
    userId: string,
    subjectId: string,
    sessionId: string | undefined,
    history: ChatTurn[] = [],
  ): Promise<string> {
    if (!this.groqApiKey) {
      throw new InternalServerErrorException(
        'GROQ_API_KEY is not configured. Get a free key at https://console.groq.com',
      );
    }

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

    const MAX_HISTORY = 10;
    const recentHistory = history.slice(-MAX_HISTORY);

    const messages: GroqMessage[] = [
      {
        role: 'system',
        content: `${SYSTEM_PROMPT}\n\nDOCUMENT CONTEXT:\n${context}`,
      },
      ...recentHistory.map((t) => ({
        role: t.role,
        content: t.content,
      })),
      { role: 'user', content: message },
    ];

    try {
      return (await callGroq(this.groqApiKey, messages, {
        temperature: 0.5,
        maxTokens: 512,
      })).trim();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new InternalServerErrorException(`Groq error: ${msg}`);
    }
  }
}
