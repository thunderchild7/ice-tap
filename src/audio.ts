import type { FishId } from "./logic";

export function createAudio() {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let noise: AudioBuffer | null = null;
  let enabled = true;

  function context(): AudioContext | null {
    if (ctx) return ctx;
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0.72;
    master.connect(ctx.destination);
    return ctx;
  }

  function output(): { ctx: AudioContext; master: GainNode } | null {
    if (!enabled) return null;
    const audio = context();
    if (!audio || !master) return null;
    return { ctx: audio, master };
  }

  function tone(
    freq: number,
    delay: number,
    duration: number,
    type: OscillatorType,
    peak: number,
    slide?: number,
  ): void {
    const bus = output();
    if (!bus) return;
    const t0 = bus.ctx.currentTime + delay;
    const osc = bus.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, slide), t0 + duration);
    const gain = bus.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + Math.min(0.012, duration * 0.4));
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain);
    gain.connect(bus.master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  function burst(delay: number, duration: number, peak: number, frequency: number): void {
    const bus = output();
    if (!bus) return;
    if (!noise || noise.sampleRate !== bus.ctx.sampleRate) {
      noise = bus.ctx.createBuffer(1, Math.floor(bus.ctx.sampleRate * 0.25), bus.ctx.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    }
    const src = bus.ctx.createBufferSource();
    src.buffer = noise;
    const filter = bus.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = frequency;
    filter.Q.value = 0.7;
    const gain = bus.ctx.createGain();
    const t0 = bus.ctx.currentTime + delay;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(bus.master);
    src.start(t0);
    src.stop(t0 + duration + 0.02);
  }

  return {
    setEnabled(value: boolean) {
      enabled = value;
    },
    unlock() {
      const audio = context();
      if (audio && audio.state === "suspended") void audio.resume();
    },
    blip() {
      tone(990, 0, 0.05, "sine", 0.04);
    },
    go() {
      tone(392, 0, 0.09, "sine", 0.05);
      tone(523, 0.07, 0.1, "sine", 0.05);
      tone(659, 0.14, 0.12, "sine", 0.045);
    },
    catch(species: FishId) {
      if (species === "pike") {
        burst(0, 0.08, 0.1, 1700);
        [523, 659, 784, 1046].forEach((freq, index) => tone(freq, index * 0.048, 0.12, "sine", 0.05));
        return;
      }
      if (species === "char") {
        burst(0, 0.07, 0.12, 1200);
        tone(660, 0, 0.09, "sine", 0.05);
        tone(880, 0.04, 0.1, "sine", 0.045);
        return;
      }
      if (species === "trout") {
        burst(0, 0.07, 0.14, 900);
        tone(740, 0, 0.1, "sine", 0.06, 480);
        return;
      }
      burst(0, 0.07, 0.15, 700);
      tone(620, 0, 0.1, "sine", 0.06, 380);
    },
    hazard() {
      burst(0, 0.12, 0.2, 180);
      tone(140, 0, 0.16, "square", 0.04, 70);
    },
    dodge() {
      tone(1560, 0, 0.04, "sine", 0.02);
    },
    escape() {
      tone(360, 0, 0.12, "triangle", 0.04, 160);
    },
    milestone() {
      tone(880, 0, 0.12, "sine", 0.05);
      tone(1320, 0, 0.14, "sine", 0.04);
    },
    over() {
      tone(494, 0, 0.14, "triangle", 0.045);
      tone(392, 0.09, 0.16, "triangle", 0.04);
      tone(262, 0.18, 0.2, "triangle", 0.04);
    },
  };
}
