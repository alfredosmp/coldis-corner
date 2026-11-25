/**
 * Procedural Ambient Sound Mixer built on Web Audio API.
 * Includes distinct Lo-Fi study beat, rain, babbling water droplets, deep forest wind, birds, warm brown noise, and gentle piano.
 */

export type AmbientChannelId =
  | 'lofi'
  | 'rain'
  | 'water'
  | 'forest'
  | 'birds'
  | 'whitenoise'
  | 'piano';

export interface AmbientChannelInfo {
  id: AmbientChannelId;
  label: string;
  description: string;
}

export const AMBIENT_CHANNELS: AmbientChannelInfo[] = [
  { id: 'lofi', label: 'Lo-Fi suave', description: 'Acordes cálidos y pulso relajado' },
  { id: 'rain', label: 'Lluvia suave', description: 'Gotas constantes en la ventana' },
  { id: 'water', label: 'Agua fluyendo', description: 'Arroyo cristalino y burbujeo' },
  { id: 'forest', label: 'Selva y brisa', description: 'Viento profundo entre árboles' },
  { id: 'birds', label: 'Pájaros suaves', description: 'Cantos delicados de mañana' },
  { id: 'whitenoise', label: 'Ruido café', description: 'Sonido suave para concentrarse' },
  { id: 'piano', label: 'Piano clásico', description: 'Acordes lentos y tranquilos' },
];

interface ActiveChannelHandle {
  gainNode: GainNode;
  stop: () => void;
}

class AmbientAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private channels = new Map<AmbientChannelId, ActiveChannelHandle>();
  private volumes: Record<AmbientChannelId, number> = {
    lofi: 0,
    rain: 0,
    water: 0,
    forest: 0,
    birds: 0,
    whitenoise: 0,
    piano: 0,
  };
  private muted = false;

  // Optional custom local MP3 player
  private customAudioEl: HTMLAudioElement | null = null;
  private customAudioUrl: string | null = null;
  private customVolume = 0.6;

  private ensureContext(): { ctx: AudioContext; masterGain: GainNode } {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 1;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return { ctx: this.ctx, masterGain: this.masterGain! };
  }

  private createNoiseBuffer(ctx: AudioContext, type: 'pink' | 'brown' | 'vinyl'): AudioBuffer {
    const length = ctx.sampleRate * 4;
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate);

    for (let ch = 0; ch < 2; ch++) {
      const output = buffer.getChannelData(ch);
      if (type === 'vinyl') {
        for (let i = 0; i < length; i++) {
          const r = Math.random();
          // Soft subtle vinyl hiss + occasional tiny dusty pop
          output[i] =
            (Math.random() * 2 - 1) * 0.008 +
            (r > 0.9994 ? (Math.random() * 2 - 1) * 0.22 : 0);
        }
      } else if (type === 'brown') {
        let lastOut = 0;
        for (let i = 0; i < length; i++) {
          const white = Math.random() * 2 - 1;
          output[i] = (lastOut + 0.02 * white) / 1.02;
          lastOut = output[i];
          output[i] *= 2.8;
        }
      } else {
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (let i = 0; i < length; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.96900 * b2 + white * 0.1538520;
          b3 = 0.86650 * b3 + white * 0.3104856;
          b4 = 0.55000 * b4 + white * 0.5329522;
          b5 = -0.7616 * b5 - white * 0.0168980;
          output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.06;
          b6 = white * 0.115926;
        }
      }
    }
    return buffer;
  }

  private startChannel(id: AmbientChannelId, volume: number): ActiveChannelHandle {
    const { ctx, masterGain } = this.ensureContext();
    const channelGain = ctx.createGain();
    channelGain.gain.setValueAtTime(0.0001, ctx.currentTime);
    channelGain.gain.linearRampToValueAtTime(volume * 0.52, ctx.currentTime + 0.3);
    channelGain.connect(masterGain);

    const cleanups: (() => void)[] = [];

    if (id === 'lofi') {
      // Cozy Lo-Fi Chillhop: soft Rhodes chords + muted dusty kick/hat + subtle vinyl crackle
      const vinyl = ctx.createBufferSource();
      vinyl.buffer = this.createNoiseBuffer(ctx, 'vinyl');
      vinyl.loop = true;
      const vinylLp = ctx.createBiquadFilter();
      vinylLp.type = 'lowpass';
      vinylLp.frequency.value = 3400;
      const vinylGain = ctx.createGain();
      vinylGain.gain.value = 0.35;
      vinyl.connect(vinylLp);
      vinylLp.connect(vinylGain);
      vinylGain.connect(channelGain);
      vinyl.start();

      // Jazz lo-fi chords (Dm9 -> G13 -> Cmaj9 -> A7b9-ish soft voicing)
      const chords = [
        [146.83, 220.0, 261.63, 329.63, 392.0],
        [196.0, 246.94, 293.66, 349.23, 440.0],
        [130.81, 196.0, 246.94, 293.66, 329.63],
        [174.61, 220.0, 261.63, 329.63, 392.0],
      ];

      // 72 BPM -> 1 eighth-note step = ~416ms
      let step = 0;
      let chordIndex = 0;

      const tick = () => {
        if (!this.ctx || !this.channels.has('lofi')) return;
        const now = ctx.currentTime;
        const beatInBar = step % 8;

        // Warm electric piano chord on beat 0 of every bar
        if (beatInBar === 0) {
          const chord = chords[chordIndex % chords.length];
          chordIndex += 1;
          chord.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const lp = ctx.createBiquadFilter();
            const env = ctx.createGain();
            osc.type = idx === 0 ? 'sine' : 'triangle';
            // Subtle warm lo-fi detune
            osc.detune.value = (idx % 2 === 0 ? 1 : -1) * 4;
            osc.frequency.setValueAtTime(freq, now + idx * 0.03);

            lp.type = 'lowpass';
            lp.frequency.setValueAtTime(780, now);

            const st = now + idx * 0.03;
            env.gain.setValueAtTime(0.0001, st);
            env.gain.linearRampToValueAtTime(idx === 0 ? 0.12 : 0.055, st + 0.08);
            env.gain.exponentialRampToValueAtTime(0.0001, st + 3.1);

            osc.connect(lp);
            lp.connect(env);
            env.connect(channelGain);
            osc.start(st);
            osc.stop(st + 3.2);
          });
        }

        // Soft muted lo-fi kick on steps 0 & 5
        if (beatInBar === 0 || beatInBar === 5) {
          const kick = ctx.createOscillator();
          const kEnv = ctx.createGain();
          kick.type = 'sine';
          kick.frequency.setValueAtTime(105, now);
          kick.frequency.exponentialRampToValueAtTime(42, now + 0.12);
          kEnv.gain.setValueAtTime(0.16, now);
          kEnv.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
          kick.connect(kEnv);
          kEnv.connect(channelGain);
          kick.start(now);
          kick.stop(now + 0.2);
        }

        // Gentle brushed snare/rim on step 4
        if (beatInBar === 4) {
          const hat = ctx.createBufferSource();
          hat.buffer = this.createNoiseBuffer(ctx, 'pink');
          const bp = ctx.createBiquadFilter();
          bp.type = 'bandpass';
          bp.frequency.value = 1350;
          const hEnv = ctx.createGain();
          hEnv.gain.setValueAtTime(0.08, now);
          hEnv.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);
          hat.connect(bp);
          bp.connect(hEnv);
          hEnv.connect(channelGain);
          hat.start(now);
          hat.stop(now + 0.12);
        }

        step += 1;
      };

      tick();
      const timer = window.setInterval(tick, 416);
      cleanups.push(() => {
        window.clearInterval(timer);
        try {
          vinyl.stop();
        } catch {
          // ignore
        }
      });
    } else if (id === 'rain') {
      const src = ctx.createBufferSource();
      src.buffer = this.createNoiseBuffer(ctx, 'pink');
      src.loop = true;

      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 450;

      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 3200;

      src.connect(hp);
      hp.connect(lp);
      lp.connect(channelGain);
      src.start();
      cleanups.push(() => {
        try {
          src.stop();
        } catch {
          // ignore
        }
      });
    } else if (id === 'water') {
      // Bright, bubbly babbling brook with playful liquid water droplets (clearly distinct from forest!)
      const stream = ctx.createBufferSource();
      stream.buffer = this.createNoiseBuffer(ctx, 'pink');
      stream.loop = true;

      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1150;
      bp.Q.value = 2.4;

      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 1.35;
      lfoGain.gain.value = 420;
      lfo.connect(lfoGain);
      lfoGain.connect(bp.frequency);

      const streamGain = ctx.createGain();
      streamGain.gain.value = 0.55;
      stream.connect(bp);
      bp.connect(streamGain);
      streamGain.connect(channelGain);
      stream.start();
      lfo.start();

      // Gentle random crystalline water bubble pops
      const bubble = () => {
        if (!this.ctx || !this.channels.has('water')) return;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        const startFreq = 420 + Math.random() * 520;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(startFreq, now);
        osc.frequency.exponentialRampToValueAtTime(startFreq * 1.9, now + 0.065);
        env.gain.setValueAtTime(0.0001, now);
        env.gain.linearRampToValueAtTime(0.055, now + 0.015);
        env.gain.exponentialRampToValueAtTime(0.0001, now + 0.075);
        osc.connect(env);
        env.connect(channelGain);
        osc.start(now);
        osc.stop(now + 0.085);
      };

      const bubbleTimer = window.setInterval(() => {
        if (Math.random() > 0.35) bubble();
      }, 360);

      cleanups.push(() => {
        window.clearInterval(bubbleTimer);
        try {
          stream.stop();
          lfo.stop();
        } catch {
          // ignore
        }
      });
    } else if (id === 'forest') {
      // Deep warm forest wind swelling slowly through canopy + soft night/jungle cricket shimmer
      const wind = ctx.createBufferSource();
      wind.buffer = this.createNoiseBuffer(ctx, 'brown');
      wind.loop = true;

      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 420;
      lp.Q.value = 1.4;

      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 0.09;
      lfoGain.gain.value = 220;
      lfo.connect(lfoGain);
      lfoGain.connect(lp.frequency);

      wind.connect(lp);
      lp.connect(channelGain);
      wind.start();
      lfo.start();

      // Subtle distant rhythmic forest cicada/cricket trill
      const trill = () => {
        if (!this.ctx || !this.channels.has('forest')) return;
        const now = ctx.currentTime;
        for (let k = 0; k < 3; k++) {
          const osc = ctx.createOscillator();
          const env = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(4150 + Math.random() * 140, now + k * 0.075);
          env.gain.setValueAtTime(0.0001, now + k * 0.075);
          env.gain.linearRampToValueAtTime(0.016, now + k * 0.075 + 0.02);
          env.gain.exponentialRampToValueAtTime(0.0001, now + k * 0.075 + 0.065);
          osc.connect(env);
          env.connect(channelGain);
          osc.start(now + k * 0.075);
          osc.stop(now + k * 0.075 + 0.07);
        }
      };

      const trillTimer = window.setInterval(() => {
        if (Math.random() > 0.35) trill();
      }, 2100);

      cleanups.push(() => {
        window.clearInterval(trillTimer);
        try {
          wind.stop();
          lfo.stop();
        } catch {
          // ignore
        }
      });
    } else if (id === 'whitenoise') {
      const src = ctx.createBufferSource();
      src.buffer = this.createNoiseBuffer(ctx, 'brown');
      src.loop = true;

      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 750;

      src.connect(lp);
      lp.connect(channelGain);
      src.start();
      cleanups.push(() => {
        try {
          src.stop();
        } catch {
          // ignore
        }
      });
    } else if (id === 'birds') {
      const bed = ctx.createBufferSource();
      bed.buffer = this.createNoiseBuffer(ctx, 'pink');
      bed.loop = true;
      const bedFilter = ctx.createBiquadFilter();
      bedFilter.type = 'bandpass';
      bedFilter.frequency.value = 1200;
      const bedGain = ctx.createGain();
      bedGain.gain.value = 0.09;
      bed.connect(bedFilter);
      bedFilter.connect(bedGain);
      bedGain.connect(channelGain);
      bed.start();

      const chirp = () => {
        if (!this.ctx || !this.channels.has('birds')) return;
        const now = ctx.currentTime;
        const baseFreq = 2300 + Math.random() * 1300;
        const notes = Math.random() > 0.45 ? 2 : 3;

        for (let n = 0; n < notes; n++) {
          const osc = ctx.createOscillator();
          const env = ctx.createGain();
          osc.type = 'sine';
          const start = now + n * 0.14;
          osc.frequency.setValueAtTime(baseFreq, start);
          osc.frequency.exponentialRampToValueAtTime(
            baseFreq * (1.18 + Math.random() * 0.16),
            start + 0.055
          );
          osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.94, start + 0.11);

          env.gain.setValueAtTime(0.0001, start);
          env.gain.linearRampToValueAtTime(0.075, start + 0.025);
          env.gain.exponentialRampToValueAtTime(0.0001, start + 0.12);

          osc.connect(env);
          env.connect(channelGain);
          osc.start(start);
          osc.stop(start + 0.13);
        }
      };

      chirp();
      const timer = window.setInterval(() => {
        if (Math.random() > 0.25) chirp();
      }, 2400);

      cleanups.push(() => {
        window.clearInterval(timer);
        try {
          bed.stop();
        } catch {
          // ignore
        }
      });
    } else if (id === 'piano') {
      const chords = [
        [261.63, 329.63, 392.0, 493.88, 587.33],
        [220.0, 261.63, 329.63, 392.0, 493.88],
        [174.61, 220.0, 261.63, 329.63, 392.0],
        [196.0, 246.94, 293.66, 329.63, 440.0],
      ];
      let chordIdx = 0;

      const playChord = () => {
        if (!this.ctx || !this.channels.has('piano')) return;
        const chord = chords[chordIdx % chords.length];
        chordIdx += 1;
        const now = ctx.currentTime;

        chord.forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const filter = ctx.createBiquadFilter();
          const env = ctx.createGain();

          osc.type = i === 0 ? 'sine' : 'triangle';
          osc.frequency.setValueAtTime(freq, now + i * 0.18);

          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(950, now + i * 0.18);

          const start = now + i * 0.18;
          env.gain.setValueAtTime(0.0001, start);
          env.gain.linearRampToValueAtTime(i === 0 ? 0.11 : 0.065, start + 0.22);
          env.gain.exponentialRampToValueAtTime(0.0001, start + 4.4);

          osc.connect(filter);
          filter.connect(env);
          env.connect(channelGain);
          osc.start(start);
          osc.stop(start + 4.6);
        });
      };

      playChord();
      const timer = window.setInterval(playChord, 4600);
      cleanups.push(() => window.clearInterval(timer));
    }

    return {
      gainNode: channelGain,
      stop: () => {
        cleanups.forEach((fn) => fn());
        try {
          channelGain.disconnect();
        } catch {
          // ignore
        }
      },
    };
  }

  setChannelVolume(id: AmbientChannelId, volume: number) {
    const clamped = Math.max(0, Math.min(1, volume));
    this.volumes[id] = clamped;

    const existing = this.channels.get(id);
    if (clamped <= 0.01) {
      if (existing) {
        existing.stop();
        this.channels.delete(id);
      }
      return;
    }

    if (!existing) {
      const handle = this.startChannel(id, clamped);
      this.channels.set(id, handle);
    } else if (this.ctx) {
      existing.gainNode.gain.setTargetAtTime(clamped * 0.52, this.ctx.currentTime, 0.08);
    }
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, 0.05);
    }
    if (this.customAudioEl) {
      this.customAudioEl.muted = muted;
    }
  }

  stopAll() {
    for (const id of Object.keys(this.volumes) as AmbientChannelId[]) {
      this.setChannelVolume(id, 0);
    }
    if (this.customAudioEl) {
      this.customAudioEl.pause();
    }
  }

  loadCustomAudio(file: File): string {
    if (this.customAudioEl) this.customAudioEl.pause();
    if (this.customAudioUrl) URL.revokeObjectURL(this.customAudioUrl);
    const url = URL.createObjectURL(file);
    this.customAudioUrl = url;
    const audio = new Audio(url);
    audio.loop = true;
    audio.volume = this.customVolume;
    audio.muted = this.muted;
    this.customAudioEl = audio;
    audio.play().catch(() => {});
    return file.name;
  }

  toggleCustomAudio(play: boolean) {
    if (!this.customAudioEl) return;
    if (play) {
      this.customAudioEl.muted = this.muted;
      this.customAudioEl.play().catch(() => {});
    } else {
      this.customAudioEl.pause();
    }
  }

  playCompletionChime() {
    if (this.muted) return;
    const { ctx } = this.ensureContext();
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const start = now + idx * 0.16;
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.14, start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 1.25);
    });
  }
}

export const ambientAudio = new AmbientAudioEngine();
