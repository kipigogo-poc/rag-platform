'use client';

import { useState } from 'react';
import { Send, Copy, Check, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api';

export function TelegramConnect() {
  const [state, setState] = useState<'idle' | 'loading' | 'shown' | 'copied'>('idle');
  const [token, setToken] = useState('');
  const [error, setError] = useState('');

  async function generate() {
    setState('loading');
    setError('');
    try {
      const { token: t } = await apiClient<{ token: string; expiresInSeconds: number }>(
        '/telegram/link-token',
        { method: 'POST' },
      );
      setToken(t);
      setState('shown');
    } catch {
      setError('Failed to generate token. Please try again.');
      setState('idle');
    }
  }

  function copy() {
    navigator.clipboard.writeText(`/link ${token}`);
    setState('copied');
    setTimeout(() => setState('shown'), 2000);
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-start gap-3">
        {/* Telegram icon (SVG) */}
        <div className="shrink-0 flex h-9 w-9 items-center justify-center rounded-lg bg-[#229ED9]/10">
          <svg viewBox="0 0 24 24" className="h-5 w-5 fill-[#229ED9]">
            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.87 13.47l-2.99-.937c-.648-.204-.66-.648.136-.96l11.67-4.5c.54-.194 1.017.131.84.957z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold">Connect Telegram</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Chat with your documents on Telegram — ask questions and get AI answers on the go.
          </p>
        </div>
      </div>

      {state === 'idle' && (
        <Button variant="outline" size="sm" className="w-full gap-2" onClick={generate}>
          <Send className="h-3.5 w-3.5" />
          Generate link token
        </Button>
      )}

      {state === 'loading' && (
        <Button variant="outline" size="sm" className="w-full" disabled>
          Generating…
        </Button>
      )}

      {(state === 'shown' || state === 'copied') && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">
              1. Open{' '}
              <a
                href="https://t.me/YourBotUsername"
                target="_blank"
                rel="noreferrer"
                className="text-primary underline underline-offset-2 inline-flex items-center gap-0.5"
              >
                your bot on Telegram <ExternalLink className="h-2.5 w-2.5" />
              </a>{' '}
              and send this command:
            </p>
            <div className="flex items-center gap-2 rounded-md bg-accent/60 border border-border px-3 py-2">
              <code className="text-xs flex-1 font-mono truncate">/link {token}</code>
              <button
                onClick={copy}
                className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                title="Copy command"
              >
                {state === 'copied'
                  ? <Check className="h-3.5 w-3.5 text-emerald-500" />
                  : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Token expires in 15 minutes.{' '}
            <button onClick={generate} className="underline hover:text-foreground transition-colors">
              Generate a new one
            </button>
          </p>
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
