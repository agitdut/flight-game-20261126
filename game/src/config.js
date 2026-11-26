// Sky Courier: Merpati Run — konfigurasi permainan.
// Satu-satunya tempat angka-angka tuning tinggal: kecepatan, bahan bakar,
// skor, ukuran dunia, dan definisi tiap leg misi.

export const GAME = {
  title: 'SKY COURIER',
  subtitle: 'Merpati Run',
  canvasWidth: 1280,
  canvasHeight: 800,
  horizonY: 330, // garis horizon pada layar 800px
  focal: 620, // jarak fokus proyeksi perspektif
  corridorHalf: 68, // setengah lebar koridor terbang (satuan dunia)
  minAltitude: 2,
  maxAltitude: 380,
  stallSpeed: 58, // di bawah ini pesawat kehilangan daya angkat
  maxSpeed: 205,
  gravityDrop: 26, // laju jatuh saat stall (satuan/detik)
};

export const PLANE = {
  cruiseThrottle: 0.62,
  accel: 34, // satuan kecepatan per detik menuju target
  climbRate: 0.5, // faktor vertikal dari pitch x kecepatan
  rollRate: 2.4, // radian per detik menuju bank target
  maxBank: 0.85, // radian
  turnRate: 0.55, // radian/detik pada bank penuh
  fuelBurnBase: 0.22, // per detik
  fuelBurnThrottle: 0.6, // per detik pada throttle penuh
  damageOnHit: 26,
  invulnerableSeconds: 1.6,
};

// Definisi tiap leg misi. Leg makin jauh makin banyak ring, makin sempit,
// makin banyak awan badai, dan bahan bakar makin ketat.
export const LEGS = [
  {
    name: 'Leg 1 — Pagi di Kepulauan Merpati',
    brief:
      'Terbang melewati semua ring hijau, kumpulkan paket, lalu mendarat di landasan. Jaga kecepatan di atas stall.',
    length: 9000,
    rings: 6,
    ringRadius: 18,
    parcels: 5,
    stormClouds: 2,
    balloons: 2,
    birds: 0,
    fuel: 100,
    wind: 0.0,
    timeBonus: 400,
  },
  {
    name: 'Leg 2 — Antar Paket Menembus Badai',
    brief:
      'Awan badai bermunculan di koridor. Hindari awan hitam dan balon udara, kejar ring kuning yang lebih kecil.',
    length: 12000,
    rings: 8,
    ringRadius: 13,
    parcels: 6,
    stormClouds: 6,
    balloons: 4,
    birds: 2,
    fuel: 100,
    wind: 0.35,
    timeBonus: 600,
  },
  {
    name: 'Leg 3 — Senja Terakhir',
    brief:
      'Angin kencang, burung camar di mana-mana, bahan bakar pas-pasan. Ring merah sempit — terbang bersih dan mendarat sempurna.',
    length: 15000,
    rings: 10,
    ringRadius: 11,
    parcels: 8,
    stormClouds: 9,
    balloons: 5,
    birds: 5,
    fuel: 100,
    wind: 0.8,
    timeBonus: 900,
  },
];

export const SCORE = {
  ring: 100,
  parcel: 50,
  comboStep: 25, // bonus per combo beruntun
  landingPerfect: 500, // mendarat di tengah landasan, pelan, halus
  landingGood: 250,
  landingRough: 100,
  legClearBase: 200,
};

export const COLORS = {
  skyTop: '#1d4e89',
  skyMid: '#7db3e8',
  skyHorizon: '#f6d9a0',
  sun: '#fff3c4',
  sea: '#2e6f9e',
  fieldA: '#7da95c',
  fieldB: '#a8bf6a',
  fieldC: '#c2b26a',
  fieldD: '#5d8a4a',
  road: '#6b6257',
  river: '#4f97c4',
  runway: '#3a3f46',
  runwayMark: '#f4f6f0',
  ringPass: '#37e08a',
  ringNext: '#ffd23e',
  ringFar: '#e8f4ff',
  hud: '#eaf6ff',
  hudDim: '#9fc4dd',
  warning: '#ff5347',
  fuel: '#ffcf3f',
};

// Benih tetap supaya dunia tiap leg deterministik: tangkapan layar dan
// dua run program menghasilkan dunia yang sama persis.
export const SEED_BASE = 20261126;
