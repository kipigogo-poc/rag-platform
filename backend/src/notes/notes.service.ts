import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentsService } from '../documents/documents.service';
import { GenerateNotesDto } from './dto/generate-notes.dto';
import { Notes } from './interfaces/notes.interface';
import { callGroq } from '../common/groq';
import { NOTES_SYSTEM, buildNotesUser } from '../common/prompts';

@Injectable()
export class NotesService {
  private readonly groqApiKey: string;

  constructor(
    private readonly config: ConfigService,
    private readonly documentsService: DocumentsService,
  ) {
    this.groqApiKey = config.get<string>('GROQ_API_KEY') ?? '';
  }

  async generateNotes(dto: GenerateNotesDto, userId: string): Promise<Notes> {
    if (!this.groqApiKey) {
      throw new InternalServerErrorException(
        'GROQ_API_KEY is not configured. Get a free key at https://console.groq.com',
      );
    }

    const topic = dto.topic?.trim() || 'all main topics';
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
        [
          { role: 'system', content: NOTES_SYSTEM },
          { role: 'user', content: buildNotesUser(topic, context) },
        ],
        { temperature: 0.2, maxTokens: 2048, jsonMode: true },
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new InternalServerErrorException(`Groq error: ${msg}`);
    }

    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON object in response');
      return JSON.parse(jsonMatch[0]) as Notes;
    } catch {
      throw new InternalServerErrorException(
        'Groq returned malformed JSON for notes. Please try again.',
      );
    }
  }
}
