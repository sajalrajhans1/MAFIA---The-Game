// Fully synthesized audio: rain ambience, a little noir jazz combo, night drones,
// heartbeat tension, and retro UI / game sound effects. No audio files.

const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.mood = 'lobby';
    this.settings = { master: 0.8, music: 0.55, sfx: 0.85, muted: false };
    try { Object.assign(this.settings, JSON.parse(localStorage.getItem('mafia.audio') || '{}')); } catch { /* ignore */ }
    this.step = 0;
    this.bar = 0;
    this.nextTime = 0;
  }

  save() { try { localStorage.setItem('mafia.audio', JSON.stringify(this.settings)); } catch { /* ignore */ } }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const C = this.ctx = new AC();
    this.out = C.createDynamicsCompressor();
    this.out.threshold.value = -14;
    this.out.ratio.value = 3;
    this.out.connect(C.destination);
    this.master = C.createGain();
    this.master.connect(this.out);
    this.music = C.createGain();
    this.sfxBus = C.createGain();
    this.amb = C.createGain();
    this.music.connect(this.master);
    this.sfxBus.connect(this.master);
    this.amb.connect(this.master);
    this.verb = C.createConvolver();
    this.verb.buffer = this.impulse(2.6, 2.2);
    this.verbIn = C.createGain();
    this.verbIn.gain.value = 0.5;
    this.verbIn.connect(this.verb);
    this.verb.connect(this.master);
    this.noiseBuf = this.makeNoise(2, 'white');
    this.brownBuf = this.makeNoise(4, 'brown');
    this.apply();
    this.startAmbience();
    this.nextTime = C.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 40);
  }

  apply() {
    if (!this.ctx) return;
    const s = this.settings, t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(s.muted ? 0 : s.master, t, 0.05);
    this.music.gain.setTargetAtTime(s.music * 0.7, t, 0.1);
    this.sfxBus.gain.setTargetAtTime(s.sfx, t, 0.05);
    this.amb.gain.setTargetAtTime(0.5 * Math.max(0.3, s.music), t, 0.3);
  }

  set(k, v) { this.settings[k] = v; this.apply(); this.save(); }
  toggleMute() { this.set('muted', !this.settings.muted); return this.settings.muted; }

  makeNoise(sec, kind) {
    const C = this.ctx, len = Math.floor(C.sampleRate * sec);
    const b = C.createBuffer(1, len, C.sampleRate), d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
    }
    return b;
  }

  impulse(sec, decay) {
    const C = this.ctx, len = Math.floor(C.sampleRate * sec);
    const b = C.createBuffer(2, len, C.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return b;
  }

  // ------------------------------------------------------------ primitives
  tone({ type = 'sine', f = 440, t = 0, dur = 0.3, g = 0.2, a = 0.005, r = null, to = null, dest = null, verb = 0, filter = null, q = 1, detune = 0 }) {
    const C = this.ctx;
    if (!C) return;
    const t0 = C.currentTime + t;
    const o = C.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t0);
    o.detune.value = detune;
    if (to) o.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
    const gn = C.createGain();
    gn.gain.setValueAtTime(0.0001, t0);
    gn.gain.exponentialRampToValueAtTime(Math.max(0.0002, g), t0 + a);
    gn.gain.exponentialRampToValueAtTime(0.0001, t0 + (r || dur));
    let node = o;
    if (filter) { const fl = C.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = filter; fl.Q.value = q; o.connect(fl); node = fl; }
    node.connect(gn);
    gn.connect(dest || this.sfxBus);
    if (verb) { const v = C.createGain(); v.gain.value = verb; gn.connect(v); v.connect(this.verbIn); }
    o.start(t0);
    o.stop(t0 + (r || dur) + 0.05);
  }

  noise({ t = 0, dur = 0.2, g = 0.2, type = 'bandpass', f = 1000, q = 1, a = 0.003, dest = null, verb = 0, brown = false, to = null }) {
    const C = this.ctx;
    if (!C) return;
    const t0 = C.currentTime + t;
    const src = C.createBufferSource();
    src.buffer = brown ? this.brownBuf : this.noiseBuf;
    src.loop = true;
    const fl = C.createBiquadFilter();
    fl.type = type;
    fl.frequency.setValueAtTime(f, t0);
    if (to) fl.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    fl.Q.value = q;
    const gn = C.createGain();
    gn.gain.setValueAtTime(0.0001, t0);
    gn.gain.exponentialRampToValueAtTime(g, t0 + a);
    gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(fl); fl.connect(gn); gn.connect(dest || this.sfxBus);
    if (verb) { const v = C.createGain(); v.gain.value = verb; gn.connect(v); v.connect(this.verbIn); }
    src.start(t0, Math.random() * 1.5);
    src.stop(t0 + dur + 0.05);
  }

  // -------------------------------------------------------------- ambience
  startAmbience() {
    const C = this.ctx;
    const rain = C.createBufferSource();
    rain.buffer = this.noiseBuf; rain.loop = true;
    const hp = C.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 900;
    const lp = C.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5200;
    this.rainGain = C.createGain(); this.rainGain.gain.value = 0.05;
    rain.connect(hp); hp.connect(lp); lp.connect(this.rainGain); this.rainGain.connect(this.amb);
    rain.start();
    const low = C.createBufferSource();
    low.buffer = this.brownBuf; low.loop = true;
    const lp2 = C.createBiquadFilter(); lp2.type = 'lowpass'; lp2.frequency.value = 400;
    this.rumbleGain = C.createGain(); this.rumbleGain.gain.value = 0.12;
    low.connect(lp2); lp2.connect(this.rumbleGain); this.rumbleGain.connect(this.amb);
    low.start();
    // night drone (always running, faded by mood)
    this.drone = C.createGain(); this.drone.gain.value = 0;
    const dlp = C.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 320; dlp.Q.value = 4;
    const lfo = C.createOscillator(); lfo.frequency.value = 0.07;
    const lfoG = C.createGain(); lfoG.gain.value = 160;
    lfo.connect(lfoG); lfoG.connect(dlp.frequency); lfo.start();
    for (const [f, d] of [[36.7, -6], [36.7, 7], [55, 3], [73.4, -4]]) {
      const o = C.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = d;
      const g = C.createGain(); g.gain.value = 0.06;
      o.connect(g); g.connect(dlp); o.start();
    }
    this.tensionOsc = C.createOscillator(); this.tensionOsc.type = 'sawtooth'; this.tensionOsc.frequency.value = 77.8;
    this.tensionGain = C.createGain(); this.tensionGain.gain.value = 0;
    this.tensionOsc.connect(this.tensionGain); this.tensionGain.connect(dlp); this.tensionOsc.start();
    dlp.connect(this.drone); this.drone.connect(this.music);
  }

  setMood(m) {
    if (m === this.mood) return;
    this.mood = m;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const night = m === 'night', tense = m === 'vote' || m === 'lastwords';
    this.drone.gain.setTargetAtTime(night ? 0.55 : tense ? 0.4 : 0, t, 1.2);
    this.tensionGain.gain.setTargetAtTime(m === 'lastwords' ? 0.05 : 0, t, 0.5);
    this.rainGain.gain.setTargetAtTime(night ? 0.09 : 0.05, t, 2);
  }

  // ----------------------------------------------------------------- music
  schedule() {
    const C = this.ctx;
    if (!C) return;
    while (this.nextTime < C.currentTime + 0.25) {
      this.playStep(this.nextTime - C.currentTime);
      const bpm = this.mood === 'lastwords' ? 96 : 76;
      const eighth = 60 / bpm / 2;
      const swing = this.step % 2 === 0 ? 1.3 : 0.7;
      this.nextTime += eighth * swing;
      this.step = (this.step + 1) % 8;
      if (this.step === 0) this.bar++;
    }
  }

  playStep(t) {
    const m = this.mood, s = this.step, beat = s / 2;
    const M = this.music;
    if (m === 'lobby' || m === 'day' || m === 'over') {
      const prog = [[38, 'm7'], [43, 'm7'], [40, 'm7b5'], [45, '7']];
      const [root, q] = prog[this.bar % 4];
      const next = prog[(this.bar + 1) % 4][0];
      const third = q === '7' ? 4 : 3, fifth = q === 'm7b5' ? 6 : 7, sev = 10;
      if (s % 2 === 0) {
        // walking bass
        const walk = [root, root + third, root + fifth, next + (Math.random() < 0.5 ? 1 : -1)];
        const n = walk[beat];
        this.tone({ type: 'triangle', f: mtof(n), t, dur: 0.5, g: 0.22, a: 0.01, r: 0.42, dest: M, filter: 700 });
        this.tone({ type: 'sine', f: mtof(n + 12), t, dur: 0.2, g: 0.05, a: 0.005, r: 0.18, dest: M });
        // brushes
        this.noise({ t, dur: 0.18, g: beat % 2 ? 0.05 : 0.025, f: 3500, q: 0.6, dest: M });
      }
      // ride: 1, 2, 2&, 3, 4, 4&
      if ([0, 2, 3, 4, 6, 7].includes(s)) this.noise({ t, dur: s % 2 ? 0.08 : 0.25, g: s % 2 ? 0.012 : 0.022, type: 'highpass', f: 7000, dest: M });
      // rhodes comp
      if (s === 0 || (s === 3 && Math.random() < 0.5)) {
        const voicing = [third, sev, 14].map(iv => root + 24 + iv);
        voicing.forEach((n, i) => {
          this.tone({ type: 'sine', f: mtof(n), t: t + i * 0.012, dur: 1.6, g: 0.045, a: 0.02, r: 1.4, dest: M, verb: 0.25 });
          this.tone({ type: 'triangle', f: mtof(n), t: t + i * 0.012, dur: 0.4, g: 0.015, a: 0.005, r: 0.3, dest: M, detune: 6 });
        });
      }
      // vibraphone noodles
      if (s % 2 === 0 && Math.random() < 0.18) {
        const scale = [62, 65, 67, 69, 72, 74, 77];
        const n = scale[Math.floor(Math.random() * scale.length)];
        this.tone({ type: 'sine', f: mtof(n), t, dur: 1.2, g: 0.04, a: 0.004, r: 1.1, dest: M, verb: 0.45 });
        this.tone({ type: 'sine', f: mtof(n) * 4, t, dur: 0.3, g: 0.008, a: 0.002, r: 0.25, dest: M });
      }
    } else if (m === 'night') {
      if (s === 0 && this.bar % 2 === 0 && Math.random() < 0.8) {
        const scale = [74, 77, 79, 81, 84, 86];
        for (let i = 0; i < 3; i++) {
          const n = scale[Math.floor(Math.random() * scale.length)];
          this.tone({ type: 'sine', f: mtof(n), t: t + i * 0.45, dur: 2, g: 0.03, a: 0.002, r: 1.8, dest: M, verb: 0.8 });
          this.tone({ type: 'sine', f: mtof(n) * 2.76, t: t + i * 0.45, dur: 0.5, g: 0.006, a: 0.002, r: 0.4, dest: M, verb: 0.5 });
        }
      }
    } else if (m === 'vote' || m === 'lastwords') {
      if (s === 0 || s === 4 || (m === 'lastwords' && (s === 2 || s === 6))) {
        this.tone({ type: 'sine', f: 58, to: 38, t, dur: 0.22, g: 0.35, a: 0.004, r: 0.2, dest: M });
        this.tone({ type: 'sine', f: 52, to: 34, t: t + 0.16, dur: 0.2, g: 0.22, a: 0.004, r: 0.18, dest: M });
      }
      if (s % 2 === 0) this.noise({ t, dur: 0.03, g: 0.03, f: 4200, q: 8, dest: M });
    }
  }

  // ------------------------------------------------------------------ sfx
  sfx(name, opt = {}) {
    if (!this.ctx) return;
    switch (name) {
      case 'click': this.tone({ type: 'square', f: 880, to: 440, dur: 0.06, g: 0.06 }); break;
      case 'hover': this.tone({ type: 'square', f: 1320, dur: 0.025, g: 0.02 }); break;
      case 'select': this.tone({ type: 'square', f: 660, dur: 0.05, g: 0.05 }); this.tone({ type: 'square', f: 990, t: 0.05, dur: 0.07, g: 0.05 }); break;
      case 'error': this.tone({ type: 'square', f: 180, dur: 0.18, g: 0.07 }); this.tone({ type: 'square', f: 140, t: 0.09, dur: 0.18, g: 0.07 }); break;
      case 'chat': this.tone({ type: 'triangle', f: 1046, dur: 0.07, g: 0.05 }); this.tone({ type: 'triangle', f: 1568, t: 0.05, dur: 0.08, g: 0.035 }); break;
      case 'deal': this.noise({ dur: 0.09, g: 0.12, f: 2800, q: 0.8, to: 1200 }); break;
      case 'flip': this.noise({ dur: 0.05, g: 0.15, f: 3000, q: 1 }); this.noise({ t: 0.06, dur: 0.07, g: 0.1, f: 2000, q: 1 }); break;
      case 'join': [523, 659, 784].forEach((f, i) => this.tone({ type: 'square', f, t: i * 0.07, dur: 0.09, g: 0.04 })); break;
      case 'leave': [784, 523].forEach((f, i) => this.tone({ type: 'square', f, t: i * 0.08, dur: 0.1, g: 0.035 })); break;
      case 'gunshot':
        this.noise({ dur: 0.5, g: 0.9, type: 'lowpass', f: 6000, to: 300, a: 0.001, verb: 0.9 });
        this.tone({ type: 'sine', f: 120, to: 35, dur: 0.35, g: 0.8, a: 0.001, verb: 0.5 });
        this.noise({ t: 0.02, dur: 1.8, g: 0.12, type: 'lowpass', f: 900, brown: true, verb: 0.6 });
        break;
      case 'bell':
        [1, 2.01, 2.43, 3.01, 4.2].forEach((p, i) => this.tone({ type: 'sine', f: 196 * p, dur: 4, g: 0.12 / (i + 1), a: 0.003, r: 3.8 - i * 0.5, verb: 0.7 }));
        break;
      case 'night':
        this.noise({ dur: 2.2, g: 0.18, type: 'lowpass', f: 1800, to: 120, a: 0.3, verb: 0.5 });
        [38, 39, 45].forEach((n, i) => this.tone({ type: 'sawtooth', f: mtof(n), dur: 3, g: 0.08, a: 0.4, r: 3, filter: 300 + i * 40, verb: 0.6 }));
        break;
      case 'thunder':
        this.noise({ dur: 3.5, g: 0.5, type: 'lowpass', f: 260, brown: true, a: 0.15, verb: 0.6 });
        this.noise({ t: 0.3, dur: 2.5, g: 0.3, type: 'lowpass', f: 140, brown: true, a: 0.3 });
        break;
      case 'gavel':
        for (let i = 0; i < 2; i++) { this.tone({ type: 'sine', f: 180, to: 90, t: i * 0.22, dur: 0.12, g: 0.45, a: 0.001, verb: 0.4 }); this.noise({ t: i * 0.22, dur: 0.06, g: 0.3, f: 1200, q: 2 }); }
        break;
      case 'tick': this.noise({ dur: 0.025, g: 0.08, f: 5000, q: 10 }); break;
      case 'vote': this.tone({ type: 'square', f: 392, dur: 0.07, g: 0.05 }); this.noise({ dur: 0.04, g: 0.1, f: 3000, q: 4 }); break;
      case 'chip': this.noise({ dur: 0.04, g: 0.18, f: 4200, q: 6 }); this.tone({ type: 'sine', f: 2600, dur: 0.05, g: 0.04 }); break;
      case 'saved':
        [72, 76, 79, 84].forEach((n, i) => this.tone({ type: 'sine', f: mtof(n), t: i * 0.09, dur: 1.4, g: 0.08, a: 0.005, r: 1.3, verb: 0.8 }));
        break;
      case 'inspect':
        [69, 72, 75, 78].forEach((n, i) => this.tone({ type: 'triangle', f: mtof(n), t: i * 0.12, dur: 0.9, g: 0.06, verb: 0.7 }));
        break;
      case 'guilty':
        [45, 46].forEach(n => this.tone({ type: 'sawtooth', f: mtof(n), dur: 1.6, g: 0.12, a: 0.01, r: 1.5, filter: 900, verb: 0.6 }));
        break;
      case 'death':
        [50, 51, 56].forEach(n => this.tone({ type: 'sawtooth', f: mtof(n), dur: 2.2, g: 0.09, a: 0.02, r: 2, filter: 1200, verb: 0.8 }));
        break;
      case 'win': [60, 64, 67, 72, 76, 79, 84].forEach((n, i) => this.tone({ type: 'square', f: mtof(n), t: i * 0.09, dur: 0.14, g: 0.05, verb: 0.3 })); break;
      case 'lose': [72, 68, 65, 61, 56].forEach((n, i) => this.tone({ type: 'square', f: mtof(n), t: i * 0.16, dur: 0.22, g: 0.05, verb: 0.3 })); break;
      case 'deal-start': this.noise({ dur: 0.5, g: 0.15, f: 2500, q: 0.5, to: 800 }); break;
      case 'typing': this.noise({ dur: 0.02, g: 0.03, f: 3000, q: 3 }); break;
    }
  }
}

export const audio = new AudioEngine();
