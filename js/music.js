/* VideoForge — bibliothèque musicale libre de droits, synthétisée dans le navigateur */
"use strict";

/* Chaque morceau est défini par une fonction qui écrit des échantillons PCM
   via l'API Web Audio (OfflineAudioContext), puis encodée en WAV et
   intégrée comme média audio normal dans la timeline. */

const MUSIC_TRACKS = [
  { id: "upbeat",    name: "Upbeat Energy",     tag: "Dynamique",    dur: 20, bpm: 120, desc: "Pop énergique — intros, vlogs" },
  { id: "chill",     name: "Chill Wave",        tag: "Détente",      dur: 20, bpm: 85,  desc: "Ambiance calme — tutoriels" },
  { id: "epic",      name: "Epic Rise",         tag: "Cinématique",  dur: 24, bpm: 100, desc: "Tension héroïque — gaming, sport" },
  { id: "corporate", name: "Clean Corporate",  tag: "Pro",          dur: 20, bpm: 110, desc: "Neutre et positif — présentations" },
];

/* Génération procédurale par morceau */
function buildSong(ctx_, song) {
  const dur = song.dur;
  const beat = 60 / song.bpm;
  const notes = { C: 261.63, D: 293.66, E: 329.63, F: 349.23, G: 392, A: 440, B: 493.88 };
  const progressions = {
    upbeat:    [[notes.C, notes.E, notes.G], [notes.A, notes.C, notes.E], [notes.F, notes.A, notes.C], [notes.G, notes.B, notes.D]],
    chill:     [[notes.A, notes.C, notes.E], [notes.F, notes.A, notes.C], [notes.C, notes.E, notes.G], [notes.G, notes.B, notes.D]],
    epic:      [[notes.D / 2, notes.A, notes.D], [notes.A, notes.D, notes.F], [notes.F, notes.A, notes.C], [notes.G, notes.B, notes.D]],
    corporate: [[notes.G, notes.B, notes.D], [notes.C, notes.E, notes.G], [notes.A, notes.C, notes.E], [notes.E, notes.G, notes.B]],
  };
  const prog = progressions[song.id] || progressions.upbeat;

  /* Kick synthétique répété */
  for (let t = beat / 2; t < dur; t += beat) {
    const k = ctx_.createOscillator(), g = ctx_.createGain();
    k.type = "sine";
    k.frequency.setValueAtTime(150, t);
    k.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    g.gain.setValueAtTime(song.id === "chill" ? 0.25 : 0.8, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    k.connect(g).connect(ctx_.destination);
    k.start(t); k.stop(t + 0.2);
  }

  /* Nappe d'accords */
  for (let bar = 0; bar * beat * 4 < dur; bar++) {
    const chord = prog[bar % prog.length];
    const t0 = bar * beat * 4, len = beat * 4;
    chord.forEach(freq => {
      [0, 1].forEach(sub => {
        const osc = ctx_.createOscillator(), g = ctx_.createGain();
        osc.type = sub === 0 ? "triangle" : "sine";
        osc.frequency.value = freq * (sub === 1 ? 2 : 1);
        osc.detune.value = sub === 1 ? 6 : -6;
        g.gain.setValueAtTime(0, t0);
        g.gain.linearRampToValueAtTime(0.14, t0 + 0.05);
        g.gain.setValueAtTime(0.14, t0 + len * 0.7);
        g.gain.linearRampToValueAtTime(0.0001, t0 + len);
        osc.connect(g).connect(ctx_.destination);
        osc.start(t0); osc.stop(t0 + len);
      });
    });
  }

  /* Mélodie simple, déterministe par morceau */
  const scale = [notes.C, notes.D, notes.E, notes.G, notes.A];
  const seed = [...song.id].reduce((s, c) => s + c.charCodeAt(0), 0);
  for (let t = beat * 4; t < dur - beat; t += beat) {
    const idx = (seed + Math.floor(t / beat)) % scale.length;
    const osc = ctx_.createOscillator(), g = ctx_.createGain();
    osc.type = "square";
    osc.frequency.value = scale[idx] * 2;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.06, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + beat * 0.9);
    osc.connect(g).connect(ctx_.destination);
    osc.start(t); osc.stop(t + beat);
  }
}

/* Encodage WAV 16-bit mono */
function audioBufferToWav(buffer) {
  const sr = buffer.sampleRate, data = buffer.getChannelData(0);
  const bytes = 44 + data.length * 2;
  const ab = new ArrayBuffer(bytes), view = new DataView(ab);
  const ws = (o, s) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
  ws(0, "RIFF"); view.setUint32(4, bytes - 8, true); ws(8, "WAVE");
  ws(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, 1, true); view.setUint32(24, sr, true);
  view.setUint32(28, sr * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  ws(36, "data"); view.setUint32(40, data.length * 2, true);
  let off = 44;
  for (let i = 0; i < data.length; i++, off += 2) {
    const s = Math.max(-1, Math.min(1, data[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
  return new Blob([ab], { type: "audio/wav" });
}

async function generateSong(song) {
  const sr = 22050;
  const off = new OfflineAudioContext(1, Math.ceil(sr * song.dur), sr);
  buildSong(off, song);
  const buf = await off.startRendering();
  return audioBufferToWav(buf);
}

/* Interface de la bibliothèque */
function renderMusicLibrary() {
  const list = $("#musicList");
  if (!list) return;
  list.innerHTML = "";
  MUSIC_TRACKS.forEach(song => {
    const already = state.media.find(m => m.id === `music-${song.id}`);
    const item = document.createElement("div");
    item.className = "music-item" + (already ? " added" : "");
    item.innerHTML = `
      <button class="mi-play" title="Écouter">🎧</button>
      <span class="mi-name" title="${song.desc}">${song.name} <small style="color:var(--muted)">· ${song.dur}s</small></span>
      <span class="mi-tag">${song.tag}</span>`;
    item.querySelector(".mi-play").onclick = async (e) => {
      e.stopPropagation();
      const btn = e.currentTarget;
      if (btn._audio) { btn._audio.pause(); btn._audio = null; btn.textContent = "🎧"; return; }
      let media = state.media.find(m => m.id === `music-${song.id}`);
      if (!media) media = await addMusicToMedia(song);
      const a = new Audio(media.url);
      a.onended = () => { btn.textContent = "🎧"; btn._audio = null; };
      btn._audio = a;
      btn.textContent = "⏹";
      a.play();
    };
    item.onclick = async () => {
      let media = state.media.find(m => m.id === `music-${song.id}`);
      if (!media) media = await addMusicToMedia(song);
      addClipFromMedia(media);
      renderMusicLibrary();
    };
    list.appendChild(item);
  });
}

async function addMusicToMedia(song) {
  toast(`🎵 Génération de "${song.name}"…`);
  const blob = await generateSong(song);
  const url = URL.createObjectURL(blob);
  const el = new Audio();
  el.preload = "metadata"; el.src = url;
  await new Promise(r => { el.onloadedmetadata = r; });
  const media = { id: `music-${song.id}`, name: song.name, type: "audio", url, duration: el.duration, thumb: null, el, builtin: true };
  state.media.push(media);
  renderMedia();
  return media;
}

function initMusicLibrary() {
  renderMusicLibrary();
}
