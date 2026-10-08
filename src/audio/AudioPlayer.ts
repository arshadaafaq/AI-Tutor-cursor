/** Queued PCM playback for Gemini Live 24 kHz 16-bit mono audio. */

export class AudioPlayer {
  private context: AudioContext | null = null;
  private nextTime = 0;
  private sources = new Set<AudioBufferSourceNode>();
  private playing = false;
  onStart?: () => void;
  onEnd?: () => void;

  async resume(): Promise<void> {
    const ctx = this.ensureContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
  }

  enqueuePcmBase64(base64: string, sampleRate = 24000): void {
    const ctx = this.ensureContext();
    const bytes = base64ToBytes(base64);
    if (bytes.length < 2) return;

    const frameCount = Math.floor(bytes.length / 2);
    const buffer = ctx.createBuffer(1, frameCount, sampleRate);
    const channel = buffer.getChannelData(0);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

    for (let i = 0; i < frameCount; i++) {
      channel[i] = view.getInt16(i * 2, true) / 32768;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);

    const now = ctx.currentTime;
    if (this.nextTime < now) {
      this.nextTime = now + 0.02;
    }

    source.start(this.nextTime);
    this.nextTime += buffer.duration;
    this.sources.add(source);

    if (!this.playing) {
      this.playing = true;
      this.onStart?.();
    }

    source.onended = () => {
      this.sources.delete(source);
      if (this.sources.size === 0) {
        this.playing = false;
        this.nextTime = 0;
        this.onEnd?.();
      }
    };
  }

  interrupt(): void {
    for (const source of this.sources) {
      try {
        source.stop();
      } catch {
        /* already stopped */
      }
    }
    this.sources.clear();
    this.nextTime = 0;
    if (this.playing) {
      this.playing = false;
      this.onEnd?.();
    }
  }

  get isPlaying(): boolean {
    return this.playing;
  }

  async close(): Promise<void> {
    this.interrupt();
    if (this.context) {
      await this.context.close();
      this.context = null;
    }
  }

  private ensureContext(): AudioContext {
    if (!this.context) {
      this.context = new AudioContext({ sampleRate: 24000 });
    }
    return this.context;
  }
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
