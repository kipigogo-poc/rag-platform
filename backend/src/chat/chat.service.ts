import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentsService } from '../documents/documents.service';
import { callGroq, GroqMessage } from '../common/groq';
import { buildChatSystemWithSource, trimChatHistory } from '../common/prompts';

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

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
      sessionId ? 5 : 8,
    );

    if (!context.trim()) {
      return "I couldn't find any content for this document. Make sure the document was uploaded and processed successfully.";
    }

    const messages: GroqMessage[] = [
      { role: 'system', content: buildChatSystemWithSource(context) },
      ...trimChatHistory(history),
      { role: 'user', content: message.trim() },
    ];

    try {
      return (
        await callGroq(this.groqApiKey, messages, {
          temperature: 0.4,
          maxTokens: 400,
        })
      ).trim();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new InternalServerErrorException(`Groq error: ${msg}`);
    }
  }
}
