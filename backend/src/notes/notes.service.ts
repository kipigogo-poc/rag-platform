import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentsService } from '../documents/documents.service';
import { GenerateNotesDto } from './dto/generate-notes.dto';
import { Notes } from './interfaces/notes.interface';
import { callGroq } from '../common/groq';
import { parseNotesResponse } from '../common/llm-response';
import { NOTES_SYSTEM, buildNotesUser, truncateSource } from '../common/prompts';

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
        'GROQ_API_KEY missing. Grab a free key at https://console.groq.com',
      );
    }

    const topic = dto.topic?.trim() || 'all main topics';
    const isConsolidated = !dto.sessionId;

    const context = await this.documentsService.retrieveContext(
      topic,
      userId,
      dto.subjectId,
      dto.sessionId,
      isConsolidated ? 8 : 5,
    );

    if (!context.trim()) {
      throw new InternalServerErrorException(
        'Nothing to work with yet. Upload a doc first.',
      );
    }

    const raw = await callGroq(
      this.groqApiKey,
      [
        { role: 'system', content: NOTES_SYSTEM },
        { role: 'user', content: buildNotesUser(topic, truncateSource(context)) },
      ],
      { temperature: 0.2, maxTokens: 1536, jsonMode: true },
    );

    return parseNotesResponse(raw);
  }
}
