/**
 * AudioManager - procedural sound generation via Web Audio API.
 * All sounds are synthesized; no audio files needed.
 * Singleton: import `audioManager` and call methods directly.
 *
 * Sound design inspired by classic sci-fi (Alien, 2001: A Space Odyssey).
 */
class AudioManager {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private enabled = false;

  // Ambient nodes (kept alive while enabled)
  private ambientNodes: AudioNode[] = [];
  private ambientSources: (OscillatorNode | AudioBufferSourceNode)[] = [];
  private ambientGain: GainNode | null = null;

  // Thrust sound nodes (continuous while flying)
  private thrustNoise: AudioBufferSourceNode | null = null;
  private thrustOsc: OscillatorNode | null = null;
  private thrustGain: GainNode | null = null;

  private getContext(): AudioContext {
    if (!this.context) {
      this.context = new AudioContext();
      this.masterGain = this.context.createGain();
      this.masterGain.gain.value = this.enabled ? 0.6 : 0;
      this.masterGain.connect(this.context.destination);
    }

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
      return;
    }

    this.masterGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
    this.stopAmbient();
    this.stopThrust();
  }

  // Ambient space atmosphere
  // Layered: filtered noise "hull hum" + high shimmer + subtle harmonic pad.
  // No sub-bass (<100Hz) to avoid nausea.
  playAmbient(): void {
    if (this.ambientGain) return;

    const ctx = this.getContext();
    if (!this.masterGain) return;

    this.ambientGain = ctx.createGain();
    this.ambientGain.gain.value = 0;
    this.ambientGain.connect(this.masterGain);

    // High-pass filter to remove sub-bass.
    const highpass = ctx.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.value = 100;
    highpass.connect(this.ambientGain);
    this.ambientNodes.push(highpass);

    // Layer 1: filtered noise texture.
    const noiseLen = ctx.sampleRate * 4;
    const noiseBuffer = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseLen; i++) {
      noiseData[i] = Math.random() * 2 - 1;
    }

    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = noiseBuffer;
    noiseSrc.loop = true;

    const noiseBand = ctx.createBiquadFilter();
    noiseBand.type = "bandpass";
    noiseBand.frequency.value = 450;
    noiseBand.Q.value = 0.5;

    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.07;

    noiseSrc.connect(noiseBand);
    noiseBand.connect(noiseGain);
    noiseGain.connect(highpass);
    noiseSrc.start();
    this.ambientSources.push(noiseSrc);
    this.ambientNodes.push(noiseBand, noiseGain);

    // Layer 2: high shimmer with slow LFO.
    const shimmer = ctx.createOscillator();
    shimmer.type = "sine";
    shimmer.frequency.value = 2200;

    const shimmerGain = ctx.createGain();
    shimmerGain.gain.value = 0.025;

    const shimmerLfo = ctx.createOscillator();
    shimmerLfo.frequency.value = 0.12;

    const shimmerLfoGain = ctx.createGain();
    shimmerLfoGain.gain.value = 0.015;

    shimmerLfo.connect(shimmerLfoGain);
    shimmerLfoGain.connect(shimmerGain.gain);
    shimmer.connect(shimmerGain);
    shimmerGain.connect(highpass);

    shimmer.start();
    shimmerLfo.start();

    this.ambientSources.push(shimmer, shimmerLfo);
    this.ambientNodes.push(shimmerGain, shimmerLfoGain);

    // Layer 3: harmonic pad A3 + E4 with slow filter sweep.
    const padA = ctx.createOscillator();
    padA.type = "triangle";
    padA.frequency.value = 220;

    const padE = ctx.createOscillator();
    padE.type = "triangle";
    padE.frequency.value = 330;

    const padGain = ctx.createGain();
    padGain.gain.value = 0.035;

    const padFilter = ctx.createBiquadFilter();
    padFilter.type = "lowpass";
    padFilter.frequency.value = 600;
    padFilter.Q.value = 0.7;

    const padLfo = ctx.createOscillator();
    padLfo.frequency.value = 0.05;

    const padLfoGain = ctx.createGain();
    padLfoGain.gain.value = 200;

    padLfo.connect(padLfoGain);
    padLfoGain.connect(padFilter.frequency);
    padA.connect(padFilter);
    padE.connect(padFilter);
    padFilter.connect(padGain);
    padGain.connect(highpass);

    padA.start();
    padE.start();
    padLfo.start();

    this.ambientSources.push(padA, padE, padLfo);
    this.ambientNodes.push(padFilter, padGain, padLfoGain);

    this.ambientGain.gain.setTargetAtTime(0.35, ctx.currentTime, 2.0);
  }

  private stopAmbient(): void {
    const ctx = this.context;
    if (!ctx || !this.ambientGain) return;

    this.ambientGain.gain.setTargetAtTime(0, ctx.currentTime, 0.5);
    const sources = this.ambientSources;
    const nodes = this.ambientNodes;
    const gain = this.ambientGain;

    window.setTimeout(() => {
      try {
        sources.forEach((source) => source.stop());
        nodes.forEach((node) => node.disconnect());
        gain.disconnect();
      } catch {
        // Already stopped/disconnected.
      }
    }, 1200);

    this.ambientSources = [];
    this.ambientNodes = [];
    this.ambientGain = null;
  }

  playClick(): void {
    if (!this.enabled) return;

    const ctx = this.getContext();
    if (!this.masterGain) return;

    const bufferSize = Math.floor(ctx.sampleRate * 0.04);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 2200;
    filter.Q.value = 0.8;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    source.start();
  }

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

  playType(): void {
    if (!this.enabled) return;

    const ctx = this.getContext();
    if (!this.masterGain) return;

    const duration = 0.02;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = 0.9 + Math.random() * 0.3;

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

  playLaunch(): void {
    if (!this.enabled) return;

    const ctx = this.getContext();
    if (!this.masterGain) return;

    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 1.8);

    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.2, now);
    oscGain.gain.setValueAtTime(0.2, now + 1.4);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 2.0);

    osc.connect(oscGain);
    oscGain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 2.0);

    const noiseBuffer = ctx.createBuffer(
      1,
      ctx.sampleRate * 0.8,
      ctx.sampleRate,
    );
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

  playThrust(): void {
    if (!this.enabled || this.thrustGain) return;

    const ctx = this.getContext();
    if (!this.masterGain) return;

    this.thrustGain = ctx.createGain();
    this.thrustGain.gain.value = 0;
    this.thrustGain.connect(this.masterGain);

    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    this.thrustNoise = ctx.createBufferSource();
    this.thrustNoise.buffer = buffer;
    this.thrustNoise.loop = true;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.value = 1000;
    noiseFilter.Q.value = 0.7;

    this.thrustNoise.connect(noiseFilter);
    noiseFilter.connect(this.thrustGain);

    this.thrustOsc = ctx.createOscillator();
    this.thrustOsc.type = "sawtooth";
    this.thrustOsc.frequency.value = 120;

    const oscGain = ctx.createGain();
    oscGain.gain.value = 0.06;

    this.thrustOsc.connect(oscGain);
    oscGain.connect(this.thrustGain);

    this.thrustNoise.start();
    this.thrustOsc.start();

    this.thrustGain.gain.setTargetAtTime(0.15, ctx.currentTime, 0.2);
  }

  stopThrust(): void {
    if (!this.thrustGain || !this.context) return;

    this.thrustGain.gain.setTargetAtTime(0, this.context.currentTime, 0.5);
    const gain = this.thrustGain;
    const noise = this.thrustNoise;
    const osc = this.thrustOsc;

    window.setTimeout(() => {
      try {
        noise?.stop();
        osc?.stop();
        gain.disconnect();
      } catch {
        // Already stopped/disconnected.
      }
    }, 1200);

    this.thrustGain = null;
    this.thrustNoise = null;
    this.thrustOsc = null;
  }

  // Two-tone beep inspired by communicator effects.
  playCommBeep(): void {
    if (!this.enabled) return;

    const ctx = this.getContext();
    if (!this.masterGain) return;

    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    osc1.type = "sine";
    osc1.frequency.value = 800;
    const g1 = ctx.createGain();
    g1.gain.setValueAtTime(0.15, now);
    g1.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc1.connect(g1);
    g1.connect(this.masterGain);
    osc1.start(now);
    osc1.stop(now + 0.15);

    const osc2 = ctx.createOscillator();
    osc2.type = "sine";
    osc2.frequency.value = 1200;
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.001, now);
    g2.gain.setValueAtTime(0.15, now + 0.17);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
    osc2.connect(g2);
    g2.connect(this.masterGain);
    osc2.start(now + 0.17);
    osc2.stop(now + 0.32);
  }

  // Gentle ascending C-E-G arpeggio.
  playArrivalChime(): void {
    if (!this.enabled) return;

    const ctx = this.getContext();
    if (!this.masterGain) return;

    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99];

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;

      const g = ctx.createGain();
      const start = now + i * 0.09;
      g.gain.setValueAtTime(0.08, start);
      g.gain.exponentialRampToValueAtTime(0.001, start + 0.25);

      osc.connect(g);
      g.connect(this.masterGain as GainNode);
      osc.start(start);
      osc.stop(start + 0.25);
    });
  }

  playTargetLock(): void {
    if (!this.enabled) return;

    const ctx = this.getContext();
    if (!this.masterGain) return;

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = 1800;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.1, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

    osc.connect(g);
    g.connect(this.masterGain);
    osc.start();
    osc.stop(ctx.currentTime + 0.08);
  }

  playMissionStart(): void {
    if (!this.enabled) return;

    const ctx = this.getContext();
    if (!this.masterGain) return;

    const now = ctx.currentTime;
    const freqs = [1000, 1400, 1800];

    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;

      const g = ctx.createGain();
      const t = now + i * 0.05;
      g.gain.setValueAtTime(0.12, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);

      osc.connect(g);
      g.connect(this.masterGain as GainNode);
      osc.start(t);
      osc.stop(t + 0.03);
    });

    const confirm = ctx.createOscillator();
    confirm.type = "sine";
    confirm.frequency.value = 880;

    const confirmGain = ctx.createGain();
    const confirmTime = now + 0.2;
    confirmGain.gain.setValueAtTime(0.1, confirmTime);
    confirmGain.gain.exponentialRampToValueAtTime(0.001, confirmTime + 0.2);

    confirm.connect(confirmGain);
    confirmGain.connect(this.masterGain);
    confirm.start(confirmTime);
    confirm.stop(confirmTime + 0.2);
  }

  playPanelOpen(): void {
    if (!this.enabled) return;

    const ctx = this.getContext();
    if (!this.masterGain) return;

    const bufferSize = Math.floor(ctx.sampleRate * 0.15);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }

    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(400, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(2000, ctx.currentTime + 0.15);
    filter.Q.value = 1.0;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.1, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

    src.connect(filter);
    filter.connect(g);
    g.connect(this.masterGain);
    src.start();
  }

  playPanelClose(): void {
    if (!this.enabled) return;

    const ctx = this.getContext();
    if (!this.masterGain) return;

    const bufferSize = Math.floor(ctx.sampleRate * 0.15);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }

    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(2000, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.15);
    filter.Q.value = 1.0;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.1, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

    src.connect(filter);
    filter.connect(g);
    g.connect(this.masterGain);
    src.start();
  }

  playPointerLockEngage(): void {
    if (!this.enabled) return;

    const ctx = this.getContext();
    if (!this.masterGain) return;

    const bufferSize = Math.floor(ctx.sampleRate * 0.03);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }

    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 400;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.15, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03);

    src.connect(filter);
    filter.connect(g);
    g.connect(this.masterGain);
    src.start();
  }
}

export const audioManager = new AudioManager();
