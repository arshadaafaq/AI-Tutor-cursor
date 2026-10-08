import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import { TutorAvatar } from './components/TutorAvatar';
import { Transcript } from './components/Transcript';
import { VisualizationPanel } from './components/VisualizationPanel';
import { TutorSession } from './live/TutorSession';
import { buildClientFallbackSvg } from './viz/fallbackSvg';
import type {
  TranscriptMessage,
  TutorState,
  VisualizationData,
  VizToolArgs,
} from './types';

type SessionConfig = {
  model: string;
  systemInstruction: string;
  voiceName: string;
};

let msgCounter = 0;
const nextId = () => `m-${++msgCounter}-${Date.now()}`;

export default function App() {
  const [state, setState] = useState<TutorState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [messages, setMessages] = useState<TranscriptMessage[]>([]);
  const [visualization, setVisualization] = useState<VisualizationData | null>(null);

  const sessionRef = useRef<TutorSession | null>(null);
  const configRef = useRef<SessionConfig | null>(null);
  const inputPartialId = useRef<string | null>(null);
  const outputPartialId = useRef<string | null>(null);

  const appendOrUpdate = useCallback(
    (role: 'tutor' | 'you', text: string, finished: boolean, partialRef: MutableRefObject<string | null>) => {
      if (!text) return;

      setMessages((prev) => {
        const next = [...prev];
        if (partialRef.current) {
          const idx = next.findIndex((m) => m.id === partialRef.current);
          if (idx >= 0) {
            const existing = next[idx]!;
            // Live API sends transcription chunks; append deltas while the turn is open.
            const merged = existing.partial
              ? `${existing.text}${text}`
              : text;
            next[idx] = {
              ...existing,
              text: merged.trimStart(),
              partial: !finished,
            };
            if (finished) partialRef.current = null;
            return next;
          }
        }

        const id = nextId();
        if (!finished) partialRef.current = id;
        else partialRef.current = null;

        next.push({ id, role, text: text.trim(), partial: !finished });
        return next;
      });
    },
    [],
  );

  const handleVisualization = useCallback(async (args: VizToolArgs) => {
    const quick = buildClientFallbackSvg(args);
    setVisualization({
      title: args.title,
      caption: args.caption,
      analogy: args.analogy,
      svg: quick,
      loading: true,
    });

    try {
      const res = await fetch('/api/visualize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(args),
      });
      if (!res.ok) throw new Error('Visualization request failed');
      const data = (await res.json()) as VisualizationData;
      setVisualization({ ...data, loading: false });
      return { ok: true, message: 'Visualization is now on the student screen.' };
    } catch {
      setVisualization({
        title: args.title,
        caption: args.caption,
        analogy: args.analogy,
        svg: quick,
        loading: false,
      });
      return { ok: true, message: 'Simple visualization is on the student screen.' };
    }
  }, []);

  const startSession = useCallback(async () => {
    setError(null);
    setState('connecting');

    try {
      if (!configRef.current) {
        const cfgRes = await fetch('/api/session-config');
        if (!cfgRes.ok) throw new Error('Could not load tutor config');
        configRef.current = (await cfgRes.json()) as SessionConfig;
      }

      const tokenRes = await fetch('/api/token', { method: 'POST' });
      const tokenBody = await tokenRes.json();
      if (!tokenRes.ok) {
        throw new Error(tokenBody.detail || tokenBody.error || 'Token failed');
      }

      const session = new TutorSession(
        {
          onState: setState,
          onError: (msg) => {
            setError(msg);
            setState('error');
          },
          onInputTranscript: (text, finished) =>
            appendOrUpdate('you', text, finished, inputPartialId),
          onOutputTranscript: (text, finished) =>
            appendOrUpdate('tutor', text, finished, outputPartialId),
          onVisualization: handleVisualization,
        },
        {
          model: tokenBody.model || configRef.current.model,
          systemInstruction: configRef.current.systemInstruction,
          voiceName: configRef.current.voiceName,
        },
      );

      sessionRef.current = session;
      await session.connect(tokenBody.token);
      setConnected(true);
      setMicOn(true);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Could not start the tutoring session';
      setError(message);
      setState('error');
      setConnected(false);
    }
  }, [appendOrUpdate, handleVisualization]);

  const endSession = useCallback(async () => {
    await sessionRef.current?.close();
    sessionRef.current = null;
    setConnected(false);
    setState('idle');
  }, []);

  const toggleMic = useCallback(() => {
    if (!sessionRef.current) return;
    const next = !micOn;
    setMicOn(next);
    sessionRef.current.setMicMuted(!next);
  }, [micOn]);

  const stopSpeaking = useCallback(() => {
    sessionRef.current?.interrupt();
  }, []);

  useEffect(() => {
    return () => {
      void sessionRef.current?.close();
    };
  }, []);

  return (
    <div className="app-shell">
      <div className="atmosphere" aria-hidden="true" />

      <header className="top-bar">
        <div className="brand">
          <span className="brand-mark">Ava</span>
          <span className="brand-sub">Your personal tutor</span>
        </div>
        {error && <p className="error-banner">{error}</p>}
      </header>

      <main className="stage">
        <div className="tutor-column">
          <TutorAvatar state={state} />

          <div className="controls">
            {!connected ? (
              <button
                type="button"
                className="btn primary"
                onClick={() => void startSession()}
                disabled={state === 'connecting'}
              >
                {state === 'connecting' ? 'Connecting…' : 'Start session'}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className={`btn mic ${micOn ? 'on' : 'off'}`}
                  onClick={toggleMic}
                  aria-pressed={micOn}
                >
                  {micOn ? 'Mic on' : 'Mic off'}
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={stopSpeaking}
                  disabled={state !== 'speaking'}
                >
                  Stop talking
                </button>
                <button type="button" className="btn ghost danger" onClick={() => void endSession()}>
                  End
                </button>
              </>
            )}
          </div>

          <p className="hint">
            {connected
              ? 'Talk naturally — Ava listens, explains simply, and shows diagrams as you learn.'
              : 'Sit down with Ava. Use your microphone for a live one-to-one tutoring conversation.'}
          </p>
        </div>

        <aside className="side-column">
          <VisualizationPanel visualization={visualization} />
          <Transcript messages={messages} />
        </aside>
      </main>
    </div>
  );
}
