# Ridho Player v2 (Offline Spotify-like) — Windows 10 EXE Setup

Ini versi yang UI-nya lebih “Spotify-ish”:
- Sidebar: Home / Search / Your Library
- Liked Songs (local)
- Metadata (Title/Artist/Album + cover dari tag file) via `music-metadata`
- Home cards: Quick picks & Recently added
- Table view mirip Spotify: Title / Artist / Album / Time
- Keyboard shortcuts: Space, N, P, ←/→

## Prasyarat (Windows 10)
- Install **Node.js LTS**
- Pastikan `node -v` dan `npm -v` jalan

## Jalankan (dev)
```bash
npm install
npm start
```

## Build jadi EXE Setup (installer)
```bash
npm run dist
```

Output biasanya:
`dist\\Ridho Player Setup 2.0.0.exe`

## Catatan ukuran file
ZIP project ini memang kecil (source code).
Tapi saat build EXE setup, Electron akan ikut dibundle sehingga size installer bisa puluhan sampai ratusan MB — itu normal.
