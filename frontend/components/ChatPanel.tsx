'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Bot, User, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api';

interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatPanelProps {
  sessionId: string;
  subjectId: string;
  fileName: string;
}

export function ChatPanel({ sessionId, subjectId, fileName }: ChatPanelProps) {
  const [history, setHistory] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, loading]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;

    const userTurn: ChatTurn = { role: 'user', content: text };
    setHistory((h) => [...h, userTurn]);
    setInput('');
    setLoading(true);

    try {
      const { reply } = await apiClient<{ reply: string }>('/chat/message', {
        method: 'POST',
        body: JSON.stringify({ sessionId, subjectId, message: text, history }),
      });
      setHistory((h) => [...h, { role: 'assistant', content: reply }]);
    } catch {
      setHistory((h) => [
        ...h,
        { role: 'assistant', content: "Couldn't get an answer. Try again." },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className="flex flex-col h-[580px] rounded-md border border-border overflow-hidden shadow-sm">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-border bg-danube/8 shrink-0">
        <Bot className="h-4 w-4 text-danube" />
        <span className="text-sm font-medium text-foreground">Ask your doc</span>
        <span className="text-xs text-muted-foreground ml-1 truncate">— {fileName}</span>
        {history.length > 0 && (
          <button
            onClick={() => setHistory([])}
            className="ml-auto flex items-center gap-1 text-xs text-danube hover:text-danube transition-colors"
          >
            <RotateCcw className="h-3 w-3" />
            Start over
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-4">
        {history.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center animate-fade-in">
            <div className="flex h-12 w-12 items-center justify-center rounded-md bg-danube/15">
              <Bot className="h-6 w-6 text-danube" />
            </div>
            <div>
              <p className="text-sm font-medium text-danube">Ask anything in this doc</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Answers come straight from your upload.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center mt-2">
              {[
                "What's the main idea?",
                'Hit me with 3 bullets',
                'What should I memorize?',
              ].map((s) => (
                <button
                  key={s}
                  onClick={() => { setInput(s); inputRef.current?.focus(); }}
                  className="text-xs rounded-md border border-border px-3 py-1.5 text-foreground hover:bg-danube/10 hover:border-danube transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {history.map((turn, i) => (
          <div
            key={i}
            className={cn(
              'flex gap-2.5 animate-fade-in',
              turn.role === 'user' ? 'flex-row-reverse' : 'flex-row',
            )}
          >
            <div
              className={cn(
                'shrink-0 flex h-7 w-7 items-center justify-center rounded-full mt-0.5',
                turn.role === 'user'
                  ? 'bg-torea text-white'
                  : 'bg-danube/10 border border-border',
              )}
            >
              {turn.role === 'user'
                ? <User className="h-3.5 w-3.5" />
                : <Bot className="h-3.5 w-3.5 text-danube" />}
            </div>

            <div
              className={cn(
                'max-w-[78%] rounded-md px-4 py-2.5 text-sm leading-relaxed',
                turn.role === 'user'
                  ? 'bg-torea text-white rounded-tr-sm'
                  : 'bg-card border border-border text-foreground rounded-tl-sm',
              )}
            >
              {turn.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-2.5 animate-fade-in">
            <div className="shrink-0 flex h-7 w-7 items-center justify-center rounded-full bg-danube/10 border border-border">
              <Bot className="h-3.5 w-3.5 text-danube" />
            </div>
            <div className="bg-card border border-border rounded-md rounded-tl-sm px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-danube" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="shrink-0 border-t border-border px-4 py-4">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="What tripped you up in this chapter?"
            disabled={loading}
            className="flex-1 h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-torea disabled:opacity-50"
          />
          <Button
            size="sm"
            disabled={!input.trim() || loading}
            onClick={sendMessage}
            className="h-10 w-10 p-0 shrink-0"
          >
            {loading
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
