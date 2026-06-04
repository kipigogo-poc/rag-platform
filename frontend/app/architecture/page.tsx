import Link from 'next/link';

const concepts = [
  {
    term: 'Foundation Model (FM)',
    awsDef: 'A large pre-trained AI model you can use as-is or fine-tune for your specific task.',
    plain: 'Think of it as a super-smart brain that already finished school. It already knows about almost everything. We don\'t train it from scratch — we just give it instructions and let it work.',
    thisApp: 'We use Google Gemini 3.5 Flash as our Foundation Model. It reads the relevant chunks of your document and generates structured notes, quiz questions, and conversational chat answers — all from the same model.',
    tag: 'Generation',
    tagColor: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  },
  {
    term: 'Retrieval-Augmented Generation (RAG)',
    awsDef: 'A technique that grounds an FM\'s output in your own data by first retrieving relevant content, then passing it to the model as context.',
    plain: 'Instead of asking Gemini to answer from memory (which might be wrong or outdated), we first search your document for the most relevant passages, then hand those to Gemini and say "here\'s the context, now generate from this". It\'s like the difference between a closed-book and open-book exam.',
    thisApp: 'Every time you generate notes, a quiz, send a chat message, or ask the Telegram bot something — the app first searches your uploaded document for the most relevant paragraphs, then injects them into the prompt. Gemini never guesses; it only works with what you uploaded.',
    tag: 'Core Pattern',
    tagColor: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  },
  {
    term: 'Vector Embeddings',
    awsDef: 'A way to convert text into a list of numbers (a vector) that captures the semantic meaning. Similar sentences produce similar vectors.',
    plain: 'Imagine every sentence in your document gets turned into a coordinate in a huge map. Sentences that mean similar things end up close together on that map. When you ask a question, we turn it into coordinates too — then find all the sentences nearby on the map. That\'s semantic search, not keyword search.',
    thisApp: 'We use Google\'s gemini-embedding-001 model to convert every chunk of your document into a 768-dimensional vector (we pin the output to 768 dims via outputDimensionality to match our Supabase column). Those vectors are stored alongside the original text.',
    tag: 'Embeddings',
    tagColor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  },
  {
    term: 'Vector Database',
    awsDef: 'A database optimized for storing and querying vector embeddings using similarity search (e.g. cosine similarity).',
    plain: 'A normal database searches for exact matches. A vector database searches for meaning-matches. You ask "find me content about cloud security" and it finds paragraphs about IAM, encryption, and compliance — even if none of them contain those exact words.',
    thisApp: 'We use Supabase pgvector — PostgreSQL with a vector extension. The match_documents function runs a cosine similarity search to find the top-K most relevant chunks for any query, whether that query comes from the web UI or the Telegram bot.',
    tag: 'Storage',
    tagColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  },
  {
    term: 'Chunking & Tokenization',
    awsDef: 'Breaking large documents into smaller segments (chunks) that fit within a model\'s context window. Tokenization is how models read text — by splitting it into tokens (roughly words or word parts).',
    plain: 'LLMs can only read a certain amount of text at once — called a context window. So we cut long documents into smaller pieces before processing them. Smaller chunks also mean better search results, since each chunk is about one specific topic instead of everything at once.',
    thisApp: 'We split documents into 1,500-character chunks with 150-character overlap (so context doesn\'t get cut off at chunk boundaries). We use LangChain\'s RecursiveCharacterTextSplitter. A 76-page PDF produces ~76 chunks, each embedded individually.',
    tag: 'Pre-processing',
    tagColor: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  },
  {
    term: 'Prompt Engineering',
    awsDef: 'The practice of carefully crafting the instructions you give to a Foundation Model to get the output format and quality you want.',
    plain: 'Garbage in, garbage out. If you ask Gemini vaguely, it gives you vague answers. We write very specific prompts that tell it exactly what format to respond in, how many items to produce, and what rules to follow.',
    thisApp: 'We use three custom prompt templates: one for structured notes JSON (title, summary, keyPoints, sections), one for quiz JSON (question, 4 options, correct answer, explanation), and one for the chatbot (system role + conversation history + retrieved context). All generation calls use responseMimeType: "application/json" for reliable parsing.',
    tag: 'Prompting',
    tagColor: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  },
  {
    term: 'Inference',
    awsDef: 'Running a trained ML model to produce a prediction or output. This is the "using" phase, as opposed to the "training" phase.',
    plain: 'Training is when you teach a model (very expensive, takes weeks, needs tons of data). Inference is when you just use the already-trained model to get an answer (fast and cheap). Everything we do in this app is inference — we never train anything.',
    thisApp: 'Every call to Gemini 3.5 Flash is an inference call — notes generation, quiz generation, chat replies, and Telegram bot answers. We also do embedding inference on every uploaded chunk. All within the Google AI Studio free-tier quota.',
    tag: 'Model Usage',
    tagColor: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  },
  {
    term: 'Generative AI',
    awsDef: 'AI that can create new content — text, images, code — rather than just classifying or predicting from existing patterns.',
    plain: 'Traditional AI looks at data and says "this email is spam" or "this image is a cat". Generative AI creates something new. Our app generates notes, quiz questions, and chat answers that never existed before — tailored specifically to what\'s in your document.',
    thisApp: 'The entire platform is a Generative AI application. Every output (notes, quiz, chat response, Telegram reply) is freshly generated every time, grounded in your document, not copy-pasted from a template.',
    tag: 'Paradigm',
    tagColor: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  },
];

const pipelineSteps = [
  { label: 'Upload', sub: 'PDF or TXT (direct to backend)', icon: '📄', color: 'border-violet-400 bg-violet-50 dark:bg-violet-950/40' },
  { label: 'Parse', sub: 'Extract raw text', icon: '✂️', color: 'border-blue-400 bg-blue-50 dark:bg-blue-950/40' },
  { label: 'Chunk', sub: '1,500 chars / 150 overlap', icon: '🧩', color: 'border-blue-400 bg-blue-50 dark:bg-blue-950/40' },
  { label: 'Embed', sub: 'gemini-embedding-001 (768d)', icon: '🔢', color: 'border-blue-400 bg-blue-50 dark:bg-blue-950/40' },
  { label: 'Store', sub: 'Supabase pgvector', icon: '🗄️', color: 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/40' },
  { label: 'Query', sub: 'Embed topic → cosine search', icon: '🔍', color: 'border-amber-400 bg-amber-50 dark:bg-amber-950/40' },
  { label: 'Retrieve', sub: 'Top-K relevant chunks', icon: '📥', color: 'border-amber-400 bg-amber-50 dark:bg-amber-950/40' },
  { label: 'Generate', sub: 'Gemini 3.5 Flash', icon: '✨', color: 'border-rose-400 bg-rose-50 dark:bg-rose-950/40' },
  { label: 'Output', sub: 'Notes · Quiz · Chat', icon: '🎯', color: 'border-violet-400 bg-violet-50 dark:bg-violet-950/40' },
];

const stack = [
  { layer: 'Frontend', tech: 'Next.js 15 (App Router)', detail: 'React server + client components, Tailwind CSS, Shadcn UI' },
  { layer: 'Auth', tech: 'NextAuth.js v5', detail: 'Google & GitHub OAuth → HS256 JWT bridge for NestJS Passport-JWT' },
  { layer: 'Backend', tech: 'NestJS (TypeScript)', detail: 'REST API, Passport-JWT, Swagger docs at /api/docs' },
  { layer: 'RAG Pipeline', tech: 'LangChain.js', detail: 'RecursiveCharacterTextSplitter, direct Gemini fetch for embeddings' },
  { layer: 'LLM', tech: 'Gemini 3.5 Flash', detail: 'Notes, quiz, chat & Telegram answers via @google/generative-ai' },
  { layer: 'Embeddings', tech: 'gemini-embedding-001', detail: '768-dim vectors via direct REST fetch with outputDimensionality:768' },
  { layer: 'Vector DB', tech: 'Supabase pgvector', detail: 'PostgreSQL + pgvector, match_documents RPC (cosine similarity)' },
  { layer: 'Chat (in-app)', tech: 'ChatPanel component', detail: 'RAG-powered Q&A tab; maintains conversation history client-side' },
  { layer: 'Chat (Telegram)', tech: 'Telegraf.js bot', detail: '/link flow, /subjects, /docs, /use — RAG answers via ChatService' },
  { layer: 'File Upload', tech: 'Direct backend upload', detail: 'Browser uploads bypass Next.js proxy to avoid proxy timeout on large PDFs' },
  { layer: 'Containers', tech: 'Docker Compose', detail: 'Backend + frontend in isolated containers, dynamic port detection' },
];

const features = [
  {
    icon: '📝',
    title: 'Notes Generation',
    desc: 'Structured notes with title, summary, key points, and collapsible sections — generated from your document in seconds.',
    color: 'border-violet-200 bg-violet-50/50 dark:border-violet-900/50 dark:bg-violet-950/20',
  },
  {
    icon: '🧠',
    title: 'Quiz Generation',
    desc: 'Multiple-choice quizzes with 4 options, correct answer, and explanation for every question. Great for self-testing.',
    color: 'border-blue-200 bg-blue-50/50 dark:border-blue-900/50 dark:bg-blue-950/20',
  },
  {
    icon: '💬',
    title: 'In-App Chat',
    desc: 'Ask follow-up questions in a chat tab. The RAG pipeline retrieves fresh context for every message — not just the first one.',
    color: 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-950/20',
  },
  {
    icon: '🤖',
    title: 'Telegram Bot',
    desc: 'Link your account with /link <token>, then ask the bot questions about any of your subjects from Telegram.',
    color: 'border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20',
  },
  {
    icon: '📂',
    title: 'Subject Tabs',
    desc: 'Organize documents into subjects (e.g. "AWS Practitioner", "System Design"). Each subject keeps its own document context.',
    color: 'border-rose-200 bg-rose-50/50 dark:border-rose-900/50 dark:bg-rose-950/20',
  },
  {
    icon: '🔐',
    title: 'Social Login',
    desc: 'Sign in with Google or GitHub via NextAuth.js v5. A JWT token bridge secures all NestJS API calls with Passport-JWT.',
    color: 'border-sky-200 bg-sky-50/50 dark:border-sky-900/50 dark:bg-sky-950/20',
  },
];

export default function ArchitecturePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto flex h-14 items-center gap-4 px-4 max-w-5xl">
          <Link href="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <span>←</span> Back to App
          </Link>
          <div className="flex items-center gap-2 ml-auto">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-primary text-primary-foreground text-[10px] font-bold">R</div>
            <span className="text-sm font-medium">Architecture</span>
            <span className="rounded-full border border-primary/30 bg-accent px-2 py-0.5 text-[10px] font-medium text-accent-foreground hidden sm:block">
              AWS AI Practitioner
            </span>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-5xl space-y-16">

        {/* Hero */}
        <section className="text-center space-y-4">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
            End-to-End RAG Architecture
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            How This App Works
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            This platform is a Retrieval-Augmented Generation (RAG) system. You upload a document,
            we process and index it semantically, then use Gemini 3.5 Flash to generate study notes,
            quizzes, and conversational answers — grounded in your content, not hallucinated from thin air.
          </p>
        </section>

        {/* What you can do */}
        <section className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold">What You Can Do</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Six capabilities, all powered by the same RAG pipeline underneath.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className={`rounded-xl border p-4 space-y-2 ${f.color}`}>
                <div className="text-2xl">{f.icon}</div>
                <p className="font-semibold text-sm">{f.title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Pipeline */}
        <section className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold">The Pipeline</h2>
            <p className="text-sm text-muted-foreground mt-1">
              What happens from the moment you upload a file to when you see your notes, quiz, or chat answer.
            </p>
          </div>

          {/* Ingestion phase */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Phase 1 — Ingestion (once per document)</p>
            <div className="flex flex-wrap gap-2 items-center">
              {pipelineSteps.slice(0, 5).map((step, i) => (
                <div key={step.label} className="flex items-center gap-2">
                  <div className={`rounded-lg border-2 px-4 py-3 text-center min-w-[100px] ${step.color}`}>
                    <div className="text-lg mb-1">{step.icon}</div>
                    <div className="text-xs font-semibold">{step.label}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{step.sub}</div>
                  </div>
                  {i < 4 && <span className="text-muted-foreground text-lg font-light">→</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Retrieval + generation phase */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Phase 2 — Retrieval + Generation (every notes · quiz · chat · Telegram message)</p>
            <div className="flex flex-wrap gap-2 items-center">
              {pipelineSteps.slice(5).map((step, i) => (
                <div key={step.label} className="flex items-center gap-2">
                  <div className={`rounded-lg border-2 px-4 py-3 text-center min-w-[100px] ${step.color}`}>
                    <div className="text-lg mb-1">{step.icon}</div>
                    <div className="text-xs font-semibold">{step.label}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{step.sub}</div>
                  </div>
                  {i < pipelineSteps.slice(5).length - 1 && (
                    <span className="text-muted-foreground text-lg font-light">→</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20 px-4 py-3 text-sm">
            <span className="font-semibold text-amber-700 dark:text-amber-400">Why two phases? </span>
            <span className="text-amber-800 dark:text-amber-300">
              Ingestion runs once and is the slow step — we embed every chunk and rate-limit ourselves to
              80 requests per batch to respect Gemini free-tier quotas. Generation runs in a few seconds
              because the embeddings are already stored; we just search and generate.
            </span>
          </div>

          <div className="rounded-lg border border-sky-200 bg-sky-50 dark:border-sky-900/50 dark:bg-sky-950/20 px-4 py-3 text-sm">
            <span className="font-semibold text-sky-700 dark:text-sky-400">Upload goes direct. </span>
            <span className="text-sky-800 dark:text-sky-300">
              File uploads bypass the Next.js proxy and go directly from the browser to the NestJS backend
              (<code className="font-mono text-xs">NEXT_PUBLIC_BACKEND_URL</code>). This avoids proxy timeout
              errors on large PDFs — ingestion can take 20+ seconds for a big document.
            </span>
          </div>
        </section>

        {/* Concepts */}
        <section className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold">AWS AI Practitioner Concepts</h2>
            <p className="text-sm text-muted-foreground mt-1">
              The key terms from the AWS AI Practitioner exam — explained the way you&apos;d explain them to someone at lunch.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            {concepts.map((c) => (
              <div key={c.term} className="rounded-xl border border-border bg-card p-5 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold text-sm leading-snug">{c.term}</h3>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${c.tagColor}`}>
                    {c.tag}
                  </span>
                </div>

                <div className="space-y-3 text-sm">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">AWS Definition</p>
                    <p className="text-muted-foreground leading-relaxed">{c.awsDef}</p>
                  </div>

                  <div className="rounded-md bg-accent/50 border border-border px-3 py-2.5">
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">In Simple Terms</p>
                    <p className="leading-relaxed">{c.plain}</p>
                  </div>

                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">In This App</p>
                    <p className="text-muted-foreground leading-relaxed">{c.thisApp}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Stack */}
        <section className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold">Full Tech Stack</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Everything runs on free tiers — total monthly cost: $0.
            </p>
          </div>

          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-accent/40">
                  <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider text-muted-foreground">Layer</th>
                  <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider text-muted-foreground">Technology</th>
                  <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Detail</th>
                </tr>
              </thead>
              <tbody>
                {stack.map((row, i) => (
                  <tr key={row.layer} className={`border-b border-border last:border-0 ${i % 2 === 0 ? '' : 'bg-accent/20'}`}>
                    <td className="px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">{row.layer}</td>
                    <td className="px-4 py-3 font-semibold whitespace-nowrap">{row.tech}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{row.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Cost / deployment callout */}
        <section className="rounded-xl border border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-950/20 p-6 space-y-3">
          <h2 className="font-semibold text-emerald-800 dark:text-emerald-300">Why $0/month?</h2>
          <ul className="text-sm text-emerald-800 dark:text-emerald-300 space-y-1.5 leading-relaxed">
            <li><span className="font-medium">Google AI Studio</span> — Gemini 3.5 Flash and gemini-embedding-001 are free up to generous rate limits (1,500 requests/day for generation)</li>
            <li><span className="font-medium">Supabase free tier</span> — 500 MB storage, 50,000 monthly active users, pgvector included</li>
            <li><span className="font-medium">Vercel free tier</span> — Unlimited Next.js deployments with generous bandwidth</li>
            <li><span className="font-medium">Render/Railway free tier</span> — NestJS backend, sleeps after inactivity but wakes on request</li>
            <li><span className="font-medium">Telegram Bot API</span> — Completely free, no rate limits for normal usage</li>
          </ul>
        </section>

      </main>

      <footer className="border-t border-border/60 py-6 text-center text-xs text-muted-foreground mt-8">
        Built with Next.js · NestJS · LangChain.js · Gemini 3.5 Flash · Supabase pgvector · Telegraf.js
      </footer>
    </div>
  );
}
