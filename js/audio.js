// Lydeffekter og generativ musik med WebAudio. Ingen lydfiler.
'use strict';

const SFX = {
  ctx: null, master: null, sfxGain: null, musicGain: null, delay: null,
  sound: true, music: true, timer: 0, step: 0,

  loadPrefs() {
    try {
      const p = JSON.parse(localStorage.getItem('imperium-audio') || '{}');
      if (typeof p.sound === 'boolean') this.sound = p.sound;
      if (typeof p.music === 'boolean') this.music = p.music;
    } catch (e) { /* ingen lager */ }
  },
  savePrefs() { try { localStorage.setItem('imperium-audio', JSON.stringify({ sound: this.sound, music: this.music })); } catch (e) { /* ingen lager */ } },

  // Kaldes ved første klik eller tastetryk
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { this.ctx = new AC(); } catch (e) { return; }
    const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = 0.8; this.master.connect(c.destination);
    this.sfxGain = c.createGain(); this.sfxGain.gain.value = 0.5; this.sfxGain.connect(this.master);
    this.musicGain = c.createGain(); this.musicGain.gain.value = 0.0; this.musicGain.connect(this.master);
    this.delay = c.createDelay(1.5); this.delay.delayTime.value = 0.42;
    const fb = c.createGain(); fb.gain.value = 0.38;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
    this.delay.connect(lp); lp.connect(fb); fb.connect(this.delay); lp.connect(this.musicGain);
    if (this.music) this.startMusic();
  },

  tone(freq, dur, opts = {}) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime + (opts.at || 0);
    const o = c.createOscillator(), g = c.createGain();
    o.type = opts.type || 'triangle';
    o.frequency.setValueAtTime(freq, t);
    if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
    const v = opts.vol == null ? 0.25 : opts.vol;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + (opts.attack || 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(opts.dest || this.sfxGain);
    if (opts.send) g.connect(this.delay);
    o.start(t); o.stop(t + dur + 0.05);
  },
  noise(dur, vol, freq) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const s = c.createBufferSource(); s.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(freq || 2400, t); f.frequency.exponentialRampToValueAtTime(200, t + dur);
    const g = c.createGain(); g.gain.value = vol;
    s.connect(f); f.connect(g); g.connect(this.sfxGain);
    s.start(t);
  },

  play(name) {
    if (!this.sound || !this.ctx) return;
    switch (name) {
      case 'click': this.tone(880, 0.05, { type: 'square', vol: 0.04 }); break;
      case 'move': this.tone(420, 0.08, { type: 'triangle', vol: 0.07, to: 520 }); break;
      case 'combat': this.noise(0.35, 0.5, 3000); this.tone(110, 0.3, { type: 'sine', vol: 0.4, to: 50 }); break;
      case 'city': [523, 659, 784, 1046].forEach((f, k) => this.tone(f, 0.6, { at: k * 0.09, vol: 0.12, send: true })); break;
      case 'tech': [440, 554, 659, 880].forEach((f, k) => this.tone(f, 0.5, { at: k * 0.07, vol: 0.1, type: 'sine', send: true })); break;
      case 'turn': this.tone(392, 0.5, { vol: 0.1, type: 'sine' }); this.tone(587, 0.7, { at: 0.12, vol: 0.09, type: 'sine', send: true }); break;
      case 'bad': this.tone(330, 0.35, { vol: 0.12, to: 196 }); break;
      case 'coin': this.tone(1318, 0.12, { type: 'square', vol: 0.04 }); this.tone(1760, 0.2, { at: 0.07, type: 'square', vol: 0.04 }); break;
    }
  },

  startMusic() {
    if (!this.ctx || this.timer) return;
    this.musicGain.gain.setTargetAtTime(0.5, this.ctx.currentTime, 1.5);
    const scale = [220, 246.9, 261.6, 329.6, 392, 440, 493.9, 523.3, 659.3];
    const tick = () => {
      if (!this.music || !this.ctx) return;
      this.step++;
      const f = pickNote(scale, this.step);
      this.tone(f, 2.6, { type: 'triangle', vol: 0.05, attack: 0.08, dest: this.musicGain, send: true });
      if (this.step % 8 === 1) this.tone(f / 4, 7, { type: 'sine', vol: 0.05, attack: 1.5, dest: this.musicGain });
      if (Math.random() < 0.3) this.tone(pickNote(scale, this.step + 3) * 2, 1.8, { at: 0.9, type: 'sine', vol: 0.025, dest: this.musicGain, send: true });
    };
    tick();
    this.timer = setInterval(tick, 1900);
  },
  stopMusic() {
    if (this.timer) { clearInterval(this.timer); this.timer = 0; }
    if (this.musicGain && this.ctx) this.musicGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.5);
  },
  setSound(v) { this.sound = v; this.savePrefs(); },
  setMusic(v) { this.music = v; this.savePrefs(); if (v) { this.unlock(); this.startMusic(); } else this.stopMusic(); },
};

// Melodien bevæger sig i små skridt i skalaen
let lastNote = 4;
function pickNote(scale, step) {
  lastNote = Math.max(0, Math.min(scale.length - 1, lastNote + [-2, -1, -1, 0, 1, 1, 2][Math.floor(Math.random() * 7)]));
  void step;
  return scale[lastNote];
}

SFX.loadPrefs();
['pointerdown', 'keydown'].forEach(ev => window.addEventListener(ev, () => SFX.unlock(), { capture: true }));
