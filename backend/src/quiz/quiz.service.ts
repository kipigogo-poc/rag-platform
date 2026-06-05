import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentsService } from '../documents/documents.service';
import { GenerateQuizDto } from './dto/generate-quiz.dto';
import { Quiz } from './interfaces/quiz.interface';
import { callGroq } from '../common/groq';
import { parseQuizResponse } from '../common/llm-response';
import { QUIZ_SYSTEM, buildQuizUser, truncateSource } from '../common/prompts';

@Injectable()
export class QuizService {
  private readonly groqApiKey: string;

  constructor(
    private readonly config: ConfigService,
    private readonly documentsService: DocumentsService,
  ) {
    this.groqApiKey = config.get<string>('GROQ_API_KEY') ?? '';
  }

  async generateQuiz(dto: GenerateQuizDto, userId: string): Promise<Quiz> {
    if (!this.groqApiKey) {
      throw new InternalServerErrorException(
        'GROQ_API_KEY missing. Grab a free key at https://console.groq.com',
      );
    }

    const topic = dto.topic?.trim() || 'all main topics';
    const count = dto.questionCount ?? 5;
    const isConsolidated = !dto.sessionId;

    const context = await this.documentsService.retrieveContext(
      topic,
      userId,
      dto.subjectId,
      dto.sessionId,
      isConsolidated ? 12 : 6,
    );

    if (!context.trim()) {
      throw new InternalServerErrorException(
        'Nothing to work with yet. Upload a doc first.',
      );
    }

    const raw = await callGroq(
      this.groqApiKey,
      [
        { role: 'system', content: QUIZ_SYSTEM },
        { role: 'user', content: buildQuizUser(topic, count, truncateSource(context)) },
      ],
      { temperature: 0.35, maxTokens: 2048, jsonMode: true },
    );

    return parseQuizResponse(raw);
  }
}
