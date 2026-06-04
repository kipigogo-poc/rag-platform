'use client';

import { BookOpen, Lightbulb, List, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Notes } from '@/lib/api';

interface NotesViewProps {
  notes: Notes;
  fileName: string;
  onReset: () => void;
}

export function NotesView({ notes, fileName, onReset }: NotesViewProps) {
  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold leading-snug">{notes.title}</h2>
          <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
            <BookOpen className="h-3.5 w-3.5" />
            {fileName}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onReset}>
          New Upload
        </Button>
      </div>

      {/* Summary */}
      <Card className="border-primary/20 bg-accent/30">
        <CardContent className="pt-5 pb-5">
          <p className="text-sm leading-relaxed">{notes.summary}</p>
        </CardContent>
      </Card>

      {/* Key Points */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-amber-500" />
            Key Points
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <ul className="space-y-2">
            {notes.keyPoints.map((point, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm">
                <ChevronRight className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Sections */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          <List className="h-3.5 w-3.5" />
          Detailed Notes
        </div>
        {notes.sections.map((section, i) => (
          <Card key={i} className="animate-slide-in" style={{ animationDelay: `${i * 60}ms` }}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">
                  {String(i + 1).padStart(2, '0')}
                </Badge>
                {section.heading}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-sm leading-relaxed text-muted-foreground">{section.content}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
