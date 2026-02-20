/**
 * AudioManager — procedural sound generation via Web Audio API.
 * All sounds are synthesized; no audio files are needed.
 * Singleton: import `audioManager` and call methods directly.
 */
class AudioManager {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private enabled: boolean = false;

  // Ambient drone nodes (kept alive while enabled)
  private ambientOscA: OscillatorNode | null = null;
  private ambientOscB: OscillatorNode | null = null;
  private ambientGain: GainNode | null = null;

  private getContext(): AudioContext {
    if (!this.context) {
      this.context = new AudioContext();
      this.masterGain = this.context.createGain();
      this.masterGain.gain.value = this.enabled ? 0.6 : 0;
      this.masterGain.connect(this.context.destination);
    }
    // Resume if suspended (browser autoplay policy)
    if (this.context.state === "suspended") {
      void this.context.resume();
    }
    return this.context;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    const ctx = this.getContext();
    if (!this.masterGain) return;

    if (enabled) {
      if (ctx.state === "suspended") void ctx.resume();
      this.masterGain.gain.setTargetAtTime(0.6, ctx.currentTime, 0.1);
      this.playAmbient();
    } else {
      this.masterGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
      this.stopAmbient();
    }
  }

  // ─── Ambient drone ───────────────────────────────────────────────────────────

  playAmbient(): void {
    if (this.ambientOscA) return; // already running
    const ctx = this.getContext();
    if (!this.masterGain) return;

    this.ambientGain = ctx.createGain();
    this.ambientGain.gain.value = 0;
    this.ambientGain.connect(this.masterGain);

    // Two detuned sine waves for a rich space-drone feel
    this.ambientOscA = ctx.createOscillator();
    this.ambientOscA.type = "sine";
    this.ambientOscA.frequency.value = 55; // A1

    this.ambientOscB = ctx.createOscillator();
    this.ambientOscB.type = "sine";
    this.ambientOscB.frequency.value = 57.5; // slightly detuned

    // LFO for slow tremolo
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.18;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.15;
    lfo.connect(lfoGain);
    lfoGain.connect(this.ambientGain.gain);

    this.ambientOscA.connect(this.ambientGain);
    this.ambientOscB.connect(this.ambientGain);

    this.ambientOscA.start();
    this.ambientOscB.start();
    lfo.start();

    // Fade in
    this.ambientGain.gain.setTargetAtTime(0.35, ctx.currentTime, 1.5);
  }

  private stopAmbient(): void {
    const ctx = this.context;
    if (!ctx || !this.ambientGain) return;

    this.ambientGain.gain.setTargetAtTime(0, ctx.currentTime, 0.5);
    const gain = this.ambientGain;

    window.setTimeout(() => {
      try {
        this.ambientOscA?.stop();
        this.ambientOscB?.stop();
        gain.disconnect();
      } catch {
        // Already stopped
      }
      this.ambientOscA = null;
      this.ambientOscB = null;
      this.ambientGain = null;
    }, 1000);
  }

  // ─── UI Click ────────────────────────────────────────────────────────────────

  playClick(): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!this.masterGain) return;

    const bufferSize = ctx.sampleRate * 0.05; // 50 ms
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 1800;
    filter.Q.value = 0.8;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    source.start();
  }

  // ─── Transition whoosh ───────────────────────────────────────────────────────

  playTransition(): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!this.masterGain) return;

    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(2000, ctx.currentTime + 0.3);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(800, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(3000, ctx.currentTime + 0.3);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.35);
  }

  // ─── Terminal keystroke ──────────────────────────────────────────────────────

  playType(): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!this.masterGain) return;

    const duration = 0.02; // 20 ms
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    // Vary pitch slightly per keystroke
    const playbackRate = 0.9 + Math.random() * 0.3;
    source.playbackRate.value = playbackRate;

    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 2000;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    source.start();
  }

  // ─── Launch ──────────────────────────────────────────────────────────────────

  playLaunch(): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!this.masterGain) return;

    const now = ctx.currentTime;

    // Rising tone
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(80, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 1.8);

    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.2, now);
    oscGain.gain.setValueAtTime(0.2, now + 1.4);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 2.0);

    osc.connect(oscGain);
    oscGain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 2.0);

    // White noise burst
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.8, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = Math.random() * 2 - 1;
    }

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.setValueAtTime(400, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(2000, now + 0.8);
    noiseFilter.Q.value = 0.5;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.3, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.masterGain);
    noiseSource.start(now);
  }
}

export const audioManager = new AudioManager();
