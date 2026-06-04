import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { Subject } from './interfaces/subject.interface';

@Injectable()
export class SubjectsService {
  private readonly supabase: SupabaseClient;

  constructor(private readonly config: ConfigService) {
    const url = config.get<string>('SUPABASE_URL') ?? '';
    const key = config.get<string>('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!url || !key) {
      console.warn(
        '[SubjectsService] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set. ' +
        'Subjects endpoints will return 503 until env vars are configured.',
      );
    }

    this.supabase = createClient(url || 'https://placeholder.supabase.co', key || 'placeholder');
  }

  async findAll(userId: string): Promise<Subject[]> {
    const { data, error } = await this.supabase
      .from('subjects')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) throw new InternalServerErrorException(error.message);
    return (data ?? []).map(this.toSubject);
  }

  async create(userId: string, dto: CreateSubjectDto): Promise<Subject> {
    const { data, error } = await this.supabase
      .from('subjects')
      .insert({
        user_id: userId,
        name: dto.name,
        color: dto.color ?? '#6d28d9',
      })
      .select()
      .single();

    if (error) throw new InternalServerErrorException(error.message);
    return this.toSubject(data);
  }

  async update(id: string, userId: string, dto: Partial<CreateSubjectDto>): Promise<Subject> {
    await this.assertOwnership(id, userId);

    const { data, error } = await this.supabase
      .from('subjects')
      .update({ name: dto.name, color: dto.color })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new InternalServerErrorException(error.message);
    return this.toSubject(data);
  }

  async remove(id: string, userId: string): Promise<void> {
    await this.assertOwnership(id, userId);

    const { error } = await this.supabase
      .from('subjects')
      .delete()
      .eq('id', id);

    if (error) throw new InternalServerErrorException(error.message);
  }

  private async assertOwnership(id: string, userId: string): Promise<void> {
    const { data, error } = await this.supabase
      .from('subjects')
      .select('id, user_id')
      .eq('id', id)
      .single();

    if (error || !data) throw new NotFoundException(`Subject ${id} not found`);
    if (data.user_id !== userId) throw new ForbiddenException('Access denied');
  }

  private toSubject(row: Record<string, unknown>): Subject {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      name: row.name as string,
      color: row.color as string,
      createdAt: row.created_at as string,
    };
  }
}
