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
      setError("Token didn't generate. Try again.");
      setState('idle');
    }
  }

  function copy() {
    navigator.clipboard.writeText(`/link ${token}`);
    setState('copied');
    setTimeout(() => setState('shown'), 2000);
  }

  return (
    <div className="rounded-md border border-border bg-card p-6 space-y-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="shrink-0 flex h-9 w-9 items-center justify-center rounded-md bg-danube/15">
          <svg viewBox="0 0 24 24" className="h-5 w-5 fill-danube">
            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.87 13.47l-2.99-.937c-.648-.204-.66-.648.136-.96l11.67-4.5c.54-.194 1.017.131.84.957z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-danube">Telegram</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            Chat with your docs on the go.
          </p>
        </div>
      </div>

      {state === 'idle' && (
        <Button variant="outline" size="sm" className="w-full gap-2" onClick={generate}>
          <Send className="h-3.5 w-3.5" />
          Get link token
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
              Open{' '}
              <a
                href="https://t.me/YourBotUsername"
                target="_blank"
                rel="noreferrer"
                className="text-danube underline underline-offset-2 inline-flex items-center gap-0.5 hover:text-danube transition-colors"
              >
                your bot <ExternalLink className="h-2.5 w-2.5" />
              </a>{' '}
              and send:
            </p>
            <div className="flex items-center gap-2 rounded-md bg-danube/8 border border-border px-3 py-2">
              <code className="text-xs flex-1 font-mono truncate text-foreground">/link {token}</code>
              <button
                onClick={copy}
                className="shrink-0 text-danube hover:text-danube transition-colors"
                title="Copy command"
              >
                {state === 'copied'
                  ? <Check className="h-3.5 w-3.5 text-emerald-500" />
                  : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Expires in 15 min.{' '}
            <button onClick={generate} className="text-danube underline hover:text-danube transition-colors">
              Grab another
            </button>
          </p>
        </div>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
