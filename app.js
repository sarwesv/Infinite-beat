/**
 * Infinite Lo-Fi Audio Engine - Staggered Background Edition
 * Optimized for Mobile/iPad Performance
 */

let isPlaying = false;
let initialized = false;

// UI Elements
const startStopBtn = document.getElementById('start-stop');
const canvas = document.getElementById('visualizer-canvas');
const staggerBg = document.getElementById('stagger-bg');
const ctx = canvas.getContext('2d');
const body = document.body;

// Constants
const NICE_VOLUME = -18; // Locked at the user-calibrated "nice" volume
const APP_VERSION = "1.2.6";

/**
 * High-Resiliency Background Persistence
 * Specifically tuned for iPadOS multitasking and standby.
 */
let wakeLock = null;
let silentAnchor = null;

// Re-request lock and force-resume context if suspended
document.addEventListener('visibilitychange', () => {
    if (isPlaying) {
        if (document.visibilityState === 'visible') {
            requestWakeLock();
        }
        // Force context resume regardless of visibility to fight OS suspension
        if (Tone.context.state !== 'running') {
            Tone.context.resume().catch(e => {});
        }
    }
});

// Context Keeper: Pings the audio context every 2 seconds to keep the thread alive
setInterval(() => {
    if (isPlaying && Tone.context.state !== 'running') {
        Tone.context.resume().catch(e => {});
        if (silentAnchor && silentAnchor.paused) silentAnchor.play().catch(e => {});
    }
}, 2000);

async function requestWakeLock() {
    if ('wakeLock' in navigator && isPlaying) {
        try {
            if (wakeLock) await wakeLock.release();
            wakeLock = await navigator.wakeLock.request('screen');
        } catch (err) {}
    }
}

function initSilentAnchor() {
    if (!silentAnchor) {
        silentAnchor = document.createElement('audio');
        silentAnchor.loop = true;
        silentAnchor.playsInline = true; 
        silentAnchor.setAttribute('muted', 'false'); // Some iOS versions need this explicit string
        // 5-second high-quality silent WAV to better signal "Active Media" to iPadOS
        silentAnchor.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
        document.body.appendChild(silentAnchor);
    }
}

function setupMediaSession() {
    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: 'Infinite Lo-Fi Beats',
            artist: 'Generative Band',
            album: 'Background Persistence Active',
            artwork: [
                { src: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect width=%22100%22 height=%22100%22 fill=%22%23020617%22/><text y=%22.9em%22 font-size=%2290%22>🎧</text></svg>', sizes: '96x96', type: 'image/svg+xml' }
            ]
        });

        // Map lock-screen controls to our START button
        const toggle = () => startStopBtn.click();
        navigator.mediaSession.setActionHandler('play', toggle);
        navigator.mediaSession.setActionHandler('pause', toggle);
    }
}

/**
 * Auto-Update Feature
 * Polls version.json and reloads if a new version is detected.
 */
function initAutoUpdater() {
    setInterval(async () => {
        try {
            const response = await fetch(`version.json?t=${Date.now()}`);
            if (!response.ok) return;
            const data = await response.json();
            if (data.version && data.version !== APP_VERSION) {
                window.location.reload();
            }
        } catch (e) {}
    }, 60000);
}
initAutoUpdater();

// Audio Nodes
let limiter, compressor, mainVol, analyser, reverb, delay;
let kick, snare, hihat, shaker, bass, keys, pad, lead, rain, vinyl;

// Visualizer State
let barHeights = new Array(32).fill(12);
let globalScale = 1; 
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
        
        // Start at the calibrated nice volume
        mainVol = new Tone.Volume(NICE_VOLUME).connect(compressor);
        analyser = new Tone.Analyser("fft", 32);
        mainVol.connect(analyser);

        reverb = new Tone.JCReverb(0.5).connect(mainVol);
        delay = new Tone.FeedbackDelay("8n.", 0.2).connect(reverb);
        
        // Lo-fi Tape Wobble Effect
        const vibrato = new Tone.Vibrato({
            frequency: 4,
            depth: 0.15
        }).connect(delay);

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
        bass = new Tone.MonoSynth({ oscillator: { type: "triangle" }, envelope: { attack: 0.05, decay: 0.3, sustain: 0.4, release: 0.8 }, filterEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.1, baseFrequency: 120, octaves: 2 }}).connect(bassDist);
        bass.volume.value = -6;

        keys = new Tone.PolySynth(Tone.Synth, { maxPolyphony: 4, oscillator: { type: "sine" }, envelope: { attack: 0.2, decay: 0.4, sustain: 0.3, release: 1 }}).connect(vibrato);
        keys.volume.value = -18;


        pad = new Tone.PolySynth(Tone.Synth, { maxPolyphony: 4, oscillator: { type: "sine" }, envelope: { attack: 2, decay: 1, sustain: 0.5, release: 3 }}).connect(reverb);
        pad.volume.value = -28;

        lead = new Tone.Synth({ oscillator: { type: "sine" }, envelope: { attack: 0.5, decay: 0.2, sustain: 0.5, release: 2 }}).connect(delay);
        lead.volume.value = -32;

        setupLoop();
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
            canvas.width = w * dpr; 
            canvas.height = h * dpr;
        }
        
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);
        
        rotationAngle += 0.007;

        const fftData = (initialized && isPlaying) ? analyser.getValue() : null;
        
        const centerX = w / 2; 
        const centerY = h / 2; 
        
        let bricks = [];
        const radiusX = Math.min(w * 0.42, h * 0.8); 
        const radiusY = radiusX * 0.35; 

        for (let i = 0; i < 32; i++) {
            let target = 12;
            if (fftData) {
                const rawVal = (fftData[i] + 100); 
                target = Math.max(12, rawVal * (h / 350)); 
            }
            
            barHeights[i] += (target - barHeights[i]) * 0.12;

            const brickAngle = (i / 32) * Math.PI * 2 + rotationAngle;
            const x = centerX + Math.cos(brickAngle) * radiusX; 
            const y = centerY + Math.sin(brickAngle) * radiusY;

            let color = "#2563eb"; 
            if (i < 6) color = "#dc2626"; 
            if (i > 22) color = "#facc15";

            bricks.push({ x, y, h: barHeights[i] * globalScale, size: 16 * globalScale, color });
        }
        bricks.sort((a, b) => a.y - b.y);
        bricks.forEach(b => {
            if (b.size > 0.1) drawLegoBrick(b.x, b.y, b.size, b.h, b.color);
        });
    }
    render();
}

/**
 * Generative Music Loop
 */
function setupLoop() {
    // Advanced Drum Patterns (Ghost notes and variation)
    const drumSeq = new Tone.Sequence((time, hit) => {
        if (hit === "K") kick.triggerAttackRelease("C1", "8n", time);
        if (hit === "S") snare.triggerAttackRelease("16n", time);
        if (hit === "H") hihat.triggerAttackRelease("32n", time, 0.4);
        if (hit === "h") shaker.triggerAttackRelease("32n", time, 0.15);
        if (hit === "gs") snare.triggerAttackRelease("32n", time, 0.1); // Ghost snare
        
        if (hit === "K") {
            Tone.Draw.schedule(() => triggerStaggerRipple(), time);
        }
    }, [ 
        "K", "h", ["H", "gs"], "h", 
        "S", "h", "K", "gs", 
        "K", ["h", "gs"], "H", "h", 
        "S", "h", ["K", "gs"], "h" 
    ], "8n").start(0);

    // Lo-Fi Jazz Chord Progressions (7ths, 9ths, 11ths)
    const progressions = [
        ["Cmaj7", "Am7", "Dm7", "G7"],    // I-vi-ii-V
        ["Fmaj7", "G7", "Em7", "Am7"],   // IV-V-iii-vi
        ["Dm9", "G13", "Cmaj9", "A7b13"], // Jazz Turnaround
        ["Am9", "D13", "Gmaj7", "E7alt"]  // ii-V-I
    ];
    
    // Mapping chord names to notes
    const chordNotesMap = {
        "Cmaj7": ["C4", "E4", "G4", "B4"], "Am7": ["A3", "C4", "E4", "G4"], "Dm7": ["D4", "F4", "A4", "C5"], "G7": ["G3", "B3", "D4", "F4"],
        "Fmaj7": ["F3", "A3", "C4", "E4"], "Em7": ["E3", "G3", "B3", "D4"], 
        "Dm9": ["D4", "F4", "A4", "C5", "E5"], "G13": ["G3", "B3", "F4", "A4", "E5"], "Cmaj9": ["C4", "E4", "G4", "B4", "D5"], "A7b13": ["A3", "C#4", "G4", "F5"],
        "Am9": ["A3", "C4", "E4", "G4", "B4"], "D13": ["D4", "F#4", "C5", "E5", "B5"], "Gmaj7": ["G3", "B3", "D4", "F#4"], "E7alt": ["E3", "G#3", "D4", "G4", "C5"]
    };

    let currentProgression = progressions[Math.floor(Math.random() * progressions.length)];
    let chordIndex = 0;

    const musicLoop = new Tone.Loop((time) => {
        // Step to next chord in progression
        const chordName = currentProgression[chordIndex];
        const chordNotes = chordNotesMap[chordName];
        
        // Change progression occasionally
        if (chordIndex === 0 && Math.random() > 0.7) {
            currentProgression = progressions[Math.floor(Math.random() * progressions.length)];
        }
        chordIndex = (chordIndex + 1) % currentProgression.length;

        // Trigger lush keys and pads
        keys.triggerAttackRelease(chordNotes, "2n", time, 0.4);
        pad.triggerAttackRelease(chordNotes, "1n", time, 0.15);

        // Syncopated Bassline
        const root = chordNotes[0].replace(/[345]/, '2');
        const fifth = chordNotes[2].replace(/[345]/, '2');
        
        bass.triggerAttackRelease(root, "4n", time, 0.5);
        
        // Rhythmic Bass variations
        if (Math.random() > 0.4) {
            bass.triggerAttackRelease(root, "8n", time + Tone.Time("4n").toSeconds(), 0.3);
        }
        if (Math.random() > 0.6) {
            bass.triggerAttackRelease(fifth, "8n", time + Tone.Time("4n + 8n").toSeconds(), 0.2);
        }

        // Phrase-based Melody Generation
        if (Math.random() > 0.3) {
            const melodyNotes = chordNotes.map(n => n.replace(/[34]/, '5'));
            const motifLength = Math.floor(Math.random() * 3) + 1; // 1 to 3 notes
            
            for (let i = 0; i < motifLength; i++) {
                const note = melodyNotes[Math.floor(Math.random() * melodyNotes.length)];
                const offset = Tone.Time("4n").toSeconds() * i;
                lead.triggerAttackRelease(note, "4n", time + offset, 0.2);
            }
        }

    }, "1n").start(0);

    Tone.Transport.bpm.value = 82; 
    Tone.Transport.swing = 0.4;
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
            if ('mediaSession' in navigator) navigator.mediaSession.playbackState = "paused";
            if (wakeLock) { wakeLock.release().then(() => wakeLock = null); }
            if (silentAnchor) silentAnchor.pause();
            
            setTimeout(() => {
                Tone.Transport.pause();
                body.classList.remove('playing');
                startStopBtn.innerText = "START";
            }, 150);
        } else {
            // FADE IN
            await Tone.start(); // Ensure context is resumed
            Tone.Transport.start();
            
            // Background persistence
            initSilentAnchor();
            silentAnchor.play().catch(e => console.error("Silent anchor failed", e));
            
            setupMediaSession();
            requestWakeLock();
            if ('mediaSession' in navigator) navigator.mediaSession.playbackState = "playing";

            if (mainVol) {
                mainVol.volume.value = -Infinity;
                mainVol.volume.rampTo(NICE_VOLUME, 0.4);
            }
            
            // SIMPLE ENTRANCE ANIMATION
            const animObj = { s: 0 };
            globalScale = 0;
            anime({
                targets: animObj,
                s: 1,
                duration: 1200,
                easing: 'easeOutElastic(1, .8)',
                update: () => {
                    globalScale = animObj.s;
                }
            });
            
            body.classList.add('playing');
            startStopBtn.innerText = "STOP";
        }
        isPlaying = !isPlaying;
    } catch (err) {
        console.error("Click handler error:", err);
        startStopBtn.innerText = "Error: " + (err.message || "Failed to start");
    }
});

window.addEventListener('resize', () => {
    if (initialized) createStaggerGrid();
});

// Start visualizer immediately so it's visible on page load
startLegoVisualizer();
