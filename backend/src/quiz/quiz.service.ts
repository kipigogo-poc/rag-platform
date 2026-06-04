import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentsService } from '../documents/documents.service';
import { GenerateQuizDto } from './dto/generate-quiz.dto';
import { Quiz } from './interfaces/quiz.interface';
import { callGroq } from '../common/groq';
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
        'GROQ_API_KEY is not configured. Get a free key at https://console.groq.com',
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
        'No content found for this session. Make sure the document was uploaded successfully.',
      );
    }

    let raw: string;
    try {
      raw = await callGroq(
        this.groqApiKey,
        [
          { role: 'system', content: QUIZ_SYSTEM },
          { role: 'user', content: buildQuizUser(topic, count, truncateSource(context)) },
        ],
        { temperature: 0.35, maxTokens: 2048, jsonMode: true },
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new InternalServerErrorException(`Groq error: ${msg}`);
    }

    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON object in response');
      const parsed = JSON.parse(jsonMatch[0]) as { questions?: Quiz } | Quiz;
      if (Array.isArray(parsed)) return parsed;
      if (parsed && 'questions' in parsed && Array.isArray(parsed.questions)) {
        return parsed.questions;
      }
      throw new Error('Missing questions array');
    } catch {
      throw new InternalServerErrorException(
        'Groq returned malformed JSON for quiz. Please try again.',
      );
    }
  }
}
