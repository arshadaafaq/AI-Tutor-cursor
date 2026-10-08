import {
  GoogleGenAI,
  Modality,
  type LiveServerMessage,
  type Session,
  type FunctionDeclaration,
} from '@google/genai';
import { AudioPlayer } from '../audio/AudioPlayer';
import { MicStreamer } from '../audio/MicStreamer';
import type { TutorState, VizToolArgs } from '../types';

export type SessionHandlers = {
  onState: (state: TutorState) => void;
  onError: (message: string) => void;
  onInputTranscript: (text: string, finished: boolean) => void;
  onOutputTranscript: (text: string, finished: boolean) => void;
  onVisualization: (args: VizToolArgs) => Promise<{ ok: boolean; message?: string }>;
};

const SHOW_VISUALIZATION: FunctionDeclaration = {
  name: 'show_visualization',
  description:
    'Show a simple educational visualization on the student’s screen for the current concept. Call this whenever you teach or explain a topic.',
  parametersJsonSchema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      concept: { type: 'string' },
      visual_type: {
        type: 'string',
        enum: [
          'flowchart',
          'comparison',
          'cycle',
          'parts',
          'timeline',
          'equation',
          'hierarchy',
          'simple_scene',
        ],
      },
      elements: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            label: { type: 'string' },
            detail: { type: 'string' },
          },
          required: ['label'],
        },
      },
      analogy: { type: 'string' },
      caption: { type: 'string' },
    },
    required: ['title', 'concept', 'visual_type', 'elements', 'caption'],
  },
};

export class TutorSession {
  private session: Session | null = null;
  private player = new AudioPlayer();
  private mic = new MicStreamer();
  private handlers: SessionHandlers;
  private systemInstruction: string;
  private voiceName: string;
  private model: string;
  private userSpeaking = false;
  private closing = false;

  constructor(
    handlers: SessionHandlers,
    options: { systemInstruction: string; voiceName?: string; model: string },
  ) {
    this.handlers = handlers;
    this.systemInstruction = options.systemInstruction;
    this.voiceName = options.voiceName ?? 'Kore';
    this.model = options.model;
  }

  async connect(ephemeralToken: string): Promise<void> {
    this.closing = false;
    this.handlers.onState('connecting');

    await this.player.resume();
    this.player.onStart = () => {
      if (!this.userSpeaking) this.handlers.onState('speaking');
    };
    this.player.onEnd = () => {
      if (!this.closing && !this.player.isPlaying) {
        this.handlers.onState(this.mic.isMuted ? 'idle' : 'listening');
      }
    };

    const ai = new GoogleGenAI({
      apiKey: ephemeralToken,
      apiVersion: 'v1alpha',
      httpOptions: { apiVersion: 'v1alpha' },
    });

    this.session = await ai.live.connect({
      model: this.model,
      config: {
        responseModalities: [Modality.AUDIO],
        systemInstruction: this.systemInstruction,
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: this.voiceName },
          },
        },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        tools: [{ functionDeclarations: [SHOW_VISUALIZATION] }],
      },
      callbacks: {
        onopen: () => {
          /* setup complete arrives via message */
        },
        onmessage: (message) => {
          void this.handleMessage(message);
        },
        onerror: (e) => {
          this.handlers.onError(e.message || 'Live connection error');
          this.handlers.onState('error');
        },
        onclose: () => {
          if (!this.closing) {
            this.handlers.onState('idle');
          }
        },
      },
    });

    this.mic.onChunk = (base64) => {
      this.session?.sendRealtimeInput({
        audio: {
          data: base64,
          mimeType: 'audio/pcm;rate=16000',
        },
      });
    };

    this.mic.onSpeakingChange = (speaking) => {
      this.userSpeaking = speaking;
      if (speaking) {
        this.handlers.onState('listening');
      } else if (!this.player.isPlaying) {
        this.handlers.onState('thinking');
      }
    };

    await this.mic.start();
    this.handlers.onState('listening');

    // Kick off the tutor greeting.
    this.session.sendClientContent({
      turns: [
        {
          role: 'user',
          parts: [
            {
              text: 'Please greet me briefly and invite me to start learning. Keep it warm and short.',
            },
          ],
        },
      ],
      turnComplete: true,
    });
  }

  setMicMuted(muted: boolean): void {
    this.mic.setMuted(muted);
    if (muted) {
      this.session?.sendRealtimeInput({ audioStreamEnd: true });
      if (!this.player.isPlaying) this.handlers.onState('idle');
    } else if (!this.player.isPlaying) {
      this.handlers.onState('listening');
    }
  }

  interrupt(): void {
    this.player.interrupt();
    // Client content messages interrupt current model generation.
    this.session?.sendClientContent({ turns: [], turnComplete: true });
    this.handlers.onState(this.mic.isMuted ? 'idle' : 'listening');
  }

  async close(): Promise<void> {
    this.closing = true;
    this.mic.stop();
    this.player.interrupt();
    try {
      this.session?.close();
    } catch {
      /* ignore */
    }
    this.session = null;
    await this.player.close();
    this.handlers.onState('idle');
  }

  private async handleMessage(message: LiveServerMessage): Promise<void> {
    if (message.toolCall?.functionCalls?.length) {
      this.handlers.onState('thinking');
      const responses = [];
      for (const call of message.toolCall.functionCalls) {
        if (call.name === 'show_visualization') {
          const args = (call.args ?? {}) as VizToolArgs;
          try {
            const result = await this.handlers.onVisualization(args);
            responses.push({
              id: call.id,
              name: call.name,
              response: {
                success: result.ok,
                message: result.message ?? 'Visualization shown to the student.',
              },
            });
          } catch (err) {
            responses.push({
              id: call.id,
              name: call.name!,
              response: {
                success: false,
                message: err instanceof Error ? err.message : 'Failed',
              },
            });
          }
        } else {
          responses.push({
            id: call.id,
            name: call.name!,
            response: { success: false, message: 'Unknown tool' },
          });
        }
      }
      this.session?.sendToolResponse({ functionResponses: responses });
    }

    const content = message.serverContent;
    if (!content) return;

    if (content.interrupted) {
      this.player.interrupt();
      this.handlers.onState(this.userSpeaking ? 'listening' : 'idle');
    }

    if (content.inputTranscription?.text) {
      this.handlers.onInputTranscript(
        content.inputTranscription.text,
        Boolean(content.inputTranscription.finished),
      );
    }

    if (content.outputTranscription?.text) {
      this.handlers.onOutputTranscript(
        content.outputTranscription.text,
        Boolean(content.outputTranscription.finished),
      );
    }

    const parts = content.modelTurn?.parts ?? [];
    for (const part of parts) {
      const data = part.inlineData?.data;
      if (data) {
        this.player.enqueuePcmBase64(data, 24000);
      }
    }

    if (content.turnComplete && !this.player.isPlaying && !this.userSpeaking) {
      this.handlers.onState(this.mic.isMuted ? 'idle' : 'listening');
    }
  }
}
