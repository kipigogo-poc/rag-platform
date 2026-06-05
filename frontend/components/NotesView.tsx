'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import type { Notes } from '@/lib/api';

interface NotesViewProps {
  notes: Notes;
  fileName: string;
  onReset: () => void;
}

export function NotesView({ notes, fileName, onReset }: NotesViewProps) {
  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h2 className="text-2xl font-bold leading-snug tracking-tight text-danube">{notes.title}</h2>
          <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
            <Icon name="menu_book" className="text-danube" size={14} />
            {fileName}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onReset}>
          Upload another
        </Button>
      </div>

      <Card className="border-danube/25 bg-danube/5 shadow-sm">
        <CardContent className="py-8">
          <p className="text-sm leading-relaxed text-foreground">{notes.summary}</p>
        </CardContent>
      </Card>

      <Card className="border-border shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2 text-danube">
            <Icon name="lightbulb" className="text-danube" size={16} />
            Key takeaways
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <ul className="space-y-3">
            {notes.keyPoints.map((point, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-foreground leading-relaxed">
                <Icon name="chevron_right" className="text-danube mt-0.5" size={16} />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          <Icon name="list" className="text-danube" size={14} />
          Deep dive
        </div>
        {notes.sections.map((section, i) => (
          <Card key={i} className="animate-slide-in border-border shadow-sm" style={{ animationDelay: `${i * 60}ms` }}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-danube">
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono border-shilo/50">
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
