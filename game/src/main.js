// Sky Courier — loop utama dan mesin keadaan permainan.
// Keadaan: title -> briefing -> flying -> legdone -> (leg berikut / victory)
//                                    \-> gameover
// Simulasi memakai timestep tetap 1/60 detik supaya permainan deterministik.

import { GAME, LEGS, SCORE } from './config.js';
import { clamp } from './random.js';
import { World } from './world.js';
import { createPlaneState, stepPlane, ringScore } from './physics.js';
import { Renderer } from './render.js';
import { Input } from './input.js';
import { SoundEngine } from './audio.js';
import { applyShot } from './shots.js';

const STEP = 1 / 60;
const BEST_KEY = 'sky-courier-merpati-best';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new Renderer(canvas);
    this.input = new Input(canvas);
    this.sound = new SoundEngine();
    this.mode = 'title';
    this.legIndex = 0;
    this.leg = LEGS[0];
    this.world = new World(0, LEGS[0]);
    this.plane = createPlaneState();
    this.score = 0;
    this.combo = 0;
    this.ringsPassed = 0;
    this.parcelsTaken = 0;
    this.totalRings = 0;
    this.totalParcels = 0;
    this.totalRingsMax = LEGS.reduce((a, l) => a + l.rings, 0);
    this.totalParcelsMax = LEGS.reduce((a, l) => a + l.parcels, 0);
    this.perfectLandings = 0;
    this.legScore = 0;
    this.legTime = 0;
    this.time = 0;
    this.messages = [];
    this.legResult = null;
    this.crashReason = '';
    this.crashDetail = '';
    this.best = 0;
    try {
      this.best = Number(localStorage.getItem(BEST_KEY) || 0) || 0;
    } catch (e) {
      this.best = 0;
    }
    this.shotMode = null;
    this.accumulator = 0;
    this.lastNow = 0;
    this.alarmedAt = 0;
    this.paused = false;
    this.parseQuery();
  }

  parseQuery() {
    const q = new URLSearchParams(window.location.search);
    const shot = q.get('shot');
    if (shot) {
      this.shotMode = shot;
      applyShot(this, shot);
    }
  }

  startLeg(index) {
    this.legIndex = index;
    this.leg = LEGS[index];
    this.world = new World(index, this.leg);
    this.plane = createPlaneState();
    this.plane.fuel = this.leg.fuel;
    this.legScore = 0;
    this.legTime = 0;
    this.ringsPassed = 0;
    this.parcelsTaken = 0;
    this.combo = 0;
    this.messages = [];
  }

  start() {
    this.score = 0;
    this.totalRings = 0;
    this.totalParcels = 0;
    this.perfectLandings = 0;
    this.startLeg(0);
    this.mode = 'briefing';
  }

  saveBest() {
    if (this.score > this.best) {
      this.best = this.score;
      try {
        localStorage.setItem(BEST_KEY, String(this.best));
      } catch (e) {
        // Penyimpanan tidak tersedia: skor terbaik hanya di memori.
      }
    }
  }

  addMessage(text, color = '#ffffff') {
    this.messages.push({ text, color, at: this.time });
    if (this.messages.length > 4) this.messages.shift();
  }

  // Satu langkah simulasi (dipanggil dengan STEP tetap).
  update() {
    const p = this.plane;
    const input = this.input;
    const now = performance.now();

    if (this.mode === 'title') {
      if (input.consume('Enter')) {
        this.sound.ensure();
        this.start();
      }
      this.time += STEP;
      return;
    }
    if (this.mode === 'briefing') {
      if (input.consume('Enter')) {
        this.sound.ensure();
        this.mode = 'flying';
        this.addMessage(`${this.leg.name} — TERBANG!`, '#37e08a');
      }
      this.time += STEP;
      return;
    }
    if (this.mode === 'legdone') {
      if (input.consume('Enter')) {
        this.sound.ensure();
        if (this.legIndex + 1 < LEGS.length) {
          this.startLeg(this.legIndex + 1);
          this.mode = 'briefing';
        } else {
          this.mode = 'victory';
          this.saveBest();
        }
      }
      this.time += STEP;
      return;
    }
    if (this.mode === 'gameover' || this.mode === 'victory') {
      if (input.consume('r') || input.consume('R')) {
        this.sound.ensure();
        this.start();
      }
      this.time += STEP;
      return;
    }
    if (this.mode !== 'flying') return;

    // Jeda & bisu.
    if (input.consume('p') || input.consume('P')) {
      this.paused = !this.paused;
      this.mode = this.paused ? 'paused' : 'flying';
      return;
    }
    if (input.consume('m') || input.consume('M')) {
      const muted = this.sound.toggleMute();
      this.addMessage(muted ? 'SUARA MATI' : 'SUARA HIDUP', '#9fc4dd');
    }

    // Ster mouse: kursor kiri/kanan = belok, atas/bawah = pitch.
    const mouse = input.mouseSteering(now);
    let pitchIn = input.pitch;
    let rollIn = input.roll;
    if (mouse) {
      rollIn = clamp(mouse.x * 1.4, -1, 1);
      pitchIn = clamp(-mouse.y * 1.2, -1, 1);
      if (Math.abs(mouse.x) < 0.08) rollIn = 0;
      if (Math.abs(mouse.y) < 0.08) pitchIn = 0;
    }
    const simInput = {
      pitch: pitchIn,
      roll: rollIn,
      throttleUp: input.throttleUp,
      throttleDown: input.throttleDown,
      mouseThrottle: null,
    };

    const events = stepPlane(p, simInput, this.world, this.leg, STEP);
    this.legTime += STEP;
    this.time += STEP;

    // Rintangan hidup: awan badai melayang, burung melintasi koridor.
    for (const ob of this.world.obstacles) {
      if (ob.kind === 'storm') {
        ob.x += ob.drift * STEP;
        if (ob.x > 58 || ob.x < -58) ob.drift = -ob.drift;
      } else if (ob.kind === 'bird') {
        ob.x += ob.flySpeed * STEP;
        if (ob.x > 62) ob.x = -62;
        if (ob.x < -62) ob.x = 62;
      }
    }

    // Alarm stall berkala (maksimal tiap 1,2 detik).
    if (p.stalling && !p.onGround && this.time - this.alarmedAt > 1.2) {
      this.alarmedAt = this.time;
      this.sound.alarm();
    }

    for (const ev of events) this.handleEvent(ev);

    // Melewati landasan tanpa mendarat: go-around (putar balik mendekat lagi).
    if (!p.landed && !p.crashed && p.z > this.world.runwayEndZ + 320) {
      if (p.y > 60) {
        p.z = this.world.runwayEndZ - 700;
        p.y = Math.max(p.y, 130);
        p.x = clamp(p.x, -20, 20);
        p.heading = 0;
        p.speed = Math.max(p.speed, 110);
        this.addMessage('MELEWATI LANDASAN — GO-AROUND!', '#ffd23e');
        this.sound.alarm();
      } else {
        // Terlalu rendah melewati ujung landasan: mendarat kasar di tanah.
        p.landed = true;
        p.onGround = true;
        this.finishLeg(0.2, SCORE.landingRough, 'Mendarat kasar di luar landasan.');
      }
    }

    this.sound.update(p.throttle, p.speed, p.stalling);
    this.input.endFrame();
  }

  handleEvent(ev) {
    const p = this.plane;
    switch (ev.type) {
      case 'takeoff':
        this.addMessage('LEPAS LANDAS!', '#37e08a');
        this.sound.blip(523, 0.18, 'triangle', 0.16);
        break;
      case 'ring': {
        this.ringsPassed++;
        this.totalRings++;
        const pts = ringScore(this.combo);
        this.combo++;
        this.legScore += pts;
        this.score += pts;
        this.addMessage(`RING ${ev.ring.index + 1}  +${pts}`, '#37e08a');
        this.sound.ring();
        break;
      }
      case 'ringmiss':
        this.combo = 0;
        this.addMessage(`RING ${ev.ring.index + 1} TERLEWAT`, '#ff5347');
        this.sound.blip(220, 0.25, 'sawtooth', 0.1);
        break;
      case 'parcel':
        this.parcelsTaken++;
        this.totalParcels++;
        this.legScore += SCORE.parcel;
        this.score += SCORE.parcel;
        this.addMessage(`PAKET DIANTAR  +${SCORE.parcel}`, '#ffd23e');
        this.sound.parcel();
        break;
      case 'hit': {
        const label = ev.obstacle.kind === 'storm' ? 'AWAN BADAI!' : ev.obstacle.kind === 'balloon' ? 'BALON UDARA!' : 'BURUNG!';
        this.addMessage(`${label}  BADAN -${26}`, '#ff5347');
        this.sound.crash();
        this.combo = 0;
        break;
      }
      case 'hitground':
        this.addMessage('MENYENTUH TANAH!', '#ff5347');
        this.sound.thud();
        break;
      case 'rough':
        this.addMessage('MENDARAT KASAR — BADAN RUSAK', '#ff5347');
        this.sound.thud();
        break;
      case 'corridor':
        this.addMessage('KEMBALI KE KORIDOR PENERBANGAN', '#ffd23e');
        break;
      case 'outoffuel':
        this.addMessage('BAHAN BAKAR HABIS — MELUNCUR!', '#ff5347');
        this.sound.alarm();
        break;
      case 'landed': {
        const label = ev.quality > 0.82 ? 'SEMPURNA' : ev.quality > 0.55 ? 'BAGUS' : 'KASAR';
        if (ev.quality > 0.82) this.perfectLandings++;
        this.sound.thud();
        this.finishLeg(ev.quality, ev.bonus, `Pendaratan ${label.toLowerCase()}.`);
        break;
      }
      case 'crash': {
        this.sound.crash();
        if (p.outOfFuel) {
          this.crashReason = 'KEHABISAN BAHAN BAKAR';
          this.crashDetail = 'Tangki kosong di tengah leg — atur throttle lebih hemat lain kali.';
        } else if (p.damage >= 100) {
          this.crashReason = 'PESAWAT HANCUR';
          this.crashDetail = 'Badan pesawat tidak sanggup lagi — hindari badai dan rintangan.';
        } else if (p.stalling) {
          this.crashReason = 'STALL — KEHILANGAN DAYA ANGKAT';
          this.crashDetail = 'Kecepatan terlalu rendah saat mendaki — jaga throttle di atas stall.';
        } else {
          this.crashReason = 'PESAWAT JATUH';
          this.crashDetail = 'Merpati tidak berhasil menyelesaikan leg ini.';
        }
        this.mode = 'gameover';
        this.saveBest();
        break;
      }
      default:
        break;
    }
  }

  finishLeg(quality, landingBonus, landingLabel) {
    const timeBonus = Math.round(
      this.leg.timeBonus * clamp(1 - this.legTime / 300, 0.2, 1),
    );
    const legScore = this.legScore + landingBonus + timeBonus + SCORE.legClearBase;
    this.score += landingBonus + timeBonus + SCORE.legClearBase;
    this.legResult = {
      quality,
      landingBonus,
      landingLabel,
      timeBonus,
      legScore,
      ringsPassed: this.ringsPassed,
      parcelsTaken: this.parcelsTaken,
    };
    this.mode = 'legdone';
  }

  frame(now) {
    if (!this.lastNow) this.lastNow = now;
    let dt = (now - this.lastNow) / 1000;
    this.lastNow = now;
    if (dt > 0.25) dt = 0.25;
    // Mode screenshot: animasi berjalan pelan tapi keadaan tetap.
    if (this.shotMode) {
      this.time += STEP;
      this.renderer.render(this);
      requestAnimationFrame((t) => this.frame(t));
      return;
    }
    this.accumulator += dt;
    let steps = 0;
    while (this.accumulator >= STEP && steps < 5) {
      this.update();
      this.accumulator -= STEP;
      steps++;
    }
    if (steps === 5) this.accumulator = 0;
    this.renderer.render(this);
    requestAnimationFrame((t) => this.frame(t));
  }

  run() {
    requestAnimationFrame((t) => this.frame(t));
  }
}

// Boot: kanvas mengisi jendela, permainan mulai di layar judul.
const canvas = document.getElementById('game');
function fitCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
fitCanvas();
window.addEventListener('resize', fitCanvas);

const game = new Game(canvas);
window.__skyCourier = game; // untuk playtest otomatis
game.run();
