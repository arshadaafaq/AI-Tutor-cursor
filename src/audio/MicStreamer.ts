/** Captures mic audio and emits 16 kHz PCM base64 chunks for Gemini Live. */

export type MicChunkHandler = (base64Pcm: string) => void;

export class MicStreamer {
  private stream: MediaStream | null = null;
  private context: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private muted = false;
  private active = false;

  onChunk: MicChunkHandler | null = null;
  onSpeakingChange: ((speaking: boolean) => void) | null = null;

  private speaking = false;
  private silenceFrames = 0;

  async start(): Promise<void> {
    if (this.active) return;

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    this.context = new AudioContext({ sampleRate: 16000 });
    this.source = this.context.createMediaStreamSource(this.stream);
    // ScriptProcessor is deprecated but widely supported and simple for prototypes.
    this.processor = this.context.createScriptProcessor(4096, 1, 1);

    this.processor.onaudioprocess = (event) => {
      if (this.muted || !this.onChunk) return;
      const input = event.inputBuffer.getChannelData(0);
      this.trackActivity(input);
      const pcm = floatTo16BitPcm(input);
      this.onChunk(bytesToBase64(pcm));
    };

    this.source.connect(this.processor);
    this.processor.connect(this.context.destination);
    this.active = true;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.stream) {
      for (const track of this.stream.getAudioTracks()) {
        track.enabled = !muted;
      }
    }
    if (muted && this.speaking) {
      this.speaking = false;
      this.onSpeakingChange?.(false);
    }
  }

  get isActive(): boolean {
    return this.active;
  }

  get isMuted(): boolean {
    return this.muted;
  }

  stop(): void {
    this.processor?.disconnect();
    this.source?.disconnect();
    this.processor = null;
    this.source = null;

    if (this.stream) {
      for (const track of this.stream.getAudioTracks()) {
        track.stop();
      }
      this.stream = null;
    }

    void this.context?.close();
    this.context = null;
    this.active = false;
    this.speaking = false;
  }

  private trackActivity(samples: Float32Array): void {
    let sum = 0;
    for (let i = 0; i < samples.length; i++) {
      sum += samples[i]! * samples[i]!;
    }
    const rms = Math.sqrt(sum / samples.length);
    const isLoud = rms > 0.015;

    if (isLoud) {
      this.silenceFrames = 0;
      if (!this.speaking) {
        this.speaking = true;
        this.onSpeakingChange?.(true);
      }
    } else if (this.speaking) {
      this.silenceFrames += 1;
      if (this.silenceFrames > 8) {
        this.speaking = false;
        this.onSpeakingChange?.(false);
      }
    }
  }
}

function floatTo16BitPcm(input: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(input.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]!));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

function bytesToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
