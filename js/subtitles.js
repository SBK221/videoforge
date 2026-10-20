/* VideoForge — module sous-titres : import/export SRT, éditeur, génération auto */
"use strict";

function srtTime(sec) {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60), ms = Math.round((sec % 1) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}
function parseSrtTime(str) {
  const m = str.trim().match(/(\d+):(\d+):(\d+)[,.](\d+)/);
  if (!m) return 0;
  return +m[1] * 3600 + +m[2] * 60 + +m[3] + +m[4] / 1000;
}

/* Convertit un fichier SRT en clips sur une piste "sous-titres" (clips texte avec style sub) */
function importSrt(text) {
  const blocks = text.replace(/\r/g, "").split(/\n\n+/).filter(b => b.trim());
  let track = state.tracks.find(t => t.type === "subtitle");
  if (!track) {
    track = { id: uid(), type: "subtitle", clips: [] };
    state.tracks.push(track);
  }
  let count = 0;
  blocks.forEach(block => {
    const lines = block.split("\n");
    const timeLine = lines.find(l => l.includes("-->"));
    if (!timeLine) return;
    const [a, b] = timeLine.split("-->");
    const start = parseSrtTime(a), end = parseSrtTime(b);
    const content = lines.filter(l => l !== timeLine && !/^\d+$/.test(l.trim())).join("\n").trim();
    if (!content) return;
    track.clips.push({
      id: uid(), type: "text", sub: true,
      start, duration: Math.max(0.3, end - start),
      props: {
        text: content, size: 30, color: "#ffffff", font: "system-ui",
        x: 50, y: 88, bold: false, align: "center",
        bg: "rgba(0,0,0,.65)", stroke: true,
      },
    });
    count++;
  });
  if (count) {
    pushHistory();
    renderAll();
    renderSubsList();
    toast(`✅ ${count} sous-titres importés`);
  } else toast("Aucun sous-titre valide trouvé dans le fichier");
}

function exportSrt() {
  let track = state.tracks.find(t => t.type === "subtitle");
  if (!track || !track.clips.length) { toast("Aucune piste de sous-titres à exporter"); return; }
  const clips = [...track.clips].sort((a, b) => a.start - b.start);
  let out = "";
  clips.forEach((c, i) => {
    out += `${i + 1}\n${srtTime(c.start)} --> ${srtTime(c.start + c.duration)}\n${c.props.text}\n\n`;
  });
  const blob = new Blob([out], { type: "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "videoforge-sous-titres.srt";
  a.click();
  toast("📤 Fichier .srt téléchargé");
}

/* Génère automatiquement des sous-titres à partir des clips texte existants (mode auto) */
function autoSubtitles() {
  let track = state.tracks.find(t => t.type === "subtitle");
  if (!track) {
    track = { id: uid(), type: "subtitle", clips: [] };
    state.tracks.push(track);
  }
  let count = 0;
  state.tracks.forEach(t => {
    if (t.type === "subtitle") return;
    t.clips.forEach(clip => {
      const text = clip.props && clip.props.text ? clip.props.text.trim() : "";
      if (!text || clip.sub) return;
      track.clips.push({
        id: uid(), type: "text", sub: true,
        start: clip.start, duration: clip.duration,
        props: {
          text, size: 30, color: "#ffffff", font: "system-ui",
          x: 50, y: 88, bold: false, align: "center",
          bg: "rgba(0,0,0,.65)", stroke: true,
        },
      });
      count++;
    });
  });
  if (count) {
    pushHistory();
    renderAll();
    renderSubsList();
    toast(`✨ ${count} sous-titres générés`);
  } else toast("Aucun texte à convertir : ajoutez des clips texte d'abord");
}

/* Éditeur de sous-titres dans le panneau latéral */
function renderSubsList() {
  const list = $("#subsList");
  if (!list) return;
  list.innerHTML = "";
  const track = state.tracks.find(t => t.type === "subtitle");
  if (!track || !track.clips.length) {
    list.innerHTML = `<p class="hint" style="font-size:11px">Aucun sous-titre. Importez un .srt ou utilisez ✨ Auto.</p>`;
    return;
  }
  [...track.clips].sort((a, b) => a.start - b.start).forEach(clip => {
    const item = document.createElement("div");
    item.className = "sub-item";
    item.innerHTML = `
      <div class="sub-time">${fmtShort(clip.start)} → ${fmtShort(clip.start + clip.duration)}</div>
      <textarea rows="2">${clip.props.text}</textarea>`;
    item.onclick = (e) => {
      if (e.target.tagName === "TEXTAREA") return;
      state.playhead = clip.start + 0.01;
      drawFrame(); updatePlayhead();
    };
    item.querySelector("textarea").addEventListener("input", (e) => {
      clip.props.text = e.target.value;
      drawFrame();
    });
    list.appendChild(item);
  });
}

/* Boutons du panneau */
function initSubtitles() {
  $("#btnImportSrt").onclick = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".srt,.txt";
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => importSrt(reader.result);
      reader.readAsText(file);
    };
    input.click();
  };
  $("#btnExportSrt").onclick = exportSrt;
  $("#btnAutoSubs").onclick = autoSubtitles;
}

/* Rendu d'un sous-titre (appelé par drawFrame) */
function drawSubtitle(clip) {
  const p = clip.props;
  ctx.save();
  ctx.font = `${p.bold ? "bold " : ""}${p.size}px ${p.font || "system-ui"}`;
  ctx.textAlign = p.align || "center";
  ctx.textBaseline = "middle";
  const y = (p.y / 100) * canvas.height;
  const x = (p.x / 100) * canvas.width;

  const lines = (p.text || "").split("\n");
  const lineH = p.size * 1.25;

  if (p.bg && p.bg !== "none") {
    const maxW = Math.max(...lines.map(l => ctx.measureText(l).width));
    const totalH = lines.length * lineH;
    ctx.fillStyle = p.bg;
    const padX = 14, padY = 8;
    ctx.fillRect(x - maxW / 2 - padX, y - totalH / 2 - padY, maxW + padX * 2, totalH + padY * 2);
  }
  if (p.stroke) {
    ctx.lineWidth = Math.max(2, p.size / 14);
    ctx.strokeStyle = "rgba(0,0,0,.85)";
    ctx.lineJoin = "round";
  }
  lines.forEach((line, i) => {
    const ly = y - ((lines.length - 1) / 2) * lineH + i * lineH;
    if (p.stroke) ctx.strokeText(line, x, ly);
    ctx.fillStyle = p.color;
    ctx.fillText(line, x, ly);
  });
  ctx.restore();
}
