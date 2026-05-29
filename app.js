/**
 * Infinite Lo-Fi Audio Engine - Multi-Viz Edition (Realistic Lava)
 * Uses Tone.js for music and Anime.js logic for smooth visuals
 */

let isPlaying = false;
let initialized = false;

// UI Elements
const startStopBtn = document.getElementById('start-stop');
const volumeSlider = document.getElementById('volume');
const canvas = document.getElementById('visualizer-canvas');
const lavaLamp = document.getElementById('lava-lamp');
const blobContainer = document.getElementById('blob-container');
const btnLego = document.getElementById('show-lego');
const btnLava = document.getElementById('show-lava');
const ctx = canvas.getContext('2d');
const body = document.body;

// Audio Nodes
let limiter, mainVol, analyser, reverb, delay;
let kick, snare, hihat, shaker, bass, keys, pad, lead, rain, vinyl;

// Visualizer State
let barHeights = new Array(32).fill(0);
let rotationAngle = 0;
let currentViz = 'lego';
let blobs = [];

/**
 * Initialize Audio Engine
 */
async function initAudio() {
    try {
        await Tone.start();
        
        limiter = new Tone.Limiter(-1).toDestination();
        mainVol = new Tone.Volume(-Infinity).connect(limiter);
        
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
        initLavaLamp();
        initialized = true;
    } catch (e) {
        console.error("Initialization failed", e);
    }
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
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        ctx.lineTo(pts[1].x, pts[1].y);
        ctx.lineTo(pts[2].x, pts[2].y);
        ctx.lineTo(pts[3].x, pts[3].y);
        ctx.closePath();
        ctx.fill();
    };

    drawFace([pCenter, pLeft, { x: pLeft.x, y: pLeft.y - height }, { x: pCenter.x, y: pCenter.y - height }], leftColor);
    drawFace([pCenter, pRight, { x: pRight.x, y: pRight.y - height }, { x: pCenter.x, y: pCenter.y - height }], rightColor);
    drawFace([{ x: pCenter.x, y: pCenter.y - height }, { x: pRight.x, y: pRight.y - height }, { x: pTop.x, y: pTop.y - height }, { x: pLeft.x, y: pLeft.y - height }], topColor);

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
 * LEGO Visualizer Main Loop
 */
function startLegoVisualizer() {
    function render() {
        requestAnimationFrame(render);
        const w = canvas.width = window.innerWidth;
        const h = canvas.height = window.innerHeight;
        ctx.clearRect(0, 0, w, h);

        if (!isPlaying || currentViz !== 'lego') return;

        rotationAngle += 0.008;
        const fftData = analyser.getValue();
        const centerX = w / 2;
        const centerY = h / 2 + 100;

        let bricks = [];
        for (let i = 0; i < fftData.length; i++) {
            const rawVal = (fftData[i] + 100);
            const target = Math.max(10, rawVal * (h / 250));
            barHeights[i] += (target - barHeights[i]) * 0.15;

            const radius = Math.min(w, h) * 0.4;
            const brickAngle = (i / fftData.length) * Math.PI * 2 + rotationAngle;
            const x = centerX + Math.cos(brickAngle) * radius;
            const y = centerY + Math.sin(brickAngle) * (radius * 0.45);
            let color = "#2563eb";
            if (i < 5) color = "#dc2626";
            if (i > 20) color = "#eab308";
            bricks.push({ x, y, h: barHeights[i], color });
        }
        bricks.sort((a, b) => a.y - b.y);
        bricks.forEach(b => drawLegoBrick(b.x, b.y, 18, b.h, b.color));
    }
    render();
}

/**
 * Lava Lamp - Realistic Multi-Blob System
 */
function initLavaLamp() {
    const blobCount = 8;
    for (let i = 0; i < blobCount; i++) {
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        const radius = 25 + Math.random() * 45;
        circle.setAttribute("r", radius);
        circle.setAttribute("cx", 50 + Math.random() * 100);
        circle.setAttribute("cy", 450);
        const colors = ["#ff0080", "#ff00ff", "#d400ff", "#ff4d94"];
        circle.setAttribute("fill", colors[Math.floor(Math.random() * colors.length)]);
        circle.setAttribute("opacity", "0.9");
        blobContainer.appendChild(circle);
        blobs.push({ el: circle, r: radius, x: 50 + Math.random() * 100, y: 100 + Math.random() * 400, speed: 0.4 + Math.random() * 1.2, offset: Math.random() * Math.PI * 2 });
    }

    function animateBlobs() {
        requestAnimationFrame(animateBlobs);
        if (currentViz !== 'lava' || !isPlaying) return;

        const fftData = analyser.getValue();
        const bassLevel = (fftData[0] + fftData[1] + fftData[2]) / 3;
        const intensity = (bassLevel + 100) / 100;

        const baseScale = Math.min(window.innerWidth, window.innerHeight) / 350;
        lavaLamp.style.transform = `scale(${baseScale})`;

        blobs.forEach((blob) => {
            blob.y -= blob.speed * (0.5 + intensity * 1.5);
            const drift = Math.sin(Date.now() / 1500 + blob.offset) * 15;
            if (blob.y < -100) { blob.y = 480; blob.x = 40 + Math.random() * 120; }
            blob.el.setAttribute("cx", blob.x + drift);
            blob.el.setAttribute("cy", blob.y);
            const dynamicRadius = blob.r * (1 + intensity * 0.25);
            blob.el.setAttribute("r", dynamicRadius);
        });

        const glow = 30 + intensity * 70;
        lavaLamp.style.filter = `drop-shadow(0 0 ${glow}px rgba(255, 0, 128, 0.5))`;
    }
    animateBlobs();
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
    }, [ "K", "h", "H", "h", "S", "h", "K", "h", "K", "h", "H", "h", "S", "h", null, "h" ], "8n").start(0);

    const chords = [ ["C4", "E4", "G4", "B4"], ["A3", "C4", "E4", "G4"], ["F3", "A3", "C4", "E4"], ["G3", "B3", "D4", "F4"], ["D4", "F4", "A4", "C5"], ["E3", "G3", "B3", "D4"] ];
    let currentChordIndex = 0;
    const musicLoop = new Tone.Loop((time) => {
        if (Tone.Transport.position.split(":")[1] === "0" && Math.random() > 0.5) { currentChordIndex = Math.floor(Math.random() * chords.length); }
        const chordNotes = chords[currentChordIndex];
        keys.triggerAttackRelease(chordNotes, "2n", time, 0.4);
        pad.triggerAttackRelease(chordNotes, "1n", time, 0.2);
        
        // --- SOFT RHYTHMIC BASS ---
        const root = chordNotes[0].replace(/[34]/, '2');
        const fifth = chordNotes[2].replace(/[34]/, '2');
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
    Tone.Transport.bpm.value = 80;
    Tone.Transport.swing = 0.3;
}

// UI Handlers
btnLego.addEventListener('click', () => {
    currentViz = 'lego';
    canvas.style.display = 'block';
    lavaLamp.style.display = 'none';
    btnLego.classList.add('active');
    btnLava.classList.remove('active');
});

btnLava.addEventListener('click', () => {
    currentViz = 'lava';
    canvas.style.display = 'none';
    lavaLamp.style.display = 'block';
    btnLava.classList.add('active');
    btnLego.classList.remove('active');
});

startStopBtn.addEventListener('click', async () => {
    if (!initialized) {
        startStopBtn.innerText = "Building...";
        await initAudio();
    }
    if (isPlaying) {
        mainVol.volume.rampTo(-Infinity, 0.1);
        setTimeout(() => { Tone.Transport.pause(); body.classList.remove('playing'); }, 120);
        startStopBtn.innerText = "Start Music";
    } else {
        Tone.Transport.start();
        const targetVol = parseFloat(volumeSlider.value);
        mainVol.volume.value = -Infinity;
        mainVol.volume.rampTo(targetVol, 0.2);
        body.classList.add('playing');
        startStopBtn.innerText = "Stop Music";
    }
    isPlaying = !isPlaying;
});

volumeSlider.addEventListener('input', (e) => {
    if (mainVol) mainVol.volume.rampTo(parseFloat(e.target.value), 0.05);
});
