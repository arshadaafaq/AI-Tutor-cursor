import { useEffect, useRef } from 'react';
import type { TranscriptMessage } from '../types';

type Props = {
  messages: TranscriptMessage[];
};

export function Transcript({ messages }: Props) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  return (
    <section className="transcript" aria-label="Conversation">
      <header className="panel-label">Conversation</header>
      <div className="transcript-scroll">
        {messages.length === 0 && (
          <p className="transcript-empty">Your chat with Ava will appear here.</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`bubble role-${m.role} ${m.partial ? 'partial' : ''}`}>
            <span className="bubble-role">
              {m.role === 'tutor' ? 'Ava' : m.role === 'you' ? 'You' : ''}
            </span>
            <p>{m.text}</p>
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </section>
  );
}
