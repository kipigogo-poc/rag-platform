import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { DocumentsService } from '../documents/documents.service';
import { GenerateNotesDto } from './dto/generate-notes.dto';
import { Notes } from './interfaces/notes.interface';

const NOTES_PROMPT = (topic: string, context: string) => `
You are an expert academic note-taker. Using ONLY the content provided below, generate comprehensive structured study notes.

TOPIC FOCUS: ${topic}

DOCUMENT CONTENT:
${context}

Respond with ONLY a valid JSON object — no markdown fences, no explanation — matching this exact schema:
{
  "title": "string — concise descriptive title",
  "summary": "string — 2-4 sentence overview",
  "keyPoints": ["string", "string", ...],
  "sections": [
    { "heading": "string", "content": "string — detailed paragraph" }
  ]
}

Rules:
- keyPoints: 5–10 concise bullet strings
- sections: 3–6 sections covering the main topics in the content
- Base everything strictly on the provided content
`.trim();

@Injectable()
export class NotesService {
  private readonly genai: GoogleGenerativeAI;

  constructor(
    private readonly config: ConfigService,
    private readonly documentsService: DocumentsService,
  ) {
    this.genai = new GoogleGenerativeAI(config.get<string>('GEMINI_API_KEY') ?? '');
  }

  async generateNotes(dto: GenerateNotesDto, userId: string): Promise<Notes> {
    const topic = dto.topic ?? 'all main topics';
    const isConsolidated = !dto.sessionId;

    // Fetch more chunks when consolidating across multiple documents
    const context = await this.documentsService.retrieveContext(
      topic,
      userId,
      dto.subjectId,
      dto.sessionId,
      isConsolidated ? 20 : 10,
    );

    if (!context.trim()) {
      throw new InternalServerErrorException(
        'No content found for this session. Make sure the document was uploaded successfully.',
      );
    }

    // ── 2. Generate with Gemini ──────────────────────────────────────────────
    const model = this.genai.getGenerativeModel({
      model: 'gemini-3.5-flash',
      generationConfig: { temperature: 0.3, responseMimeType: 'application/json' },
    });

    const result = await model.generateContent(NOTES_PROMPT(topic, context));
    const raw = result.response.text();

    // ── 3. Parse JSON ────────────────────────────────────────────────────────
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON object in response');
      return JSON.parse(jsonMatch[0]) as Notes;
    } catch {
      throw new InternalServerErrorException(
        'Gemini returned malformed JSON for notes. Please try again.',
      );
    }
  }
}
