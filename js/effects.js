/* VideoForge — transitions par clip + keyframes d'animation */
"use strict";

/* ============ Transitions par clip ============ */
const TRANSITIONS = [
  { key: "none",  label: "Aucune" },
  { key: "fade",  label: "Fondu" },
  { key: "slide", label: "Glissé" },
  { key: "zoom",  label: "Zoom" },
  { key: "wipe",  label: "Balayage" },
];

/* Calcule alpha/scale/offset d'entrée-sortie selon la transition du clip */
function transitionState(clip, t, canvasW) {
  const p = clip.props;
  const kind = p.transition || "none";
  const dur = Math.min(p.transitionDur || 0.5, clip.duration / 2);
  const localIn = t - clip.start;
  const localOut = (clip.start + clip.duration) - t;
  const res = { alpha: 1, scale: 1, dx: 0, clipW: 1 };

  const ease = (x) => x * x * (3 - 2 * x); // smoothstep

  if (kind === "fade") {
    if (localIn < dur) res.alpha *= ease(Math.max(0, localIn / dur));
    if (localOut < dur) res.alpha *= ease(Math.max(0, localOut / dur));
  } else if (kind === "slide") {
    if (localIn < dur) res.dx = (1 - ease(Math.max(0, localIn / dur))) * canvasW;
    if (localOut < dur) res.dx -= (1 - ease(Math.max(0, localOut / dur))) * canvasW;
  } else if (kind === "zoom") {
    if (localIn < dur) res.scale *= 0.6 + 0.4 * ease(Math.max(0, localIn / dur));
    if (localOut < dur) { res.alpha *= ease(Math.max(0, localOut / dur)); res.scale *= 0.6 + 0.4 * ease(Math.max(0, localOut / dur)); }
  } else if (kind === "wipe") {
    if (localIn < dur) res.clipW = ease(Math.max(0, localIn / dur));
    if (localOut < dur) res.clipW = Math.min(res.clipW, ease(Math.max(0, localOut / dur)));
  }
  return res;
}

/* ============ Keyframes ============ */
/* clip.keyframes = [{t (s, relatif au clip), props: {opacity, scale, x, y, rotation}}]
   Interpolation linéaire entre keyframes encadrantes. */

function addKeyframeAt(clip, relT, props) {
  if (!clip.keyframes) clip.keyframes = [];
  const existing = clip.keyframes.findIndex(k => Math.abs(k.t - relT) < 0.05);
  const kf = { t: relT, props: { ...props } };
  if (existing >= 0) clip.keyframes[existing] = kf;
  else {
    clip.keyframes.push(kf);
    clip.keyframes.sort((a, b) => a.t - b.t);
  }
}

function removeKeyframe(clip, index) {
  if (!clip.keyframes) return;
  clip.keyframes.splice(index, 1);
}

/* Retourne les props animées à l'instant t (absolu) */
function animatedProps(clip, t) {
  const base = { ...clip.props };
  const kfs = clip.keyframes;
  if (!kfs || !kfs.length) return base;
  const rel = t - clip.start;
  if (rel <= kfs[0].t) return { ...base, ...kfs[0].props };
  if (rel >= kfs[kfs.length - 1].t) return { ...base, ...kfs[kfs.length - 1].props };
  for (let i = 0; i < kfs.length - 1; i++) {
    const a = kfs[i], b = kfs[i + 1];
    if (rel >= a.t && rel <= b.t) {
      const f = (rel - a.t) / (b.t - a.t);
      const out = { ...base };
      ["opacity", "scale", "x", "y", "rotation"].forEach(key => {
        if (a.props[key] != null && b.props[key] != null) {
          out[key] = a.props[key] + (b.props[key] - a.props[key]) * f;
        }
      });
      return out;
    }
  }
  return base;
}

/* ============ Interface : section propriétés étendue ============ */
function renderEffectsUI(sel) {
  const { clip, track } = sel;
  if (track.type !== "video" || clip.sub) return "";
  const p = clip.props;
  const kfs = clip.keyframes || [];
  const opts = TRANSITIONS.map(tr =>
    `<option value="${tr.key}" ${((p.transition || "none") === tr.key) ? "selected" : ""}>${tr.label}</option>`).join("");
  let kfRows = kfs.map((k, i) => `
    <div class="kf-row">
      <span class="kf-time">${k.t.toFixed(2)}s</span>
      <span class="kf-vals">op ${Math.round((k.props.opacity ?? 1) * 100)}% · éch ${Math.round((k.props.scale ?? 1) * 100)}% · x ${k.props.x ?? 0} · y ${k.props.y ?? 0} · r ${k.props.rotation ?? 0}°</span>
      <button class="btn btn-sm kf-del" data-i="${i}" title="Supprimer">✕</button>
    </div>`).join("");
  if (!kfs.length) kfRows = `<p class="hint" style="font-size:11px">Aucune keyframe. Placez la tête de lecture puis cliquez « ◆ Capturer » pour figer les props actuelles à cet instant.</p>`;
  return `
    <div class="panel-subsection">
      <h4>Transition</h4>
      <div class="form-row form-row-inline">
        <div><label>Type</label><select id="pTransition">${opts}</select></div>
        <div><label>Durée (s)</label><input type="number" id="pTransDur" step="0.1" min="0.1" max="3" value="${p.transitionDur || 0.5}"></div>
      </div>
    </div>
    <div class="panel-subsection">
      <h4>Animation (keyframes)</h4>
      <div class="kf-actions">
        <button class="btn btn-sm" id="btnCaptureKf">◆ Capturer ici</button>
      </div>
      <div class="kf-list">${kfRows}</div>
    </div>`;
}

function bindEffectsUI(sel) {
  const { clip } = sel;
  const tr = $("#pTransition");
  if (tr) tr.onchange = (e) => { clip.props.transition = e.target.value; drawFrame(); };
  const td = $("#pTransDur");
  if (td) td.oninput = (e) => { clip.props.transitionDur = Math.max(0.1, +e.target.value); drawFrame(); };
  const cap = $("#btnCaptureKf");
  if (cap) cap.onclick = () => {
    const rel = Math.max(0, Math.min(clip.duration, state.playhead - clip.start));
    const propsNow = animatedProps(clip, state.playhead);
    addKeyframeAt(clip, rel, {
      opacity: propsNow.opacity, scale: propsNow.scale,
      x: propsNow.x, y: propsNow.y, rotation: propsNow.rotation,
    });
    pushHistory();
    renderProps();
    drawFrame();
    toast(`◆ Keyframe capturée à ${rel.toFixed(2)}s`);
  };
  document.querySelectorAll(".kf-del").forEach(btn => {
    btn.onclick = () => {
      pushHistory();
      removeKeyframe(clip, +btn.dataset.i);
      renderProps();
      drawFrame();
    };
  });
}

/* Marqueurs de keyframes sur le clip (appelé par renderTimeline) */
function keyframeMarkers(clip) {
  const kfs = clip.keyframes;
  if (!kfs || !kfs.length) return "";
  return kfs.map(k =>
    `<span class="kf-marker" style="left:${k.t * state.pxPerSec - 4}px"></span>`).join("");
}
