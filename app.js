/**
 * Infinite Lo-Fi Audio Engine - Multi-Viz Edition (Realistic Lava)
 * Optimized for Mobile/iPad Performance
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
let limiter, compressor, mainVol, analyser, reverb, delay;
let kick, snare, hihat, shaker, bass, keys, pad, lead, rain, vinyl;

// Visualizer State
let barHeights = new Array(32).fill(0);
let rotationAngle = 0;
let currentViz = 'lego';
let blobs = [];

// Lava Lamp Blob Shapes (SVG Path Data)
const blobShapes = [
    "M100,20 C140,20 180,60 180,100 C180,140 140,180 100,180 C60,180 20,140 20,100 C20,60 60,20 100,20",
    "M100,20 C160,20 190,70 190,110 C190,150 150,190 100,190 C50,190 10,150 10,110 C10,70 40,20 100,20",
    "M100,30 C130,30 170,50 170,90 C170,130 140,170 100,170 C60,170 30,130 30,90 C30,50 70,30 100,30",
    "M100,20 C150,20 180,50 180,100 C180,150 150,180 100,180 C50,180 20,150 20,100 C20,50 50,20 100,20"
];

/**
 * Initialize Audio Engine
 */
async function initAudio() {
    try {
        await Tone.start();
        
        // --- MASTER CHAIN (Optimized for small speakers) ---
        limiter = new Tone.Limiter(-1).toDestination();
        compressor = new Tone.Compressor({
            threshold: -18,
            ratio: 3,
            attack: 0.01,
            release: 0.1
        }).connect(limiter);
        
        mainVol = new Tone.Volume(-Infinity).connect(compressor);
        
        analyser = new Tone.Analyser("fft", 32);
        mainVol.connect(analyser);

        // Lighter Reverb for Mobile CPU (JCReverb is more efficient than Reverb/Freeverb)
        reverb = new Tone.JCReverb(0.5).connect(mainVol);
        delay = new Tone.FeedbackDelay("8n.", 0.2).connect(reverb);

        // --- AMBIENCE ---
        rain = new Tone.Noise("pink");
        rain.volume.value = -38;
        const rainFilter = new Tone.AutoFilter({ frequency: "8n", baseFrequency: 300, octaves: 1.5 }).connect(mainVol).start();
        rain.connect(rainFilter);
        rain.start();

        vinyl = new Tone.Noise("brown");
        vinyl.volume.value = -45;
        vinyl.connect(mainVol);
        vinyl.start();

        // --- DRUMS ---
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

        // Keys & Pads: Restricted polyphony for mobile performance
        keys = new Tone.PolySynth(Tone.Synth, { 
            maxPolyphony: 4,
            oscillator: { type: "sine" }, 
            envelope: { attack: 0.2, decay: 0.4, sustain: 0.3, release: 1 }
        }).connect(delay);
        keys.volume.value = -18;

        pad = new Tone.PolySynth(Tone.Synth, { 
            maxPolyphony: 4,
            oscillator: { type: "sine" }, 
            envelope: { attack: 2, decay: 1, sustain: 0.5, release: 3 }
        }).connect(reverb);
        pad.volume.value = -28;

        lead = new Tone.Synth({ oscillator: { type: "sine" }, envelope: { attack: 0.5, decay: 0.2, sustain: 0.5, release: 2 }}).connect(delay);
        lead.volume.value = -22;

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
 * LEGO Visualizer Main Loop with STRICT CENTERING
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
        const centerY = h / 2;

        let bricks = [];
        for (let i = 0; i < fftData.length; i++) {
            const rawVal = (fftData[i] + 100);
            const target = Math.max(10, rawVal * (h / 300));
            barHeights[i] += (target - barHeights[i]) * 0.15;

            const radius = Math.max(380, Math.min(w, h) * 0.5);
            const brickAngle = (i / fftData.length) * Math.PI * 2 + rotationAngle;
            
            const x = centerX + Math.cos(brickAngle) * radius;
            const y = centerY + Math.sin(brickAngle) * (radius * 0.45);
            
            let color = "#2563eb";
            if (i < 5) color = "#dc2626";
            if (i > 20) color = "#eab308";
            bricks.push({ x, y, h: barHeights[i], color });
        }
        bricks.sort((a, b) => a.y - b.y);
        bricks.forEach(b => drawLegoBrick(b.x, b.y, 14, b.h, b.color));
    }
    render();
}

/**
 * Lava Lamp - Realistic Multi-Blob System with STRICT CENTERING
 */
function initLavaLamp() {
    const blobCount = 8;
    for (let i = 0; i < blobCount; i++) {
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        const radius = 25 + Math.random() * 45;
        circle.setAttribute("r", radius);
        circle.setAttribute("cx", 100);
        circle.setAttribute("cy", 450);
        
        // Flat shades of blue
        const blues = ["#1d4ed8", "#0284c7", "#2563eb", "#3b82f6"];
        circle.setAttribute("fill", blues[Math.floor(Math.random() * blues.length)]);
        circle.setAttribute("opacity", "1.0"); 
        blobContainer.appendChild(circle);
        
        const blobData = {
            el: circle,
            r: radius,
            x: 40 + Math.random() * 120,
            y: 450,
            speed: 0.1 + Math.random() * 0.2, 
            offset: Math.random() * Math.PI * 2
        };
        blobs.push(blobData);

        const animateSingleBlob = () => {
            const duration = 25000 + Math.random() * 20000;
            anime({
                targets: blobData,
                y: [-150, 550],
                direction: 'reverse',
                loop: true,
                duration: duration,
                easing: 'easeInOutSine',
                update: () => {
                    if (currentViz !== 'lava') return;
                    const drift = Math.sin(Date.now() / 2500 + blobData.offset) * 20;
                    blobData.el.setAttribute("cy", blobData.y);
                    blobData.el.setAttribute("cx", blobData.x + drift);
                    const stretch = 1 + Math.abs(Math.sin(Date.now() / 4000 + blobData.offset)) * 0.4;
                    blobData.el.style.transform = `scale(${1/stretch}, ${stretch})`;
                    blobData.el.style.transformOrigin = `${blobData.x + drift}px ${blobData.y}px`;
                }
            });
        };
        animateSingleBlob();
    }

    function pulse() {
        requestAnimationFrame(pulse);
        if (currentViz !== 'lava' || !isPlaying) return;

        const fftData = analyser.getValue();
        const bassLevel = (fftData[0] + fftData[1] + fftData[2]) / 3;
        const intensity = (bassLevel + 100) / 100;

        const baseScale = Math.min(window.innerWidth, window.innerHeight) / 500;
        lavaLamp.style.transform = `translate(-50%, -50%) scale(${baseScale})`;

        const glow = 15 + intensity * 40;
        blobContainer.style.filter = `drop-shadow(0 0 ${glow}px rgba(37, 99, 235, 0.6))`;
    }
    pulse();
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
