'use client';

import { useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { LogOut, ChevronDown, BookOpen, HelpCircle, MessageCircle } from 'lucide-react';
import { LoginScreen } from '@/components/LoginScreen';
import { SubjectSidebar, type Subject } from '@/components/SubjectSidebar';
import { UploadZone } from '@/components/UploadZone';
import { NotesView } from '@/components/NotesView';
import { QuizCard } from '@/components/QuizCard';
import { QuizResults } from '@/components/QuizResults';
import { ChatPanel } from '@/components/ChatPanel';
import { TelegramConnect } from '@/components/TelegramConnect';
import { cn } from '@/lib/utils';
import type { Quiz, Notes, QuizQuestion, ContentSession } from '@/lib/api';
import { listContentSessions, saveContentSession, deleteContentSession, consolidateSubject } from '@/lib/api';

type ContentTab = 'notes' | 'quiz' | 'chat';
type QuizState = 'idle' | 'quiz' | 'results';

export default function HomePage() {
  const { data: session, status } = useSession();
  const [activeSubject, setActiveSubject] = useState<Subject | null>(null);
  // All sessions for the active subject — keyed array so previous notes survive new uploads
  const [sessions, setSessions] = useState<ContentSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(true);
  const [loadingsessions, setLoadingSessions] = useState(false);
  const [consolidating, setConsolidating] = useState(false);
  const [activeTab, setActiveTab] = useState<ContentTab>('notes');
  const [quizState, setQuizState] = useState<QuizState>('idle');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // Derived — whichever session the user has selected
  const content = sessions.find((s) => s.sessionId === activeSessionId) ?? null;
  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (status === 'unauthenticated' || !session) {
    return (
      <>
        <AppHeader session={null} userMenuOpen={false} onToggleMenu={() => {}} />
        <LoginScreen />
        <AppFooter />
      </>
    );
  }

  async function handleSelectSubject(subject: Subject) {
    if (subject?.id !== activeSubject?.id) {
      setActiveSubject(subject);
      setSessions([]);
      setActiveSessionId(null);
      setShowUpload(false);
      resetContent();
      // Load persisted sessions for this subject
      setLoadingSessions(true);
      try {
        const saved = await listContentSessions(subject.id);
        if (saved.length > 0) {
          setSessions(saved);
          setActiveSessionId(saved[0].sessionId);
        } else {
          setShowUpload(true);
        }
      } catch {
        setShowUpload(true);
      } finally {
        setLoadingSessions(false);
      }
    }
  }

  async function handleUploadSuccess(sessionId: string, fileName: string, notes: Notes, quiz: Quiz) {
    const newEntry: ContentSession = { id: '', sessionId, subjectId: activeSubject!.id, fileName, notes, quiz, createdAt: new Date().toISOString() };
    setSessions((prev) => {
      const exists = prev.find((s) => s.sessionId === sessionId);
      return exists ? prev : [newEntry, ...prev];
    });
    setActiveSessionId(sessionId);
    setShowUpload(false);
    setActiveTab('notes');
    setQuizState('idle');
    // Persist in the background — don't block the UI
    saveContentSession({ sessionId, subjectId: activeSubject!.id, fileName, notes, quiz }).catch(
      (err) => console.error('Failed to persist session:', err),
    );
  }

  async function handleConsolidate() {
    if (!activeSubject) return;
    setConsolidating(true);
    try {
      const { notes, quiz } = await consolidateSubject(activeSubject.id, 'all main topics', 10);
      const consolidatedId = `consolidated-${activeSubject.id}`;
      const entry: ContentSession = {
        id: '',
        sessionId: consolidatedId,
        subjectId: activeSubject.id,
        fileName: '📚 All Documents',
        notes,
        quiz,
        createdAt: new Date().toISOString(),
      };
      setSessions((prev) => {
        const filtered = prev.filter((s) => s.sessionId !== consolidatedId);
        return [entry, ...filtered];
      });
      setActiveSessionId(consolidatedId);
      setActiveTab('notes');
      setQuizState('idle');
      // Persist consolidated session
      saveContentSession({ sessionId: consolidatedId, subjectId: activeSubject.id, fileName: '📚 All Documents', notes, quiz }).catch(
        (err) => console.error('Failed to persist consolidated session:', err),
      );
    } catch (err) {
      console.error('Consolidation failed:', err);
    } finally {
      setConsolidating(false);
    }
  }

  function resetContent() {
    setQuizState('idle');
    setCurrentIndex(0);
    setAnswers({});
  }

  function startQuiz() {
    setCurrentIndex(0);
    setAnswers({});
    setQuizState('quiz');
  }

  const currentQuestion: QuizQuestion | undefined = content?.quiz[currentIndex];

  return (
    <>
      <AppHeader
        session={session}
        userMenuOpen={userMenuOpen}
        onToggleMenu={() => setUserMenuOpen((v) => !v)}
      />

      <div className="container mx-auto flex gap-8 px-4 py-8 max-w-5xl">
        <SubjectSidebar activeSubjectId={activeSubject?.id ?? null} onSelect={handleSelectSubject} />

        <main className="flex-1 min-w-0">
          {!activeSubject ? (
            <EmptySubjectState />
          ) : (
            <>
              {/* Subject header */}
              <div className="flex items-center gap-2 mb-4">
                <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: activeSubject.color }} />
                <h2 className="text-lg font-semibold">{activeSubject.name}</h2>
                <div className="ml-auto flex items-center gap-2">
                  {sessions.filter((s) => !s.sessionId.startsWith('consolidated-')).length >= 2 && (
                    <button
                      onClick={handleConsolidate}
                      disabled={consolidating}
                      className="flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/5 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                    >
                      {consolidating ? (
                        <><div className="h-3 w-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />Consolidating…</>
                      ) : (
                        <><span>📚</span>Consolidate all docs</>
                      )}
                    </button>
                  )}
                  <button
                    onClick={() => setShowUpload((v) => !v)}
                    className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
                  >
                    {showUpload && sessions.length > 0 ? 'Hide upload' : '+ Upload document'}
                  </button>
                </div>
              </div>

              {/* Document selector — shown when sessions exist */}
              {sessions.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {sessions.map((s) => (
                    <div key={s.sessionId} className="flex items-center gap-1">
                      <button
                        onClick={() => { setActiveSessionId(s.sessionId); resetContent(); setActiveTab('notes'); }}
                        className={cn(
                          'flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                          s.sessionId === activeSessionId
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground',
                        )}
                      >
                        <span>📄</span>
                        <span className="max-w-[140px] truncate">{s.fileName}</span>
                      </button>
                      <button
                        title="Delete this session"
                        onClick={async () => {
                          await deleteContentSession(s.sessionId).catch(() => {});
                          setSessions((prev) => prev.filter((x) => x.sessionId !== s.sessionId));
                          if (activeSessionId === s.sessionId) {
                            const next = sessions.find((x) => x.sessionId !== s.sessionId);
                            setActiveSessionId(next?.sessionId ?? null);
                            if (!next) setShowUpload(true);
                          }
                        }}
                        className="text-muted-foreground hover:text-destructive transition-colors text-xs"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload zone — shown when no sessions yet, or when toggled */}
              {loadingsessions ? (
                <div className="flex items-center justify-center py-16 gap-3 text-sm text-muted-foreground animate-fade-in">
                  <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  Loading saved documents…
                </div>
              ) : (sessions.length === 0 || showUpload) && (
                <div className="mb-6">
                  <UploadZone subjectId={activeSubject.id} onSuccess={handleUploadSuccess} />
                </div>
              )}

              {/* Content tabs — shown when a session is active */}
              {content && (
                <>
                  {/* Content tabs */}
                  <div className="flex gap-1 border-b border-border mb-6">
                    <TabButton
                      active={activeTab === 'notes'}
                      onClick={() => { setActiveTab('notes'); }}
                      icon={<BookOpen className="h-3.5 w-3.5" />}
                      label="Notes"
                    />
                    <TabButton
                      active={activeTab === 'quiz'}
                      onClick={() => { setActiveTab('quiz'); if (quizState === 'idle') startQuiz(); }}
                      icon={<HelpCircle className="h-3.5 w-3.5" />}
                      label={`Quiz (${content.quiz.length})`}
                    />
                    <TabButton
                      active={activeTab === 'chat'}
                      onClick={() => setActiveTab('chat')}
                      icon={<MessageCircle className="h-3.5 w-3.5" />}
                      label="Chat"
                    />
                  </div>

                  {/* Tab content */}
                  {activeTab === 'notes' && (
                    <NotesView notes={content.notes} fileName={content.fileName} onReset={() => { setSessions([]); setActiveSessionId(null); setShowUpload(true); }} />
                  )}

                  {activeTab === 'quiz' && quizState === 'quiz' && currentQuestion && (
                    <QuizCard
                      question={currentQuestion}
                      questionIndex={currentIndex}
                      totalQuestions={content.quiz.length}
                      selectedAnswer={answers[currentIndex]}
                      onAnswer={(ans) => setAnswers((p) => ({ ...p, [currentIndex]: ans }))}
                      onNext={() => {
                        if (currentIndex < content.quiz.length - 1) setCurrentIndex((i) => i + 1);
                        else setQuizState('results');
                      }}
                      onPrev={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                      isFirst={currentIndex === 0}
                      isLast={currentIndex === content.quiz.length - 1}
                      fileName={content.fileName}
                    />
                  )}

                  {activeTab === 'quiz' && quizState === 'results' && (
                    <QuizResults
                      quiz={content.quiz}
                      answers={answers}
                      fileName={content.fileName}
                      onRestart={() => { setSessions([]); setActiveSessionId(null); setShowUpload(true); }}
                      onRetake={startQuiz}
                    />
                  )}

                  {activeTab === 'chat' && (
                    <ChatPanel
                      sessionId={content.sessionId}
                      subjectId={activeSubject.id}
                      fileName={content.fileName}
                    />
                  )}
                </>
              )}
            </>
          )}
        </main>
      </div>

      <AppFooter />
    </>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function TabButton({ active, onClick, icon, label }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
        active
          ? 'border-primary text-primary'
          : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border',
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function AppHeader({ session, userMenuOpen, onToggleMenu }: {
  session: ReturnType<typeof useSession>['data'];
  userMenuOpen: boolean;
  onToggleMenu: () => void;
}) {
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-sm">
      <div className="container mx-auto flex h-14 items-center px-4 max-w-5xl">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-bold">R</div>
          <span className="font-semibold tracking-tight">RAG Quiz</span>
          <span className="hidden sm:inline-block rounded-full border border-primary/30 bg-accent px-2 py-0.5 text-[10px] font-medium text-accent-foreground">
            Groq · Llama 3.3
          </span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <a href="/architecture"
            className="hidden sm:inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors border border-border rounded-md px-2.5 py-1.5">
            Architecture
          </a>
          {session?.user ? (
            <div className="relative">
              <button onClick={onToggleMenu}
                className="flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm hover:bg-accent transition-colors">
                {session.user.image
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={session.user.image} alt="" className="h-5 w-5 rounded-full" />
                  : <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                      {(session.user.name ?? 'U')[0].toUpperCase()}
                    </div>}
                <span className="hidden sm:inline max-w-[120px] truncate">{session.user.name}</span>
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              </button>
              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-1 w-64 rounded-md border border-border bg-background shadow-md z-50 animate-fade-in">
                  <div className="px-3 py-2 border-b border-border">
                    <p className="text-xs font-medium truncate">{session.user.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{session.user.email}</p>
                  </div>
                  <div className="p-2">
                    <TelegramConnect />
                  </div>
                  <div className="border-t border-border">
                    <button onClick={() => signOut({ callbackUrl: '/' })}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors">
                      <LogOut className="h-3.5 w-3.5" />Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

function AppFooter() {
  return (
    <footer className="border-t border-border/60 py-6 text-center text-xs text-muted-foreground mt-auto">
      Built with Next.js · NestJS · Groq · Jina · Supabase pgvector
    </footer>
  );
}

function EmptySubjectState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4 text-center animate-fade-in">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-dashed border-border">
        <span className="text-2xl">📚</span>
      </div>
      <div>
        <p className="font-medium text-sm">Select a subject to get started</p>
        <p className="text-xs text-muted-foreground mt-1">
          Choose from the sidebar or create a new subject with the + button.
        </p>
      </div>
    </div>
  );
}
