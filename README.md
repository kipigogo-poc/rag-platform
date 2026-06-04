# RAG Quiz Platform

A full-stack Retrieval-Augmented Generation (RAG) platform that converts any PDF or text document into an interactive multiple-choice quiz. Built as a portfolio showcase.

## Stack

| Layer | Technology | Hosting |
|-------|------------|---------|
| Frontend | Next.js 15 (App Router) + Tailwind CSS + Shadcn UI | Vercel (free) |
| Backend | NestJS + LangChain.js | Render / Railway (free) |
| Embeddings & LLM | Google Gemini (`text-embedding-004` + `gemini-3.5-flash`) | Google AI Studio (free) |
| Vector DB | Supabase pgvector | Supabase (free) |

**Total LLM API cost: $0** — Gemini free tier covers all embedding and generation calls.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Next.js Frontend                 │
│  UploadZone ──► API call ──► QuizCard ──► Results  │
└────────────────────────┬────────────────────────────┘
                         │ HTTP
┌────────────────────────▼────────────────────────────┐
│                   NestJS Backend                    │
│                                                     │
│  POST /documents/upload                             │
│    └─ PDF parse ──► chunk (500t/50t overlap)        │
│         └─ text-embedding-004 ──► Supabase pgvector │
│                                                     │
│  POST /quiz/generate                                │
│    └─ similarity search ──► gemini-3.5-flash        │
│         └─ structured JSON quiz response            │
└─────────────────────────────────────────────────────┘
```

---

## Auth Setup (NextAuth.js v5)

### 1. Generate a shared secret
```bash
openssl rand -base64 32
# Copy the output → AUTH_SECRET in both frontend/.env.local and backend/.env
```

### 2. Google OAuth
1. Go to [console.cloud.google.com](https://console.cloud.google.com/apis/credentials) → Create credentials → OAuth 2.0 Client ID
2. Application type: **Web application**
3. Authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google` (dev)
   - `https://your-vercel-app.vercel.app/api/auth/callback/google` (prod)
4. Copy **Client ID** → `GOOGLE_CLIENT_ID`, **Client Secret** → `GOOGLE_CLIENT_SECRET`

### 3. GitHub OAuth
1. Go to [github.com/settings/developers](https://github.com/settings/developers) → New OAuth App
2. Authorization callback URL:
   - Dev: `http://localhost:3000/api/auth/callback/github`
   - Prod: `https://your-vercel-app.vercel.app/api/auth/callback/github`
3. Copy **Client ID** → `GITHUB_CLIENT_ID`, **Client Secret** → `GITHUB_CLIENT_SECRET`

### How the token bridge works
```
Next.js (NextAuth session cookie)
  └─► GET /api/auth/token  ← Next.js Route Handler
        └─ auth() decodes session → jwt.sign(HS256, AUTH_SECRET, 1h)
             └─► Authorization: Bearer <token> ─► NestJS
                   └─ passport-jwt validates with same AUTH_SECRET
```

---

## Supabase pgvector Setup

Run all of this SQL in your Supabase SQL editor before starting the backend:

```sql
-- Subjects table (one per user, per topic area)
create table subjects (
  id         uuid default gen_random_uuid() primary key,
  user_id    text not null,
  name       text not null,
  color      text not null default '#6d28d9',
  created_at timestamptz default now()
);
create index on subjects(user_id);
```

### pgvector documents table

```sql
-- Enable the pgvector extension
create extension if not exists vector;

-- Create the documents table for LangChain SupabaseVectorStore
create table documents (
  id bigserial primary key,
  content text,
  metadata jsonb,
  embedding vector(768)   -- text-embedding-004 outputs 768 dimensions
);

-- Create an index for fast similarity search
create index on documents
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Create the match_documents RPC function required by LangChain
create or replace function match_documents (
  query_embedding vector(768),
  match_count int default 5,
  filter jsonb default '{}'
) returns table (
  id bigint,
  content text,
  metadata jsonb,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    id,
    content,
    metadata,
    1 - (documents.embedding <=> query_embedding) as similarity
  from documents
  where metadata @> filter
  order by documents.embedding <=> query_embedding
  limit match_count;
end;
$$;
```

### Telegram integration tables

Run these additional SQL statements to enable the Telegram chatbot:

```sql
-- One-time tokens for linking a Telegram account to a web app account
create table if not exists link_tokens (
  token text primary key,
  user_id text not null,
  expires_at timestamptz not null
);

-- Stores which subject/document each Telegram user is currently chatting about
create table if not exists telegram_sessions (
  telegram_id bigint primary key,
  user_id text not null,
  active_subject_id text,
  active_session_id text,
  updated_at timestamptz default now()
);
```

### Content sessions table (persistent notes + quiz)

```sql
-- Persists the generated notes and quiz for each uploaded document
create table if not exists content_sessions (
  id          uuid primary key default gen_random_uuid(),
  session_id  text not null unique,
  user_id     text not null,
  subject_id  uuid not null references subjects(id) on delete cascade,
  file_name   text not null,
  notes       jsonb not null,
  quiz        jsonb not null,
  created_at  timestamptz default now()
);
create index on content_sessions(user_id, subject_id);
```

---

## Local Development

### Prerequisites
- Node.js 20+
- A Google AI Studio API key (free at [aistudio.google.com](https://aistudio.google.com))
- A Supabase project with the SQL above applied

### Backend

```bash
cd backend
cp .env.example .env        # fill in your keys
npm install
npm run start:dev           # http://localhost:3001
```

### Frontend

```bash
cd frontend
cp .env.example .env.local  # fill in NEXT_PUBLIC_API_URL
npm install
npm run dev                 # http://localhost:3000
```

---

## Deployment

### Vercel (Frontend)
1. Import the `frontend/` folder as a new Vercel project.
2. Set `NEXT_PUBLIC_API_URL` to your Render/Railway backend URL.

### Render / Railway (Backend)
1. Connect this repo, set root directory to `backend/`.
2. Build command: `npm run build`
3. Start command: `npm run start`
4. Add all env vars from `.env.example`.

---

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/documents/upload` | Upload a PDF or TXT file for ingestion |
| `GET` | `/documents` | List all ingested document sessions |
| `POST` | `/quiz/generate` | Generate a quiz for a given session ID |
| `GET` | `/health` | Health check |
