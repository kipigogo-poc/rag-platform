import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SaveContentSessionDto } from './dto/save-content-session.dto';
import { ContentSession } from './interfaces/content-session.interface';

@Injectable()
export class ContentSessionsService {
  private readonly supabase: SupabaseClient;

  constructor(private readonly config: ConfigService) {
    this.supabase = createClient(
      config.get<string>('SUPABASE_URL') ?? '',
      config.get<string>('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );
  }

  async save(userId: string, dto: SaveContentSessionDto): Promise<ContentSession> {
    // Upsert so re-uploading the same sessionId doesn't create duplicates
    const { data, error } = await this.supabase
      .from('content_sessions')
      .upsert(
        {
          session_id: dto.sessionId,
          user_id: userId,
          subject_id: dto.subjectId,
          file_name: dto.fileName,
          notes: dto.notes,
          quiz: dto.quiz,
        },
        { onConflict: 'session_id' },
      )
      .select()
      .single();

    if (error) throw new InternalServerErrorException(error.message);
    return this.toSession(data);
  }

  async listBySubject(userId: string, subjectId: string): Promise<ContentSession[]> {
    const { data, error } = await this.supabase
      .from('content_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('subject_id', subjectId)
      .order('created_at', { ascending: false });

    if (error) throw new InternalServerErrorException(error.message);
    return (data ?? []).map((r) => this.toSession(r));
  }

  async deleteBySession(userId: string, sessionId: string): Promise<void> {
    const { error } = await this.supabase
      .from('content_sessions')
      .delete()
      .eq('session_id', sessionId)
      .eq('user_id', userId);

    if (error) throw new InternalServerErrorException(error.message);
  }

  private toSession(row: Record<string, unknown>): ContentSession {
    return {
      id: row.id as string,
      sessionId: row.session_id as string,
      userId: row.user_id as string,
      subjectId: row.subject_id as string,
      fileName: row.file_name as string,
      notes: row.notes as ContentSession['notes'],
      quiz: row.quiz as ContentSession['quiz'],
      createdAt: row.created_at as string,
    };
  }
}
