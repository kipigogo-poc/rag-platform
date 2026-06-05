import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentsService } from '../documents/documents.service';
import { callGroq, GroqMessage } from '../common/groq';
import { buildChatSystemWithSource, trimChatHistory, truncateSource } from '../common/prompts';

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
        'GROQ_API_KEY missing. Grab a free key at https://console.groq.com',
      );
    }

    const context = await this.documentsService.retrieveContext(
      message,
      userId,
      subjectId,
      sessionId,
      sessionId ? 4 : 6,
    );

    if (!context.trim()) {
      return "Can't find content for this doc. Upload and process it first.";
    }

    const messages: GroqMessage[] = [
      { role: 'system', content: buildChatSystemWithSource(truncateSource(context, 5_000)) },
      ...trimChatHistory(history),
      { role: 'user', content: message.trim() },
    ];

    return (
      await callGroq(this.groqApiKey, messages, {
        temperature: 0.4,
        maxTokens: 400,
      })
    ).trim();
  }
}
