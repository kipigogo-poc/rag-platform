'use client';

import { CheckCircle2, XCircle, RefreshCcw, UploadCloud, Trophy, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { Quiz } from '@/lib/api';

interface QuizResultsProps {
  quiz: Quiz;
  answers: Record<number, string>;
  fileName: string;
  onRestart: () => void;
  onRetake: () => void;
}

function getGrade(score: number, total: number): { label: string; color: string } {
  const pct = (score / total) * 100;
  if (pct === 100) return { label: 'Perfect!', color: 'text-emerald-600' };
  if (pct >= 80) return { label: 'Excellent', color: 'text-emerald-600' };
  if (pct >= 60) return { label: 'Good', color: 'text-amber-600' };
  if (pct >= 40) return { label: 'Fair', color: 'text-orange-600' };
  return { label: 'Keep studying', color: 'text-red-600' };
}

export function QuizResults({ quiz, answers, fileName, onRestart, onRetake }: QuizResultsProps) {
  const score = quiz.reduce((acc, q, i) => acc + (answers[i] === q.correctAnswer ? 1 : 0), 0);
  const total = quiz.length;
  const percentage = Math.round((score / total) * 100);
  const grade = getGrade(score, total);

  return (
    <div className="animate-fade-in space-y-6">
      {/* Score hero */}
      <Card className="text-center overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-violet-500 to-indigo-500" />
        <CardContent className="pt-8 pb-8 space-y-4">
          <div className="flex justify-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-violet-100 to-indigo-100">
              <Trophy className="h-9 w-9 text-primary" />
            </div>
          </div>
          <div>
            <div className={cn('text-5xl font-bold tabular-nums', grade.color)}>
              {percentage}%
            </div>
            <div className={cn('text-lg font-semibold mt-1', grade.color)}>{grade.label}</div>
            <div className="text-sm text-muted-foreground mt-0.5">
              {score} / {total} correct
            </div>
          </div>
          <Progress value={percentage} className="h-3 max-w-xs mx-auto" />
          <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <BookOpen className="h-3.5 w-3.5" />
            {fileName}
          </div>
        </CardContent>
      </Card>

      {/* Answer review */}
      <div className="space-y-3">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
          Answer Review
        </h2>
        {quiz.map((question, i) => {
          const userAnswer = answers[i];
          const isCorrect = userAnswer === question.correctAnswer;
          return (
            <Card key={i} className={cn('animate-slide-in', { 'opacity-95': !isCorrect })}>
              <CardHeader className="pb-2">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0">
                    {isCorrect ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                  </div>
                  <CardTitle className="text-sm font-medium leading-snug">
                    {question.question}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pl-10 space-y-2">
                <div className="flex flex-wrap gap-2 text-xs">
                  {userAnswer && (
                    <Badge variant={isCorrect ? 'success' : 'destructive'}>
                      Your answer: {userAnswer}
                    </Badge>
                  )}
                  {!isCorrect && (
                    <Badge variant="success">
                      Correct: {question.correctAnswer}
                    </Badge>
                  )}
                  {!userAnswer && (
                    <Badge variant="secondary">Skipped</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {question.explanation}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <Button variant="outline" className="flex-1 gap-2" onClick={onRetake}>
          <RefreshCcw className="h-4 w-4" />
          Retake Quiz
        </Button>
        <Button className="flex-1 gap-2" onClick={onRestart}>
          <UploadCloud className="h-4 w-4" />
          New Document
        </Button>
      </div>
    </div>
  );
}
