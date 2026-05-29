/**
 * Infinite Lo-Fi Audio Engine - High Quality Version
 * Generative music using Tone.js
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

/**
 * Initialize Audio Engine
 */
async function initAudio() {
    try {
        await Tone.start();

        // --- MASTER CHAIN ---
        limiter = new Tone.Limiter(-1).toDestination();

        // Start main volume at -Infinity to avoid the initial pop
        mainVol = new Tone.Volume(-Infinity).connect(limiter);

        analyser = new Tone.Analyser("fft", 128);
        mainVol.connect(analyser);

        // Effects
        reverb = new Tone.Reverb({ decay: 6, wet: 0.3 }).connect(mainVol);
        delay = new Tone.FeedbackDelay("8n.", 0.3).connect(reverb);

        // --- AMBIENCE: RAIN & VINYL ---
        rain = new Tone.Noise("pink");
        rain.volume.value = -35; // Set volume BEFORE starting

        const rainFilter = new Tone.AutoFilter({
            frequency: "4n",
            baseFrequency: 400,
            octaves: 2
        }).connect(mainVol).start();

        rain.connect(rainFilter);
        rain.start();

        vinyl = new Tone.Noise("brown");
        vinyl.volume.value = -40; // Set volume BEFORE starting
        vinyl.connect(mainVol);
        vinyl.start();

        // --- DRUMS: BOOM BAP ---
        kick = new Tone.MembraneSynth({
            pitchDecay: 0.05,
            octaves: 2,
            oscillator: { type: "sine" },
            envelope: { attack: 0.005, decay: 0.4, sustain: 0.01 }
        }).connect(mainVol);
        kick.volume.value = -2;

        snare = new Tone.NoiseSynth({
            noise: { type: "white" },
            envelope: { attack: 0.005, decay: 0.1, sustain: 0 }
        }).connect(mainVol);
        snare.volume.value = -10;

        hihat = new Tone.MetalSynth({
            frequency: 200,
            envelope: { attack: 0.005, decay: 0.1, release: 0.05 },
            harmonicity: 5.1,
            modulationIndex: 32,
            resonance: 4000,
            octaves: 1.5
        }).connect(mainVol);
        hihat.volume.value = -25;

        shaker = new Tone.NoiseSynth({
            noise: { type: "white" },
            envelope: { attack: 0.01, decay: 0.05, sustain: 0 }
        }).connect(mainVol);
        shaker.volume.value = -30;

        // --- INSTRUMENTS: CHILL VIBES ---
        const bassDist = new Tone.Distortion(0.1).connect(mainVol);
        bass = new Tone.MonoSynth({
            oscillator: { type: "triangle" },
            envelope: { attack: 0.01, decay: 0.3, sustain: 0.4, release: 0.8 },
            filterEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.1, baseFrequency: 150, octaves: 2.5 }
        }).connect(bassDist);
        bass.volume.value = +4; // Significant volume boost

        keys = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: "sine" },
            envelope: { attack: 0.2, decay: 0.4, sustain: 0.4, release: 1.5 }
        }).connect(delay);
        keys.volume.value = -15;

        pad = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: "sine" },
            envelope: { attack: 2, decay: 1, sustain: 0.8, release: 4 }
        }).connect(reverb);
        pad.volume.value = -25;

        lead = new Tone.Synth({
            oscillator: { type: "sine" },
            envelope: { attack: 0.5, decay: 0.2, sustain: 0.5, release: 2 }
        }).connect(delay);
        lead.volume.value = -20;

        setupLoop();
        startVisualizer();
        initialized = true;
    } catch (e) {
        console.error("Initialization failed", e);
    }
}

/**
 * Generative Music Loop
 */
function setupLoop() {
    // 1. Drum Sequence (Boom Bap with Swing)
    const drumSeq = new Tone.Sequence((time, hit) => {
        if (hit === "K") kick.triggerAttackRelease("C1", "8n", time);
        if (hit === "S") snare.triggerAttackRelease("16n", time);
        if (hit === "H") hihat.triggerAttackRelease("32n", time, 0.5);
        if (hit === "h") shaker.triggerAttackRelease("32n", time, 0.2);
    }, [
        "K", "h", "H", "h", "S", "h", "K", "h",
        "K", "h", "H", "h", "S", "h", null, "h"
    ], "8n").start(0);

    // 2. Chords & Melody
    const chords = [
        ["C4", "E4", "G4", "B4"],  // Cmaj7
        ["A3", "C4", "E4", "G4"],  // Am7
        ["F3", "A3", "C4", "E4"],  // Fmaj7
        ["G3", "B3", "D4", "F4"],  // G7
        ["D4", "F4", "A4", "C5"],  // Dm7
        ["E3", "G3", "B3", "D4"]   // Em7
    ];

    let currentChordIndex = 0;

    const musicLoop = new Tone.Loop((time) => {
        // Change chord every 2 bars
        if (Tone.Transport.position.split(":")[1] === "0" && Math.random() > 0.5) {
            currentChordIndex = Math.floor(Math.random() * chords.length);
        }

        const chordNotes = chords[currentChordIndex];

        // Play Chords & Pad
        keys.triggerAttackRelease(chordNotes, "2n", time, 0.4);
        pad.triggerAttackRelease(chordNotes, "1n", time, 0.2);

        // --- SOFT RHYTHMIC BASS ---
        const root = chordNotes[0].replace(/[34]/, '2');
        const fifth = chordNotes[2].replace(/[34]/, '2');

        // Root on beat 1
        bass.triggerAttackRelease(root, "2n", time, 0.5);

        // Subtle rhythmic hits
        if (Math.random() > 0.4) {
            // Beat 3 or "and" of 2
            const bassOffset = Math.random() > 0.5 ? "2n" : "2n + 8n";
            const bassNote = Math.random() > 0.7 ? fifth : root;
            bass.triggerAttackRelease(bassNote, "8n", time + Tone.Time(bassOffset).toSeconds(), 0.3);
        }

        // Generative Lead Melody
        if (Math.random() > 0.4) {
            const melodyNote = chordNotes[Math.floor(Math.random() * chordNotes.length)].replace(/[34]/, '5');
            lead.triggerAttackRelease(melodyNote, "2n", time + Tone.Time("4n").toSeconds(), 0.3);
        }
    }, "1n").start(0);

    Tone.Transport.bpm.value = 80;
    Tone.Transport.swing = 0.3;
}

/**
 * Visualizer Loop
 */
function startVisualizer() {
    function draw() {
        requestAnimationFrame(draw);
        const width = canvas.width = canvas.offsetWidth;
        const height = canvas.height = canvas.offsetHeight;
        ctx.clearRect(0, 0, width, height);

        if (!isPlaying) return;

        const data = analyser.getValue();
        const barWidth = (width / data.length) * 2;
        let x = 0;

        for (let i = 0; i < data.length; i++) {
            const h = (data[i] + 100) * (height / 120);
            ctx.fillStyle = `hsla(${210 + i}, 70%, 60%, 0.8)`;
            ctx.fillRect(x, height - h, barWidth - 1, h);
            x += barWidth;
        }
    }
    draw();
}

// UI Handlers
startStopBtn.addEventListener('click', async () => {
    if (!initialized) {
        startStopBtn.innerText = "Loading...";
        await initAudio();
        startStopBtn.innerText = "Start Music";
    }

    if (isPlaying) {
        // Ramp down volume to avoid the pop when pausing
        mainVol.volume.rampTo(-Infinity, 0.1);
        setTimeout(() => {
            Tone.Transport.pause();
            startStopBtn.innerText = "Start Music";
            body.classList.remove('playing');
        }, 120);
    } else {
        // Ensure transport starts
        Tone.Transport.start();
        // Ramp up volume for a smooth start
        const targetVol = parseFloat(volumeSlider.value);
        mainVol.volume.value = -Infinity;
        mainVol.volume.rampTo(targetVol, 0.2);
        startStopBtn.innerText = "Stop Music";
        body.classList.add('playing');
    }
    isPlaying = !isPlaying;
});

volumeSlider.addEventListener('input', (e) => {
    if (mainVol && isPlaying) {
        const val = parseFloat(e.target.value);
        mainVol.volume.rampTo(val, 0.1);
    }
});

