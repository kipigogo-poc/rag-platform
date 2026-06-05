// All NestJS API calls go through /nest/* which Next.js server-side rewrites
// to BACKEND_URL (http://backend:3001 in Docker, http://localhost:3001 locally).
// File uploads bypass the proxy and go directly to NEXT_PUBLIC_BACKEND_URL
// because large uploads can timeout through the Next.js proxy layer.
const BASE_URL = '/nest';
const DIRECT_BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QuizOption {
  label: 'A' | 'B' | 'C' | 'D';
  text: string;
}

export interface QuizQuestion {
  question: string;
  options: QuizOption[];
  correctAnswer: 'A' | 'B' | 'C' | 'D';
  explanation: string;
}

export type Quiz = QuizQuestion[];

export interface UploadResponse {
  sessionId: string;
  fileName: string;
  chunks: number;
  message: string;
}

export interface GenerateQuizPayload {
  sessionId: string;
  subjectId: string;
  topic?: string;
  questionCount?: number;
}

export interface GenerateNotesPayload {
  sessionId: string;
  subjectId: string;
  topic?: string;
}

export interface NoteSection {
  heading: string;
  content: string;
}

export interface Notes {
  title: string;
  summary: string;
  keyPoints: string[];
  sections: NoteSection[];
}

export interface ContentSession {
  id: string;
  sessionId: string;
  subjectId: string;
  fileName: string;
  notes: Notes;
  quiz: Quiz;
  createdAt: string;
}

// ─── Token cache ──────────────────────────────────────────────────────────────

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

async function getBearerToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) {
    return cachedToken;
  }
  const res = await fetch('/api/auth/token');
  if (!res.ok) throw new Error('Log in to continue');
  const { token, expiresIn } = (await res.json()) as { token: string; expiresIn: number };
  cachedToken = token;
  tokenExpiresAt = Date.now() + expiresIn * 1000;
  return token;
}

// ─── Core fetcher ─────────────────────────────────────────────────────────────

export async function apiClient<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = await getBearerToken();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    ...(init.body && typeof init.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
    ...(init.headers as Record<string, string>),
  };

  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      message = body?.message ?? message;
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ─── Domain helpers ───────────────────────────────────────────────────────────

export async function uploadDocument(
  file: File,
  subjectId: string,
): Promise<UploadResponse> {
  const token = await getBearerToken();
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(
    `${DIRECT_BACKEND_URL}/documents/upload?subjectId=${encodeURIComponent(subjectId)}`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    },
  );

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try { const b = await res.json(); message = b?.message ?? message; } catch { /* ignore */ }
    throw new Error(message);
  }
  return res.json() as Promise<UploadResponse>;
}

export async function generateQuiz(payload: GenerateQuizPayload): Promise<Quiz> {
  return apiClient<Quiz>('/quiz/generate', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function generateNotes(payload: GenerateNotesPayload): Promise<Notes> {
  return apiClient<Notes>('/notes/generate', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Generate notes + quiz from ALL documents in a subject (no sessionId) */
export async function consolidateSubject(
  subjectId: string,
  topic: string,
  questionCount: number,
): Promise<{ notes: Notes; quiz: Quiz }> {
  // Sequential calls — avoids Groq TPM/RPM burst (free tier ~30 req/min)
  const notes = await apiClient<Notes>('/notes/generate', {
    method: 'POST',
    body: JSON.stringify({ subjectId, topic }),
  });
  await sleep(3_000);
  const quiz = await apiClient<Quiz>('/quiz/generate', {
    method: 'POST',
    body: JSON.stringify({ subjectId, topic, questionCount }),
  });
  return { notes, quiz };
}

// ─── Content session persistence ──────────────────────────────────────────────

export async function saveContentSession(payload: {
  sessionId: string;
  subjectId: string;
  fileName: string;
  notes: Notes;
  quiz: Quiz;
}): Promise<ContentSession> {
  return apiClient<ContentSession>('/content-sessions', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function listContentSessions(subjectId: string): Promise<ContentSession[]> {
  return apiClient<ContentSession[]>(
    `/content-sessions?subjectId=${encodeURIComponent(subjectId)}`,
  );
}

export async function deleteContentSession(sessionId: string): Promise<void> {
  return apiClient<void>(`/content-sessions/${encodeURIComponent(sessionId)}`, {
    method: 'DELETE',
  });
}
