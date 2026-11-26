// Sky Courier — semua gambar: langit, pegunungan, tanah petak sawah,
// jalan, sungai, landasan, ring, rintangan, pesawat, dan HUD.
// Kamera mengejar dari belakang pesawat; dunia diproyeksikan perspektif
// sederhana (skala = fokus / jarak).

import { GAME, COLORS } from './config.js';
import { clamp, lerp, mulberry32, cellHash } from './random.js';

const FIELD_COLORS = ['#7da95c', '#a8bf6a', '#c2b26a', '#5d8a4a', '#6f9e57'];

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.W = canvas.width;
    this.H = canvas.height;
    this.ridgeFar = this.makeRidge(20261126 + 11, 46, 26);
    this.ridgeNear = this.makeRidge(20261126 + 77, 70, 52);
  }

  makeRidge(seed, base, amp) {
    const rng = mulberry32(seed);
    const pts = [];
    let h = base;
    for (let i = 0; i <= 24; i++) {
      h = clamp(h + (rng() - 0.5) * amp, 12, base + amp * 1.6);
      pts.push(h);
    }
    return pts;
  }

  // Proyeksi satu titik dunia ke layar. null bila di belakang kamera.
  project(wx, wy, wz, cam, heading, pitch) {
    const dz = wz - cam.z;
    if (dz < 3) return null;
    const s = GAME.focal / dz;
    const horizon = GAME.horizonY + pitch * 300;
    const x = this.W / 2 + (wx - cam.x) * s - Math.tan(heading) * GAME.focal * 0.85;
    const y = horizon - (wy - cam.y) * s;
    return { x, y, s, dz };
  }

  camera(p) {
    return { x: p.x * 0.92, y: p.y + 6.5, z: p.z - 15 };
  }

  render(state) {
    const { ctx, W, H } = this;
    const p = state.plane;
    const cam = this.camera(p);
    ctx.clearRect(0, 0, W, H);
    this.drawSky(state, p);
    ctx.save();
    // Dunia ikut miring mengikuti bank pesawat (kamera yang miring).
    ctx.translate(W / 2, H * 0.55);
    ctx.rotate(-p.bank * 0.42);
    ctx.translate(-W / 2, -H * 0.55);
    this.drawRidges(state, p);
    this.drawGround(state, p, cam);
    this.drawRunways(state, p, cam);
    this.drawClouds(state, p, cam);
    this.drawRings(state, p, cam);
    this.drawParcels(state, p, cam);
    this.drawObstacles(state, p, cam);
    this.drawShadow(state, p, cam);
    ctx.restore();
    this.drawPlane(state, p);
    if (state.mode === 'flying' || state.mode === 'landing') this.drawHUD(state, p);
    if (state.mode === 'title') this.drawTitle(state);
    if (state.mode === 'briefing') this.drawBriefing(state);
    if (state.mode === 'paused') this.drawPaused(state);
    if (state.mode === 'legdone') this.drawLegDone(state);
    if (state.mode === 'gameover') this.drawGameOver(state);
    if (state.mode === 'victory') this.drawVictory(state);
    this.drawMessages(state);
  }

  drawSky(state, p) {
    const { ctx, W, H } = this;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    const dusk = state.legIndex === 2;
    if (dusk) {
      g.addColorStop(0, '#2b3a6e');
      g.addColorStop(0.45, '#c97e4e');
      g.addColorStop(0.62, '#f6d9a0');
      g.addColorStop(1, '#5d8a4a');
    } else {
      g.addColorStop(0, COLORS.skyTop);
      g.addColorStop(0.5, COLORS.skyMid);
      g.addColorStop(0.68, COLORS.skyHorizon);
      g.addColorStop(1, '#8fb573');
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // Matahari
    const sunX = W * 0.78 - p.heading * 300;
    const sunY = 120 - p.pitch * 160;
    ctx.save();
    ctx.globalAlpha = 0.9;
    const sg = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 90);
    sg.addColorStop(0, COLORS.sun);
    sg.addColorStop(0.25, 'rgba(255, 240, 190, 0.85)');
    sg.addColorStop(1, 'rgba(255, 240, 190, 0)');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 90, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawRidge(pts, baseY, color, heading, parallax) {
    const { ctx, W } = this;
    const shift = -heading * 420 * parallax;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-40, baseY + 4);
    const step = (W + 80) / (pts.length - 1);
    for (let i = 0; i < pts.length; i++) {
      const x = -40 + i * step + shift;
      ctx.lineTo(x, baseY - pts[i]);
    }
    ctx.lineTo(W + 40, baseY + 4);
    ctx.closePath();
    ctx.fill();
  }

  drawRidges(state, p) {
    const horizon = GAME.horizonY + p.pitch * 300;
    this.drawRidge(this.ridgeFar, horizon + 2, 'rgba(93, 122, 158, 0.85)', p.heading, 0.4);
    this.drawRidge(this.ridgeNear, horizon + 2, 'rgba(70, 104, 78, 0.9)', p.heading, 0.8);
  }

  drawGround(state, p, cam) {
    const { ctx, W, H } = this;
    const horizon = GAME.horizonY + p.pitch * 300;
    // Dasar tanah di bawah horizon.
    ctx.fillStyle = '#6f9e57';
    ctx.fillRect(0, horizon, W, H - horizon);

    const world = state.world;
    const zStart = Math.max(10, Math.floor((cam.z + 12) / 25) * 25);
    const rows = 42;
    // Gambar dari jauh ke dekat supaya yang dekat menimpa yang jauh.
    for (let ri = rows - 1; ri >= 0; ri--) {
      const z0 = zStart + ri * 25;
      const z1 = z0 + 25;
      for (let cx = -6; cx < 6; cx++) {
        const x0 = cx * 15;
        const x1 = x0 + 15;
        const a = this.project(x0, 0, z0, cam, p.heading, p.pitch);
        const b = this.project(x1, 0, z0, cam, p.heading, p.pitch);
        const c = this.project(x1, 0, z1, cam, p.heading, p.pitch);
        const d = this.project(x0, 0, z1, cam, p.heading, p.pitch);
        if (!a || !b || !c || !d) continue;
        const col = world.fieldColor(cx, Math.floor(z0 / 25));
        ctx.fillStyle = FIELD_COLORS[col];
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.lineTo(c.x, c.y);
        ctx.lineTo(d.x, d.y);
        ctx.closePath();
        ctx.fill();
        // Tekstur petak: bayangan dalam + rumpun pohon sesekali, supaya
        // ladang tidak terlihat seperti blok warna polos dari kejauhan.
        const detail = cellHash(cx, Math.floor(z0 / 25), 99);
        if (detail < 0.45) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.10)';
          ctx.beginPath();
          ctx.moveTo(lerp(a.x, b.x, 0.25), lerp(a.y, b.y, 0.25));
          ctx.lineTo(lerp(b.x, a.x, 0.25), lerp(b.y, a.y, 0.25));
          ctx.lineTo(lerp(c.x, d.x, 0.25), lerp(c.y, d.y, 0.25));
          ctx.lineTo(lerp(d.x, c.x, 0.25), lerp(d.y, c.y, 0.25));
          ctx.closePath();
          ctx.fill();
        } else if (detail > 0.96) {
          // Rumpun pohon kecil: jarang, mungil, lonjong seperti semak.
          const tx = (a.x + b.x + c.x + d.x) / 4;
          const ty = (a.y + b.y + c.y + d.y) / 4;
          const tr = Math.max(1, 1.1 * a.s);
          ctx.fillStyle = 'rgba(38, 84, 38, 0.9)';
          ctx.beginPath();
          ctx.ellipse(tx, ty, tr, tr * 0.6, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      // Jalan utama membelah petak.
      for (const rx of world.roadX()) {
        const a = this.project(rx - 3, 0.1, z0, cam, p.heading, p.pitch);
        const b = this.project(rx + 3, 0.1, z0, cam, p.heading, p.pitch);
        const c = this.project(rx + 3, 0.1, z1, cam, p.heading, p.pitch);
        const d = this.project(rx - 3, 0.1, z1, cam, p.heading, p.pitch);
        if (!a || !b || !c || !d) continue;
        ctx.fillStyle = COLORS.road;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.lineTo(c.x, c.y);
        ctx.lineTo(d.x, d.y);
        ctx.closePath();
        ctx.fill();
      }
      // Sungai berkelok.
      const rxc = world.riverX(z0);
      const a = this.project(rxc - 7, 0.1, z0, cam, p.heading, p.pitch);
      const b = this.project(rxc + 7, 0.1, z0, cam, p.heading, p.pitch);
      const c = this.project(rxc + 7, 0.1, z1, cam, p.heading, p.pitch);
      const d = this.project(rxc - 7, 0.1, z1, cam, p.heading, p.pitch);
      if (a && b && c && d) {
        ctx.fillStyle = COLORS.river;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.lineTo(c.x, c.y);
        ctx.lineTo(d.x, d.y);
        ctx.closePath();
        ctx.fill();
      }
    }
    this.drawTowns(state, p, cam);
  }

  drawTowns(state, p, cam) {
    const { ctx } = this;
    const rng = mulberry32(20261126 + state.legIndex * 331);
    for (let i = 0; i < 7; i++) {
      const tx = -70 + rng() * 140;
      const tz = 200 + rng() * (state.world.length - 400);
      if (Math.abs(tz - p.z) > 700) continue;
      const houses = 4 + Math.floor(rng() * 6);
      for (let h = 0; h < houses; h++) {
        const hx = tx + (rng() - 0.5) * 22;
        const hz = tz + (rng() - 0.5) * 22;
        const pr = this.project(hx, 0, hz, cam, p.heading, p.pitch);
        if (!pr || pr.y < GAME.horizonY) continue;
        const w = Math.max(2, 9 * pr.s);
        const hh = Math.max(2, 6 * pr.s);
        ctx.fillStyle = h % 3 === 0 ? '#c96a4a' : '#e8e0cc';
        ctx.fillRect(pr.x - w / 2, pr.y - hh, w, hh);
      }
    }
  }

  drawRunwayStrip(state, p, cam, zStart, zEnd) {
    const { ctx } = this;
    const step = 20;
    for (let z = zStart; z < zEnd; z += step) {
      const a = this.project(-8, 0.15, z, cam, p.heading, p.pitch);
      const b = this.project(8, 0.15, z, cam, p.heading, p.pitch);
      const c = this.project(8, 0.15, z + step, cam, p.heading, p.pitch);
      const d = this.project(-8, 0.15, z + step, cam, p.heading, p.pitch);
      if (!a || !b || !c || !d) continue;
      ctx.fillStyle = COLORS.runway;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(c.x, c.y);
      ctx.lineTo(d.x, d.y);
      ctx.closePath();
      ctx.fill();
      // Garis tengah putus-putus.
      if (Math.floor(z / 40) % 2 === 0) {
        const m1 = this.project(-0.7, 0.2, z, cam, p.heading, p.pitch);
        const m2 = this.project(0.7, 0.2, z, cam, p.heading, p.pitch);
        const m3 = this.project(0.7, 0.2, z + step, cam, p.heading, p.pitch);
        const m4 = this.project(-0.7, 0.2, z + step, cam, p.heading, p.pitch);
        if (m1 && m2 && m3 && m4) {
          ctx.fillStyle = COLORS.runwayMark;
          ctx.beginPath();
          ctx.moveTo(m1.x, m1.y);
          ctx.lineTo(m2.x, m2.y);
          ctx.lineTo(m3.x, m3.y);
          ctx.lineTo(m4.x, m4.y);
          ctx.closePath();
          ctx.fill();
        }
      }
      // Lampu tepi landasan: titik kuning menyala di kedua sisi, supaya
      // landasan terbaca dari jauh saat approach.
      for (const ex of [-9.5, 9.5]) {
        const e = this.project(ex, 0.4, z, cam, p.heading, p.pitch);
        if (!e) continue;
        const r = Math.max(1.2, 3.2 * e.s);
        ctx.save();
        ctx.fillStyle = '#ffd23e';
        ctx.shadowColor = '#ffd23e';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(e.x, e.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
    // Lampu approach: baris cahaya putih menuju ambang landasan.
    for (let z = zStart - 160; z < zStart - 10; z += 20) {
      const a = this.project(-5, 0.3, z, cam, p.heading, p.pitch);
      const b = this.project(5, 0.3, z, cam, p.heading, p.pitch);
      const c = this.project(5, 0.3, z + 8, cam, p.heading, p.pitch);
      const d = this.project(-5, 0.3, z + 8, cam, p.heading, p.pitch);
      if (!a || !b || !c || !d) continue;
      ctx.save();
      ctx.fillStyle = 'rgba(255, 244, 200, 0.95)';
      ctx.shadowColor = '#fff3c4';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(c.x, c.y);
      ctx.lineTo(d.x, d.y);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    // Ambang landasan: empat bilah putih (piano keys) di kedua ujung.
    for (const zt of [zStart, zEnd - 6]) {
      for (const bcx of [-6.4, -2.2, 2.2, 6.4]) {
        const a = this.project(bcx - 1.3, 0.2, zt, cam, p.heading, p.pitch);
        const b = this.project(bcx + 1.3, 0.2, zt, cam, p.heading, p.pitch);
        const c = this.project(bcx + 1.3, 0.2, zt + 6, cam, p.heading, p.pitch);
        const d = this.project(bcx - 1.3, 0.2, zt + 6, cam, p.heading, p.pitch);
        if (!a || !b || !c || !d) continue;
        ctx.fillStyle = COLORS.runwayMark;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.lineTo(c.x, c.y);
        ctx.lineTo(d.x, d.y);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  drawRunways(state, p, cam) {
    const world = state.world;
    this.drawRunwayStrip(state, p, cam, world.runwayStartZ - 20, world.runwayStartZ + 260);
    this.drawRunwayStrip(state, p, cam, world.runwayEndZ - 20, world.runwayEndZ + 260);
  }

  drawClouds(state, p, cam) {
    const { ctx } = this;
    for (const c of state.world.clouds) {
      const dz = c.z - cam.z;
      if (dz < 5 || dz > 1500) continue;
      const pr = this.project(c.x, c.y, c.z, cam, p.heading, p.pitch);
      if (!pr) continue;
      const s = c.s * pr.s;
      if (s < 2) continue;
      ctx.save();
      ctx.globalAlpha = c.shade < 0.5 ? 0.92 : 0.75;
      ctx.fillStyle = c.shade < 0.5 ? '#ffffff' : '#e8eef5';
      ctx.beginPath();
      ctx.ellipse(pr.x, pr.y, s, s * 0.42, 0, 0, Math.PI * 2);
      ctx.ellipse(pr.x - s * 0.55, pr.y + s * 0.08, s * 0.62, s * 0.3, 0, 0, Math.PI * 2);
      ctx.ellipse(pr.x + s * 0.55, pr.y + s * 0.08, s * 0.66, s * 0.32, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  drawRings(state, p, cam) {
    const { ctx } = this;
    const next = state.world.nextRing();
    for (const ring of state.world.rings) {
      if (ring.passed) continue;
      const dz = ring.z - cam.z;
      if (dz < 4 || dz > 1600) continue;
      const pr = this.project(ring.x, ring.y, ring.z, cam, p.heading, p.pitch);
      if (!pr) continue;
      const r = Math.max(2, ring.radius * pr.s);
      const isNext = ring === next;
      const color = isNext
        ? state.legIndex === 2
          ? '#ff7a5c'
          : state.legIndex === 1
            ? COLORS.ringNext
            : COLORS.ringPass
        : COLORS.ringFar;
      ctx.save();
      ctx.globalAlpha = isNext ? 1 : 0.55;
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(2, r * 0.1);
      ctx.shadowColor = color;
      ctx.shadowBlur = isNext ? 18 : 6;
      ctx.beginPath();
      ctx.arc(pr.x, pr.y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      // Nomor ring di tengah.
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.max(11, Math.floor(r * 0.5))}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(ring.index + 1), pr.x, pr.y);
      ctx.restore();
    }
    // Panah pemandu ke ring berikutnya bila di luar layar.
    if (next) {
      const pr = this.project(next.x, next.y, next.z, cam, p.heading, p.pitch);
      if (pr && (pr.x < 60 || pr.x > this.W - 60 || pr.y < 60 || pr.y > this.H - 160)) {
        const ax = clamp(pr.x, 70, this.W - 70);
        const ay = clamp(pr.y, 70, this.H - 170);
        ctx.save();
        ctx.fillStyle = COLORS.ringNext;
        ctx.font = 'bold 15px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`RING ${next.index + 1} — ${Math.round(next.z - p.z)} m`, ax, ay - 26);
        ctx.beginPath();
        ctx.moveTo(ax, ay - 12);
        ctx.lineTo(ax - 12, ay + 10);
        ctx.lineTo(ax + 12, ay + 10);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
  }

  drawParcels(state, p, cam) {
    const { ctx } = this;
    for (const parcel of state.world.parcels) {
      if (parcel.taken) continue;
      const dz = parcel.z - cam.z;
      if (dz < 4 || dz > 900) continue;
      const bob = Math.sin(state.time * 2 + parcel.z) * 2;
      const pr = this.project(parcel.x, parcel.y + bob, parcel.z, cam, p.heading, p.pitch);
      if (!pr) continue;
      const s = Math.max(3, 7 * pr.s);
      ctx.save();
      ctx.translate(pr.x, pr.y);
      ctx.rotate(Math.sin(state.time + parcel.z) * 0.2);
      ctx.fillStyle = '#d97b2f';
      ctx.strokeStyle = '#8a4d16';
      ctx.lineWidth = 1.5;
      ctx.fillRect(-s, -s, s * 2, s * 2);
      ctx.strokeRect(-s, -s, s * 2, s * 2);
      ctx.strokeStyle = '#fff3d6';
      ctx.beginPath();
      ctx.moveTo(-s, 0);
      ctx.lineTo(s, 0);
      ctx.moveTo(0, -s);
      ctx.lineTo(0, s);
      ctx.stroke();
      ctx.restore();
    }
  }

  drawObstacles(state, p, cam) {
    const { ctx } = this;
    for (const ob of state.world.obstacles) {
      const dz = ob.z - cam.z;
      if (dz < 4 || dz > 1100) continue;
      const bob = ob.kind === 'bird' ? Math.sin(state.time * 6 + ob.phase) * 4 : 0;
      const pr = this.project(ob.x, ob.y + bob, ob.z, cam, p.heading, p.pitch);
      if (!pr) continue;
      const r = Math.max(3, ob.radius * pr.s);
      if (ob.kind === 'storm') {
        ctx.save();
        ctx.globalAlpha = 0.92;
        ctx.fillStyle = '#3d4450';
        ctx.beginPath();
        ctx.ellipse(pr.x, pr.y, r, r * 0.55, 0, 0, Math.PI * 2);
        ctx.ellipse(pr.x - r * 0.6, pr.y + r * 0.12, r * 0.6, r * 0.4, 0, 0, Math.PI * 2);
        ctx.ellipse(pr.x + r * 0.6, pr.y + r * 0.12, r * 0.65, r * 0.42, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#232833';
        ctx.beginPath();
        ctx.ellipse(pr.x, pr.y + r * 0.28, r * 0.8, r * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
        // Kilat sesekali.
        if (Math.sin(state.time * 2.3 + ob.phase) > 0.93) {
          ctx.strokeStyle = '#ffe66d';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(pr.x, pr.y + r * 0.4);
          ctx.lineTo(pr.x - r * 0.15, pr.y + r * 0.9);
          ctx.lineTo(pr.x + r * 0.05, pr.y + r * 0.9);
          ctx.lineTo(pr.x - r * 0.1, pr.y + r * 1.4);
          ctx.stroke();
        }
        ctx.restore();
      } else if (ob.kind === 'balloon') {
        ctx.save();
        ctx.fillStyle = '#e05252';
        ctx.beginPath();
        ctx.ellipse(pr.x, pr.y, r * 0.8, r, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f6d9a0';
        ctx.beginPath();
        ctx.ellipse(pr.x, pr.y, r * 0.32, r * 0.95, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#5a4632';
        ctx.lineWidth = Math.max(1, r * 0.06);
        ctx.beginPath();
        ctx.moveTo(pr.x - r * 0.4, pr.y + r * 0.7);
        ctx.lineTo(pr.x - r * 0.3, pr.y + r * 1.35);
        ctx.moveTo(pr.x + r * 0.4, pr.y + r * 0.7);
        ctx.lineTo(pr.x + r * 0.3, pr.y + r * 1.35);
        ctx.stroke();
        ctx.fillStyle = '#8a6b45';
        ctx.fillRect(pr.x - r * 0.32, pr.y + r * 1.3, r * 0.64, r * 0.5);
        ctx.restore();
      } else {
        // Burung camar: dua sayap mengepak.
        const flap = Math.sin(state.time * 9 + ob.phase) * 0.5;
        ctx.save();
        ctx.strokeStyle = '#2b2f36';
        ctx.lineWidth = Math.max(1.5, r * 0.12);
        ctx.beginPath();
        ctx.moveTo(pr.x - r, pr.y - flap * r * 0.4);
        ctx.quadraticCurveTo(pr.x - r * 0.4, pr.y + r * 0.25, pr.x, pr.y);
        ctx.quadraticCurveTo(pr.x + r * 0.4, pr.y + r * 0.25, pr.x + r, pr.y - flap * r * 0.4);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  drawShadow(state, p, cam) {
    const { ctx } = this;
    const pr = this.project(p.x, 0, p.z + 10, cam, p.heading, p.pitch);
    if (!pr || pr.y < GAME.horizonY) return;
    const s = clamp(26 * pr.s, 2, 60);
    ctx.save();
    ctx.globalAlpha = clamp(0.35 - (p.y / GAME.maxAltitude) * 0.25, 0.08, 0.35);
    ctx.fillStyle = '#1c2b1a';
    ctx.beginPath();
    ctx.ellipse(pr.x, pr.y, s * 1.6, s * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawPlane(state, p) {
    const { ctx, W, H } = this;
    const px = W / 2;
    const py = H * 0.64 - p.pitch * 130 + (p.onGround ? 26 : 0);
    const bank = p.bank;
    const scale = p.onGround ? 1.08 : 1;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-bank * 0.9);
    ctx.scale(scale, scale);
    // Bayangan lembut di bawah pesawat.
    ctx.fillStyle = 'rgba(10, 20, 30, 0.18)';
    ctx.beginPath();
    ctx.ellipse(0, 96, 92, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    // Sayap (kiri-kanan), tampak dari belakang-atas.
    ctx.fillStyle = '#1f7a6d';
    ctx.strokeStyle = '#146052';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-14, 6);
    ctx.lineTo(-148, 26);
    ctx.lineTo(-152, 40);
    ctx.lineTo(-12, 30);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(14, 6);
    ctx.lineTo(148, 26);
    ctx.lineTo(152, 40);
    ctx.lineTo(12, 30);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Ujung sayap: lampu navigasi (merah kiri, hijau kanan, berkedip).
    const blink = Math.sin(state.time * 4) > 0 ? 1 : 0.25;
    ctx.globalAlpha = blink;
    ctx.fillStyle = '#ff4d4d';
    ctx.beginPath();
    ctx.arc(-150, 33, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#37e08a';
    ctx.beginPath();
    ctx.arc(150, 33, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    // Ekor horizontal + sirip vertikal.
    ctx.fillStyle = '#e05252';
    ctx.beginPath();
    ctx.moveTo(-8, 62);
    ctx.lineTo(-52, 78);
    ctx.lineTo(-50, 88);
    ctx.lineTo(-6, 76);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(8, 62);
    ctx.lineTo(52, 78);
    ctx.lineTo(50, 88);
    ctx.lineTo(6, 76);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#e05252';
    ctx.beginPath();
    ctx.moveTo(-4, 58);
    ctx.lineTo(0, 8);
    ctx.lineTo(10, 58);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.save();
    ctx.translate(3, 52);
    ctx.rotate(0.06);
    ctx.fillText('M', 0, 0);
    ctx.restore();
    // Badan pesawat: dari ekor (bawah, dekat kamera) ke hidung (atas).
    const bodyGrad = ctx.createLinearGradient(0, 84, 0, -78);
    bodyGrad.addColorStop(0, '#f4f6f0');
    bodyGrad.addColorStop(0.55, '#ffffff');
    bodyGrad.addColorStop(1, '#dfe8f0');
    ctx.fillStyle = bodyGrad;
    ctx.strokeStyle = '#b9c4cc';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-17, 84);
    ctx.quadraticCurveTo(-20, 20, -11, -62);
    ctx.quadraticCurveTo(-7, -80, 0, -82);
    ctx.quadraticCurveTo(7, -80, 11, -62);
    ctx.quadraticCurveTo(20, 20, 17, 84);
    ctx.quadraticCurveTo(0, 92, -17, 84);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Garis merah khas Merpati di badan.
    ctx.fillStyle = '#e05252';
    ctx.beginPath();
    ctx.moveTo(-16, 66);
    ctx.quadraticCurveTo(-18, 20, -11, -40);
    ctx.lineTo(-6, -40);
    ctx.quadraticCurveTo(-12, 20, -10, 66);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(16, 66);
    ctx.quadraticCurveTo(18, 20, 11, -40);
    ctx.lineTo(6, -40);
    ctx.quadraticCurveTo(12, 20, 10, 66);
    ctx.closePath();
    ctx.fill();
    // Kaca kokpit.
    ctx.fillStyle = '#16324a';
    ctx.beginPath();
    ctx.ellipse(0, -46, 9, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.ellipse(-3, -54, 3, 8, 0.2, 0, Math.PI * 2);
    ctx.fill();
    // Baling-baling di hidung: cakram + 2 bilah berputar.
    const propAngle = state.time * 42;
    ctx.save();
    ctx.translate(0, -84);
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = '#9fb2c0';
    ctx.beginPath();
    ctx.ellipse(0, 0, 26, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.85;
    ctx.rotate(propAngle);
    ctx.fillStyle = '#2b2f36';
    ctx.fillRect(-2, -30, 4, 60);
    ctx.rotate(Math.PI / 2);
    ctx.fillRect(-2, -30, 4, 60);
    ctx.restore();
    ctx.fillStyle = '#e05252';
    ctx.beginPath();
    ctx.arc(0, -84, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ---------- HUD ----------

  drawHUD(state, p) {
    const { ctx, W, H } = this;
    const leg = state.leg;
    ctx.save();
    ctx.textBaseline = 'alphabetic';
    // Panel atas: skor, leg, waktu.
    ctx.fillStyle = 'rgba(8, 18, 32, 0.55)';
    ctx.fillRect(0, 0, W, 64);
    ctx.fillStyle = COLORS.hud;
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`SKOR ${state.score}`, 18, 40);
    ctx.font = '15px sans-serif';
    ctx.fillStyle = COLORS.hudDim;
    ctx.fillText(`KOMBO x${state.combo}   RING ${state.ringsPassed}/${leg.rings}`, 18, 58);
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.hud;
    ctx.font = 'bold 17px sans-serif';
    ctx.fillText(leg.name, W / 2, 26);
    ctx.font = '13px sans-serif';
    ctx.fillStyle = COLORS.hudDim;
    const distLeft = Math.max(0, Math.round(state.world.runwayEndZ - p.z));
    ctx.fillText(`LANDASAN ${distLeft} m  •  ${this.formatTime(state.time)}`, W / 2, 46);
    this.drawCompass(state, p);
    this.drawFlightData(state, p);
    this.drawAttitude(state, p);
    this.drawFuelHull(state, p);
    this.drawThrottle(state, p);
    // Peringatan.
    if (p.stalling && !p.onGround) this.flashText('STALL! NAIKKAN KECEPATAN', H * 0.3, COLORS.warning, state);
    else if (p.fuel < 22 && !p.onGround) this.flashText('BAHAN BAKAR RENDAH', H * 0.3, COLORS.fuel, state);
    else if (p.damage >= 60) this.flashText('BADAN PESAWAT RUSAK PARAH', H * 0.3, COLORS.warning, state);
    // Panduan mendarat.
    if (p.z > state.world.runwayEndZ - 520 && p.z < state.world.runwayEndZ + 200 && !p.landed) {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px sans-serif';
      const aligned = Math.abs(p.x) < 9;
      ctx.fillText(
        aligned ? '▲ SEJAJAR LANDASAN — TURUNKAN KECEPATAN DI BAWAH 105' : '◀ SEJAJARKAN DENGAN LANDASAN ▶',
        W / 2,
        H - 178,
      );
    }
    // Beacon ambang landasan: berlian berdenyut + jarak, supaya landasan
    // selalu terbaca dari kejauhan saat approach.
    if (p.z < state.world.runwayEndZ && p.z > state.world.runwayEndZ - 900 && !p.landed) {
      const cam = this.camera(p);
      const bp = this.project(0, 4, state.world.runwayEndZ, cam, p.heading, p.pitch);
      if (bp && bp.y > 90 && bp.y < H - 200) {
        const pulse = 0.6 + 0.4 * Math.sin(state.time * 5);
        const bx = clamp(bp.x, 90, W - 90);
        const by = clamp(bp.y, 100, H - 220);
        ctx.save();
        ctx.globalAlpha = pulse;
        ctx.strokeStyle = '#ffd23e';
        ctx.lineWidth = 3;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.moveTo(bx, by - 16);
        ctx.lineTo(bx + 14, by);
        ctx.lineTo(bx, by + 16);
        ctx.lineTo(bx - 14, by);
        ctx.closePath();
        ctx.stroke();
        ctx.fillStyle = '#ffd23e';
        ctx.font = 'bold 15px sans-serif';
        ctx.textAlign = 'center';
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.strokeText(`LANDASAN ${Math.round(state.world.runwayEndZ - p.z)} m`, bx, by - 26);
        ctx.fillText(`LANDASAN ${Math.round(state.world.runwayEndZ - p.z)} m`, bx, by - 26);
        ctx.restore();
      }
    }
    ctx.restore();
  }

  flashText(text, y, color, state) {
    const { ctx, W } = this;
    if (Math.sin(state.time * 7) < -0.2) return;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 16;
    ctx.fillText(text, W / 2, y);
    ctx.restore();
  }

  drawCompass(state, p) {
    const { ctx, W } = this;
    const cx = W / 2;
    const cy = 84;
    const half = 150;
    const headingDeg = ((p.heading * 180) / Math.PI % 360 + 360) % 360;
    ctx.save();
    ctx.fillStyle = 'rgba(8, 18, 32, 0.5)';
    ctx.fillRect(cx - half - 8, cy - 20, half * 2 + 16, 34);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.strokeRect(cx - half - 8, cy - 20, half * 2 + 16, 34);
    ctx.beginPath();
    ctx.rect(cx - half, cy - 20, half * 2, 34);
    ctx.clip();
    for (let d = -180; d <= 180; d += 5) {
      const deg = Math.round((headingDeg + d) / 5) * 5;
      const norm = ((deg % 360) + 360) % 360;
      const dx = (d - (headingDeg - Math.round(headingDeg / 5) * 5)) * 2.4;
      const x = cx + dx;
      const major = norm % 45 === 0;
      const mid = norm % 15 === 0;
      ctx.strokeStyle = major ? '#ffffff' : 'rgba(255,255,255,0.5)';
      ctx.lineWidth = major ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(x, cy + 12);
      ctx.lineTo(x, cy + (major ? -4 : mid ? 2 : 6));
      ctx.stroke();
      if (major) {
        const label = { 0: 'U', 90: 'T', 180: 'S', 270: 'B' }[norm] || String(norm).padStart(3, '0');
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(label, x, cy - 6);
      }
    }
    ctx.restore();
    // Penanda heading saat ini.
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath();
    ctx.moveTo(cx, cy + 16);
    ctx.lineTo(cx - 6, cy + 6);
    ctx.lineTo(cx + 6, cy + 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(Math.round(headingDeg)).padStart(3, '0') + '°', cx, cy + 34);
  }

  drawFlightData(state, p) {
    const { ctx, W } = this;
    const x = W - 24;
    ctx.textAlign = 'right';
    const altFt = Math.round(p.y * 12);
    const spdKt = Math.round(p.speed * 1.15);
    const vsi = Math.round(p.verticalSpeed * 60);
    const rows = [
      ['ALT', `${altFt} ft`],
      ['SPD', `${spdKt} kt`],
      ['VSI', `${vsi >= 0 ? '+' : ''}${vsi} ft/m`],
      ['HDG', `${String(Math.round(((p.heading * 180) / Math.PI % 360 + 360) % 360)).padStart(3, '0')}°`],
    ];
    ctx.font = 'bold 22px monospace';
    rows.forEach(([label, value], i) => {
      const y = 100 + i * 40;
      ctx.fillStyle = 'rgba(8, 18, 32, 0.55)';
      ctx.fillRect(x - 168, y - 24, 168, 32);
      ctx.fillStyle = COLORS.hudDim;
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(label, x - 160, y - 2);
      ctx.fillStyle = COLORS.hud;
      ctx.font = 'bold 20px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(value, x - 8, y - 2);
    });
  }

  drawAttitude(state, p) {
    const { ctx, H } = this;
    const cx = 96;
    const cy = H - 96;
    const r = 56;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.translate(cx, cy);
    ctx.rotate(-p.bank);
    ctx.translate(0, p.pitch * 130);
    ctx.fillStyle = '#4f97c4';
    ctx.fillRect(-r, -r * 2, r * 2, r * 2);
    ctx.fillStyle = '#8a6b45';
    ctx.fillRect(-r, 0, r * 2, r * 2);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-r, 0);
    ctx.lineTo(r, 0);
    ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
    // Simbol pesawat tetap di tengah.
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath();
    ctx.moveTo(-26, 0);
    ctx.lineTo(26, 0);
    ctx.lineTo(0, 4);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = COLORS.hudDim;
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ATTITUDE', cx, cy + r + 16);
  }

  drawThrottle(state, p) {
    const { ctx, H } = this;
    const x = 178;
    const y0 = H - 152;
    const h = 112;
    ctx.fillStyle = 'rgba(8, 18, 32, 0.55)';
    ctx.fillRect(x - 8, y0 - 8, 34, h + 16);
    ctx.fillStyle = '#22384a';
    ctx.fillRect(x, y0, 18, h);
    const fillH = h * p.throttle;
    const grad = ctx.createLinearGradient(0, y0 + h, 0, y0);
    grad.addColorStop(0, '#37e08a');
    grad.addColorStop(0.7, '#ffd23e');
    grad.addColorStop(1, '#ff5347');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y0 + h - fillH, 18, fillH);
    ctx.fillStyle = COLORS.hud;
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('THR', x + 9, y0 - 14);
    ctx.fillText(`${Math.round(p.throttle * 100)}%`, x + 9, y0 + h + 26);
  }

  drawFuelHull(state, p) {
    const { ctx, W, H } = this;
    const x = W - 220;
    const y = H - 96;
    ctx.textAlign = 'left';
    this.bar(x, y, 196, 16, p.fuel / 100, p.fuel < 22 ? COLORS.warning : COLORS.fuel, 'BAHAN BAKAR');
    this.bar(x, y + 34, 196, 16, 1 - p.damage / 100, p.damage >= 60 ? COLORS.warning : '#37e08a', 'BADAN PESAWAT');
    ctx.fillStyle = COLORS.hudDim;
    ctx.font = '11px sans-serif';
    ctx.fillText(`RING ${state.ringsPassed}/${state.leg.rings}  •  PAKET ${state.parcelsTaken}/${state.leg.parcels}`, x, y + 66);
  }

  bar(x, y, w, h, frac, color, label) {
    const { ctx } = this;
    ctx.fillStyle = 'rgba(8, 18, 32, 0.6)';
    ctx.fillRect(x - 4, y - 4, w + 8, h + 8);
    ctx.fillStyle = '#22384a';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, Math.max(0, w * clamp(frac, 0, 1)), h);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(label, x + 4, y + h - 4);
  }

  formatTime(t) {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  // ---------- Pesan mengambang ----------

  drawMessages(state) {
    const { ctx, W } = this;
    ctx.save();
    ctx.textAlign = 'center';
    state.messages.forEach((m, i) => {
      const age = state.time - m.at;
      if (age > 2.2) return;
      const alpha = age < 1.6 ? 1 : 1 - (age - 1.6) / 0.6;
      ctx.globalAlpha = alpha;
      ctx.font = 'bold 26px sans-serif';
      ctx.fillStyle = m.color || '#ffffff';
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 8;
      ctx.fillText(m.text, W / 2, 210 + i * 34);
    });
    ctx.restore();
  }

  // ---------- Layar-layar ----------

  panel(x, y, w, h) {
    const { ctx } = this;
    ctx.fillStyle = 'rgba(6, 14, 26, 0.72)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, w, h);
  }

  drawTitle(state) {
    const { ctx, W, H } = this;
    this.panel(W / 2 - 330, 120, 660, 420);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd23e';
    ctx.font = 'bold 54px sans-serif';
    ctx.fillText('SKY COURIER', W / 2, 200);
    ctx.fillStyle = '#ffffff';
    ctx.font = '28px sans-serif';
    ctx.fillText('— Merpati Run —', W / 2, 240);
    ctx.font = '17px sans-serif';
    ctx.fillStyle = '#cfe3f2';
    ctx.fillText('Pilot pesawat kurir melintasi kepulauan. Terbang melewati ring,', W / 2, 290);
    ctx.fillText('antar paket, dan mendarat sempurna sebelum bahan bakar habis.', W / 2, 314);
    ctx.font = 'bold 16px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('3 LEG  •  24 RING  •  19 PAKET  •  BADAI, BALON & BURUNG', W / 2, 352);
    ctx.font = '15px monospace';
    ctx.fillStyle = '#9fc4dd';
    ctx.fillText('↑ ↓  PITCH      ← →  BELOK      SHIFT / CTRL  THROTTLE', W / 2, 400);
    ctx.fillText('MOUSE  KEMUDIKAN      P  JEDA      M  SUARA      ENTER  MULAI', W / 2, 424);
    ctx.font = 'bold 22px sans-serif';
    ctx.fillStyle = Math.sin(state.time * 4) > -0.4 ? '#37e08a' : '#9fc4dd';
    ctx.fillText('TEKAN ENTER UNTUK TERBANG', W / 2, 486);
    if (state.best > 0) {
      ctx.font = '15px sans-serif';
      ctx.fillStyle = '#ffd23e';
      ctx.fillText(`SKOR TERBAIK: ${state.best}`, W / 2, 520);
    }
  }

  drawBriefing(state) {
    const { ctx, W, H } = this;
    const leg = state.leg;
    this.panel(W / 2 - 320, 180, 640, 300);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd23e';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText(leg.name, W / 2, 240);
    ctx.fillStyle = '#eaf6ff';
    ctx.font = '17px sans-serif';
    this.wrapText(leg.brief, W / 2, 280, 560, 26);
    ctx.font = '15px monospace';
    ctx.fillStyle = '#9fc4dd';
    ctx.fillText(
      `RING ${leg.rings}  •  PAKET ${leg.parcels}  •  BADAI ${leg.stormClouds}  •  BAHAN BAKAR ${leg.fuel}`,
      W / 2,
      400,
    );
    ctx.font = 'bold 20px sans-serif';
    ctx.fillStyle = Math.sin(state.time * 4) > -0.4 ? '#37e08a' : '#cfe3f2';
    ctx.fillText('TEKAN ENTER UNTUK LEPAS LANDAS', W / 2, 448);
  }

  wrapText(text, cx, y, maxWidth, lineHeight) {
    const { ctx } = this;
    const words = text.split(' ');
    let line = '';
    let yy = y;
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, cx, yy);
        line = word;
        yy += lineHeight;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, cx, yy);
  }

  drawPaused(state) {
    const { ctx, W, H } = this;
    ctx.fillStyle = 'rgba(6, 14, 26, 0.6)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 44px sans-serif';
    ctx.fillText('JEDA', W / 2, H / 2 - 10);
    ctx.font = '18px sans-serif';
    ctx.fillStyle = '#cfe3f2';
    ctx.fillText('Tekan P untuk lanjut terbang', W / 2, H / 2 + 30);
  }

  drawLegDone(state) {
    const { ctx, W } = this;
    const d = state.legResult;
    this.panel(W / 2 - 300, 170, 600, 330);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#37e08a';
    ctx.font = 'bold 34px sans-serif';
    ctx.fillText('LEG SELESAI!', W / 2, 230);
    ctx.fillStyle = '#ffffff';
    ctx.font = '18px sans-serif';
    ctx.fillText(`Pendaratan: ${d.landingLabel}  (+${d.landingBonus})`, W / 2, 280);
    ctx.fillText(`Ring: ${d.ringsPassed}/${state.leg.rings}  •  Paket: ${d.parcelsTaken}/${state.leg.parcels}`, W / 2, 310);
    ctx.fillText(`Bonus waktu: +${d.timeBonus}`, W / 2, 340);
    ctx.fillStyle = '#ffd23e';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(`SKOR LEG: ${d.legScore}   •   TOTAL: ${state.score}`, W / 2, 388);
    ctx.fillStyle = '#cfe3f2';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(
      state.legIndex + 1 < 3 ? 'TEKAN ENTER — LEG BERIKUTNYA' : 'TEKAN ENTER — LIHAT HASIL AKHIR',
      W / 2,
      448,
    );
  }

  drawGameOver(state) {
    const { ctx, W } = this;
    this.panel(W / 2 - 320, 170, 640, 320);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff5347';
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(state.crashReason || 'PESAWAT JATUH', W / 2, 240);
    ctx.fillStyle = '#eaf6ff';
    ctx.font = '17px sans-serif';
    ctx.fillText(state.crashDetail || 'Merpati tidak berhasil menyelesaikan leg ini.', W / 2, 282);
    ctx.fillStyle = '#ffd23e';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(`SKOR AKHIR: ${state.score}`, W / 2, 336);
    ctx.fillStyle = '#cfe3f2';
    ctx.font = '16px sans-serif';
    ctx.fillText(`Leg ${state.legIndex + 1}  •  Ring ${state.ringsPassed}  •  Paket ${state.parcelsTaken}`, W / 2, 372);
    ctx.font = 'bold 19px sans-serif';
    ctx.fillStyle = Math.sin(state.time * 4) > -0.4 ? '#37e08a' : '#cfe3f2';
    ctx.fillText('TEKAN R UNTUK TERBANG LAGI', W / 2, 438);
  }

  drawVictory(state) {
    const { ctx, W } = this;
    this.panel(W / 2 - 330, 150, 660, 380);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd23e';
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText('MISI SELESAI!', W / 2, 214);
    ctx.fillStyle = '#ffffff';
    ctx.font = '19px sans-serif';
    ctx.fillText('Merpati mengantar semua paket dan mendarat di tiga landasan.', W / 2, 256);
    ctx.fillText('Kepulauan berterima kasih, Pilot.', W / 2, 282);
    ctx.fillStyle = '#37e08a';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText(`SKOR AKHIR: ${state.score}`, W / 2, 340);
    ctx.fillStyle = '#eaf6ff';
    ctx.font = '17px sans-serif';
    ctx.fillText(`Ring ${state.totalRings}/${state.totalRingsMax}  •  Paket ${state.totalParcels}/${state.totalParcelsMax}`, W / 2, 380);
    ctx.fillText(`Pendaratan sempurna: ${state.perfectLandings} dari 3`, W / 2, 406);
    if (state.best > 0) {
      ctx.fillStyle = '#ffd23e';
      ctx.fillText(`Skor terbaik di browser ini: ${state.best}`, W / 2, 438);
    }
    ctx.fillStyle = '#cfe3f2';
    ctx.font = 'bold 19px sans-serif';
    ctx.fillText('TEKAN R UNTUK MISI BARU', W / 2, 492);
  }
}
