import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';

export interface TelegramSession {
  telegramId: number;
  userId: string;
  activeSubjectId: string | null;
  activeSessionId: string | null;
}

@Injectable()
export class TelegramSessionsService {
  private readonly supabase: SupabaseClient;

  constructor(config: ConfigService) {
    this.supabase = createClient(
      config.get<string>('SUPABASE_URL') ?? '',
      config.get<string>('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );
  }

  // ── Link tokens ─────────────────────────────────────────────────────────────

  async createLinkToken(userId: string): Promise<string> {
    const token = randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 min

    const { error } = await this.supabase
      .from('link_tokens')
      .upsert({ token, user_id: userId, expires_at: expiresAt });

    if (error) throw new InternalServerErrorException(error.message);
    return token;
  }

  async consumeLinkToken(token: string): Promise<string | null> {
    const { data, error } = await this.supabase
      .from('link_tokens')
      .select('user_id, expires_at')
      .eq('token', token)
      .single();

    if (error || !data) return null;
    if (new Date(data.expires_at) < new Date()) {
      await this.supabase.from('link_tokens').delete().eq('token', token);
      return null;
    }

    await this.supabase.from('link_tokens').delete().eq('token', token);
    return data.user_id as string;
  }

  // ── Telegram sessions ────────────────────────────────────────────────────────

  async getSession(telegramId: number): Promise<TelegramSession | null> {
    const { data, error } = await this.supabase
      .from('telegram_sessions')
      .select('*')
      .eq('telegram_id', telegramId)
      .single();

    if (error || !data) return null;

    return {
      telegramId: data.telegram_id as number,
      userId: data.user_id as string,
      activeSubjectId: (data.active_subject_id as string) ?? null,
      activeSessionId: (data.active_session_id as string) ?? null,
    };
  }

  async setSession(
    telegramId: number,
    userId: string,
    activeSubjectId?: string | null,
    activeSessionId?: string | null,
  ): Promise<void> {
    const { error } = await this.supabase.from('telegram_sessions').upsert({
      telegram_id: telegramId,
      user_id: userId,
      active_subject_id: activeSubjectId ?? null,
      active_session_id: activeSessionId ?? null,
      updated_at: new Date().toISOString(),
    });

    if (error) throw new InternalServerErrorException(error.message);
  }

  async clearSession(telegramId: number): Promise<void> {
    await this.supabase.from('telegram_sessions').delete().eq('telegram_id', telegramId);
  }

  // ── Subject + session helpers ────────────────────────────────────────────────

  async listSubjects(userId: string): Promise<Array<{ id: string; name: string; color: string }>> {
    const { data } = await this.supabase
      .from('subjects')
      .select('id, name, color')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    return (data ?? []) as Array<{ id: string; name: string; color: string }>;
  }

  async listSessions(
    userId: string,
    subjectId: string,
  ): Promise<Array<{ sessionId: string; fileName: string }>> {
    const { data } = await this.supabase
      .from('documents')
      .select('metadata')
      .eq('metadata->>userId', userId)
      .eq('metadata->>subjectId', subjectId)
      .not('metadata->>sessionId', 'is', null);

    const seen = new Map<string, string>();
    for (const row of data ?? []) {
      const m = row.metadata as Record<string, string>;
      if (!seen.has(m.sessionId)) seen.set(m.sessionId, m.fileName);
    }

    return Array.from(seen.entries()).map(([sessionId, fileName]) => ({
      sessionId,
      fileName,
    }));
  }
}
