const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const mm = require('music-metadata');

let mainWindow;

function createWindow () {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 800,
    minWidth: 1040,
    minHeight: 680,
    backgroundColor: "#0b0f14",
    show: false,
    title: "Ridho Player",
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

function walkMusicFiles(dir) {
  const exts = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac']);
  let results = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    return results;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results = results.concat(walkMusicFiles(full));
    else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (exts.has(ext)) results.push({ path: full, name: entry.name, ext });
    }
  }
  return results;
}

ipcMain.handle('pick-folder', async () => {
  const res = await dialog.showOpenDialog(mainWindow, {
    title: 'Pilih folder musik',
    properties: ['openDirectory']
  });
  if (res.canceled || !res.filePaths?.length) return { canceled: true };
  const folder = res.filePaths[0];
  const files = walkMusicFiles(folder);
  return { canceled: false, folder, files };
});

ipcMain.handle('to-file-url', async (_evt, p) => {
  try {
    const url = new URL(`file://${p.replace(/\\/g, '/')}`);
    return url.toString();
  } catch (e) {
    return `file:///${p.replace(/\\/g, '/')}`;
  }
});

// Read metadata on-demand (title/artist/album/duration + embedded cover)
ipcMain.handle('read-metadata', async (_evt, filePath) => {
  try {
    const metadata = await mm.parseFile(filePath, { duration: true, skipCovers: false });
    const common = metadata.common || {};
    const format = metadata.format || {};
    let pictureDataUrl = null;

    const pic = Array.isArray(common.picture) && common.picture.length ? common.picture[0] : null;
    if (pic && pic.data && pic.format) {
      const b64 = Buffer.from(pic.data).toString('base64');
      pictureDataUrl = `data:${pic.format};base64,${b64}`;
    }

    return {
      ok: true,
      title: common.title || null,
      artist: common.artist || null,
      album: common.album || null,
      trackNo: common.track?.no || null,
      year: common.year || null,
      duration: (typeof format.duration === 'number') ? format.duration : null,
      pictureDataUrl
    };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
});
