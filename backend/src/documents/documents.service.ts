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

/** Calls the Gemini embedding REST API directly, with sequential rate-limited calls + smart retry */
function makeEmbeddings(apiKey: string) {
  // Sequential delay between every individual embed call.
  // Keeps burst rate well below the 1,500 req/min free-tier cap while being
  // gentle on the 1,000 req/day per-model quota.
  const CALL_DELAY_MS = 120;

  async function embedWithRetry(text: string, retries: number): Promise<number[]> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: { parts: [{ text }] },
        outputDimensionality: 768,
      }),
    });

    if (res.status === 429) {
      let body: { error?: { details?: Array<{ retryDelay?: string; quotaId?: string; violations?: Array<{ quotaId?: string }> }> } } = {};
      try { body = await res.json(); } catch { /* ignore */ }

      // Detect per-day quota exhaustion — retrying won't help until tomorrow
      const violations = body.error?.details?.flatMap((d) => d.violations ?? []) ?? [];
      const isDaily = violations.some((v) => v.quotaId?.includes('PerDay')) ||
        body.error?.details?.some((d) => d.quotaId?.includes('PerDay'));
      if (isDaily) {
        throw new Error(
          'Embedding API error 429: Daily free-tier quota exhausted (1,000 requests/day). ' +
          'Quota resets at midnight Pacific Time. Reduce document size or wait until tomorrow.',
        );
      }

      // Per-minute rate limit — back off and retry
      if (retries > 0) {
        let waitMs = 35_000;
        try {
          const delayStr = body.error?.details?.find((d) => d.retryDelay)?.retryDelay;
          if (delayStr) waitMs = Math.max(parseFloat(delayStr) * 1000 + 500, 1_000);
        } catch { /* ignore */ }
        await new Promise((r) => setTimeout(r, waitMs));
        return embedWithRetry(text, retries - 1);
      }
    }

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Embedding API error ${res.status}: ${err}`);
    }

    const data = (await res.json()) as { embedding: { values: number[] } };
    return data.embedding.values;
  }

  async function embedQuery(text: string): Promise<number[]> {
    return embedWithRetry(text, 3);
  }

  return {
    embedQuery,
    /** Embeds sequentially with a small delay to stay well within rate limits */
    async embedDocuments(texts: string[]): Promise<number[][]> {
      const results: number[][] = [];
      for (const text of texts) {
        results.push(await embedWithRetry(text, 3));
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
    this.embeddings = makeEmbeddings(config.get<string>('GEMINI_API_KEY') ?? '');
  }

  async ingestDocument(
    file: Express.Multer.File,
    userId: string,
    subjectId: string,
  ): Promise<IngestResult> {
    const sessionId = uuidv4();

    // ── 1. Extract raw text ─────────────────────────────────────────────────
    let rawText: string;
    if (file.mimetype === 'application/pdf') {
      const parsed = await pdfParse(file.buffer);
      rawText = parsed.text;
    } else {
      rawText = file.buffer.toString('utf-8');
    }

    if (!rawText.trim()) {
      throw new InternalServerErrorException('Could not extract any text from the uploaded file.');
    }

    // ── 2. Chunk ─────────────────────────────────────────────────────────────
    // Larger chunks = fewer embedding API calls = less quota used per document.
    // 3,000 chars / 200 overlap ≈ half the chunks compared to the previous 1,500/150 settings.
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

    // ── 3. Embed + store in Supabase pgvector ────────────────────────────────
    try {
      await SupabaseVectorStore.fromDocuments(docs, this.embeddings as any, {
        client: this.supabase,
        tableName: 'documents',
        queryName: 'match_documents',
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new InternalServerErrorException(`Vector store error: ${message}`);
    }

    return {
      sessionId,
      fileName: file.originalname,
      chunks: chunks.length,
      message: `Document ingested and vectorized successfully (${chunks.length} chunks).`,
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
      if (!seen.has(m.sessionId)) {
        seen.set(m.sessionId, {
          sessionId: m.sessionId,
          fileName: m.fileName,
          chunks: 1,
          createdAt: m.createdAt,
        });
      } else {
        seen.get(m.sessionId)!.chunks++;
      }
    }

    return Array.from(seen.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  /**
   * Retrieve the most relevant chunks for a query using Supabase RPC.
   * If sessionId is omitted, searches across ALL documents in the subject.
   * Returns a concatenated string of the top-k chunk texts.
   */
  async retrieveContext(
    query: string,
    userId: string,
    subjectId: string,
    sessionId: string | undefined,
    k = 8,
  ): Promise<string> {
    const queryEmbedding = await this.embeddings.embedQuery(query);

    // Build filter — omit sessionId to search all docs in the subject
    const filter: Record<string, string> = { userId, subjectId };
    if (sessionId) filter.sessionId = sessionId;

    const { data, error } = await this.supabase.rpc('match_documents', {
      query_embedding: queryEmbedding,
      match_count: k,
      filter,
    });

    if (error) {
      throw new InternalServerErrorException(`Retrieval error: ${error.message}`);
    }

    if (!data || data.length === 0) return '';

    return (data as Array<{ content: string }>)
      .map((row) => row.content)
      .join('\n\n---\n\n');
  }
}
