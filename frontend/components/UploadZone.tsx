'use client';

import { useState, useRef, useCallback } from 'react';
import { UploadCloud, FileText, Loader2, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { uploadDocument, generateQuiz, generateNotes, type Quiz, type Notes } from '@/lib/api';

interface UploadZoneProps {
  subjectId: string;
  onSuccess: (sessionId: string, fileName: string, notes: Notes, quiz: Quiz) => void;
}

type UploadState = 'idle' | 'dragging' | 'uploading' | 'notes' | 'quiz' | 'done' | 'error';

const STEPS = [
  { key: 'uploading', label: 'Parsing & chunking document…' },
  { key: 'notes',     label: 'Generating notes with Gemini…' },
  { key: 'quiz',      label: 'Generating quiz with Gemini…' },
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
      setError('Only PDF and plain-text (.txt) files are supported.');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError('File exceeds the 20 MB limit.');
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

      setStepIndex(2);
      setState('quiz');
      const quiz = await generateQuiz({ sessionId, subjectId, topic: focusTopic, questionCount });

      setState('done');
      setTimeout(() => onSuccess(sessionId, fileName, notes, quiz), 400);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setState('error');
    }
  }

  const isLoading = ['uploading', 'notes', 'quiz'].includes(state);

  return (
    <div className="animate-fade-in space-y-4">
      <Card
        className={cn(
          'border-2 border-dashed transition-all duration-200 cursor-pointer',
          state === 'dragging' && 'border-primary bg-accent scale-[1.01]',
          !isLoading && state !== 'dragging' && 'hover:border-primary/60 hover:bg-accent/40',
          isLoading && 'pointer-events-none opacity-70',
        )}
        onClick={() => !isLoading && inputRef.current?.click()}
        onDrop={onDrop}
        onDragOver={(e) => { e.preventDefault(); setState('dragging'); }}
        onDragLeave={() => setState('idle')}
      >
        <CardContent className="flex flex-col items-center justify-center py-12 gap-4 text-center">
          {selectedFile ? (
            <>
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent">
                <FileText className="h-7 w-7 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {(selectedFile.size / 1024).toFixed(1)} KB
                </p>
              </div>
              <Badge variant="success">Ready to ingest</Badge>
            </>
          ) : (
            <>
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent">
                <UploadCloud className="h-7 w-7 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">Drag & drop your PDF or TXT here</p>
                <p className="text-xs text-muted-foreground mt-1">
                  or <span className="text-primary underline underline-offset-2">browse files</span> · max 20 MB
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
        <Card className="animate-fade-in">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium w-36 shrink-0">Quiz questions</label>
              <input type="range" min={1} max={20} value={questionCount}
                onChange={(e) => setQuestionCount(Number(e.target.value))}
                className="flex-1 accent-violet-600" />
              <span className="w-6 text-center text-sm font-bold text-primary">{questionCount}</span>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium w-36 shrink-0">Focus topic</label>
              <input type="text" placeholder="e.g. photosynthesis (optional)"
                value={topic} onChange={(e) => setTopic(e.target.value)}
                className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <div className="animate-fade-in space-y-2">
          {STEPS.map((step, i) => (
            <div key={step.key} className="flex items-center gap-3 text-sm">
              {i < stepIndex
                ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                : i === stepIndex
                ? <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0" />
                : <div className="h-4 w-4 rounded-full border border-border shrink-0" />}
              <span className={cn(i === stepIndex ? 'text-foreground' : 'text-muted-foreground')}>
                {step.label}
              </span>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive animate-fade-in">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <Button className="w-full gap-2" size="lg" disabled={!selectedFile || isLoading} onClick={handleSubmit}>
        {isLoading
          ? <><Loader2 className="h-4 w-4 animate-spin" />Processing…</>
          : <><Sparkles className="h-4 w-4" />Generate Notes & Quiz</>}
      </Button>
    </div>
  );
}
