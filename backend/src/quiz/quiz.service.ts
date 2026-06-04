import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { DocumentsService } from '../documents/documents.service';
import { GenerateQuizDto } from './dto/generate-quiz.dto';
import { Quiz } from './interfaces/quiz.interface';

const QUIZ_PROMPT = (topic: string, count: number, context: string) => `
You are an expert quiz creator. Using ONLY the content provided below, generate exactly ${count} multiple-choice questions.

TOPIC FOCUS: ${topic}
QUESTION COUNT: ${count}

DOCUMENT CONTENT:
${context}

Respond with ONLY a valid JSON array — no markdown fences, no explanation — where each element matches:
{
  "question": "string",
  "options": [
    { "label": "A", "text": "string" },
    { "label": "B", "text": "string" },
    { "label": "C", "text": "string" },
    { "label": "D", "text": "string" }
  ],
  "correctAnswer": "A" | "B" | "C" | "D",
  "explanation": "string — why the correct answer is right"
}

Rules:
- Exactly ${count} questions
- All 4 options must be plausible
- Base every question strictly on the provided content
- Explanations must be 1-2 sentences
`.trim();

@Injectable()
export class QuizService {
  private readonly genai: GoogleGenerativeAI;

  constructor(
    private readonly config: ConfigService,
    private readonly documentsService: DocumentsService,
  ) {
    this.genai = new GoogleGenerativeAI(config.get<string>('GEMINI_API_KEY') ?? '');
  }

  async generateQuiz(dto: GenerateQuizDto, userId: string): Promise<Quiz> {
    const topic = dto.topic ?? 'all main topics';
    const count = dto.questionCount ?? 5;
    const isConsolidated = !dto.sessionId;

    // Fetch more chunks when consolidating across multiple documents
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

    // ── 2. Generate with Gemini ──────────────────────────────────────────────
    const model = this.genai.getGenerativeModel({
      model: 'gemini-3.5-flash',
      generationConfig: { temperature: 0.4, responseMimeType: 'application/json' },
    });

    const result = await model.generateContent(QUIZ_PROMPT(topic, count, context));
    const raw = result.response.text();

    // ── 3. Parse JSON ────────────────────────────────────────────────────────
    try {
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('No JSON array in response');
      return JSON.parse(jsonMatch[0]) as Quiz;
    } catch {
      throw new InternalServerErrorException(
        'Gemini returned malformed JSON for quiz. Please try again.',
      );
    }
  }
}
