const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const statusPill = $("#statusPill");
const folderPathEl = $("#folderPath");
const searchInput = $("#searchInput");

const chipFolder = $("#chipFolder");
const chipCount = $("#chipCount");
const npLine = $("#npLine");

const quickGrid = $("#quickGrid");
const recentGrid = $("#recentGrid");

const libraryList = $("#libraryList");
const searchList = $("#searchList");
const likedList = $("#likedList");

const audio = $("#audio");
const playBtn = $("#playBtn");
const prevBtn = $("#prevBtn");
const nextBtn = $("#nextBtn");
const seek = $("#seek");
const vol = $("#vol");
const tCur = $("#tCur");
const tDur = $("#tDur");

const nowTitle = $("#nowTitle");
const nowArtist = $("#nowArtist");
const coverImg = $("#coverImg");
const coverFallback = $("#coverFallback");
const likeBtn = $("#likeBtn");

const shuffleBtn = $("#shuffleBtn");
const sortBtn = $("#sortBtn");
const likedBtn = $("#likedBtn");
const pickFolderBtn = $("#pickFolder");

let folder = null;
let library = [];     // {id, path, fileName, ext, addedAt, meta?}
let filtered = [];
let queue = [];
let currentIndex = -1;
let isPlaying = false;
let isShuffle = false;
let sortAZ = true;

const LS_KEY = "ridho_player_v2_state";

function saveState(){
  const likedIds = getLikedSet();
  const state = { likedIds: [...likedIds] };
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}
function loadState(){
  try{
    const s = JSON.parse(localStorage.getItem(LS_KEY) || "{}");
    return s && typeof s === "object" ? s : {};
  }catch{ return {}; }
}
function getLikedSet(){
  const s = loadState();
  return new Set(Array.isArray(s.likedIds) ? s.likedIds : []);
}

function setActiveView(view){
  $$(".view").forEach(v => v.classList.remove("active"));
  $(`#view-${view}`).classList.add("active");
  $$(".navBtn").forEach(b => b.classList.toggle("active", b.dataset.view === view));
}

$$(".navBtn").forEach(btn => btn.addEventListener("click", () => setActiveView(btn.dataset.view)));

likedBtn.addEventListener("click", () => {
  setActiveView("liked");
  renderLiked();
});

function setStatus(text){ statusPill.textContent = text; }

function formatTime(sec){
  if(!isFinite(sec)) return "0:00";
  sec = Math.max(0, Math.floor(sec));
  const m = Math.floor(sec/60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2,"0")}`;
}

function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, s => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[s]));
}

async function enrichMeta(track){
  if(track.metaLoaded) return track;
  const res = await window.ridho.readMetadata(track.path);
  if(res && res.ok){
    track.meta = {
      title: res.title || null,
      artist: res.artist || null,
      album: res.album || null,
      duration: res.duration || null,
      pictureDataUrl: res.pictureDataUrl || null
    };
  } else {
    track.meta = track.meta || {};
  }
  track.metaLoaded = true;
  return track;
}

function displayTitle(track){
  const m = track.meta || {};
  return m.title || track.fileName;
}
function displayArtist(track){
  const m = track.meta || {};
  return m.artist || "Unknown Artist";
}
function displayAlbum(track){
  const m = track.meta || {};
  return m.album || "Unknown Album";
}
function displayDuration(track){
  const m = track.meta || {};
  if(m.duration) return formatTime(m.duration);
  return "—";
}

async function renderHome(){
  quickGrid.innerHTML = "";
  recentGrid.innerHTML = "";

  const picks = library.slice(0, 8);
  const recent = [...library].slice(-8).reverse();

  for(const t of picks){
    const card = mkCard(t, "Quick pick");
    quickGrid.appendChild(card);
  }
  for(const t of recent){
    const card = mkCard(t, "Recently added");
    recentGrid.appendChild(card);
  }
}

function mkCard(track, subtitle){
  const el = document.createElement("div");
  el.className = "card";
  el.innerHTML = `
    <div class="cardTop">
      <div class="thumb">♪</div>
      <div style="min-width:0">
        <div class="cardTitle">${escapeHtml(track.fileName)}</div>
        <div class="cardSub">${escapeHtml(subtitle)}</div>
      </div>
    </div>
  `;
  el.addEventListener("click", async () => {
    setActiveView("library");
    const idx = filtered.findIndex(x => x.id === track.id);
    if(idx >= 0) playFromFilteredIndex(idx);
    else playFromLibraryId(track.id);
  });
  return el;
}

function applySearch(){
  const q = (searchInput.value || "").trim().toLowerCase();
  // Simple search based on filename + (cached) meta title/artist/album
  const likedSet = getLikedSet();
  const src = [...library];

  filtered = src.filter(t => {
    if(!q) return true;
    const m = t.meta || {};
    const hay = `${t.fileName} ${m.title||""} ${m.artist||""} ${m.album||""}`.toLowerCase();
    return hay.includes(q);
  });

  if(sortAZ){
    filtered.sort((a,b)=> (displayTitle(a)).localeCompare(displayTitle(b)));
  }

  renderLibraryTable();
  renderSearchTable(); // search view uses same filtered
  renderLiked(likedSet);
  chipCount.textContent = `${library.length} tracks`;
  chipFolder.textContent = folder ? "Folder selected" : "No folder";
}

searchInput.addEventListener("input", () => {
  applySearch();
  setActiveView("search");
});

function mkRow(track, idx, onClick){
  const el = document.createElement("div");
  el.className = "row";
  el.dataset.id = track.id;
  el.innerHTML = `
    <div class="idx">${idx}</div>
    <div class="cellTitle">
      <div class="t1">${escapeHtml(displayTitle(track))}</div>
      <div class="t2">${escapeHtml(track.fileName)}</div>
    </div>
    <div class="t2">${escapeHtml(displayArtist(track))}</div>
    <div class="t2">${escapeHtml(displayAlbum(track))}</div>
    <div class="r">${escapeHtml(displayDuration(track))}</div>
  `;
  el.addEventListener("click", onClick);
  return el;
}

function syncActiveRows(){
  $$(".row").forEach(r => r.classList.remove("active"));
  if(currentIndex >= 0 && queue[currentIndex]){
    const id = queue[currentIndex].id;
    const rows = $$(".row").filter(r => r.dataset.id === id);
    rows.forEach(r => r.classList.add("active"));
  }
}

function renderLibraryTable(){
  libraryList.innerHTML = "";
  if(!filtered.length){
    libraryList.innerHTML = `<div class="row" style="cursor:default">
      <div class="idx">—</div>
      <div class="cellTitle"><div class="t1">Kosong</div><div class="t2">Pilih folder musik dulu</div></div>
      <div class="t2">—</div><div class="t2">—</div><div class="r">—</div>
    </div>`;
    return;
  }
  filtered.forEach((t, i) => {
    libraryList.appendChild(mkRow(t, i+1, () => playFromFilteredIndex(i)));
  });
  syncActiveRows();
}

function renderSearchTable(){
  searchList.innerHTML = "";
  if(!filtered.length){
    searchList.innerHTML = `<div class="row" style="cursor:default">
      <div class="idx">—</div>
      <div class="cellTitle"><div class="t1">Tidak ada hasil</div><div class="t2">Coba kata kunci lain</div></div>
      <div class="t2">—</div><div class="t2">—</div><div class="r">—</div>
    </div>`;
    return;
  }
  filtered.forEach((t, i) => {
    searchList.appendChild(mkRow(t, i+1, () => playFromFilteredIndex(i)));
  });
  syncActiveRows();
}

function renderLiked(likedSet){
  likedSet = likedSet || getLikedSet();
  const liked = library.filter(t => likedSet.has(t.id));
  likedList.innerHTML = "";
  if(!liked.length){
    likedList.innerHTML = `<div class="row" style="cursor:default">
      <div class="idx">—</div>
      <div class="cellTitle"><div class="t1">Belum ada yang kamu like</div><div class="t2">Klik ♡ di player untuk menambah</div></div>
      <div class="t2">—</div><div class="t2">—</div><div class="r">—</div>
    </div>`;
    return;
  }
  liked.forEach((t, i) => {
    likedList.appendChild(mkRow(t, i+1, () => playFromLibraryId(t.id)));
  });
  syncActiveRows();
}

function buildQueueFromFiltered(startIdx){
  queue = [...filtered];
  return startIdx;
}

async function playTrack(track, idxInQueue){
  if(!track) return;
  currentIndex = idxInQueue;

  setStatus("Loading metadata…");
  await enrichMeta(track);

  nowTitle.textContent = displayTitle(track);
  nowArtist.textContent = `${displayArtist(track)} • ${displayAlbum(track)}`;
  npLine.textContent = `${displayTitle(track)} — ${displayArtist(track)}`;

  // cover
  if(track.meta && track.meta.pictureDataUrl){
    coverImg.src = track.meta.pictureDataUrl;
    coverImg.style.display = "block";
    coverFallback.style.display = "none";
  }else{
    coverImg.style.display = "none";
    coverFallback.style.display = "grid";
  }

  const likedSet = getLikedSet();
  const isLiked = likedSet.has(track.id);
  likeBtn.classList.toggle("liked", isLiked);
  likeBtn.textContent = isLiked ? "♥" : "♡";

  const fileUrl = await window.ridho.toFileUrl(track.path);
  audio.src = fileUrl;

  setStatus("Playing");
  await audio.play().catch(()=>{});
  isPlaying = true;
  updatePlayIcon();
  syncActiveRows();
}

function updatePlayIcon(){
  playBtn.textContent = isPlaying ? "⏸" : "▶";
}

function playFromFilteredIndex(i){
  if(!filtered.length) return;
  const qi = buildQueueFromFiltered(i);
  playFromQueueIndex(qi);
}

function playFromLibraryId(id){
  const idx = library.findIndex(t => t.id === id);
  if(idx < 0) return;
  // queue = full library
  queue = [...library];
  playFromQueueIndex(idx);
}

function playFromQueueIndex(i){
  if(!queue.length) return;
  i = Math.max(0, Math.min(queue.length-1, i));
  playTrack(queue[i], i);
}

function next(){
  if(!queue.length) return;
  if(isShuffle){
    const rand = Math.floor(Math.random() * queue.length);
    playFromQueueIndex(rand);
  } else {
    playFromQueueIndex((currentIndex + 1) % queue.length);
  }
}

function prev(){
  if(!queue.length) return;
  if(audio.currentTime > 3){
    audio.currentTime = 0;
    return;
  }
  playFromQueueIndex((currentIndex - 1 + queue.length) % queue.length);
}

playBtn.addEventListener("click", async () => {
  if(!audio.src){
    if(filtered.length) playFromFilteredIndex(0);
    return;
  }
  if(isPlaying){
    audio.pause();
    isPlaying = false;
    setStatus("Paused");
  } else {
    await audio.play().catch(()=>{});
    isPlaying = true;
    setStatus("Playing");
  }
  updatePlayIcon();
});

nextBtn.addEventListener("click", next);
prevBtn.addEventListener("click", prev);

audio.addEventListener("ended", next);

audio.addEventListener("timeupdate", () => {
  const dur = audio.duration || 0;
  const cur = audio.currentTime || 0;
  tCur.textContent = formatTime(cur);
  tDur.textContent = formatTime(dur);
  if(dur > 0){
    seek.value = String(Math.round((cur / dur) * 1000));
  }
});

seek.addEventListener("input", () => {
  const dur = audio.duration || 0;
  if(dur <= 0) return;
  const v = Number(seek.value || 0) / 1000;
  audio.currentTime = v * dur;
});

vol.addEventListener("input", () => {
  audio.volume = Math.max(0, Math.min(1, Number(vol.value)/100));
});
audio.volume = Number(vol.value)/100;

shuffleBtn.addEventListener("click", () => {
  isShuffle = !isShuffle;
  shuffleBtn.textContent = isShuffle ? "Shuffle: ON" : "Shuffle";
});

sortBtn.addEventListener("click", () => {
  sortAZ = !sortAZ;
  sortBtn.textContent = sortAZ ? "A–Z" : "Original";
  applySearch();
});

likeBtn.addEventListener("click", () => {
  if(currentIndex < 0 || !queue[currentIndex]) return;
  const id = queue[currentIndex].id;
  const likedSet = getLikedSet();
  if(likedSet.has(id)) likedSet.delete(id);
  else likedSet.add(id);
  const isLiked = likedSet.has(id);
  localStorage.setItem(LS_KEY, JSON.stringify({ likedIds: [...likedSet] }));
  likeBtn.classList.toggle("liked", isLiked);
  likeBtn.textContent = isLiked ? "♥" : "♡";
  renderLiked(likedSet);
});

pickFolderBtn.addEventListener("click", async () => {
  const res = await window.ridho.pickFolder();
  if(res.canceled) return;

  folder = res.folder;
  folderPathEl.textContent = folder;
  setStatus("Scanning…");

  library = (res.files || []).map((f, i) => ({
    id: `${i}-${f.path}`,
    path: f.path,
    fileName: f.name,
    ext: (f.ext || "").replace(".","").toUpperCase(),
    addedAt: Date.now() + i
  }));

  // Pre-enrich metadata for the first 10 to make UI feel "Spotify-like"
  const first = library.slice(0, 10);
  for(const t of first){
    await enrichMeta(t);
  }

  queue = [...library];
  applySearch();
  await renderHome();

  setStatus(library.length ? "Ready" : "No tracks");
});

window.addEventListener("keydown", (e) => {
  if(e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;

  if(e.code === "Space"){
    e.preventDefault();
    playBtn.click();
  }
  if(e.code === "KeyN") next();
  if(e.code === "KeyP") prev();
  if(e.code === "ArrowRight"){
    audio.currentTime = Math.min((audio.duration||0), (audio.currentTime||0) + 5);
  }
  if(e.code === "ArrowLeft"){
    audio.currentTime = Math.max(0, (audio.currentTime||0) - 5);
  }
});

// Initial
applySearch();
renderHome();
setStatus("Ready");
