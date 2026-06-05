'use client';

import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Icon, IconSpinner } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import { uploadDocument, generateQuiz, generateNotes, type Quiz, type Notes } from '@/lib/api';

interface UploadZoneProps {
  subjectId: string;
  onSuccess: (sessionId: string, fileName: string, notes: Notes, quiz: Quiz) => void;
}

type UploadState = 'idle' | 'dragging' | 'uploading' | 'notes' | 'quiz' | 'done' | 'error';

const STEPS = [
  { key: 'uploading', label: 'Reading your file…' },
  { key: 'notes',     label: 'Writing notes…' },
  { key: 'quiz',      label: 'Building quiz…' },
] as const;

export function UploadZone({ subjectId, onSuccess }: UploadZoneProps) {
  const [state, setState] = useState<UploadState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [questionCount, setQuestionCount] = useState(5);
  const [topic, setTopic] = useState('');
  const [stepIndex, setStepIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    const allowed = ['application/pdf', 'text/plain'];
    if (!allowed.includes(file.type)) {
      setError('PDF or TXT only.');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError('Max file size: 20 MB.');
      return;
    }
    setError(null);
    setSelectedFile(file);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setState('idle');
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  async function handleSubmit() {
    if (!selectedFile) return;
    setError(null);
    setStepIndex(0);

    try {
      setState('uploading');
      const { sessionId, fileName } = await uploadDocument(selectedFile, subjectId);

      const focusTopic = topic.trim() || 'all main topics';

      setStepIndex(1);
      setState('notes');
      const notes = await generateNotes({ sessionId, subjectId, topic: focusTopic });

      await new Promise((r) => setTimeout(r, 3_000));

      setStepIndex(2);
      setState('quiz');
      const quiz = await generateQuiz({ sessionId, subjectId, topic: focusTopic, questionCount });

      setState('done');
      setTimeout(() => onSuccess(sessionId, fileName, notes, quiz), 400);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work. Try again.");
      setState('error');
    }
  }

  const isLoading = ['uploading', 'notes', 'quiz'].includes(state);

  return (
    <div className="animate-fade-in space-y-6">
      <Card
        className={cn(
          'border-2 border-dashed border-border transition-all duration-200 cursor-pointer shadow-sm',
          state === 'dragging' && 'border-torea bg-danube/10 scale-[1.01]',
          !isLoading && state !== 'dragging' && 'hover:border-danube hover:bg-danube/5',
          isLoading && 'pointer-events-none opacity-70',
        )}
        onClick={() => !isLoading && inputRef.current?.click()}
        onDrop={onDrop}
        onDragOver={(e) => { e.preventDefault(); setState('dragging'); }}
        onDragLeave={() => setState('idle')}
      >
        <CardContent className="flex flex-col items-center justify-center py-16 gap-5 text-center">
          {selectedFile ? (
            <>
              <div className="flex h-14 w-14 items-center justify-center rounded-md bg-danube/15">
                <Icon name="description" className="text-danube" size={28} />
              </div>
              <div>
                <p className="font-semibold text-sm text-foreground">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {(selectedFile.size / 1024).toFixed(1)} KB
                </p>
              </div>
              <Badge variant="success">Ready</Badge>
            </>
          ) : (
            <>
              <div className="flex h-14 w-14 items-center justify-center rounded-md bg-danube/15">
                <Icon name="cloud_upload" className="text-danube" size={28} />
              </div>
              <div>
                <p className="font-medium text-sm text-foreground">Drop a PDF or TXT</p>
                <p className="text-xs text-muted-foreground mt-1">
                  or <span className="text-danube underline underline-offset-2">pick a file</span> · 20 MB max
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.txt,application/pdf,text/plain"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />

      {selectedFile && !isLoading && (
        <Card className="animate-fade-in border-border">
          <CardContent className="pt-8 space-y-5">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-foreground w-36 shrink-0">Questions</label>
              <input type="range" min={1} max={20} value={questionCount}
                onChange={(e) => setQuestionCount(Number(e.target.value))}
                className="flex-1 accent-torea" />
              <span className="w-6 text-center text-sm font-bold text-danube">{questionCount}</span>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-foreground w-36 shrink-0">Topic</label>
              <input type="text" placeholder="AWS IAM roles"
                value={topic} onChange={(e) => setTopic(e.target.value)}
                className="flex-1 h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-torea" />
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <div className="animate-fade-in space-y-2">
          {STEPS.map((step, i) => (
            <div key={step.key} className="flex items-center gap-3 text-sm">
              {i < stepIndex
                ? <Icon name="check_circle" className="text-emerald-400" size={16} filled />
                : i === stepIndex
                ? <IconSpinner className="text-danube" size={16} />
                : <div className="h-4 w-4 rounded-full border border-border shrink-0" />}
              <span className={cn(i === stepIndex ? 'text-foreground' : 'text-muted-foreground/70')}>
                {step.label}
              </span>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-shilo/50 bg-shilo/10 px-4 py-3 text-sm text-foreground animate-fade-in">
          <Icon name="error" className="text-danube" size={16} />
          {error}
        </div>
      )}

      <Button className="w-full gap-2" size="lg" disabled={!selectedFile || isLoading} onClick={handleSubmit}>
        {isLoading
          ? <><IconSpinner size={16} />Working…</>
          : <><Icon name="auto_awesome" size={16} />Build notes & quiz</>}
      </Button>
    </div>
  );
}
