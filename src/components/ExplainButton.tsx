import { useEffect, useState } from 'react';
import { useAiChat } from '../ai/useAiChat';
import { useAiReady } from '../ai/useAi';
import { EXPLAIN_CALC, EXPLAIN_CARD } from '../ai/prompts';
import { AiErrorBox, ChatInput, ChatLog } from './AiChat';
import { IconSpark } from './icons';
import { Button, Modal } from './ui';

function ExplainDialog({ kind, context, onClose }: { kind: 'card' | 'calc'; context: string; onClose: () => void }) {
  const chat = useAiChat(kind === 'card' ? EXPLAIN_CARD : EXPLAIN_CALC, 'low');
  const { restart } = chat;
  // Erklärung sofort beim Öffnen anfordern (Abbruch beim Schließen übernimmt der Hook)
  useEffect(() => {
    restart(context);
  }, []);
  return (
    <Modal open onClose={onClose} title={kind === 'card' ? 'Erklär mir das' : 'Rechenweg erklären'} wide>
      <ChatLog messages={chat.messages} partial={chat.partial} streaming={chat.status === 'streaming'} hideFirstUser />
      {chat.error && (
        <div className="mt-3">
          <AiErrorBox error={chat.error} onRetry={chat.retry} />
        </div>
      )}
      <div className="mt-3">
        <ChatInput
          onSend={(t) => chat.send(t)}
          disabled={chat.status === 'streaming' || chat.messages.length === 0}
          streaming={chat.status === 'streaming'}
          onStop={chat.stop}
          placeholder="Rückfrage stellen …"
        />
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="text-xs text-slate-500">KI-Antworten können Fehler enthalten – im Zweifel mit Musterlösung und Unterricht abgleichen.</p>
        <Button variant="ghost" onClick={onClose}>
          Schließen
        </Button>
      </div>
    </Modal>
  );
}

/** Button „Erklär mir das“ – erscheint nur, wenn der KI-Tutor eingerichtet ist */
export function ExplainButton({ kind, getContext, className = '' }: { kind: 'card' | 'calc'; getContext: () => string; className?: string }) {
  const ready = useAiReady();
  const [open, setOpen] = useState(false);
  const [context, setContext] = useState('');
  if (!ready) return null;
  return (
    <>
      <Button
        variant="secondary"
        className={`min-h-9 py-1 text-violet-700 dark:text-violet-300 ${className}`}
        onClick={(e) => {
          e.stopPropagation();
          setContext(getContext());
          setOpen(true);
        }}
      >
        <IconSpark className="h-4 w-4" /> {kind === 'card' ? 'Erklär mir das' : 'Rechenweg erklären'}
      </Button>
      {open && <ExplainDialog kind={kind} context={context} onClose={() => setOpen(false)} />}
    </>
  );
}
