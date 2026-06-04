'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, CheckCircle2, XCircle, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { QuizQuestion } from '@/lib/api';

interface QuizCardProps {
  question: QuizQuestion;
  questionIndex: number;
  totalQuestions: number;
  selectedAnswer?: string;
  onAnswer: (answer: string) => void;
  onNext: () => void;
  onPrev: () => void;
  isFirst: boolean;
  isLast: boolean;
  fileName: string;
}

const OPTION_COLORS = {
  correct: 'border-emerald-500 bg-emerald-50 text-emerald-900',
  wrong: 'border-red-400 bg-red-50 text-red-900',
  selected: 'border-primary bg-accent text-accent-foreground',
  default: 'border-border hover:border-primary/60 hover:bg-accent/40',
} as const;

export function QuizCard({
  question,
  questionIndex,
  totalQuestions,
  selectedAnswer,
  onAnswer,
  onNext,
  onPrev,
  isFirst,
  isLast,
  fileName,
}: QuizCardProps) {
  const [showExplanation, setShowExplanation] = useState(false);
  const progress = ((questionIndex + 1) / totalQuestions) * 100;
  const isAnswered = selectedAnswer !== undefined;
  const isCorrect = selectedAnswer === question.correctAnswer;

  function getOptionStyle(label: string) {
    if (!isAnswered) {
      return OPTION_COLORS.default;
    }
    if (label === question.correctAnswer) return OPTION_COLORS.correct;
    if (label === selectedAnswer) return OPTION_COLORS.wrong;
    return 'border-border opacity-50';
  }

  function handleNext() {
    setShowExplanation(false);
    onNext();
  }

  function handlePrev() {
    setShowExplanation(false);
    onPrev();
  }

  return (
    <div className="animate-fade-in space-y-4">
      {/* Meta bar */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <BookOpen className="h-3.5 w-3.5" />
          {fileName}
        </span>
        <Badge variant="outline">
          {questionIndex + 1} / {totalQuestions}
        </Badge>
      </div>

      <Progress value={progress} />

      {/* Question card */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg leading-snug">{question.question}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {question.options.map((option) => (
            <button
              key={option.label}
              disabled={isAnswered}
              onClick={() => onAnswer(option.label)}
              className={cn(
                'w-full flex items-start gap-3 rounded-lg border-2 px-4 py-3 text-left text-sm transition-all duration-150',
                getOptionStyle(option.label),
                !isAnswered && 'cursor-pointer',
                isAnswered && 'cursor-default',
              )}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-current text-xs font-bold">
                {option.label}
              </span>
              <span className="leading-relaxed">{option.text}</span>
              {isAnswered && option.label === question.correctAnswer && (
                <CheckCircle2 className="ml-auto h-4 w-4 shrink-0 text-emerald-600 self-center" />
              )}
              {isAnswered && option.label === selectedAnswer && option.label !== question.correctAnswer && (
                <XCircle className="ml-auto h-4 w-4 shrink-0 text-red-500 self-center" />
              )}
            </button>
          ))}
        </CardContent>
      </Card>

      {/* Result feedback */}
      {isAnswered && (
        <div
          className={cn(
            'rounded-lg border-2 px-4 py-3 text-sm animate-fade-in',
            isCorrect
              ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
              : 'border-red-300 bg-red-50 text-red-900',
          )}
        >
          <div className="flex items-center gap-2 font-semibold mb-1">
            {isCorrect ? (
              <>
                <CheckCircle2 className="h-4 w-4" /> Correct!
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4" /> Incorrect — the answer is{' '}
                <strong>{question.correctAnswer}</strong>
              </>
            )}
          </div>
          {showExplanation ? (
            <p className="text-xs leading-relaxed opacity-90">{question.explanation}</p>
          ) : (
            <button
              onClick={() => setShowExplanation(true)}
              className="text-xs underline underline-offset-2 opacity-80 hover:opacity-100"
            >
              Show explanation
            </button>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-3">
        <Button
          variant="outline"
          disabled={isFirst}
          onClick={handlePrev}
          className="gap-1"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </Button>
        <Button
          className="flex-1 gap-1"
          disabled={!isAnswered}
          onClick={handleNext}
        >
          {isLast ? 'See Results' : 'Next'}
          {!isLast && <ChevronRight className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
