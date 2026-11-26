# flight-game-20261126

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/agitdut/flight-game-20261126/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/agitdut/flight-game-20261126/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

**Sky Courier — Merpati Run**: pilot pesawat kurir propeler melintasi kepulauan. Terbang melewati ring target, antar paket, hindari awan badai, balon udara, dan burung camar — lalu mendarat sempurna di landasan sebelum bahan bakar habis. Tiga leg dengan kesulitan naik: angin kencang, ring makin sempit, bahan bakar makin ketat.

## Run it

```sh
node serve.ts
# buka http://localhost:8080 di desktop Chrome
```

Tanpa build step, tanpa request jaringan: `game/` murni file statis (HTML + modul ES + suara WebAudio prosedural). `main.ts` (Node 22, stdlib saja) menyerahkan game ke `/output` beserta `dossier.json`.

## Cara main

| Kontrol | Fungsi |
|---|---|
| `↑` / `↓` atau `W` / `S` | Pitch — mendaki / menukik |
| `←` / `→` atau `A` / `D` | Bank — belok kiri / kanan |
| `Shift` / `Ctrl` (atau `E` / `Q`) | Throttle naik / turun |
| Mouse | Gerakkan kursor untuk mengemudi |
| `Enter` | Mulai / lanjut ke leg berikutnya |
| `P` | Jeda |
| `M` | Suara hidup / mati |
| `R` | Misi baru (di layar akhir) |

## Aturan main

- **Ring**: terbang tepat menembus ring untuk poin (+100, bonus combo beruntun +25/ring). Ring yang terlewat memutus combo.
- **Paket**: kumpulkan kotak paket melayang (+50).
- **Bahan bakar**: habis di udara = meluncur jatuh. Throttle penuh membakar lebih cepat — kelola hemat.
- **Stall**: kecepatan di bawah 58 kt sambil mendaki = kehilangan daya angkat. Jaga kecepatan!
- **Kerusakan**: tabrakan dengan awan badai, balon, burung, atau tanah mengurangi integritas badan pesawat. 100% = jatuh.
- **Mendarat**: sejajar landasan, kecepatan di bawah 105 kt, turun perlahan. Pendaratan sempurna +500, bagus +250, kasar +100. Melewati landasan = go-around otomatis.
- **Skor**: ring + paket + bonus pendaratan + bonus waktu + bonus penyelesaian leg. Skor terbaik tersimpan di browser.

## Struktur kode

```
game/
  index.html        halaman game (kanvas fullscreen)
  src/
    config.js       tuning, definisi leg, skor, warna
    random.js       RNG deterministik (mulberry32) + hash sel ladang
    audio.js        suara prosedural WebAudio (mesin, angin, lonceng)
    input.js        keyboard + mouse
    world.js        isi dunia tiap leg: ring, paket, rintangan, awan
    physics.js      model terbang: throttle, stall, tabrakan, mendarat
    render.js       gambar: langit, terrain, pesawat, HUD, layar-layar
    shots.js        keadaan deterministik untuk screenshot (?shot=...)
    main.js         loop utama + mesin keadaan permainan
main.ts             entrypoint: salin game/ + screenshots/ ke /output, tulis dossier.json
serve.ts            server statis lokal untuk playtest
screenshots/        4 screenshot asli dari game (start, play, landing, end)
```

Semua isi dunia lahir dari benih tetap per leg, jadi permainan deterministik: dua run yang sama menghasilkan dunia yang sama.

---

<sub>Entered on [make.fun](https://make.fun/?ref=git&utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>
