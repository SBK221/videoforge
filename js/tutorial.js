/* VideoForge — tutoriel interactif au premier lancement */
"use strict";

const TUTORIAL_STEPS = [
  {
    title: "👋 Bienvenue dans VideoForge",
    target: "#dropzone",
    text: `Votre studio de montage vidéo, entièrement dans le navigateur. En 6 étapes rapides, vous saurez tout faire.<br><br><b>Étape 1 :</b> commencez par importer une vidéo, une image ou une musique — glissez un fichier dans cette zone, ou cliquez dessus.`,
  },
  {
    title: "📁 Vos médias apparaissent ici",
    target: "#mediaGrid",
    text: `Chaque fichier importé devient une carte réutilisable. Double-cliquez sur une carte pour l'ajouter directement à la timeline, ou glissez-la sur la piste de votre choix.<br><br>Le bouton ✕ supprime un média de la liste.`,
  },
  {
    title: "🎵 Musique libre de droits",
    target: "#musicLibraryPanel",
    text: `Pas de fichier sous la main ? Choisissez un morceau dans la bibliothèque : il est <b>synthétisé dans votre navigateur</b>, donc 100 % libre de droits.<br><br>🎧 pour écouter, puis un clic pour l'ajouter à la piste audio.`,
  },
  {
    title: "🎞 La timeline : le cœur du montage",
    target: "#timelineScroll",
    text: `Les clips se montent ici : glissez-les pour les déplacer, tirez leurs bords pour les raccourcir.<br><br>Barre du haut : <kbd>S</kbd> diviser · <kbd>D</kbd> dupliquer · <kbd>Suppr</kbd> supprimer · le bouton <b>T</b> ajoute du texte.`,
  },
  {
    title: "▶ Prévisualisez votre montage",
    target: ".preview-controls",
    text: `<kbd>Espace</kbd> pour lecture/pause, les flèches pour naviguer image par image.<br><br>La tête de lecture rouge dans la timeline indique l'instant affiché ici.`,
  },
  {
    title: "⬇ Exportez votre vidéo",
    target: "#btnExport",
    text: `Quand votre montage est prêt, exportez en 720p, 1080p ou 4K. Le rendu se fait <b>localement</b> — aucun fichier n'est envoyé sur Internet.<br><br>Bon montage ! 🎬`,
  },
];

let tutStep = 0;

function positionTutorialCard(card, targetEl) {
  const r = targetEl.getBoundingClientRect();
  const margin = 14;
  let left = Math.max(16, r.left + r.width / 2 - 170);
  let top;
  if (r.top > window.innerHeight / 2) {
    top = Math.max(16, r.top - card.offsetHeight - margin);
  } else {
    top = Math.min(window.innerHeight - card.offsetHeight - 16, r.bottom + margin);
  }
  left = Math.min(left, window.innerWidth - 356);
  card.style.left = `${left}px`;
  card.style.top = `${top}px`;
}

function highlightTarget(targetEl) {
  let hl = document.querySelector(".tut-highlight");
  if (!hl) {
    hl = document.createElement("div");
    hl.className = "tut-highlight";
    document.body.appendChild(hl);
  }
  if (!targetEl) { hl.style.display = "none"; return; }
  const r = targetEl.getBoundingClientRect();
  hl.style.display = "";
  hl.style.left = `${r.left - 6}px`;
  hl.style.top = `${r.top - 6}px`;
  hl.style.width = `${r.width + 12}px`;
  hl.style.height = `${r.height + 12}px`;
}

function showTutorialStep(i) {
  const step = TUTORIAL_STEPS[i];
  let card = document.querySelector(".tut-card");
  if (!card) {
    card = document.createElement("div");
    card.className = "tut-card";
    document.body.appendChild(card);
  }
  const targetEl = step.target ? $(step.target) : null;
  const dots = TUTORIAL_STEPS.map((_, k) => `<span class="tut-dot${k === i ? " on" : ""}"></span>`).join("");

  card.innerHTML = `
    <span class="tut-step">Étape ${i + 1} / ${TUTORIAL_STEPS.length}</span>
    <h3>${step.title}</h3>
    <p>${step.text}</p>
    <div class="tut-nav">
      <button class="btn btn-sm" id="tutSkip">Passer</button>
      <div class="tut-dots">${dots}</div>
      <button class="btn btn-sm btn-primary" id="tutNext">${i === TUTORIAL_STEPS.length - 1 ? "Terminer 🎬" : "Suivant →"}</button>
    </div>`;

  highlightTarget(targetEl);
  requestAnimationFrame(() => positionTutorialCard(card, targetEl));

  card.querySelector("#tutNext").onclick = () => {
    if (i < TUTORIAL_STEPS.length - 1) { tutStep = i + 1; showTutorialStep(i + 1); }
    else endTutorial();
  };
  card.querySelector("#tutSkip").onclick = endTutorial;
}

function endTutorial() {
  localStorage.setItem("vf-tutorial-done", "1");
  document.querySelectorAll(".tut-card, .tut-highlight, .tut-overlay").forEach(el => el.remove());
}

function startTutorial(force = false) {
  if (!force && localStorage.getItem("vf-tutorial-done")) return;
  if (document.querySelector(".tut-card")) return;
  const overlay = document.createElement("div");
  overlay.className = "tut-overlay";
  overlay.onclick = endTutorial;
  document.body.appendChild(overlay);
  tutStep = 0;
  showTutorialStep(0);
}

/* Redimensionnement : repositionne la carte */
window.addEventListener("resize", () => {
  const card = document.querySelector(".tut-card");
  if (!card) return;
  const step = TUTORIAL_STEPS[tutStep];
  const targetEl = step && step.target ? $(step.target) : null;
  highlightTarget(targetEl);
  if (targetEl) positionTutorialCard(card, targetEl);
});
