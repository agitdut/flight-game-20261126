// Sky Courier — generator angka acak deterministik (mulberry32).
// Semua isi dunia (ladang, awan, ring, rintangan) lahir dari benih tetap,
// jadi dua run permainan yang sama menghasilkan dunia yang sama persis.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Hash stabil dari koordinat sel (x, z) menjadi angka 0..1. Dipakai untuk
// warna ladang: sel yang sama selalu berwarna sama di setiap frame.
export function cellHash(x, z, salt = 0) {
  let h = (x * 374761393 + z * 668265263 + salt * 974634) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function range(rng, min, max) {
  return min + rng() * (max - min);
}

export function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

export function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Sudut terpendek dari a ke b (radian), untuk memutar kompas dengan halus.
export function angleDelta(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
