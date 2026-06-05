'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Icon } from '@/components/ui/icon';
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
  if (pct === 100) return { label: 'Flawless', color: 'text-danube' };
  if (pct >= 80) return { label: 'Strong', color: 'text-danube' };
  if (pct >= 60) return { label: 'Solid', color: 'text-danube/80' };
  if (pct >= 40) return { label: 'Getting there', color: 'text-muted-foreground' };
  return { label: 'Keep going', color: 'text-red-400' };
}

export function QuizResults({ quiz, answers, fileName, onRestart, onRetake }: QuizResultsProps) {
  const score = quiz.reduce((acc, q, i) => acc + (answers[i] === q.correctAnswer ? 1 : 0), 0);
  const total = quiz.length;
  const percentage = Math.round((score / total) * 100);
  const grade = getGrade(score, total);

  return (
    <div className="animate-fade-in space-y-8">
      <Card className="text-center overflow-hidden border-border shadow-sm">
        <div className="h-1.5 bg-gradient-to-r from-torea to-danube" />
        <CardContent className="py-10 space-y-5">
          <div className="flex justify-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-md bg-danube/15">
              <Icon name="emoji_events" className="text-danube" size={36} />
            </div>
          </div>
          <div>
            <div className={cn('text-5xl font-bold tabular-nums tracking-tight', grade.color)}>
              {percentage}%
            </div>
            <div className={cn('text-lg font-semibold mt-1 tracking-tight', grade.color)}>{grade.label}</div>
            <div className="text-sm text-muted-foreground mt-1 leading-relaxed">
              {score} / {total} correct
            </div>
          </div>
          <Progress value={percentage} className="h-3 max-w-xs mx-auto" />
          <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <Icon name="menu_book" className="text-danube" size={14} />
            {fileName}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
          Answer breakdown
        </h2>
        {quiz.map((question, i) => {
          const userAnswer = answers[i];
          const isCorrect = userAnswer === question.correctAnswer;
          return (
            <Card key={i} className={cn('animate-slide-in border-border shadow-sm', { 'opacity-95': !isCorrect })}>
              <CardHeader className="pb-3">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0">
                    {isCorrect ? (
                      <Icon name="check_circle" className="text-danube" size={20} filled />
                    ) : (
                      <Icon name="cancel" className="text-red-400" size={20} />
                    )}
                  </div>
                  <CardTitle className="text-sm font-medium leading-snug text-foreground">
                    {question.question}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pl-10 space-y-2">
                <div className="flex flex-wrap gap-2 text-xs">
                  {userAnswer && (
                    <Badge variant={isCorrect ? 'success' : 'destructive'}>
                      You: {userAnswer}
                    </Badge>
                  )}
                  {!isCorrect && (
                    <Badge variant="success">
                      Right answer: {question.correctAnswer}
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

      <div className="flex gap-3 pt-2">
        <Button variant="outline" className="flex-1 gap-2" onClick={onRetake}>
          <Icon name="refresh" size={16} />
          Run it again
        </Button>
        <Button className="flex-1 gap-2" onClick={onRestart}>
          <Icon name="cloud_upload" size={16} />
          Upload new doc
        </Button>
      </div>
    </div>
  );
}
