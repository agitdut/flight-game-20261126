// Sky Courier — isi dunia tiap leg: ring target, paket, rintangan,
// awan, dan landasan. Semua lahir dari benih leg sehingga dunia yang
// sama selalu muncul untuk leg yang sama (deterministik).

import { mulberry32, range, cellHash } from './random.js';
import { GAME, SEED_BASE } from './config.js';

// Satu cincin target yang harus diterbangi pesawat.
export class Ring {
  constructor(x, y, z, radius, index) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.radius = radius;
    this.index = index;
    this.passed = false;
    this.missed = false;
  }
}

export class Parcel {
  constructor(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.taken = false;
    this.spin = 0;
  }
}

// Rintangan: 'storm' (awan badai, merusak), 'balloon' (balon udara),
// 'bird' (kawanan camar, bergerak menyilang).
export class Obstacle {
  constructor(kind, x, y, z, radius) {
    this.kind = kind;
    this.x = x;
    this.y = y;
    this.z = z;
    this.radius = radius;
    this.phase = Math.random() * Math.PI * 2;
  }
}

export class World {
  constructor(legIndex, leg) {
    this.legIndex = legIndex;
    this.leg = leg;
    this.rng = mulberry32(SEED_BASE + legIndex * 7919);
    this.length = leg.length;
    this.runwayStartZ = 40;
    this.runwayEndZ = leg.length - 60;
    this.rings = [];
    this.parcels = [];
    this.obstacles = [];
    this.clouds = [];
    this.buildRings();
    this.buildParcels();
    this.buildObstacles();
    this.buildClouds();
  }

  buildRings() {
    const leg = this.leg;
    const usable = this.length - 500;
    for (let i = 0; i < leg.rings; i++) {
      const t = (i + 1) / (leg.rings + 1);
      const z = 320 + t * usable;
      // Ring makin jauh makin menantang: x dan y makin menyebar.
      const spreadX = 26 + i * 3.2;
      const spreadY = 60 + i * 16;
      const x = range(this.rng, -spreadX, spreadX);
      const y = range(this.rng, 55, Math.min(300, 55 + spreadY));
      this.rings.push(new Ring(x, y, z, leg.ringRadius, i));
    }
  }

  buildParcels() {
    for (let i = 0; i < this.leg.parcels; i++) {
      const z = range(this.rng, 420, this.length - 300);
      const x = range(this.rng, -52, 52);
      const y = range(this.rng, 45, 300);
      this.parcels.push(new Parcel(x, y, z));
    }
  }

  buildObstacles() {
    const leg = this.leg;
    // Awan badai: jangan taruh tepat di jalur ring (beri jarak aman).
    for (let i = 0; i < leg.stormClouds; i++) {
      const z = range(this.rng, 500, this.length - 250);
      if (this.nearRing(z, 130)) continue;
      this.obstacles.push(
        new Obstacle('storm', range(this.rng, -56, 56), range(this.rng, 50, 320), z, 26),
      );
    }
    for (let i = 0; i < leg.balloons; i++) {
      const z = range(this.rng, 500, this.length - 250);
      if (this.nearRing(z, 110)) continue;
      this.obstacles.push(
        new Obstacle('balloon', range(this.rng, -50, 50), range(this.rng, 60, 240), z, 13),
      );
    }
    for (let i = 0; i < leg.birds; i++) {
      const z = range(this.rng, 600, this.length - 200);
      this.obstacles.push(
        new Obstacle('bird', range(this.rng, -46, 46), range(this.rng, 70, 260), z, 10),
      );
    }
  }

  nearRing(z, margin) {
    return this.rings.some((r) => Math.abs(r.z - z) < margin);
  }

  buildClouds() {
    // Awan hias (tidak berbahaya) tersebar di langit sepanjang leg.
    for (let i = 0; i < 42; i++) {
      this.clouds.push({
        x: range(this.rng, -160, 160),
        y: range(this.rng, 180, 420),
        z: range(this.rng, 60, this.length),
        s: range(this.rng, 14, 42),
        shade: range(this.rng, 0, 1),
      });
    }
  }

  nextRing() {
    return this.rings.find((r) => !r.passed && !r.missed) || null;
  }

  ringsLeft() {
    return this.rings.filter((r) => !r.passed && !r.missed).length;
  }

  // Warna ladang untuk sel grid (cx, cz): petak sawah yang konsisten.
  fieldColor(cx, cz) {
    const h = cellHash(cx, cz, this.legIndex * 31 + 7);
    if (h < 0.28) return 0;
    if (h < 0.52) return 1;
    if (h < 0.74) return 2;
    if (h < 0.9) return 3;
    return 4; // 10%: petak kota kecil / hutan
  }

  // Sungai berkelok: posisi x sungai pada jarak z tertentu.
  riverX(z) {
    return Math.sin(z * 0.0016) * 34 + Math.sin(z * 0.00041) * 18;
  }

  // Jalan utama membelah koridor di x = -28 dan x = +30.
  roadX() {
    return [-28, 30];
  }
}
