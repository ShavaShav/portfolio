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

  // Ambient ship atmosphere
  // Layered: low-mid hull hum + subtle vent texture + gentle harmonic drone.
  // Keep very little extreme highs to avoid fatigue over long sessions.
  playAmbient(): void {
    if (this.ambientGain) return;

    const ctx = this.getContext();
    if (!this.masterGain) return;

    this.ambientGain = ctx.createGain();
    this.ambientGain.gain.value = 0;
    this.ambientGain.connect(this.masterGain);

    // Shape the spectrum into a calm cockpit band.
    const highpass = ctx.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.value = 55;

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = 1200;
    lowpass.Q.value = 0.45;

    highpass.connect(lowpass);
    lowpass.connect(this.ambientGain);
    this.ambientNodes.push(highpass, lowpass);

    // Layer 1: hull/engine bed.
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
    noiseBand.frequency.value = 180;
    noiseBand.Q.value = 0.7;

    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.06;

    const noiseLfo = ctx.createOscillator();
    noiseLfo.type = "sine";
    noiseLfo.frequency.value = 0.06;
    const noiseLfoGain = ctx.createGain();
    noiseLfoGain.gain.value = 55;

    noiseLfo.connect(noiseLfoGain);
    noiseLfoGain.connect(noiseBand.frequency);
    noiseSrc.connect(noiseBand);
    noiseBand.connect(noiseGain);
    noiseGain.connect(highpass);
    noiseSrc.start();
    noiseLfo.start();
    this.ambientSources.push(noiseSrc, noiseLfo);
    this.ambientNodes.push(noiseBand, noiseGain, noiseLfoGain);

    // Layer 2: soft filtered vent noise.
    const ventSrc = ctx.createBufferSource();
    ventSrc.buffer = noiseBuffer;
    ventSrc.loop = true;

    const ventBand = ctx.createBiquadFilter();
    ventBand.type = "bandpass";
    ventBand.frequency.value = 520;
    ventBand.Q.value = 1.1;

    const ventGain = ctx.createGain();
    ventGain.gain.value = 0.016;

    const ventLfo = ctx.createOscillator();
    ventLfo.type = "triangle";
    ventLfo.frequency.value = 0.09;
    const ventLfoGain = ctx.createGain();
    ventLfoGain.gain.value = 80;

    ventLfo.connect(ventLfoGain);
    ventLfoGain.connect(ventBand.frequency);
    ventSrc.connect(ventBand);
    ventBand.connect(ventGain);
    ventGain.connect(highpass);

    ventSrc.start();
    ventLfo.start();

    this.ambientSources.push(ventSrc, ventLfo);
    this.ambientNodes.push(ventBand, ventGain, ventLfoGain);

    // Layer 3: harmonic bed (low-mid) with tiny movement.
    const padA = ctx.createOscillator();
    padA.type = "sine";
    padA.frequency.value = 98;

    const padE = ctx.createOscillator();
    padE.type = "triangle";
    padE.frequency.value = 147;

    const padGain = ctx.createGain();
    padGain.gain.value = 0.03;

    const padFilter = ctx.createBiquadFilter();
    padFilter.type = "lowpass";
    padFilter.frequency.value = 420;
    padFilter.Q.value = 0.5;

    const padLfo = ctx.createOscillator();
    padLfo.frequency.value = 0.04;

    const padLfoGain = ctx.createGain();
    padLfoGain.gain.value = 110;

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

    this.ambientGain.gain.setTargetAtTime(0.28, ctx.currentTime, 2.4);
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

  playLaunchStatusOk(): void {
    if (!this.enabled) return;

    const ctx = this.getContext();
    if (!this.masterGain) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(1120, now);
    osc.frequency.exponentialRampToValueAtTime(920, now + 0.09);

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 1500;
    filter.Q.value = 1.2;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.095);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  playLaunchCountdown(): void {
    if (!this.enabled) return;

    const ctx = this.getContext();
    if (!this.masterGain) return;

    const now = ctx.currentTime;
    const beepOffsets = [0, 0.42, 0.84];
    const beepFrequencies = [520, 620, 760];

    beepOffsets.forEach((offset, index) => {
      const t = now + offset;
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(beepFrequencies[index], t);
      osc.frequency.exponentialRampToValueAtTime(beepFrequencies[index] * 0.92, t + 0.16);

      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 1300;
      filter.Q.value = 1.1;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.13, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain as GainNode);
      osc.start(t);
      osc.stop(t + 0.16);
    });
  }

  playLaunchIgnition(): void {
    if (!this.enabled) return;

    const ctx = this.getContext();
    if (!this.masterGain) return;

    const now = ctx.currentTime;

    // Main warp core: rapid acceleration, then long deceleration tail.
    const core = ctx.createOscillator();
    core.type = "sawtooth";
    core.frequency.setValueAtTime(58, now);
    core.frequency.exponentialRampToValueAtTime(940, now + 0.95);
    core.frequency.exponentialRampToValueAtTime(120, now + 3.15);

    const coreGain = ctx.createGain();
    coreGain.gain.setValueAtTime(0.0001, now);
    coreGain.gain.linearRampToValueAtTime(0.3, now + 0.12);
    coreGain.gain.setValueAtTime(0.24, now + 1.1);
    coreGain.gain.exponentialRampToValueAtTime(0.001, now + 3.2);

    const coreFilter = ctx.createBiquadFilter();
    coreFilter.type = "lowpass";
    coreFilter.frequency.setValueAtTime(360, now);
    coreFilter.frequency.exponentialRampToValueAtTime(1700, now + 1.0);
    coreFilter.frequency.exponentialRampToValueAtTime(280, now + 3.2);
    coreFilter.Q.value = 0.55;

    core.connect(coreFilter);
    coreFilter.connect(coreGain);
    coreGain.connect(this.masterGain);
    core.start(now);
    core.stop(now + 3.25);

    // Harmonic body that thickens the warp tone.
    const harmonic = ctx.createOscillator();
    harmonic.type = "triangle";
    harmonic.frequency.setValueAtTime(90, now);
    harmonic.frequency.exponentialRampToValueAtTime(440, now + 0.85);
    harmonic.frequency.exponentialRampToValueAtTime(80, now + 3.05);

    const harmonicGain = ctx.createGain();
    harmonicGain.gain.setValueAtTime(0.0001, now);
    harmonicGain.gain.linearRampToValueAtTime(0.18, now + 0.1);
    harmonicGain.gain.setValueAtTime(0.13, now + 0.95);
    harmonicGain.gain.exponentialRampToValueAtTime(0.001, now + 3.1);

    const harmonicFilter = ctx.createBiquadFilter();
    harmonicFilter.type = "bandpass";
    harmonicFilter.frequency.setValueAtTime(220, now);
    harmonicFilter.frequency.exponentialRampToValueAtTime(860, now + 0.9);
    harmonicFilter.frequency.exponentialRampToValueAtTime(180, now + 3.1);
    harmonicFilter.Q.value = 0.8;

    harmonic.connect(harmonicFilter);
    harmonicFilter.connect(harmonicGain);
    harmonicGain.connect(this.masterGain);
    harmonic.start(now);
    harmonic.stop(now + 3.15);

    const noiseBuffer = ctx.createBuffer(
      1,
      Math.floor(ctx.sampleRate * 3.4),
      ctx.sampleRate,
    );
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      const t = i / noiseData.length;
      noiseData[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 0.62);
    }

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.setValueAtTime(95, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(980, now + 1.0);
    noiseFilter.frequency.exponentialRampToValueAtTime(140, now + 3.35);
    noiseFilter.Q.value = 0.75;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.0001, now);
    noiseGain.gain.linearRampToValueAtTime(0.37, now + 0.08);
    noiseGain.gain.setValueAtTime(0.26, now + 1.1);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 3.4);

    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.masterGain);
    noiseSource.start(now);

    // Low-end warp rumble to keep the launch feeling heavy.
    const sub = ctx.createOscillator();
    sub.type = "sine";
    sub.frequency.setValueAtTime(34, now);
    sub.frequency.exponentialRampToValueAtTime(66, now + 1.1);
    sub.frequency.exponentialRampToValueAtTime(38, now + 3.2);

    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0.0001, now);
    subGain.gain.linearRampToValueAtTime(0.2, now + 0.16);
    subGain.gain.setValueAtTime(0.17, now + 1.1);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 3.3);

    sub.connect(subGain);
    subGain.connect(this.masterGain);
    sub.start(now);
    sub.stop(now + 3.3);

    // Deceleration whistle as we settle into local space.
    const decel = ctx.createOscillator();
    decel.type = "sine";
    decel.frequency.setValueAtTime(280, now + 1.5);
    decel.frequency.exponentialRampToValueAtTime(72, now + 3.35);

    const decelGain = ctx.createGain();
    decelGain.gain.setValueAtTime(0.0001, now + 1.45);
    decelGain.gain.linearRampToValueAtTime(0.06, now + 1.58);
    decelGain.gain.exponentialRampToValueAtTime(0.001, now + 3.4);

    decel.connect(decelGain);
    decelGain.connect(this.masterGain);
    decel.start(now + 1.45);
    decel.stop(now + 3.45);
  }

  playLaunch(): void {
    if (!this.enabled) return;

    const ctx = this.getContext();
    this.playLaunchCountdown();
    window.setTimeout(() => {
      if (!this.enabled || !this.context || this.context !== ctx) return;
      this.playLaunchIgnition();
    }, 1150);
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

  playBlasterShot(): void {
    if (!this.enabled) return;

    const ctx = this.getContext();
    if (!this.masterGain) return;

    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(1400, now);
    osc.frequency.exponentialRampToValueAtTime(500, now + 0.09);

    const toneGain = ctx.createGain();
    toneGain.gain.setValueAtTime(0.11, now);
    toneGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    const toneFilter = ctx.createBiquadFilter();
    toneFilter.type = "bandpass";
    toneFilter.frequency.value = 1300;
    toneFilter.Q.value = 1.2;

    osc.connect(toneFilter);
    toneFilter.connect(toneGain);
    toneGain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.1);

    const crackleBuffer = ctx.createBuffer(
      1,
      Math.floor(ctx.sampleRate * 0.04),
      ctx.sampleRate,
    );
    const crackleData = crackleBuffer.getChannelData(0);
    for (let i = 0; i < crackleData.length; i++) {
      crackleData[i] = (Math.random() * 2 - 1) * (1 - i / crackleData.length);
    }

    const crackle = ctx.createBufferSource();
    crackle.buffer = crackleBuffer;
    const crackleFilter = ctx.createBiquadFilter();
    crackleFilter.type = "highpass";
    crackleFilter.frequency.value = 1800;
    const crackleGain = ctx.createGain();
    crackleGain.gain.value = 0.07;

    crackle.connect(crackleFilter);
    crackleFilter.connect(crackleGain);
    crackleGain.connect(this.masterGain);
    crackle.start(now);
  }

  playAsteroidSplit(): void {
    if (!this.enabled) return;

    const ctx = this.getContext();
    if (!this.masterGain) return;

    const now = ctx.currentTime;

    [0, 0.045].forEach((offset) => {
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(220 + Math.random() * 120, now + offset);
      osc.frequency.exponentialRampToValueAtTime(110, now + offset + 0.1);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.08, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.12);

      osc.connect(gain);
      gain.connect(this.masterGain as GainNode);
      osc.start(now + offset);
      osc.stop(now + offset + 0.12);
    });
  }

  playExplosion(): void {
    if (!this.enabled) return;

    const ctx = this.getContext();
    if (!this.masterGain) return;

    const now = ctx.currentTime;
    const bufferSize = Math.floor(ctx.sampleRate * 0.45);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      const t = i / bufferSize;
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 1.2);
    }

    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.setValueAtTime(260, now);
    band.frequency.exponentialRampToValueAtTime(120, now + 0.45);
    band.Q.value = 0.8;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    src.connect(band);
    band.connect(gain);
    gain.connect(this.masterGain);
    src.start(now);
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
