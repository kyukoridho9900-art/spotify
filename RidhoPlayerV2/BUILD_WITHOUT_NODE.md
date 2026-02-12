# Build EXE Setup tanpa install Node di PC kamu (pakai GitHub Actions)

## Langkah cepat
1. Buat repo baru di GitHub
2. Upload seluruh isi folder project ini (termasuk folder `.github`)
3. Buka tab **Actions** → pilih workflow **Build Windows Installer**
4. Klik **Run workflow**
5. Setelah selesai, download **Artifacts** bernama `RidhoPlayer-Setup`
6. Di dalamnya ada file installer: `Ridho Player Setup 2.0.0.exe`

Catatan:
- Kamu TIDAK perlu install Node di laptopmu untuk menjalankan installer.
- Node hanya dipakai di server GitHub saat proses build.
