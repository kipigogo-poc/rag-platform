import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentsService } from '../documents/documents.service';
import { GenerateQuizDto } from './dto/generate-quiz.dto';
import { Quiz } from './interfaces/quiz.interface';
import { callGroq } from '../common/groq';

const QUIZ_PROMPT = (topic: string, count: number, context: string) => `
You are an expert quiz creator. Using ONLY the content provided below, generate exactly ${count} multiple-choice questions.

TOPIC FOCUS: ${topic}
QUESTION COUNT: ${count}

DOCUMENT CONTENT:
${context}

Respond with ONLY a valid JSON object — no markdown fences, no explanation — matching this exact schema:
{
  "questions": [
    {
      "question": "string",
      "options": [
        { "label": "A", "text": "string" },
        { "label": "B", "text": "string" },
        { "label": "C", "text": "string" },
        { "label": "D", "text": "string" }
      ],
      "correctAnswer": "A",
      "explanation": "string — why the correct answer is right"
    }
  ]
}

Rules:
- The "questions" array must contain exactly ${count} items
- correctAnswer must be one of: A, B, C, D
- All 4 options must be plausible
- Base every question strictly on the provided content
- Explanations must be 1-2 sentences
`.trim();

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

    const topic = dto.topic ?? 'all main topics';
    const count = dto.questionCount ?? 5;
    const isConsolidated = !dto.sessionId;

    const context = await this.documentsService.retrieveContext(
      topic,
      userId,
      dto.subjectId,
      dto.sessionId,
      isConsolidated ? 16 : 8,
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
        [{ role: 'user', content: QUIZ_PROMPT(topic, count, context) }],
        { temperature: 0.4, jsonMode: true },
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
