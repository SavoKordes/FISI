import { useCallback, useEffect, useRef, useState } from 'react';
import type { AiError, ChatMessage, Effort } from './aiClient';

type Status = 'idle' | 'streaming' | 'error';

/** Chatverlauf mit Streaming; das SDK wird erst beim ersten Senden geladen */
export function useAiChat(system: string, effort: Effort = 'low') {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [partial, setPartial] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<AiError | null>(null);
  const ctrl = useRef<AbortController | null>(null);
  const systemRef = useRef(system);
  systemRef.current = system;

  useEffect(() => () => ctrl.current?.abort(), []);

  const run = useCallback(
    async (history: ChatMessage[]) => {
      ctrl.current?.abort();
      const c = new AbortController();
      ctrl.current = c;
      setStatus('streaming');
      setError(null);
      setPartial('');
      try {
        const { streamChat } = await import('./aiClient');
        const r = await streamChat({ system: systemRef.current, messages: history, effort, onText: setPartial, signal: c.signal });
        setMessages([...history, { role: 'assistant', content: r.text }]);
        setPartial('');
        setStatus('idle');
        return r.text;
      } catch (e) {
        const err = e as AiError;
        if (err.kind === 'aborted') return null; // stop() hat den Teiltext bereits übernommen
        setError(err);
        setStatus('error');
        return null;
      }
    },
    [effort],
  );

  const send = useCallback(
    (content: string) => {
      const history = [...messages, { role: 'user' as const, content }];
      setMessages(history);
      return run(history);
    },
    [messages, run],
  );

  /** Neuen Verlauf mit einer ersten Nachricht beginnen (alter Verlauf wird verworfen) */
  const restart = useCallback(
    (content: string) => {
      const history = [{ role: 'user' as const, content }];
      setMessages(history);
      return run(history);
    },
    [run],
  );

  /** Nach einem Fehler die letzte Anfrage wiederholen */
  const retry = useCallback(() => (messages.length ? run(messages) : Promise.resolve(null)), [messages, run]);

  const stop = useCallback(() => {
    ctrl.current?.abort();
    setMessages((m) => (partial ? [...m, { role: 'assistant', content: partial + '\n\n*(abgebrochen)*' }] : m));
    setPartial('');
    setStatus('idle');
  }, [partial]);

  const reset = useCallback(() => {
    ctrl.current?.abort();
    setMessages([]);
    setPartial('');
    setStatus('idle');
    setError(null);
  }, []);

  return { messages, partial, status, error, send, restart, retry, stop, reset, setMessages };
}
