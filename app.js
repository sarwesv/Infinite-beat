/**
 * Infinite Lo-Fi Audio Engine - LEGO 3D Visualizer Edition
 * Uses Tone.js for music and Anime.js logic for smooth visuals
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
let rotationAngle = 0;

/**
 * Initialize Audio Engine
 */
async function initAudio() {
    try {
        await Tone.start();
        
        limiter = new Tone.Limiter(-1).toDestination();
        mainVol = new Tone.Volume(-Infinity).connect(limiter);
        
        // FFT size for 32 bars
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

        // --- DRUMS ---
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
 * 3D Isometric LEGO Cube Renderer (Fixed View)
 */
function drawLegoBrick(centerX, centerY, size, height, color) {
    const topColor = color;
    const rightColor = shadeColor(color, -25);
    const leftColor = shadeColor(color, -45);

    // Standard 30-degree Isometric Projection
    const isoW = size * 0.9;
    const isoH = size * 0.45;

    // Faces Corners
    const pCenter = { x: centerX, y: centerY };
    const pRight = { x: centerX + isoW, y: centerY - isoH };
    const pTop = { x: centerX, y: centerY - isoH * 2 };
    const pLeft = { x: centerX - isoW, y: centerY - isoH };

    const drawFace = (pts, col) => {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        ctx.lineTo(pts[1].x, pts[1].y);
        ctx.lineTo(pts[2].x, pts[2].y);
        ctx.lineTo(pts[3].x, pts[3].y);
        ctx.closePath();
        ctx.fill();
    };

    // Draw order for standard view: Left, Right, then Top
    // 1. Left Face
    drawFace([
        pCenter,
        pLeft,
        { x: pLeft.x, y: pLeft.y - height },
        { x: pCenter.x, y: pCenter.y - height }
    ], leftColor);

    // 2. Right Face
    drawFace([
        pCenter,
        pRight,
        { x: pRight.x, y: pRight.y - height },
        { x: pCenter.x, y: pCenter.y - height }
    ], rightColor);

    // 3. Top Face
    drawFace([
        { x: pCenter.x, y: pCenter.y - height },
        { x: pRight.x, y: pRight.y - height },
        { x: pTop.x, y: pTop.y - height },
        { x: pLeft.x, y: pLeft.y - height }
    ], topColor);

    // Sharper Highlight
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(pLeft.x, pLeft.y - height);
    ctx.lineTo(pCenter.x, pCenter.y - height);
    ctx.lineTo(pRight.x, pRight.y - height);
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
 * LEGO Visualizer Main Loop with Depth Sorting
 */
function startLegoVisualizer() {
    function render() {
        requestAnimationFrame(render);
        const w = canvas.width = canvas.offsetWidth;
        const h = canvas.height = canvas.offsetHeight;
        ctx.clearRect(0, 0, w, h);

        if (!isPlaying) return;

        rotationAngle += 0.008;
        const fftData = analyser.getValue();
        const centerX = w / 2;
        const centerY = h * 0.75; // Moved baseplate LOWER to prevent tall bricks clipping

        // Create an array of brick objects so we can sort them
        let bricks = [];
        for (let i = 0; i < fftData.length; i++) {
            const rawVal = (fftData[i] + 100);
            const target = Math.max(10, rawVal * (h / 200)); // Scaled down height multiplier
            barHeights[i] += (target - barHeights[i]) * 0.15;

            const radius = Math.min(w, h) * 0.35;
            const brickAngle = (i / fftData.length) * Math.PI * 2 + rotationAngle;
            
            const x = centerX + Math.cos(brickAngle) * radius;
            const y = centerY + Math.sin(brickAngle) * (radius * 0.45);
            
            let color = "#2563eb"; // Blue
            if (i < 5) color = "#dc2626"; // Red (Bass)
            if (i > 20) color = "#eab308"; // Yellow (Highs)
            
            bricks.push({ x, y, h: barHeights[i], color });
        }

        // --- PAINTER'S ALGORITHM (Depth Sorting) ---
        // Sort by 'y' coordinate so the bricks furthest away are drawn FIRST
        bricks.sort((a, b) => a.y - b.y);

        bricks.forEach(b => {
            drawLegoBrick(b.x, b.y, 14, b.h, b.color);
        });
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

    anime({
        targets: startStopBtn,
        rotateX: '+=360',
        translateY: [
            { value: -100, duration: 400, easing: 'easeOutCubic' },
            { value: 0, duration: 500, easing: 'easeInCubic' }
        ],
        scaleX: [
            { value: 1, duration: 700 },
            { value: 1.2, duration: 100, easing: 'easeOutQuad' },
            { value: 1, duration: 200, easing: 'easeInOutQuad' }
        ],
        scaleY: [
            { value: 1, duration: 700 },
            { value: 0.8, duration: 100, easing: 'easeOutQuad' },
            { value: 1, duration: 200, easing: 'easeInOutQuad' }
        ],
        update: (anim) => {
            if (anim.currentTime > 450 && anim.currentTime < 500) {
                startStopBtn.innerText = isPlaying ? "Start Music" : "Stop Music";
            }
        },
        duration: 1000
    });

    if (isPlaying) {
        mainVol.volume.rampTo(-Infinity, 0.1);
        setTimeout(() => {
            Tone.Transport.pause();
            body.classList.remove('playing');
        }, 120);
    } else {
        Tone.Transport.start();
        const targetVol = parseFloat(volumeSlider.value);
        mainVol.volume.value = -Infinity;
        mainVol.volume.rampTo(targetVol, 0.2);
        body.classList.add('playing');
    }
    isPlaying = !isPlaying;
});

volumeSlider.addEventListener('input', (e) => {
    if (mainVol) {
        mainVol.volume.rampTo(parseFloat(e.target.value), 0.05);
    }
});
