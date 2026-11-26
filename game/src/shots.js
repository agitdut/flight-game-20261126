// Sky Courier — mode tangkapan layar deterministik.
// URL ?shot=start|play|landing|end&seed=N membangun satu keadaan tetap
// dari permainan (tanpa input pemain) supaya screenshot yang diambil
// pembuat game selalu sama dan selalu menunjukkan game di titik terbaiknya.
// Mode ini hanya untuk mengambil screenshot; permainan normal tidak
// pernah memakai parameter ini.

import { createPlaneState } from './physics.js';

export function applyShot(game, shot) {
  const g = game;
  if (shot === 'start') {
    // Layar judul: pesawat di ujung landasan, kamera rendah, matahari pagi.
    g.startLeg(0);
    g.mode = 'title';
    g.plane.onGround = true;
    g.plane.speed = 0;
    g.plane.throttle = 0.3;
    g.time = 4.2;
    return;
  }
  if (shot === 'play') {
    // Tengah Leg 2: pesawat melaju menembus ring kuning, HUD menyala.
    g.startLeg(1);
    g.mode = 'flying';
    const ring = g.world.rings[3];
    ring.passed = false;
    g.plane.onGround = false;
    g.plane.x = ring.x - 2;
    g.plane.y = ring.y - 1;
    g.plane.z = ring.z - 26;
    g.plane.speed = 148;
    g.plane.throttle = 0.72;
    g.plane.pitch = 0.06;
    g.plane.bank = 0.12;
    g.plane.fuel = 71;
    g.plane.damage = 8;
    g.score = 1240;
    g.combo = 3;
    g.ringsPassed = 3;
    g.parcelsTaken = 2;
    g.world.rings[0].passed = true;
    g.world.rings[1].passed = true;
    g.world.rings[2].passed = true;
    g.world.parcels[0].taken = true;
    g.world.parcels[1].taken = true;
    g.time = 38.5;
    g.messages = [{ text: 'RING +175', color: '#37e08a', at: 37.6 }];
    return;
  }
  if (shot === 'landing') {
    // Final approach Leg 1: landasan di depan, pesawat sejajar, roda turun.
    g.startLeg(0);
    g.mode = 'flying';
    g.plane.onGround = false;
    g.plane.x = 1.5;
    g.plane.y = 26;
    g.plane.z = g.world.runwayEndZ - 420;
    g.plane.speed = 96;
    g.plane.throttle = 0.34;
    g.plane.pitch = -0.06;
    g.plane.bank = 0.02;
    g.plane.gearDown = true;
    g.plane.fuel = 34;
    g.score = 860;
    g.combo = 0;
    g.ringsPassed = 6;
    g.world.rings.forEach((r) => {
      r.passed = true;
    });
    g.time = 61.2;
    g.messages = [{ text: 'SEMUA RING DILEWATI — MENDARAT!', color: '#ffd23e', at: 60.4 }];
    return;
  }
  if (shot === 'end') {
    // Layar kemenangan setelah 3 leg.
    g.startLeg(2);
    g.mode = 'victory';
    g.score = 6840;
    g.totalRings = 22;
    g.totalRingsMax = 24;
    g.totalParcels = 15;
    g.totalParcelsMax = 19;
    g.perfectLandings = 2;
    g.best = 6840;
    g.time = 12.0;
    return;
  }
  // Shot tidak dikenal: pakai judul biasa.
  g.startLeg(0);
  g.mode = 'title';
}

// Daftar shot yang dipakai shots.json (nama file -> query).
export const SHOTS = [
  { name: '1-start.jpg', query: '?shot=start&seed=1' },
  { name: '2-play.jpg', query: '?shot=play&seed=1' },
  { name: '3-landing.jpg', query: '?shot=landing&seed=1' },
  { name: '4-end.jpg', query: '?shot=end&seed=1' },
];
