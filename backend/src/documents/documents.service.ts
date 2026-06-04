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

/**
 * HuggingFace Inference API embeddings using all-mpnet-base-v2.
 * - 768 dimensions — matches existing Supabase vector(768) schema exactly
 * - Completely free, globally available (no geographic restrictions)
 * - Falls back to Gemini embedding API if HF_TOKEN is not set
 */
function makeEmbeddings(geminiApiKey: string, hfToken: string) {
  const HF_MODEL = 'sentence-transformers/all-mpnet-base-v2';
  const HF_URL = `https://api-inference.huggingface.co/models/${HF_MODEL}`;
  const CALL_DELAY_MS = 100;

  async function embedOneHF(text: string, retries = 4): Promise<number[]> {
    // 60-second timeout per call — HF model cold-start can take ~30s
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);

    let res: Response;
    try {
      res = await fetch(HF_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${hfToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inputs: text }),
        signal: controller.signal,
      });
    } catch (err: unknown) {
      clearTimeout(timeout);
      const isAbort = err instanceof Error && err.name === 'AbortError';
      if (isAbort && retries > 0) {
        console.warn('[HF] Request timed out, retrying in 5s…');
        await new Promise((r) => setTimeout(r, 5_000));
        return embedOneHF(text, retries - 1);
      }
      throw new Error(`HuggingFace fetch failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      clearTimeout(timeout);
    }

    // Model loading — HuggingFace returns 503 with estimated_time while warming up
    if (res.status === 503 && retries > 0) {
      let waitMs = 20_000;
      try {
        const body = await res.json() as { estimated_time?: number };
        if (body.estimated_time) waitMs = Math.min(body.estimated_time * 1000 + 2_000, 60_000);
      } catch { /* ignore */ }
      console.warn(`[HF] Model loading, waiting ${Math.round(waitMs / 1000)}s…`);
      await new Promise((r) => setTimeout(r, waitMs));
      return embedOneHF(text, retries - 1);
    }

    if (res.status === 429 && retries > 0) {
      await new Promise((r) => setTimeout(r, 10_000));
      return embedOneHF(text, retries - 1);
    }

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`HuggingFace embedding error ${res.status}: ${err}`);
    }

    const data = await res.json() as number[] | number[][];
    // HF can return [[...]] (batch) or [...] (single)
    const vector = Array.isArray(data[0]) ? (data as number[][])[0] : data as number[];
    if (!Array.isArray(vector) || vector.length === 0) {
      throw new Error(`Unexpected embedding shape from HuggingFace: ${JSON.stringify(data).slice(0, 120)}`);
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
      let body: { error?: { details?: Array<{ retryDelay?: string; violations?: Array<{ quotaId?: string }> }> } } = {};
      try { body = await res.json(); } catch { /* ignore */ }
      const violations = body.error?.details?.flatMap((d) => d.violations ?? []) ?? [];
      if (violations.some((v) => v.quotaId?.includes('PerDay'))) {
        throw new Error('Gemini embedding quota exhausted for today. Set HF_TOKEN to use HuggingFace embeddings instead.');
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

  // Use HuggingFace when token is provided, fall back to Gemini
  const embedOne = hfToken ? embedOneHF : embedOneGemini;

  return {
    async embedQuery(text: string): Promise<number[]> {
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
      config.get<string>('HF_TOKEN') ?? '',
    );
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
