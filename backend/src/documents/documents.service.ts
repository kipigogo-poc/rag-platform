import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SupabaseVectorStore } from '@langchain/community/vectorstores/supabase';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { Document } from 'langchain/document';
import * as pdfParse from 'pdf-parse';
import { v4 as uuidv4 } from 'uuid';

export interface IngestResult {
  sessionId: string;
  fileName: string;
  chunks: number;
  message: string;
}

export interface SessionMeta {
  sessionId: string;
  fileName: string;
  chunks: number;
  createdAt: string;
}

interface GeminiQuotaBody {
  error?: {
    details?: Array<{
      violations?: Array<{ quotaId?: string }>;
    }>;
  };
}

function makeEmbeddings(geminiApiKey: string, jinaApiKey: string) {
  const CALL_DELAY_MS = 100;

  async function embedOneJina(text: string, retries = 3): Promise<number[]> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30_000);

    let res: Response;
    try {
      res = await fetch('https://api.jina.ai/v1/embeddings', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${jinaApiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          model: 'jina-embeddings-v2-base-en',
          input: [text],
        }),
        signal: controller.signal,
      });
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (retries > 0) {
        await new Promise((r) => setTimeout(r, 3_000));
        return embedOneJina(text, retries - 1);
      }
      const wrapped = new Error(
        `Jina AI fetch failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      (wrapped as Error & { cause?: unknown }).cause = err;
      throw wrapped;
    }
    clearTimeout(timeoutId);

    if (res.status === 429 && retries > 0) {
      await new Promise((r) => setTimeout(r, 10_000));
      return embedOneJina(text, retries - 1);
    }

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Jina AI embedding error ${res.status}: ${errText}`);
    }

    const data = (await res.json()) as { data: Array<{ embedding: number[] }> };
    const vector = data?.data?.[0]?.embedding;
    if (!Array.isArray(vector) || vector.length === 0) {
      throw new Error(`Unexpected Jina AI response: ${JSON.stringify(data).slice(0, 120)}`);
    }
    return vector;
  }

  async function embedOneGemini(text: string, retries = 3): Promise<number[]> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${geminiApiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: { parts: [{ text }] }, outputDimensionality: 768 }),
    });

    if (res.status === 429 && retries > 0) {
      let body: GeminiQuotaBody;
      try {
        body = (await res.json()) as GeminiQuotaBody;
      } catch {
        body = {};
      }
      const violations = body.error?.details?.flatMap((d) => d.violations ?? []) ?? [];
      if (violations.some((v) => v.quotaId?.includes('PerDay'))) {
        throw new Error(
          'Gemini embedding quota exhausted for today. Set JINA_API_KEY to use Jina AI embeddings instead.',
        );
      }
      await new Promise((r) => setTimeout(r, 35_000));
      return embedOneGemini(text, retries - 1);
    }

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gemini embedding error ${res.status}: ${err}`);
    }

    const data = (await res.json()) as { embedding: { values: number[] } };
    return data.embedding.values;
  }

  const embedOne = jinaApiKey ? embedOneJina : embedOneGemini;

  return {
    embedQuery(text: string): Promise<number[]> {
      return embedOne(text);
    },
    async embedDocuments(texts: string[]): Promise<number[][]> {
      const results: number[][] = [];
      for (const text of texts) {
        results.push(await embedOne(text));
        await new Promise((r) => setTimeout(r, CALL_DELAY_MS));
      }
      return results;
    },
  };
}

@Injectable()
export class DocumentsService {
  private readonly supabase: SupabaseClient;
  private readonly embeddings: ReturnType<typeof makeEmbeddings>;

  constructor(private readonly config: ConfigService) {
    this.supabase = createClient(
      config.get<string>('SUPABASE_URL') ?? '',
      config.get<string>('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );
    this.embeddings = makeEmbeddings(
      config.get<string>('GEMINI_API_KEY') ?? '',
      config.get<string>('JINA_API_KEY') ?? '',
    );
  }

  async ingestDocument(
    file: Express.Multer.File,
    userId: string,
    subjectId: string,
  ): Promise<IngestResult> {
    const sessionId = uuidv4();

    const rawText =
      file.mimetype === 'application/pdf'
        ? (await pdfParse(file.buffer)).text
        : file.buffer.toString('utf-8');

    if (!rawText.trim()) {
      throw new InternalServerErrorException('Nothing readable in that file.');
    }

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 3000,
      chunkOverlap: 200,
      separators: ['\n\n', '\n', '. ', ' ', ''],
    });

    const chunks = await splitter.splitText(rawText);

    const docs: Document[] = chunks.map((chunk, i) => ({
      pageContent: chunk,
      metadata: {
        userId,
        subjectId,
        sessionId,
        fileName: file.originalname,
        chunkIndex: i,
        createdAt: new Date().toISOString(),
      },
    }));

    try {
      await SupabaseVectorStore.fromDocuments(docs, this.embeddings as any, {
        client: this.supabase,
        tableName: 'documents',
        queryName: 'match_documents',
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new InternalServerErrorException(`Couldn't index this doc: ${message}`);
    }

    return {
      sessionId,
      fileName: file.originalname,
      chunks: chunks.length,
      message: `Ready — ${chunks.length} chunks indexed.`,
    };
  }

  async listSessions(userId: string, subjectId: string): Promise<SessionMeta[]> {
    const { data, error } = await this.supabase
      .from('documents')
      .select('metadata')
      .eq('metadata->>userId', userId)
      .eq('metadata->>subjectId', subjectId)
      .not('metadata->>sessionId', 'is', null);

    if (error) throw new InternalServerErrorException(error.message);

    const seen = new Map<string, SessionMeta>();
    for (const row of data ?? []) {
      const m = row.metadata as Record<string, string>;
      const existing = seen.get(m.sessionId);
      if (!existing) {
        seen.set(m.sessionId, {
          sessionId: m.sessionId,
          fileName: m.fileName,
          chunks: 1,
          createdAt: m.createdAt,
        });
        continue;
      }
      existing.chunks++;
    }

    return Array.from(seen.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  async retrieveContext(
    query: string,
    userId: string,
    subjectId: string,
    sessionId: string | undefined,
    k = 8,
  ): Promise<string> {
    const queryEmbedding = await this.embeddings.embedQuery(query);

    const filter: Record<string, string> = { userId, subjectId };
    if (sessionId) filter.sessionId = sessionId;

    const { data, error } = await this.supabase.rpc('match_documents', {
      query_embedding: queryEmbedding,
      match_count: k,
      filter,
    });

    if (error) {
      throw new InternalServerErrorException(`Couldn't search your docs: ${error.message}`);
    }

    if (!data || data.length === 0) return '';

    return (data as Array<{ content: string }>)
      .map((row, i) => `[${i + 1}] ${row.content.trim()}`)
      .join('\n');
  }
}
