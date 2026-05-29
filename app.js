/**
 * Infinite Lo-Fi Audio Engine - LEGO 3D Visualizer Edition
 * Uses Tone.js for music and Anime.js for smooth visuals
 */

let isPlaying = false;
let initialized = false;

// UI Elements
const startStopBtn = document.getElementById('start-stop');
const volumeSlider = document.getElementById('volume');
const canvas = document.getElementById('visualizer-canvas');
const ctx = canvas.getContext('2d');
const body = document.body;

// Audio Nodes
let limiter, mainVol, analyser, reverb, delay;
let kick, snare, hihat, shaker, bass, keys, pad, lead, rain, vinyl;

// Visualizer State
let barHeights = new Array(32).fill(0);
let targetHeights = new Array(32).fill(0);

/**
 * Initialize Audio Engine
 */
async function initAudio() {
    try {
        await Tone.start();
        
        limiter = new Tone.Limiter(-1).toDestination();
        mainVol = new Tone.Volume(-Infinity).connect(limiter);
        
        // Lower FFT size for a "blocky" LEGO look (32 bars)
        analyser = new Tone.Analyser("fft", 32);
        mainVol.connect(analyser);

        reverb = new Tone.Reverb({ decay: 6, wet: 0.3 }).connect(mainVol);
        delay = new Tone.FeedbackDelay("8n.", 0.3).connect(reverb);

        // --- AMBIENCE ---
        rain = new Tone.Noise("pink");
        rain.volume.value = -35;
        const rainFilter = new Tone.AutoFilter({ frequency: "4n", baseFrequency: 400, octaves: 2 }).connect(mainVol).start();
        rain.connect(rainFilter);
        rain.start();

        vinyl = new Tone.Noise("brown");
        vinyl.volume.value = -40;
        vinyl.connect(mainVol);
        vinyl.start();

        // --- INSTRUMENTS ---
        kick = new Tone.MembraneSynth({ pitchDecay: 0.05, octaves: 2, oscillator: { type: "sine" }, envelope: { attack: 0.005, decay: 0.4, sustain: 0.01 }}).connect(mainVol);
        kick.volume.value = -2;

        snare = new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.005, decay: 0.1, sustain: 0 }}).connect(mainVol);
        snare.volume.value = -10;

        hihat = new Tone.MetalSynth({ frequency: 200, envelope: { attack: 0.005, decay: 0.1, release: 0.05 }, harmonicity: 5.1, modulationIndex: 32, resonance: 4000, octaves: 1.5 }).connect(mainVol);
        hihat.volume.value = -25;

        shaker = new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.01, decay: 0.05, sustain: 0 }}).connect(mainVol);
        shaker.volume.value = -30;

        const bassDist = new Tone.Distortion(0.1).connect(mainVol);
        bass = new Tone.MonoSynth({ oscillator: { type: "triangle" }, envelope: { attack: 0.01, decay: 0.3, sustain: 0.4, release: 0.8 }, filterEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.1, baseFrequency: 150, octaves: 2.5 }}).connect(bassDist);
        bass.volume.value = +4;

        keys = new Tone.PolySynth(Tone.Synth, { oscillator: { type: "sine" }, envelope: { attack: 0.2, decay: 0.4, sustain: 0.4, release: 1.5 }}).connect(delay);
        keys.volume.value = -15;

        pad = new Tone.PolySynth(Tone.Synth, { oscillator: { type: "sine" }, envelope: { attack: 2, decay: 1, sustain: 0.8, release: 4 }}).connect(reverb);
        pad.volume.value = -25;

        lead = new Tone.Synth({ oscillator: { type: "sine" }, envelope: { attack: 0.5, decay: 0.2, sustain: 0.5, release: 2 }}).connect(delay);
        lead.volume.value = -20;

        setupLoop();
        startLegoVisualizer();
        initialized = true;
    } catch (e) {
        console.error("Initialization failed", e);
    }
}

/**
 * 3D Isometric LEGO Cube Renderer
 */
function drawLegoBrick(x, y, size, height, color) {
    const topColor = color;
    const rightColor = shadeColor(color, -20);
    const leftColor = shadeColor(color, -40);

    // Isometric math: project 3D to 2D
    const isoW = size * 0.8;
    const isoH = size * 0.4;

    // 1. Right Face
    ctx.fillStyle = rightColor;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + isoW, y - isoH);
    ctx.lineTo(x + isoW, y - isoH - height);
    ctx.lineTo(x, y - height);
    ctx.closePath();
    ctx.fill();

    // 2. Left Face
    ctx.fillStyle = leftColor;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - isoW, y - isoH);
    ctx.lineTo(x - isoW, y - isoH - height);
    ctx.lineTo(x, y - height);
    ctx.closePath();
    ctx.fill();

    // 3. Top Face (The "Smooth" part)
    ctx.fillStyle = topColor;
    ctx.beginPath();
    ctx.moveTo(x, y - height);
    ctx.lineTo(x + isoW, y - isoH - height);
    ctx.lineTo(x, y - isoH * 2 - height);
    ctx.lineTo(x - isoW, y - isoH - height);
    ctx.closePath();
    ctx.fill();
    
    // Subtle white highlight on the top edge for "plastic" look
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 1;
    ctx.stroke();
}

function shadeColor(color, percent) {
    let R = parseInt(color.substring(1,3),16);
    let G = parseInt(color.substring(3,5),16);
    let B = parseInt(color.substring(5,7),16);
    R = parseInt(R * (100 + percent) / 100);
    G = parseInt(G * (100 + percent) / 100);
    B = parseInt(B * (100 + percent) / 100);
    R = (R<255)?R:255;  G = (G<255)?G:255;  B = (B<255)?B:255;
    let RR = ((R.toString(16).length==1)?"0"+R.toString(16):R.toString(16));
    let GG = ((G.toString(16).length==1)?"0"+G.toString(16):G.toString(16));
    let BB = ((B.toString(16).length==1)?"0"+B.toString(16):B.toString(16));
    return "#"+RR+GG+BB;
}

/**
 * LEGO Visualizer Main Loop
 */
function startLegoVisualizer() {
    function render() {
        requestAnimationFrame(render);
        const w = canvas.width = canvas.offsetWidth;
        const h = canvas.height = canvas.offsetHeight;
        ctx.clearRect(0, 0, w, h);

        if (!isPlaying) return;

        const fftData = analyser.getValue();
        const brickSize = (w / fftData.length) * 0.6;
        const spacing = w / fftData.length;

        for (let i = 0; i < fftData.length; i++) {
            // Target height based on frequency
            const rawVal = (fftData[i] + 100); // 0 to 100 approx
            const target = Math.max(10, rawVal * (h / 120));
            
            // Anime.js style smoothing (Lerp)
            barHeights[i] += (target - barHeights[i]) * 0.15;

            const x = (i * spacing) + (spacing / 2);
            const y = h * 0.85; // Baseplate height
            
            // Choose color based on frequency
            let color = "#3b82f6"; // Blue
            if (i < 5) color = "#ef4444"; // Bass = Red bricks
            if (i > 20) color = "#facc15"; // Highs = Yellow bricks
            
            // Draw the 3D Lego column
            drawLegoBrick(x, y, brickSize, barHeights[i], color);
        }
    }
    render();
}

/**
 * Generative Music Loop
 */
function setupLoop() {
    const drumSeq = new Tone.Sequence((time, hit) => {
        if (hit === "K") kick.triggerAttackRelease("C1", "8n", time);
        if (hit === "S") snare.triggerAttackRelease("16n", time);
        if (hit === "H") hihat.triggerAttackRelease("32n", time, 0.5);
        if (hit === "h") shaker.triggerAttackRelease("32n", time, 0.2);
    }, [
        "K", "h", "H", "h", "S", "h", "K", "h",
        "K", "h", "H", "h", "S", "h", null, "h"
    ], "8n").start(0);

    const chords = [
        ["C4", "E4", "G4", "B4"], ["A3", "C4", "E4", "G4"], ["F3", "A3", "C4", "E4"],
        ["G3", "B3", "D4", "F4"], ["D4", "F4", "A4", "C5"], ["E3", "G3", "B3", "D4"]
    ];

    let currentChordIndex = 0;
    const musicLoop = new Tone.Loop((time) => {
        if (Tone.Transport.position.split(":")[1] === "0" && Math.random() > 0.5) {
            currentChordIndex = Math.floor(Math.random() * chords.length);
        }
        const chordNotes = chords[currentChordIndex];
        keys.triggerAttackRelease(chordNotes, "2n", time, 0.4);
        pad.triggerAttackRelease(chordNotes, "1n", time, 0.2);
        bass.triggerAttackRelease(chordNotes[0].replace(/[34]/, '2'), "2n", time, 0.6);
        if (Math.random() > 0.4) {
            const melodyNote = chordNotes[Math.floor(Math.random() * chordNotes.length)].replace(/[34]/, '5');
            lead.triggerAttackRelease(melodyNote, "2n", time + Tone.Time("4n").toSeconds(), 0.3);
        }
    }, "1n").start(0);

    Tone.Transport.bpm.value = 80;
    Tone.Transport.swing = 0.3;
}

// UI Handlers
startStopBtn.addEventListener('click', async () => {
    if (!initialized) {
        startStopBtn.innerText = "Building...";
        await initAudio();
        startStopBtn.innerText = "Start Music";
    }

    if (isPlaying) {
        mainVol.volume.rampTo(-Infinity, 0.1);
        setTimeout(() => {
            Tone.Transport.pause();
            startStopBtn.innerText = "Start Music";
            body.classList.remove('playing');
        }, 120);
    } else {
        Tone.Transport.start();
        const targetVol = parseFloat(volumeSlider.value);
        mainVol.volume.value = -Infinity;
        mainVol.volume.rampTo(targetVol, 0.2);
        startStopBtn.innerText = "Stop Music";
        body.classList.add('playing');
    }
    isPlaying = !isPlaying;
});

volumeSlider.addEventListener('input', (e) => {
    if (mainVol) {
        mainVol.volume.rampTo(parseFloat(e.target.value), 0.05);
    }
});
