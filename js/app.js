/* VideoForge — moteur d'édition vidéo 100% navigateur */
"use strict";

const $ = (sel) => document.querySelector(sel);

/* ============ État global ============ */
const state = {
  media: [],              // {id, name, type: video|image|audio, url, duration, thumb, el}
  tracks: [],             // {id, type: video|audio|text, clips: []}
  selection: null,        // {trackIndex, clipIndex}
  playhead: 0,
  playing: false,
  pxPerSec: 80,
  mode: "simple",         // simple | expert
  transition: "cut",      // cut | fade | slide
  history: [],
  future: [],
  counter: 1,
};

const uid = () => `id${state.counter++}`;

/* ============ Utilitaires ============ */
function fmtTime(sec) {
  if (sec == null || isNaN(sec)) sec = 0;
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60), cs = Math.floor((sec % 1) * 10);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${cs}`;
}
function fmtShort(sec) {
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
function totalDuration() {
  let end = 0;
  state.tracks.forEach(t => t.clips.forEach(c => end = Math.max(end, c.start + c.duration)));
  return end;
}
function toast(msg, ms = 2200) {
  const t = $("#toast");
  t.textContent = msg; t.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { t.hidden = true; }, ms);
}

/* ============ Historique (undo/redo) ============ */
function snapshot() {
  return JSON.stringify({ tracks: state.tracks });
}
function pushHistory() {
  state.history.push(snapshot());
  if (state.history.length > 60) state.history.shift();
  state.future = [];
}
function undo() {
  if (!state.history.length) return;
  state.future.push(snapshot());
  const prev = JSON.parse(state.history.pop());
  state.tracks = prev.tracks;
  state.selection = null;
  renderAll();
}
function redo() {
  if (!state.future.length) return;
  state.history.push(snapshot());
  const next = JSON.parse(state.future.pop());
  state.tracks = next.tracks;
  state.selection = null;
  renderAll();
}

/* ============ Pistes ============ */
function addTrack(type) {
  const order = { video: 0, text: 1, audio: 2 };
  state.tracks.push({ id: uid(), type, clips: [] });
  state.tracks.sort((a, b) => order[a.type] - order[b.type]);
  renderAll();
}
function ensureTracks() {
  if (!state.tracks.find(t => t.type === "video")) addTrack("video");
  if (state.tracks.length < 3) {
    if (!state.tracks.find(t => t.type === "text")) addTrack("text");
    if (!state.tracks.find(t => t.type === "audio")) addTrack("audio");
  }
}

/* ============ Import des médias ============ */
function importFiles(files) {
  [...files].forEach(file => {
    const url = URL.createObjectURL(file);
    const type = file.type.startsWith("video") ? "video"
               : file.type.startsWith("image") ? "image"
               : file.type.startsWith("audio") ? "audio" : null;
    if (!type) { toast(`Format non supporté : ${file.name}`); return; }

    if (type === "image") {
      const img = new Image();
      img.onload = () => {
        state.media.push({ id: uid(), name: file.name, type, url, duration: 5, thumb: url, el: img, width: img.width, height: img.height });
        renderMedia();
      };
      img.src = url;
      return;
    }

    const el = document.createElement(type === "video" ? "video" : "audio");
    el.preload = "metadata";
    el.src = url;
    el.onloadedmetadata = () => {
      const item = { id: uid(), name: file.name, type, url, duration: el.duration || 5, thumb: null, el };
      if (type === "video") {
        el.currentTime = Math.min(0.5, el.duration / 2);
        el.onseeked = () => {
          const c = document.createElement("canvas");
          c.width = 160; c.height = 90;
          c.getContext("2d").drawImage(el, 0, 0, c.width, c.height);
          item.thumb = c.toDataURL("image/jpeg", 0.6);
          renderMedia();
        };
      }
      state.media.push(item);
      renderMedia();
      toast(`Importé : ${file.name}`);
    };
  });
}

function renderMedia() {
  const grid = $("#mediaGrid");
  grid.innerHTML = "";
  state.media.forEach(m => {
    const card = document.createElement("div");
    card.className = "media-card";
    card.draggable = true;
    card.innerHTML = `
      <button class="media-del" title="Retirer">✕</button>
      ${m.type === "video" && m.thumb
        ? `<img class="media-thumb" src="${m.thumb}">`
        : `<div class="media-icon">${m.type === "image" ? "🖼" : "🎵"}</div>`}
      ${m.type !== "image" ? `<span class="media-dur">${fmtShort(m.duration)}</span>` : ""}
      <div class="media-name" title="${m.name}">${m.name}</div>`;
    card.ondragstart = (e) => e.dataTransfer.setData("text/plain", `media:${m.id}`);
    card.querySelector(".media-del").onclick = (e) => {
      e.stopPropagation();
      state.media = state.media.filter(x => x.id !== m.id);
      renderMedia();
    };
    card.ondblclick = () => addClipFromMedia(m);
    grid.appendChild(card);
  });
}

/* ============ Clips ============ */
function trackEnd(track) {
  return track.clips.reduce((end, c) => Math.max(end, c.start + c.duration), 0);
}
function addClipFromMedia(m) {
  let track = state.tracks.find(t => t.type === (m.type === "audio" ? "audio" : "video"));
  if (!track) { addTrack(m.type === "audio" ? "audio" : "video"); track = state.tracks.find(t => t.type === (m.type === "audio" ? "audio" : "video")); }
  pushHistory();
  const clip = {
    id: uid(), mediaId: m.id,
    start: trackEnd(track), duration: m.type === "image" ? 5 : m.duration,
    inPoint: 0, props: { opacity: 1, scale: 1, x: 0, y: 0, rotation: 0, brightness: 100, contrast: 100, saturate: 100 },
  };
  track.clips.push(clip);
  renderAll();
  toast(`"${m.name}" ajouté à la timeline`);
}

function addTextClip(text = "Votre texte") {
  let track = state.tracks.find(t => t.type === "text");
  if (!track) { addTrack("text"); track = state.tracks.find(t => t.type === "text"); }
  pushHistory();
  track.clips.push({
    id: uid(), type: "text",
    start: state.playhead, duration: 4,
    props: { text, size: 48, color: "#ffffff", font: "system-ui", x: 50, y: 50, bold: true, align: "center", bg: "none" },
  });
  renderAll();
}

function getSelectedClip() {
  if (!state.selection) return null;
  const t = state.tracks[state.selection.trackIndex];
  if (!t) return null;
  return { track: t, clip: t.clips[state.selection.clipIndex], sel: state.selection };
}

/* ============ Rendu timeline ============ */
function renderAll() {
  renderTimeline();
  renderProps();
  $("#totalDuration").textContent = `Durée : ${fmtShort(totalDuration())}`;
  drawFrame();
}

function renderTimeline() {
  const tracksEl = $("#tracks");
  tracksEl.innerHTML = "";
  const dur = Math.max(totalDuration() + 10, 30);
  const w = dur * state.pxPerSec + 20;

  state.tracks.forEach((track, ti) => {
    const row = document.createElement("div");
    row.className = "track";
    row.style.width = `${w}px`;
    row.dataset.trackIndex = ti;
    const typeLabels = { video: "Vidéo", text: "Texte", audio: "Audio", subtitle: "Sous-titres" };
    row.innerHTML = `<span class="track-label">${typeLabels[track.type] || track.type}</span>`;

    track.clips.forEach((clip, ci) => {
      const m = state.media.find(x => x.id === clip.mediaId);
      const el = document.createElement("div");
      el.className = `clip clip-${clip.sub ? "text" : (clip.type || (m ? m.type : "video"))}${state.selection && state.selection.trackIndex === ti && state.selection.clipIndex === ci ? " selected" : ""}`;
      el.style.left = `${clip.start * state.pxPerSec}px`;
      el.style.width = `${Math.max(clip.duration * state.pxPerSec, 24)}px`;
      el.innerHTML = `
        ${m && m.thumb ? `<img class="clip-thumb" src="${m.thumb}" style="width:${Math.min(clip.duration * state.pxPerSec, 44)}px">` : ""}
        <span style="margin-left:${m && m.thumb ? 48 : 0}px; pointer-events:none;">${clip.props && clip.props.text ? clip.props.text : (m ? m.name : "clip")}</span>
        <div class="clip-handle l"></div><div class="clip-handle r"></div>${keyframeMarkers(clip)}`;
      el.dataset.trackIndex = ti;
      el.dataset.clipIndex = ci;

      el.addEventListener("mousedown", (e) => {
        if (e.target.classList.contains("clip-handle")) return;
        e.stopPropagation();
        selectClip(ti, ci);
        const startX = e.clientX, origStart = clip.start;
        let moved = false;
        const onMove = (ev) => {
          const dx = (ev.clientX - startX) / state.pxPerSec;
          if (Math.abs(ev.clientX - startX) > 3) moved = true;
          clip.start = Math.max(0, origStart + dx);
          renderTimeline();
        };
        const onUp = () => {
          if (moved) pushHistory();
          document.removeEventListener("mousemove", onMove);
          document.removeEventListener("mouseup", onUp);
          renderAll();
        };
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
      });

      el.querySelector(".clip-handle.l").addEventListener("mousedown", (e) => {
        e.stopPropagation();
        selectClip(ti, ci);
        const startX = e.clientX, origStart = clip.start, origDur = clip.duration;
        const onMove = (ev) => {
          const dx = (ev.clientX - startX) / state.pxPerSec;
          const ns = Math.max(0, origStart + dx);
          const delta = ns - origStart;
          if (origDur - delta > 0.1) {
            clip.start = ns;
            clip.duration = origDur - delta;
            if (clip.inPoint != null) clip.inPoint = Math.max(0, (clip.inPoint || 0) + delta);
            renderTimeline();
          }
        };
        const onUp = () => { pushHistory(); document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); renderAll(); };
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
      });
      el.querySelector(".clip-handle.r").addEventListener("mousedown", (e) => {
        e.stopPropagation();
        selectClip(ti, ci);
        const startX = e.clientX, origDur = clip.duration;
        const onMove = (ev) => {
          const dx = (ev.clientX - startX) / state.pxPerSec;
          clip.duration = Math.max(0.1, origDur + dx);
          renderTimeline();
        };
        const onUp = () => { pushHistory(); document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); renderAll(); };
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
      });

      row.appendChild(el);
    });

    row.addEventListener("mousedown", (e) => {
      if (e.target === row) {
        state.selection = null;
        state.playhead = (e.offsetX - 10) / state.pxPerSec;
        renderTimeline(); drawFrame(); updatePlayhead();
        selectClipStartDrag(row, e);
      }
    });
    row.addEventListener("dragover", (e) => e.preventDefault());
    row.addEventListener("drop", (e) => {
      e.preventDefault();
      const data = e.dataTransfer.getData("text/plain");
      if (data.startsWith("media:")) {
        const m = state.media.find(x => x.id === data.slice(6));
        if (!m) return;
        pushHistory();
        const wantType = m.type === "audio" ? "audio" : "video";
        let target = track.type === wantType ? track : state.tracks.find(t => t.type === wantType);
        if (!target) { addTrack(wantType); target = state.tracks.find(t => t.type === wantType); }
        target.clips.push({
          id: uid(), mediaId: m.id,
          start: Math.max(0, (e.offsetX - 10) / state.pxPerSec),
          duration: m.type === "image" ? 5 : m.duration, inPoint: 0,
          props: { opacity: 1, scale: 1, x: 0, y: 0, rotation: 0, brightness: 100, contrast: 100, saturate: 100 },
        });
        renderAll();
      }
    });

    tracksEl.appendChild(row);
  });

  renderRuler(dur, w);
  updatePlayhead();
}

function selectClipStartDrag(row, e) {
  const startX = e.clientX, orig = state.playhead;
  const onMove = (ev) => {
    state.playhead = Math.max(0, orig + (ev.clientX - startX) / state.pxPerSec);
    drawFrame(); updatePlayhead(); updateTimecode();
  };
  const onUp = () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup", onUp);
}

function renderRuler(dur, w) {
  const ruler = $("#ruler");
  ruler.style.width = `${w}px`;
  ruler.innerHTML = "";
  const step = state.pxPerSec >= 160 ? 1 : state.pxPerSec >= 60 ? 5 : 10;
  for (let t = 0; t <= dur; t += step) {
    const tick = document.createElement("div");
    tick.className = "ruler-tick";
    tick.style.left = `${t * state.pxPerSec + 10}px`;
    tick.textContent = fmtShort(t);
    ruler.appendChild(tick);
  }
}

function updatePlayhead() {
  const ph = $("#playhead");
  ph.style.left = `${state.playhead * state.pxPerSec + 10}px`;
}

function selectClip(ti, ci) {
  state.selection = { trackIndex: ti, clipIndex: ci };
  renderTimeline();
  renderProps();
  drawFrame();
}

/* ============ Panneau propriétés ============ */
function renderProps() {
  const box = $("#propsContent");
  const sel = getSelectedClip();
  if (!sel) { box.innerHTML = `<p class="hint">Sélectionnez un clip dans la timeline pour éditer ses propriétés.</p>`; return; }
  const { clip, track } = sel;
  const p = clip.props;

  if (clip.type === "text") {
    box.innerHTML = `
      <div class="form-row"><label>Texte</label><textarea id="pText" rows="2">${p.text || ""}</textarea></div>
      <div class="form-row"><label>Taille</label><input type="range" id="pSize" min="10" max="120" value="${p.size}"></div>
      <div class="form-row"><label>Couleur</label><input type="color" id="pColor" value="${p.color}" style="width:100%;height:36px;background:none;border:1px solid var(--border);border-radius:6px;"></div>
      <div class="form-row form-row-inline">
        <div><label>Début (s)</label><input type="number" id="pStart" step="0.1" value="${clip.start}"></div>
        <div><label>Durée (s)</label><input type="number" id="pDur" step="0.1" value="${clip.duration}"></div>
      </div>
      <div class="form-row form-row-inline">
        <div><label>Pos X %</label><input type="range" id="pX" min="0" max="100" value="${p.x}"></div>
        <div><label>Pos Y %</label><input type="range" id="pY" min="0" max="100" value="${p.y}"></div>
      </div>
      <div class="form-row"><label>Gras</label><input type="checkbox" id="pBold" ${p.bold ? "checked" : ""}></div>`;
    const bind = (id, fn) => $(id).addEventListener("input", (e) => { fn(e.target); drawFrame(); });
    bind("#pText", t => p.text = t.value);
    bind("#pSize", t => p.size = +t.value);
    bind("#pColor", t => p.color = t.value);
    bind("#pStart", t => clip.start = Math.max(0, +t.value));
    bind("#pDur", t => clip.duration = Math.max(0.1, +t.value));
    bind("#pX", t => p.x = +t.value);
    bind("#pY", t => p.y = +t.value);
    bind("#pBold", t => p.bold = t.checked);
    return;
  }

  box.innerHTML = `
    <div class="form-row form-row-inline">
      <div><label>Début (s)</label><input type="number" id="pStart" step="0.1" value="${clip.start}"></div>
      <div><label>Durée (s)</label><input type="number" id="pDur" step="0.1" value="${clip.duration}"></div>
    </div>
    ${track.type === "video" ? `
    <div class="form-row"><label>Opacité</label><input type="range" id="pOpacity" min="0" max="100" value="${p.opacity * 100}"></div>
    <div class="form-row"><label>Échelle</label><input type="range" id="pScale" min="10" max="300" value="${p.scale * 100}"></div>
    <div class="form-row form-row-inline">
      <div><label>Position X</label><input type="range" id="pX" min="-100" max="100" value="${p.x}"></div>
      <div><label>Position Y</label><input type="range" id="pY" min="-100" max="100" value="${p.y}"></div>
    </div>
    <div class="form-row"><label>Rotation (°)</label><input type="range" id="pRot" min="-180" max="180" value="${p.rotation}"></div>
    <div class="form-row"><label>Luminosité</label><input type="range" id="pBright" min="0" max="200" value="${p.brightness}"></div>
    <div class="form-row"><label>Contraste</label><input type="range" id="pContrast" min="0" max="200" value="${p.contrast}"></div>
    <div class="form-row"><label>Saturation</label><input type="range" id="pSat" min="0" max="200" value="${p.saturate}"></div>` : ""}
    ${renderEffectsUI(sel)}
    <div class="form-row"><button class="btn btn-danger" id="pDelete">🗑 Supprimer ce clip</button></div>`;

  const bind = (id, fn) => $(id).addEventListener("input", (e) => { fn(e.target); drawFrame(); renderTimeline(); });
  bind("#pStart", t => clip.start = Math.max(0, +t.value));
  bind("#pDur", t => clip.duration = Math.max(0.1, +t.value));
  bind("#pOpacity", t => p.opacity = +t.value / 100);
  bind("#pScale", t => p.scale = +t.value / 100);
  bind("#pX", t => p.x = +t.value);
  bind("#pY", t => p.y = +t.value);
  bind("#pRot", t => p.rotation = +t.value);
  bind("#pBright", t => p.brightness = +t.value);
  bind("#pContrast", t => p.contrast = +t.value);
  bind("#pSat", t => p.saturate = +t.value);
  $("#pDelete").onclick = deleteSelected;
  bindEffectsUI(sel);
}

/* ============ Rendu de la frame ============ */
const canvas = $("#previewCanvas");
const ctx = canvas.getContext("2d");

function clipAt(track, t) {
  return track.clips.find(c => t >= c.start && t < c.start + c.duration);
}

function drawFrame() {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const t = state.playhead;

  state.tracks.filter(tr => tr.type === "video").forEach(track => {
    const clip = clipAt(track, t);
    if (!clip) return;
    const m = state.media.find(x => x.id === clip.mediaId);
    if (!m || !m.el) return;

    const p = animatedProps(clip, t);
    const tr = transitionState(clip, t, canvas.width);
    let alpha = (p.opacity ?? 1) * tr.alpha;
    const extraScale = tr.scale || 1;
    const wipeClip = tr.clipW ?? 1;

    const src = m.el;
    if (m.type === "video" && src.readyState < 2) return;

    const vw = m.type === "video" ? src.videoWidth : src.width;
    const vh = m.type === "video" ? src.videoHeight : src.height;
    if (!vw || !vh) return;

    const fit = Math.min(canvas.width / vw, canvas.height / vh) * (p.scale ?? 1) * extraScale;
    const dw = vw * fit, dh = vh * fit;
    let cx = (canvas.width - dw) / 2 + (p.x / 100) * canvas.width / 2 + tr.dx;
    let cy = (canvas.height - dh) / 2 + (p.y / 100) * canvas.height / 2;

    ctx.save();
    if (wipeClip < 1) {
      ctx.beginPath();
      ctx.rect(cx, 0, dw * wipeClip, canvas.height);
      ctx.clip();
    }
    ctx.globalAlpha = alpha;
    ctx.filter = `brightness(${p.brightness}%) contrast(${p.contrast}%) saturate(${p.saturate}%)`;
    ctx.translate(cx + dw / 2, cy + dh / 2);
    if (p.rotation) ctx.rotate((p.rotation * Math.PI) / 180);
    ctx.drawImage(src, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();
  });

  state.tracks.filter(tr => tr.type === "text" || tr.type === "subtitle").forEach(track => {
    const clip = clipAt(track, t);
    if (!clip) return;
    if (clip.sub || track.type === "subtitle") { drawSubtitle(clip); return; }
    const p = clip.props;
    ctx.save();
    ctx.font = `${p.bold ? "bold " : ""}${p.size}px ${p.font || "system-ui"}`;
    ctx.fillStyle = p.color;
    ctx.textAlign = p.align || "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0,0,0,.7)";
    ctx.shadowBlur = 6;
    ctx.fillText(p.text || "", (p.x / 100) * canvas.width, (p.y / 100) * canvas.height);
    ctx.restore();
  });

  updateTimecode();
}

function updateTimecode() {
  $("#timecode").textContent = fmtTime(state.playhead);
}

/* ============ Lecture ============ */
let lastTs = null;
function playLoop(ts) {
  if (!state.playing) { lastTs = null; return; }
  if (lastTs != null) state.playhead += (ts - lastTs) / 1000;
  lastTs = ts;
  const total = totalDuration();
  if (state.playhead >= total) { state.playhead = total; pause(); renderAll(); return; }

  // Synchronise les éléments vidéo/audio
  state.tracks.forEach(track => {
    track.clips.forEach(clip => {
      const m = state.media.find(x => x.id === clip.mediaId);
      if (!m || !m.el || m.type === "image") return;
      const el = m.el;
      const active = state.playhead >= clip.start && state.playhead < clip.start + clip.duration;
      const wantTime = (clip.inPoint || 0) + (state.playhead - clip.start);
      if (active) {
        if (Math.abs(el.currentTime - wantTime) > 0.3) el.currentTime = wantTime;
        if (el.paused && !exporting) el.play().catch(() => {});
      } else if (!el.paused) el.pause();
    });
  });

  drawFrame();
  updatePlayhead();
  const scroll = $("#timelineScroll");
  const x = state.playhead * state.pxPerSec + 10;
  if (x > scroll.scrollLeft + scroll.clientWidth - 100) scroll.scrollLeft = x - 200;

  requestAnimationFrame(playLoop);
}

function play() {
  if (totalDuration() === 0) { toast("Ajoutez d'abord des médias à la timeline"); return; }
  if (state.playhead >= totalDuration()) state.playhead = 0;
  state.playing = true;
  $("#btnPlay").textContent = "⏸";
  requestAnimationFrame(playLoop);
}
function pause() {
  state.playing = false;
  $("#btnPlay").textContent = "▶";
  state.media.forEach(m => { if (m.el && m.el.pause) m.el.pause(); });
  if (exporting && exportResolve) exportResolve();
}

/* ============ Export ============ */
let exporting = false, exportResolve = null;

function openExport() {
  if (totalDuration() === 0) { toast("La timeline est vide"); return; }
  $("#exportModal").hidden = false;
}

async function startExport() {
  const width = +$("#expRes").value;
  const height = width === 3840 ? 2160 : width === 1920 ? 1080 : 720;
  const bitrate = +$("#expQuality").value * 1_000_000;
  const scale = width / canvas.width;
  canvas.width = width; canvas.height = height;

  const stream = canvas.captureStream(30);

  // Mixage audio : musique + audio des clips vidéo, via AudioContext
  try {
    const actx = new AudioContext();
    const dest = actx.createMediaStreamDestination();
    const active = new Set();
    state.tracks.forEach(track => track.clips.forEach(clip => {
      const m = state.media.find(x => x.id === clip.mediaId);
      if (m && m.el && m.el.captureStream) {
        try {
          const src = actx.createMediaStreamSource(m.el.captureStream());
          src.connect(dest);
          active.add(m.el);
        } catch (_) {}
      }
    }));
    if (dest.stream.getAudioTracks().length) {
      dest.stream.getAudioTracks().forEach(t => stream.addTrack(t));
      actx.resume();
    }
  } catch (_) { /* export vidéo seul si l'audio n'est pas disponible */ }

  const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
    ? "video/webm;codecs=vp9,opus" : "video/webm";
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: bitrate });
  const chunks = [];
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };

  const done = new Promise((res) => { exportResolve = res; });
  exporting = true;
  $("#expProgress").hidden = false;
  $("#recOverlay").hidden = false;

  state.playhead = 0;
  rec.start(250);
  play();

  const total = totalDuration();
  const timer = setInterval(() => {
    const pct = Math.min(100, Math.round((state.playhead / total) * 100));
    $("#expProgressFill").style.width = `${pct}%`;
    $("#expProgressLabel").textContent = `${pct}%`;
  }, 200);

  await done;
  clearInterval(timer);
  rec.stop();
  await new Promise(r => setTimeout(r, 400));

  const blob = new Blob(chunks, { type: "video/webm" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `videoforge-export-${Date.now()}.webm`;
  a.click();

  canvas.width = 1280; canvas.height = 720;
  exporting = false; exportResolve = null;
  $("#recOverlay").hidden = true;
  $("#expProgress").hidden = true;
  $("#exportModal").hidden = true;
  toast("✅ Export terminé ! Vidéo téléchargée.");
  drawFrame();
}

/* ============ Actions timeline ============ */
function splitSelected() {
  const sel = getSelectedClip();
  if (!sel) { toast("Sélectionnez un clip à diviser"); return; }
  const { clip, track } = sel;
  const t = state.playhead;
  if (t <= clip.start + 0.1 || t >= clip.start + clip.duration - 0.1) { toast("Placez la tête de lecture au milieu du clip"); return; }
  pushHistory();
  const right = JSON.parse(JSON.stringify(clip));
  right.id = uid();
  right.start = t;
  right.duration = clip.start + clip.duration - t;
  right.inPoint = (clip.inPoint || 0) + (t - clip.start);
  clip.duration = t - clip.start;
  track.clips.push(right);
  renderAll();
  toast("Clip divisé");
}

function deleteSelected() {
  const sel = getSelectedClip();
  if (!sel) return;
  pushHistory();
  sel.track.clips.splice(sel.clipIndex, 1);
  state.selection = null;
  renderAll();
}

function duplicateSelected() {
  const sel = getSelectedClip();
  if (!sel) return;
  pushHistory();
  const copy = JSON.parse(JSON.stringify(sel.clip));
  copy.id = uid();
  copy.start = sel.clip.start + sel.clip.duration;
  sel.track.clips.push(copy);
  renderAll();
}

/* ============ Initialisation ============ */
function toggleFullscreenPreview() {
  const wrap = document.querySelector(".canvas-wrap");
  if (document.fullscreenElement) document.exitFullscreen(); else wrap.requestFullscreen().catch(() => {});
}

function init() {
  ensureTracks();
  initSubtitles();
  initMusicLibrary();

  // Thème clair / sombre (préférence sauvegardée)
  const savedTheme = localStorage.getItem("vf-theme");
  if (savedTheme === "light") {
    document.body.classList.add("light");
    $("#btnTheme").textContent = "☀️ Thème";
  }
  $("#btnTheme").onclick = () => {
    const light = document.body.classList.toggle("light");
    localStorage.setItem("vf-theme", light ? "light" : "dark");
    $("#btnTheme").textContent = light ? "☀️ Thème" : "🌙 Thème";
  };

  // Modal raccourcis
  $("#btnShortcuts").onclick = () => { $("#shortcutsModal").hidden = false; };
  $("#scClose").onclick = () => { $("#shortcutsModal").hidden = true; };
  $("#shortcutsModal").addEventListener("click", (e) => { if (e.target.id === "shortcutsModal") e.target.hidden = true; });

  // Import
  $("#dropzone").onclick = () => $("#fileInput").click();
  $("#fileInput").onchange = (e) => importFiles(e.target.files);
  ["dragenter", "dragover"].forEach(ev => $("#dropzone").addEventListener(ev, (e) => { e.preventDefault(); $("#dropzone").classList.add("drag"); }));
  ["dragleave", "drop"].forEach(ev => $("#dropzone").addEventListener(ev, (e) => { e.preventDefault(); $("#dropzone").classList.remove("drag"); }));
  $("#dropzone").addEventListener("drop", (e) => importFiles(e.dataTransfer.files));

  // Lecture
  $("#btnPlay").onclick = () => (state.playing ? pause() : play());
  $("#btnStart").onclick = () => { state.playhead = 0; drawFrame(); updatePlayhead(); };
  $("#btnEnd").onclick = () => { state.playhead = totalDuration(); drawFrame(); updatePlayhead(); };
  $("#btnPrevFrame").onclick = () => { state.playhead = Math.max(0, state.playhead - 1 / 30); drawFrame(); updatePlayhead(); };
  $("#btnNextFrame").onclick = () => { state.playhead += 1 / 30; drawFrame(); updatePlayhead(); };

  // Outils
  $("#btnSplit").onclick = splitSelected;
  $("#btnDelete").onclick = deleteSelected;
  $("#btnDuplicate").onclick = duplicateSelected;
  $("#btnAddText").onclick = () => addTextClip();
  $("#btnAddTrack").onclick = () => addTrack("video");

  kfBtn.onclick = () => {
    const sel = getSelectedClip();
    if (!sel || sel.track.type !== "video") return;
    const rel = Math.max(0, Math.min(sel.clip.duration, state.playhead - sel.clip.start));
    const now = animatedProps(sel.clip, state.playhead);
    addKeyframeAt(sel.clip, rel, {
      opacity: now.opacity, scale: now.scale,
      x: now.x, y: now.y, rotation: now.rotation,
    });
    pushHistory();
    renderProps(); renderTimeline(); drawFrame();
    toast(`◆ Keyframe ajoutée à ${rel.toFixed(2)}s`);
  };

  // Bouton keyframe : visible quand un clip vidéo est sélectionné
  const kfBtn = $("#btnKeyframe"), kfHint = $("#keyframeHint");
  const origRenderProps = renderProps;
  renderProps = function () {
    origRenderProps();
    const sel = getSelectedClip();
    const isVideo = sel && sel.track.type === "video" && !sel.clip.sub;
    kfBtn.style.display = isVideo ? "" : "none";
    const kfs = isVideo ? (sel.clip.keyframes || []).length : 0;
    kfHint.textContent = kfs ? `${kfs} keyframe${kfs > 1 ? "s" : ""}` : "";
  };

  // Historique / mode
  $("#btnUndo").onclick = undo;
  $("#btnRedo").onclick = redo;
  $("#btnMode").onclick = () => {
    state.mode = state.mode === "simple" ? "expert" : "simple";
    document.body.classList.toggle("mode-simple", state.mode === "simple");
    $("#modeBadge").textContent = state.mode === "simple" ? "Mode Simple" : "Mode Expert";
    $("#btnMode").textContent = state.mode === "simple" ? "⚡ Mode Expert" : "🎈 Mode Simple";
  };

  // Zoom timeline
  $("#zoomRange").oninput = (e) => { state.pxPerSec = +e.target.value; renderTimeline(); };

  // Transitions
  const transitions = [["cut", "Sans transition"], ["fade", "Fondu"], ["slide", "Glissé"]];
  const list = $("#transitionList");
  transitions.forEach(([key, label]) => {
    const chip = document.createElement("button");
    chip.className = "chip" + (state.transition === key ? " active" : "");
    chip.textContent = label;
    chip.onclick = () => {
      state.transition = key;
      list.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      drawFrame();
    };
    list.appendChild(chip);
  });

  // Export
  $("#btnExport").onclick = openExport;
  $("#expCancel").onclick = () => { $("#exportModal").hidden = true; };
  $("#expStart").onclick = startExport;
  $("#expQuality").oninput = (e) => $("#expQualityVal").textContent = e.target.value;

  // Raccourcis clavier avancés
  document.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT") return;
    const k = e.key;
    const seek = (d) => { state.playhead = Math.max(0, Math.min(totalDuration(), state.playhead + d)); drawFrame(); updatePlayhead(); };

    if (e.code === "Space") { e.preventDefault(); state.playing ? pause() : play(); return; }
    if ((e.ctrlKey || e.metaKey) && (k === "z" || k === "Z")) { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if ((e.ctrlKey || e.metaKey) && (k === "a" || k === "A")) { e.preventDefault(); state.playhead = totalDuration(); drawFrame(); updatePlayhead(); return; }
    if ((e.ctrlKey || e.metaKey) && (k === "m" || k === "M")) { e.preventDefault(); addTrack("video"); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    switch (k) {
      case "s": case "S": splitSelected(); break;
      case "d": case "D": duplicateSelected(); break;
      case "t": case "T": addTextClip(); break;
      case "f": case "F": toggleFullscreenPreview(); break;
      case "j": case "J": if (state.playing) { state.media.forEach(m => m.el && (m.el.playbackRate = Math.max(0.25, (m.el.playbackRate||1)/2))); } else seek(-5); break;
      case "k": case "K": pause(); break;
      case "l": case "L": if (state.playing) { state.media.forEach(m => m.el && (m.el.playbackRate = Math.min(4, (m.el.playbackRate||1)*2))); } else seek(5); break;
      case "ArrowLeft": e.preventDefault(); seek(e.shiftKey ? -5 : -1); break;
      case "ArrowRight": e.preventDefault(); seek(e.shiftKey ? 5 : 1); break;
      case ",": seek(-1/30); break;
      case ".": seek(1/30); break;
      case "Home": state.playhead = 0; drawFrame(); updatePlayhead(); break;
      case "End": state.playhead = totalDuration(); drawFrame(); updatePlayhead(); break;
      case "Delete": case "Backspace": deleteSelected(); break;
      case "?": $("#shortcutsModal").hidden = false; break;
    }
  });

  // Sécurité avant fermeture
  window.addEventListener("beforeunload", (e) => {
    if (totalDuration() > 0) { e.preventDefault(); e.returnValue = ""; }
  });

  // Tutoriel interactif (premier lancement)
  $("#btnTutorial").onclick = () => startTutorial(true);
  setTimeout(() => startTutorial(), 700);

  drawFrame();
  renderTimeline();
}

document.addEventListener("DOMContentLoaded", init);
