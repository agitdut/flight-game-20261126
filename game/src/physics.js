// Sky Courier — model terbang pesawat kurir "Merpati".
// Satu-satunya tempat fisika tinggal: throttle mengatur kecepatan target,
// pitch mengatur naik/turun, bank mengatur belok. Kecepatan di bawah stall
// membuat pesawat kehilangan daya angkat dan menukik.

import { GAME, PLANE, SCORE } from './config.js';
import { clamp, lerp, angleDelta } from './random.js';

export function createPlaneState() {
  return {
    x: 0, // posisi lateral (satuan dunia), 0 = tengah koridor
    y: 24, // ketinggian (satuan dunia)
    z: 0, // jarak maju sepanjang leg
    heading: 0, // radian, 0 = lurus ke depan
    speed: 0, // satuan/detik
    throttle: 0.55,
    pitch: 0, // radian, + mendaki
    bank: 0, // radian, + miring kanan
    verticalSpeed: 0,
    fuel: 100,
    damage: 0,
    invulnerable: 0,
    stalling: false,
    onGround: true,
    landed: false,
    crashed: false,
    outOfFuel: false,
    gearDown: false,
  };
}

// Satu langkah simulasi dengan timestep tetap (1/60 detik).
// Mengembalikan daftar kejadian pada langkah ini untuk efek + suara.
export function stepPlane(p, input, world, leg, dt) {
  const events = [];
  if (p.crashed || p.landed) return events;

  // --- throttle ---
  if (input.throttleUp) p.throttle = clamp(p.throttle + 0.55 * dt, 0, 1);
  if (input.throttleDown) p.throttle = clamp(p.throttle - 0.55 * dt, 0, 1);
  if (input.mouseThrottle !== undefined && input.mouseThrottle !== null) {
    p.throttle = clamp(input.mouseThrottle, 0, 1);
  }

  // --- kecepatan menuju target throttle ---
  const targetSpeed = 30 + p.throttle * (GAME.maxSpeed - 30);
  p.speed = lerp(p.speed, targetSpeed, clamp((PLANE.accel / Math.max(1, targetSpeed)) * dt * 2.2, 0, 1));
  if (p.speed < 0) p.speed = 0;

  // --- pitch & bank menuju input (dengan smoothing) ---
  const pitchTarget = clamp(input.pitch * 0.5, -0.5, 0.5);
  p.pitch = lerp(p.pitch, pitchTarget, clamp(4.5 * dt, 0, 1));
  const bankTarget = clamp(input.roll * PLANE.maxBank, -PLANE.maxBank, PLANE.maxBank);
  p.bank = lerp(p.bank, bankTarget, clamp(PLANE.rollRate * dt * 2.4, 0, 1));

  // --- stall: kecepatan rendah + pitch ke atas = kehilangan angkat ---
  p.stalling = p.speed < GAME.stallSpeed && p.pitch > 0.02 && !p.onGround;
  if (p.stalling && events.length < 8) {
    // sekali per langkah sudah cukup; main.js memakai flag untuk alarm
  }

  // --- gerak ---
  const climbFactor = p.stalling ? -0.85 : 1;
  p.verticalSpeed = Math.sin(p.pitch) * p.speed * PLANE.climbRate * climbFactor;
  // Angin leg mendorong pesawat menyamping perlahan.
  const windPush = (leg.wind || 0) * 6 * dt;
  p.heading += p.bank * PLANE.turnRate * dt * clamp(p.speed / 90, 0.25, 1);
  p.heading = clamp(p.heading, -0.6, 0.6);
  // Sayap rata = pesawat cepat kembali lurus (tidak terus melayang).
  if (Math.abs(p.bank) < 0.06) {
    p.heading = lerp(p.heading, 0, clamp(1.6 * dt, 0, 1));
    if (Math.abs(p.heading) < 0.002) p.heading = 0;
  }
  // Gerakan lateral terutama mengikuti bank (langsung, tanpa inersia
  // heading) supaya kontrol terasa menjawab; heading menambah sedikit
  // momentum belok. Lepas tombol = sayap rata = berhenti melayang.
  const lateralSpeed = Math.sin(p.bank) * p.speed * 0.6 + Math.sin(p.heading) * p.speed * 0.3;
  p.x += lateralSpeed * dt + windPush;
  p.z += Math.cos(p.heading) * p.speed * dt;
  p.y += p.verticalSpeed * dt;
  p.y = clamp(p.y, GAME.minAltitude, GAME.maxAltitude);

  // --- batas koridor: dorong halus kembali ---
  if (p.x > GAME.corridorHalf) {
    p.x = GAME.corridorHalf;
    p.heading -= 0.25 * dt;
    if (!p.corridorWarned) events.push({ type: 'corridor' });
    p.corridorWarned = true;
  } else if (p.x < -GAME.corridorHalf) {
    p.x = -GAME.corridorHalf;
    p.heading += 0.25 * dt;
    if (!p.corridorWarned) events.push({ type: 'corridor' });
    p.corridorWarned = true;
  } else {
    p.corridorWarned = false;
  }

  // --- bahan bakar ---
  if (!p.onGround) {
    p.fuel -= (PLANE.fuelBurnBase + PLANE.fuelBurnThrottle * p.throttle) * dt;
    if (p.fuel <= 0) {
      p.fuel = 0;
      p.outOfFuel = true;
      p.throttle = 0;
      events.push({ type: 'outoffuel' });
    }
  }

  // --- lepas landas / menyentuh tanah ---
  if (p.onGround) {
    p.y = GAME.minAltitude + 4;
    if (p.speed > 78 && p.pitch > 0.08) {
      p.onGround = false;
      events.push({ type: 'takeoff' });
    }
  }

  // --- ring: pesawat melewati bidang z ring ---
  const prevZ = p.z - Math.cos(p.heading) * p.speed * dt;
  for (const ring of world.rings) {
    if (ring.passed || ring.missed) continue;
    if (prevZ < ring.z && p.z >= ring.z) {
      const dx = p.x - ring.x;
      const dy = p.y - ring.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= ring.radius) {
        ring.passed = true;
        events.push({ type: 'ring', ring, dist });
      } else {
        ring.missed = true;
        events.push({ type: 'ringmiss', ring, dist });
      }
    }
  }

  // --- paket ---
  for (const parcel of world.parcels) {
    if (parcel.taken) continue;
    const dz = Math.abs(p.z - parcel.z);
    if (dz < 9) {
      const dx = p.x - parcel.x;
      const dy = p.y - parcel.y;
      if (Math.sqrt(dx * dx + dy * dy) < 13) {
        parcel.taken = true;
        events.push({ type: 'parcel', parcel });
      }
    }
  }

  // --- rintangan ---
  if (p.invulnerable > 0) p.invulnerable -= dt;
  for (const ob of world.obstacles) {
    const dz = Math.abs(p.z - ob.z);
    if (dz > ob.radius + 6) continue;
    const dx = p.x - ob.x;
    const dy = p.y - ob.y;
    if (Math.sqrt(dx * dx + dy * dy) < ob.radius + 5) {
      if (p.invulnerable <= 0 && !p.onGround) {
        p.damage += PLANE.damageOnHit;
        p.invulnerable = PLANE.invulnerableSeconds;
        events.push({ type: 'hit', obstacle: ob });
        if (p.damage >= 100) {
          p.damage = 100;
          p.crashed = true;
          events.push({ type: 'crash' });
        }
      }
    }
  }

  // --- menabrak tanah / gunung (ketinggian minimum) ---
  if (!p.onGround && p.y <= GAME.minAltitude + 0.5 && p.speed > 40) {
    if (p.invulnerable <= 0) {
      p.damage += PLANE.damageOnHit;
      p.invulnerable = PLANE.invulnerableSeconds;
      events.push({ type: 'hitground' });
      if (p.damage >= 100) {
        p.damage = 100;
        p.crashed = true;
        events.push({ type: 'crash' });
      }
    }
  }

  // --- mendarat di landasan akhir leg ---
  const runway = world.runwayEndZ;
  if (!p.onGround && p.z >= runway - 30 && p.z <= runway + 190) {
    const aligned = Math.abs(p.x) < 9 && Math.abs(p.heading) < 0.22;
    const slow = p.speed < 105;
    const low = p.y <= 14;
    if (low && slow && aligned) {
      p.landed = true;
      p.onGround = true;
      const center = 1 - Math.min(1, Math.abs(p.x) / 9);
      const smooth = 1 - Math.min(1, Math.abs(p.verticalSpeed) / 22);
      const quality = center * 0.5 + smooth * 0.5;
      const bonus =
        quality > 0.82 ? SCORE.landingPerfect : quality > 0.55 ? SCORE.landingGood : SCORE.landingRough;
      events.push({ type: 'landed', quality, bonus });
    } else if (low && !aligned && p.z > runway + 60) {
      // Mendarat kasar di luar landasan: rusak, tapi leg tetap selesai
      // bila pesawat masih utuh.
      if (p.invulnerable <= 0) {
        p.damage += 18;
        p.invulnerable = PLANE.invulnerableSeconds;
        events.push({ type: 'rough' });
      }
    }
  }

  // Kehabisan bahan bakar di udara: meluncur turun sampai jatuh.
  if (p.outOfFuel && !p.onGround) {
    p.y -= GAME.gravityDrop * 0.35 * dt;
    if (p.y <= GAME.minAltitude + 0.5) {
      p.crashed = true;
      events.push({ type: 'crash' });
    }
  }

  // Stall berat di udara rendah = jatuh.
  if (p.stalling && p.y <= GAME.minAltitude + 2 && p.speed < 40) {
    p.crashed = true;
    events.push({ type: 'crash' });
  }

  return events;
}

// Skor ring memakai combo beruntun: makin banyak ring berturut-turut
// tanpa miss, makin besar bonusnya.
export function ringScore(combo) {
  return SCORE.ring + Math.min(8, combo) * SCORE.comboStep;
}
