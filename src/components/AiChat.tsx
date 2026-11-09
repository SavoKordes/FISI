import { useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '../ai/aiClient';
import type { AiError } from '../ai/aiClient';
import { Markdown } from './Markdown';
import { Button } from './ui';

/** Verlauf: Prüfling rechts, Claude links (Markdown), Streaming-Text mit Cursor */
export function ChatLog({
  messages,
  partial,
  streaming,
  hideFirstUser = false,
  userLabel = 'Du',
  aiLabel = 'Claude',
}: {
  messages: ChatMessage[];
  partial: string;
  streaming: boolean;
  hideFirstUser?: boolean;
  userLabel?: string;
  aiLabel?: string;
}) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'nearest' });
  }, [messages.length, partial.length > 0]);
  return (
    <div className="space-y-3">
      {messages.map((m, i) =>
        m.role === 'user' ? (
          hideFirstUser && i === 0 ? null : (
            <div key={i} className="ml-8 rounded-2xl rounded-tr-sm bg-sky-600 px-3 py-2 text-sm whitespace-pre-wrap text-white">
              <div className="mb-0.5 text-[11px] font-semibold opacity-80">{userLabel}</div>
              {m.content}
            </div>
          )
        ) : (
          <div key={i} className="mr-4 rounded-2xl rounded-tl-sm bg-slate-100 px-3 py-2 dark:bg-slate-800">
            <div className="mb-0.5 text-[11px] font-semibold text-violet-600 dark:text-violet-300">{aiLabel}</div>
            <Markdown className="text-sm">{m.content}</Markdown>
          </div>
        ),
      )}
      {streaming && (
        <div className="mr-4 rounded-2xl rounded-tl-sm bg-slate-100 px-3 py-2 dark:bg-slate-800">
          <div className="mb-0.5 text-[11px] font-semibold text-violet-600 dark:text-violet-300">{aiLabel}</div>
          {partial ? (
            <Markdown className="text-sm">{partial + ' ▍'}</Markdown>
          ) : (
            <div className="flex items-center gap-2 py-1 text-sm text-slate-500">
              <span className="inline-flex gap-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" />
              </span>
              denkt nach …
            </div>
          )}
        </div>
      )}
      <div ref={end} />
    </div>
  );
}

export function AiErrorBox({ error, onRetry }: { error: AiError; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
      <p>{error.message}</p>
      {onRetry && error.kind !== 'config' && error.kind !== 'auth' && (
        <Button variant="secondary" className="mt-2 min-h-9 py-1" onClick={onRetry}>
          Erneut versuchen
        </Button>
      )}
    </div>
  );
}

/** Eingabezeile; Enter sendet, Shift+Enter = Zeilenumbruch */
export function ChatInput({
  onSend,
  disabled,
  placeholder = 'Nachricht …',
  streaming,
  onStop,
}: {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
  streaming?: boolean;
  onStop?: () => void;
}) {
  const [text, setText] = useState('');
  const submit = () => {
    const t = text.trim();
    if (!t || disabled) return;
    onSend(t);
    setText('');
  };
  return (
    <div className="flex items-end gap-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        rows={2}
        placeholder={placeholder}
        className="min-h-11 flex-1 resize-y rounded-xl border border-slate-300 bg-transparent p-2.5 text-sm dark:border-slate-700"
      />
      {streaming ? (
        <Button variant="secondary" onClick={onStop}>
          Stopp
        </Button>
      ) : (
        <Button onClick={submit} disabled={disabled || !text.trim()}>
          Senden
        </Button>
      )}
    </div>
  );
}
