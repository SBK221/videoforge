# 🎬 VideoForge

**Éditeur vidéo professionnel dans votre navigateur.** Simple, puissant, gratuit — et 100 % privé : vos fichiers ne quittent jamais votre machine.

![Mode](https://img.shields.io/badge/Mode-Simple_%7C_Expert-4f8cff)
![License](https://img.shields.io/badge/licence-libre-2fd27d)
![Deps](https://img.shields.io/badge/d%C3%A9pendances-0-7c5cff)

## ✨ Fonctionnalités

### Montage
- Timeline multi-pistes (Vidéo · Texte · Audio · Sous-titres)
- Glisser-déposer des médias, redimensionnement des clips (trim)
- Diviser (`S`), dupliquer (`D`), supprimer (`Suppr`)
- Undo/Redo illimité (`Ctrl+Z` / `Ctrl+Shift+Z`)

### Effets & animation
- Transitions par clip : fondu, glissé, zoom, balayage (durée réglable)
- Keyframes animables : opacité, échelle, position, rotation (interpolation automatique)
- Corrections : luminosité, contraste, saturation
- Texte : taille, couleur, gras, position

### Sous-titres
- Import `.srt` (standard YouTube/VLC)
- Export `.srt`
- Génération auto depuis les clips texte
- Éditeur intégré avec saut au timecode

### Audio
- Bibliothèque musicale **libre de droits** (4 morceaux synthétisés dans le navigateur)
- Écoute avant ajout, intégration en 1 clic
- Export avec audio mixé (musique + son des vidéos)

### Export
- 720p / 1080p / 4K, bitrate réglable
- WebM — rendu 100 % local, aucun serveur

### Accessibilité
- **Mode Simple** (interface épurée) / **Mode Expert**
- Thème sombre & clair (préférence sauvegardée)
- Raccourcis clavier complets (`?` pour l'aide)
- Responsive (desktop → mobile)

## 🚀 Utilisation

Ouvrez simplement `index.html` dans Chrome ou Firefox — aucune installation, aucun serveur.

### Version en ligne
👉 **[Démo GitHub Pages](https://sbk221.github.io/videoforge/)**

## 🛠 Architecture

```
index.html          Interface (topbar, 3 panneaux, timeline)
css/style.css       Thème sombre/clair, responsive
js/app.js           Moteur : état, timeline, lecture, export
js/effects.js       Transitions par clip + keyframes
js/subtitles.js     Import/export SRT + éditeur
js/music.js         Bibliothèque musicale synthétisée (Web Audio)
```

Aucune dépendance, aucun framework — JavaScript natif uniquement.

## ⌨ Raccourcis principaux

| Touche | Action |
|---|---|
| `Espace` | Lecture / Pause |
| `J` `K` `L` | Ralenti / Pause / Accéléré |
| `←` `→` (+`Shift`) | ±1 s / ±5 s |
| `,` `.` | Image par image |
| `S` / `D` / `T` | Diviser / Dupliquer / Texte |
| `F` | Plein écran |
| `?` | Aide complète |

## ⚠️ Notes
- L'export utilise `MediaRecorder` : durée = durée réelle de la timeline.
- Formats acceptés : tout ce que votre navigateur lit (MP4, WebM, MOV selon codec, PNG, JPG, MP3, WAV…).

## 📄 Licence
Code libre d'utilisation. Musiques de la bibliothèque : générées procéduralement, libres de droits.
