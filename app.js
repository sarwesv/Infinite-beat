/**
 * Infinite Lo-Fi Audio Engine - Staggered Background Edition
 * Optimized for Mobile/iPad Performance
 */

let isPlaying = false;
let initialized = false;

// UI Elements
const startStopBtn = document.getElementById('start-stop');
const volumeSlider = document.getElementById('volume');
const dbDisplay = document.getElementById('db-value');
const canvas = document.getElementById('visualizer-canvas');
const staggerBg = document.getElementById('stagger-bg');
const ctx = canvas.getContext('2d');
const body = document.body;

// Audio Nodes
let limiter, compressor, mainVol, analyser, reverb, delay;
let kick, snare, hihat, shaker, bass, keys, pad, lead, rain, vinyl;

// Visualizer State
let barHeights = new Array(32).fill(0);
let rotationAngle = 0;

/**
 * Initialize Audio Engine
 */
async function initAudio() {
    try {
        await Tone.start();
        createStaggerGrid();
        
        limiter = new Tone.Limiter(-1).toDestination();
        compressor = new Tone.Compressor({
            threshold: -18,
            ratio: 3,
            attack: 0.01,
            release: 0.1
        }).connect(limiter);
        
        // Start at slider value
        const startDb = volumeSlider ? parseFloat(volumeSlider.value) : -20;
        mainVol = new Tone.Volume(startDb).connect(compressor);
        analyser = new Tone.Analyser("fft", 32);
        mainVol.connect(analyser);

        reverb = new Tone.JCReverb(0.5).connect(mainVol);
        delay = new Tone.FeedbackDelay("8n.", 0.2).connect(reverb);

        rain = new Tone.Noise("pink");
        rain.volume.value = -38;
        const rainFilter = new Tone.AutoFilter({ frequency: "8n", baseFrequency: 300, octaves: 1.5 }).connect(mainVol).start();
        rain.connect(rainFilter);
        rain.start();

        vinyl = new Tone.Noise("brown");
        vinyl.volume.value = -45;
        vinyl.connect(mainVol);
        vinyl.start();

        kick = new Tone.MembraneSynth({ pitchDecay: 0.05, octaves: 2, oscillator: { type: "sine" }, envelope: { attack: 0.005, decay: 0.4, sustain: 0.01 }}).connect(mainVol);
        kick.volume.value = -2;

        snare = new Tone.NoiseSynth({ envelope: { attack: 0.005, decay: 0.1, sustain: 0 }}).connect(mainVol);
        snare.volume.value = -12;

        hihat = new Tone.MetalSynth({ frequency: 200, envelope: { attack: 0.005, decay: 0.1, release: 0.05 }, harmonicity: 3, modulationIndex: 16, resonance: 2000, octaves: 1 }).connect(mainVol);
        hihat.volume.value = -28;

        shaker = new Tone.NoiseSynth({ envelope: { attack: 0.01, decay: 0.05, sustain: 0 }}).connect(mainVol);
        shaker.volume.value = -32;

        const bassDist = new Tone.Distortion(0.05).connect(mainVol);
        bass = new Tone.MonoSynth({ oscillator: { type: "triangle" }, envelope: { attack: 0.01, decay: 0.3, sustain: 0.4, release: 0.8 }, filterEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.1, baseFrequency: 120, octaves: 2 }}).connect(bassDist);
        bass.volume.value = +4;

        keys = new Tone.PolySynth(Tone.Synth, { maxPolyphony: 4, oscillator: { type: "sine" }, envelope: { attack: 0.2, decay: 0.4, sustain: 0.3, release: 1 }}).connect(delay);
        keys.volume.value = -18;

        pad = new Tone.PolySynth(Tone.Synth, { maxPolyphony: 4, oscillator: { type: "sine" }, envelope: { attack: 2, decay: 1, sustain: 0.5, release: 3 }}).connect(reverb);
        pad.volume.value = -28;

        lead = new Tone.Synth({ oscillator: { type: "sine" }, envelope: { attack: 0.5, decay: 0.2, sustain: 0.5, release: 2 }}).connect(delay);
        lead.volume.value = -22;

        setupLoop();
        startLegoVisualizer();
        initialized = true;
    } catch (e) {
        console.error("Initialization failed", e);
    }
}

/**
 * Create a grid of dots for the stagger effect
 */
function createStaggerGrid() {
    const columns = Math.ceil(window.innerWidth / 80);
    const rows = Math.ceil(window.innerHeight / 80);
    const totalDots = columns * rows;
    
    staggerBg.innerHTML = '';
    for (let i = 0; i < totalDots; i++) {
        const dot = document.createElement('div');
        dot.className = 'stagger-dot';
        staggerBg.appendChild(dot);
    }
}

/**
 * Trigger staggered background ripple
 */
function triggerStaggerRipple() {
    if (!initialized) return;
    const columns = Math.ceil(window.innerWidth / 80);
    const rows = Math.ceil(window.innerHeight / 80);
    
    anime({
        targets: '.stagger-dot',
        scale: [1, 2.5, 1],
        opacity: [0.4, 1, 0.4],
        delay: anime.stagger(60, { grid: [columns, rows], from: 'center' }),
        duration: 800,
        easing: 'easeOutSine'
    });
}

/**
 * 3D Isometric LEGO Cube Renderer
 */
function drawLegoBrick(centerX, centerY, size, height, color) {
    const topColor = color;
    const rightColor = shadeColor(color, -25);
    const leftColor = shadeColor(color, -45);
    const isoW = size * 0.9;
    const isoH = size * 0.45;
    const pCenter = { x: centerX, y: centerY };
    const pRight = { x: centerX + isoW, y: centerY - isoH };
    const pTop = { x: centerX, y: centerY - isoH * 2 };
    const pLeft = { x: centerX - isoW, y: centerY - isoH };
    const drawFace = (pts, col) => {
        ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); ctx.lineTo(pts[1].x, pts[1].y); ctx.lineTo(pts[2].x, pts[2].y); ctx.lineTo(pts[3].x, pts[3].y); ctx.closePath(); ctx.fill();
    };
    drawFace([pCenter, pLeft, { x: pLeft.x, y: pLeft.y - height }, { x: pCenter.x, y: pCenter.y - height }], leftColor);
    drawFace([pCenter, pRight, { x: pRight.x, y: pRight.y - height }, { x: pCenter.x, y: pCenter.y - height }], rightColor);
    drawFace([{ x: pCenter.x, y: pCenter.y - height }, { x: pRight.x, y: pRight.y - height }, { x: pTop.x, y: pTop.y - height }, { x: pLeft.x, y: pLeft.y - height }], topColor);
    ctx.strokeStyle = "rgba(255,255,255,0.4)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(pLeft.x, pLeft.y - height); ctx.lineTo(pCenter.x, pCenter.y - height); ctx.lineTo(pRight.x, pRight.y - height); ctx.stroke();
}

function shadeColor(color, percent) {
    let R = parseInt(color.substring(1,3),16); let G = parseInt(color.substring(3,5),16); let B = parseInt(color.substring(5,7),16);
    R = parseInt(R * (100 + percent) / 100); G = parseInt(G * (100 + percent) / 100); B = parseInt(B * (100 + percent) / 100);
    R = (R<255)?R:255; G = (G<255)?G:255; B = (B<255)?B:255;
    let RR = ((R.toString(16).length==1)?"0"+R.toString(16):R.toString(16)); let GG = ((G.toString(16).length==1)?"0"+G.toString(16):G.toString(16)); let BB = ((B.toString(16).length==1)?"0"+B.toString(16):B.toString(16));
    return "#"+RR+GG+BB;
}

/**
 * LEGO Visualizer Main Loop with PERFECT ALIGNMENT
 */
function startLegoVisualizer() {
    function render() {
        requestAnimationFrame(render);
        const dpr = window.devicePixelRatio || 1;
        const w = window.innerWidth;
        const h = window.innerHeight;
        if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
            canvas.width = w * dpr; canvas.height = h * dpr; ctx.scale(dpr, dpr);
        }
        ctx.clearRect(0, 0, w, h);
        if (!isPlaying) return;
        rotationAngle += 0.007;
        const fftData = analyser.getValue();
        const centerX = w / 2; const centerY = h / 2;
        let bricks = [];
        for (let i = 0; i < fftData.length; i++) {
            const rawVal = (fftData[i] + 100); const target = Math.max(12, rawVal * (h / 350)); barHeights[i] += (target - barHeights[i]) * 0.12;
            const radius = Math.min(w, h) * 0.45; const brickAngle = (i / fftData.length) * Math.PI * 2 + rotationAngle;
            const x = centerX + Math.cos(brickAngle) * radius; const y = centerY + Math.sin(brickAngle) * (radius * 0.35);
            let color = "#2563eb"; if (i < 6) color = "#dc2626"; if (i > 22) color = "#facc15";
            bricks.push({ x, y, h: barHeights[i], color });
        }
        bricks.sort((a, b) => a.y - b.y);
        bricks.forEach(b => drawLegoBrick(b.x, b.y, 16, b.h, b.color));
    }
    render();
}

/**
 * Generative Music Loop
 */
function setupLoop() {
    const drumSeq = new Tone.Sequence((time, hit) => {
        if (hit === "K") {
            kick.triggerAttackRelease("C1", "8n", time);
            Tone.Draw.schedule(() => triggerStaggerRipple(), time);
        }
        if (hit === "S") snare.triggerAttackRelease("16n", time);
        if (hit === "H") hihat.triggerAttackRelease("32n", time, 0.5);
        if (hit === "h") shaker.triggerAttackRelease("32n", time, 0.2);
    }, [ "K", "h", "H", "h", "S", "h", "K", "h", "K", "h", "H", "h", "S", "h", null, "h" ], "8n").start(0);

    const chords = [ ["C4", "E4", "G4", "B4"], ["A3", "C4", "E4", "G4"], ["F3", "A3", "C4", "E4"], ["G3", "B3", "D4", "F4"], ["D4", "F4", "A4", "C5"], ["E3", "G3", "B3", "D4"] ];
    let currentChordIndex = 0;
    const musicLoop = new Tone.Loop((time) => {
        if (Tone.Transport.position.split(":")[1] === "0" && Math.random() > 0.5) { currentChordIndex = Math.floor(Math.random() * chords.length); }
        const chordNotes = chords[currentChordIndex];
        keys.triggerAttackRelease(chordNotes, "2n", time, 0.4);
        pad.triggerAttackRelease(chordNotes, "1n", time, 0.2);
        const root = chordNotes[0].replace(/[34]/, '2'); const fifth = chordNotes[2].replace(/[34]/, '2');
        bass.triggerAttackRelease(root, "2n", time, 0.5);
        if (Math.random() > 0.4) {
            const bassOffset = Math.random() > 0.5 ? "2n" : "2n + 8n";
            const bassNote = Math.random() > 0.7 ? fifth : root;
            bass.triggerAttackRelease(bassNote, "8n", time + Tone.Time(bassOffset).toSeconds(), 0.3);
        }
        if (Math.random() > 0.4) {
            const melodyNote = chordNotes[Math.floor(Math.random() * chordNotes.length)].replace(/[34]/, '5');
            lead.triggerAttackRelease(melodyNote, "2n", time + Tone.Time("4n").toSeconds(), 0.3);
        }
    }, "1n").start(0);
    Tone.Transport.bpm.value = 80; Tone.Transport.swing = 0.3;
}

// UI Handlers
startStopBtn.addEventListener('click', async () => {
    try {
        if (typeof Tone === 'undefined') {
            startStopBtn.innerText = "Error: Tone.js not loaded";
            return;
        }

        if (!initialized) {
            startStopBtn.innerText = "Building...";
            await initAudio();
            if (!initialized) return; // initAudio failed but caught its own error
        }

        if (isPlaying) {
            // FADE OUT
            if (mainVol) mainVol.volume.rampTo(-Infinity, 0.15);
            setTimeout(() => {
                Tone.Transport.pause();
                body.classList.remove('playing');
                startStopBtn.innerText = "Start Music";
            }, 150);
        } else {
            // FADE IN
            await Tone.start(); // Ensure context is resumed
            Tone.Transport.start();
            
            if (mainVol) {
                const targetDb = volumeSlider ? parseFloat(volumeSlider.value) : -20;
                mainVol.volume.value = -Infinity;
                mainVol.volume.rampTo(targetDb, 0.4);
            }
            
            body.classList.add('playing');
            startStopBtn.innerText = "Stop Music";
        }
        isPlaying = !isPlaying;
    } catch (err) {
        console.error("Click handler error:", err);
        startStopBtn.innerText = "Error: " + (err.message || "Failed to start");
    }
});

volumeSlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    if (mainVol) mainVol.volume.rampTo(val, 0.05);
    if (dbDisplay) dbDisplay.innerText = val;
});

window.addEventListener('resize', () => {
    if (initialized) createStaggerGrid();
});
