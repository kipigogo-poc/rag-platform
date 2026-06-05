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
import { ASSETS } from '@/lib/assets';

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
        <div className="h-6 w-6 rounded-full border-2 border-torea border-t-transparent animate-spin" />
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

      <div className="container mx-auto flex gap-8 px-4 py-10 max-w-5xl">
        <SubjectSidebar activeSubjectId={activeSubject?.id ?? null} onSelect={handleSelectSubject} />

        <main className="flex-1 min-w-0">
          {!activeSubject ? (
            <EmptySubjectState />
          ) : (
            <>
              {/* Subject header */}
              <div className="flex items-center gap-3 mb-6">
                <span className="h-3 w-3 rounded-full shrink-0 ring-2 ring-white shadow-sm" style={{ backgroundColor: activeSubject.color }} />
                <h2 className="text-xl font-semibold tracking-tight text-danube">{activeSubject.name}</h2>
                <div className="ml-auto flex items-center gap-3">
                  {sessions.filter((s) => !s.sessionId.startsWith('consolidated-')).length >= 2 && (
                    <button
                      onClick={handleConsolidate}
                      disabled={consolidating}
                      className="flex items-center gap-1.5 rounded-md border border-danube/40 bg-danube/10 px-3 py-1.5 text-xs font-medium text-danube hover:bg-danube/20 transition-colors disabled:opacity-50"
                    >
                      {consolidating ? (
                        <><div className="h-3 w-3 rounded-full border-2 border-torea border-t-transparent animate-spin" />Consolidating…</>
                      ) : (
                        <><span>📚</span>Merge all docs</>
                      )}
                    </button>
                  )}
                  <button
                    onClick={() => setShowUpload((v) => !v)}
                    className="text-xs text-danube hover:text-torea underline underline-offset-2 transition-colors"
                  >
                    {showUpload && sessions.length > 0 ? 'Hide upload' : '+ Add document'}
                  </button>
                </div>
              </div>

              {/* Document selector — shown when sessions exist */}
              {sessions.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-6">
                  {sessions.map((s) => (
                    <div key={s.sessionId} className="flex items-center gap-1">
                      <button
                        onClick={() => { setActiveSessionId(s.sessionId); resetContent(); setActiveTab('notes'); }}
                        className={cn(
                          'flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
                          s.sessionId === activeSessionId
                            ? 'border-danube bg-danube/15 text-danube'
                            : 'border-border text-muted-foreground hover:border-danube hover:text-foreground',
                        )}
                      >
                        <span>📄</span>
                        <span className="max-w-[140px] truncate">{s.fileName}</span>
                      </button>
                      <button
                        title="Remove"
                        onClick={async () => {
                          await deleteContentSession(s.sessionId).catch(() => {});
                          setSessions((prev) => prev.filter((x) => x.sessionId !== s.sessionId));
                          if (activeSessionId === s.sessionId) {
                            const next = sessions.find((x) => x.sessionId !== s.sessionId);
                            setActiveSessionId(next?.sessionId ?? null);
                            if (!next) setShowUpload(true);
                          }
                        }}
                        className="text-muted-foreground/70 hover:text-red-600 transition-colors text-xs px-1"
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
                  <div className="h-4 w-4 rounded-full border-2 border-torea border-t-transparent animate-spin" />
                  Loading docs…
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
                  <div className="flex gap-1 border-b border-border mb-8">
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
        'flex items-center gap-1.5 px-5 py-3 text-sm font-medium border-b-2 transition-colors -mb-px',
        active
          ? 'border-danube text-danube'
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
    <header className="parallax-hero sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-sm shadow-sm">
      <div
        className="parallax-layer absolute inset-0 -z-20 opacity-60"
        style={{ backgroundImage: `url(${ASSETS.images.headerTexture})` }}
        aria-hidden
      />
      <div className="parallax-overlay -z-10 opacity-90" aria-hidden />
      <div className="relative container mx-auto flex h-16 items-center px-4 max-w-5xl">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-torea text-white text-xs font-bold tracking-tight shadow-sm">R</div>
          <span className="font-semibold tracking-tight text-danube">RAG Quiz</span>
          <span className="hidden sm:inline-block rounded-md border border-danube/30 bg-danube/10 px-2.5 py-0.5 text-[10px] font-medium text-danube">
            Groq · Llama 3.3
          </span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <a href="/architecture"
            className="hidden sm:inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-torea transition-colors border border-border rounded-md px-3 py-1.5 hover:border-danube">
            Architecture
          </a>
          {session?.user ? (
            <div className="relative">
              <button onClick={onToggleMenu}
                className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:border-danube hover:bg-danube/5 transition-colors">
                {session.user.image
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={session.user.image} alt="" className="h-5 w-5 rounded-md" />
                  : <div className="flex h-5 w-5 items-center justify-center rounded-md bg-torea text-white text-[10px] font-bold">
                      {(session.user.name ?? 'U')[0].toUpperCase()}
                    </div>}
                <span className="hidden sm:inline max-w-[120px] truncate">{session.user.name}</span>
                <ChevronDown className="h-3 w-3 text-danube" />
              </button>
              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-1 w-64 rounded-md border border-border bg-card shadow-sm z-50 animate-fade-in">
                  <div className="px-4 py-3 border-b border-border">
                    <p className="text-xs font-medium truncate text-foreground">{session.user.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{session.user.email}</p>
                  </div>
                  <div className="p-3">
                    <TelegramConnect />
                  </div>
                  <div className="border-t border-border">
                    <button onClick={() => signOut({ callbackUrl: '/' })}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-400 hover:bg-red-950/40 transition-colors">
                      <LogOut className="h-3.5 w-3.5" />Log out
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
    <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground mt-auto leading-relaxed">
      Built with Next.js · NestJS · Groq · Jina · Supabase pgvector
    </footer>
  );
}

function EmptySubjectState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-6 text-center animate-fade-in">
      <div className="flex h-16 w-16 items-center justify-center rounded-md border border-border bg-danube/5 shadow-sm">
        <span className="text-2xl">📚</span>
      </div>
      <div>
        <p className="font-medium text-sm text-danube tracking-tight">Pick a subject</p>
        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
          Use the sidebar — or hit + to make one.
        </p>
      </div>
    </div>
  );
}
