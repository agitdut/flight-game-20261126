// Sky Courier — mesin suara prosedural (WebAudio, tanpa aset audio).
// Semua bunyi disintesis: dengung mesin mengikuti throttle, desir angin
// mengikuti kecepatan, lonceng ring, dentuman mendarat, dan alarm stall.

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineOsc2 = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.windSource = null;
    this.windGain = null;
    this.windFilter = null;
    this.started = false;
  }

  // Dipanggil dari gestur pertama pemain (klik / tombol) karena browser
  // melarang audio sebelum interaksi.
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    this.ctx = new AudioCtx();
    this.buildEngine();
    this.buildWind();
    this.started = true;
  }

  buildEngine() {
    const ctx = this.ctx;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0.0;
    this.engineFilter = ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 420;
    this.engineFilter.Q.value = 1.2;
    this.engineOsc = ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 52;
    this.engineOsc2 = ctx.createOscillator();
    this.engineOsc2.type = 'square';
    this.engineOsc2.frequency.value = 104;
    const g2 = ctx.createGain();
    g2.gain.value = 0.35;
    this.engineOsc.connect(this.engineFilter);
    this.engineOsc2.connect(g2);
    g2.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(ctx.destination);
    this.engineOsc.start();
    this.engineOsc2.start();
  }

  buildWind() {
    const ctx = this.ctx;
    const len = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.windSource = ctx.createBufferSource();
    this.windSource.buffer = buffer;
    this.windSource.loop = true;
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.frequency.value = 700;
    this.windFilter.Q.value = 0.6;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0.0;
    this.windSource.connect(this.windFilter);
    this.windFilter.connect(this.windGain);
    this.windGain.connect(ctx.destination);
    this.windSource.start();
  }

  // Dipanggil tiap frame: throttle 0..1, speed 0..~210, stall bool.
  update(throttle, speed, stalling) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const rpm = 42 + throttle * 66 + (stalling ? -8 : 0);
    this.engineOsc.frequency.setTargetAtTime(rpm, t, 0.08);
    this.engineOsc2.frequency.setTargetAtTime(rpm * 2.02, t, 0.08);
    this.engineFilter.frequency.setTargetAtTime(320 + throttle * 900, t, 0.1);
    this.engineGain.gain.setTargetAtTime(0.045 + throttle * 0.075, t, 0.12);
    this.windGain.gain.setTargetAtTime(Math.min(0.09, speed * 0.00042), t, 0.15);
    this.windFilter.frequency.setTargetAtTime(480 + speed * 3.4, t, 0.15);
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.ctx) {
      const g = this.muted ? 0 : 1;
      if (this.engineGain) this.engineGain.gain.value = 0;
      if (this.windGain) this.windGain.gain.value = 0;
      if (!this.muted && this.engineGain) this.engineGain.gain.value = 0.08;
      void g;
    }
    return this.muted;
  }

  blip(freq, dur, type = 'sine', vol = 0.16, when = 0) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  ring() {
    this.blip(880, 0.22, 'sine', 0.2);
    this.blip(1318, 0.3, 'sine', 0.16, 0.07);
    this.blip(1760, 0.36, 'sine', 0.1, 0.14);
  }

  parcel() {
    this.blip(659, 0.14, 'triangle', 0.16);
    this.blip(988, 0.2, 'triangle', 0.14, 0.06);
  }

  thud() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, t0);
    osc.frequency.exponentialRampToValueAtTime(38, t0 + 0.22);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.5, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.3);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.35);
  }

  crash() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    const len = ctx.sampleRate * 0.5;
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    const g = ctx.createGain();
    g.gain.value = 0.5;
    src.connect(filter);
    filter.connect(g);
    g.connect(ctx.destination);
    src.start(t0);
    this.blip(90, 0.5, 'sawtooth', 0.25);
  }

  alarm() {
    this.blip(740, 0.12, 'square', 0.07);
    this.blip(740, 0.12, 'square', 0.07, 0.18);
  }
}
