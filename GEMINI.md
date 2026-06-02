# Infinite Lo-Fi Beats - Project Instructions

## Tech Stack
- **Audio:** Tone.js (Generative engine, synthesis, effects)
- **Visuals:** HTML5 Canvas (3D Isometric LEGO bricks), Anime.js (UI animations, stagger ripple)
- **Styling:** Vanilla CSS (Glassmorphism, responsive design)
- **Deployment:** GitHub Pages (Static site)

## Architecture
- `index.html`: Main entry point and UI skeleton.
- `app.js`: Contains the entire logic (Audio engine, visualizer, UI interactions).
- `styles.css`: Global styles and animations.
- `version.json`: Simple version tracking for auto-updates.

## Conventions
- **Version Control:** Follow the versioning scheme in `version.json` and `APP_VERSION` in `app.js`. Update both when making significant changes.
- **Audio:**
  - Use `panicStop()` to silence all audio sources (without cancelling sequences).
  - Tone.js nodes should be connected through `mainVol` (calibrated at -11dB for speakers).
  - Background persistence uses a silent MP3 anchor to prevent mobile OS suspension.
- **Visuals:**
  - `drawLegoBrick` is the primitive for the visualizer.
  - Visualizer handles device pixel ratio (DPR) and uses Anime.js for smooth scaling.
- **Styling:**
  - Use CSS variables defined in `:root`.
  - Maintain the glassmorphism aesthetic.

## Workflows
- **Testing:** Manually verify audio playback and visualizer responsiveness in a browser after changes.
- **Auto-Update:** Ensure `version.json` is updated so clients reload the new version.
