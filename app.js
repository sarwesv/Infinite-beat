/**
 * Infinite Lo-Fi Audio Engine
 * Uses Tone.js for generative music synthesis
 */

let isPlaying = false;
let initialized = false;

// UI Elements
const startStopBtn = document.getElementById('start-stop');
const volumeSlider = document.getElementById('volume');
const statusText = document.getElementById('status');
const visualizer = document.getElementById('visualizer');
const body = document.body;

// Instruments & Effects
let limiter, vol, filter, reverb, vinylNoise;
let kick, snare, hihat, keys, bass;

/**
 * Initialize the audio engine
 */
async function initAudio() {
    await Tone.start();
    
    // Master Chain
    limiter = new Tone.Limiter(-1).toDestination();
    vol = new Tone.Volume(-12).connect(limiter);
    reverb = new Tone.Reverb({ decay: 4, wet: 0.3 }).connect(vol);
    filter = new Tone.Filter(1500, "lowpass").connect(reverb);

    // Vinyl Noise (Ambient)
    vinylNoise = new Tone.Noise("brown").start();
    const noiseFilter = new Tone.AutoFilter({
        frequency: "4n",
        baseFrequency: 200,
        octaves: 2
    }).connect(vol).start();
    vinylNoise.connect(noiseFilter);
    vinylNoise.volume.value = -35;

    // Drums
    kick = new Tone.MembraneSynth({
        pitchDecay: 0.05,
        octaves: 4,
        oscillator: { type: "sine" }
    }).connect(filter);
    
    snare = new Tone.NoiseSynth({
        noise: { type: "white" },
        envelope: { attack: 0.001, decay: 0.2, sustain: 0 }
    }).connect(filter);

    hihat = new Tone.MetalSynth({
        frequency: 200,
        envelope: { attack: 0.001, decay: 0.1, release: 0.01 },
        harmonicity: 5.1,
        modulationIndex: 32,
        resonance: 4000,
        octaves: 1.5
    }).connect(filter);

    // Bass
    bass = new Tone.MonoSynth({
        oscillator: { type: "triangle" },
        envelope: { attack: 0.1, decay: 0.3, sustain: 0.8, release: 1 },
        filterEnvelope: { attack: 0.001, decay: 0.7, sustain: 0.1, baseFrequency: 200, octaves: 2 }
    }).connect(filter);
    bass.volume.value = -6;

    // Keys (Wobbly Electric Piano)
    keys = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "sine" },
        envelope: { attack: 0.2, decay: 0.1, sustain: 1, release: 2 }
    }).connect(filter);
    
    const vibrato = new Tone.Vibrato(5, 0.1).connect(filter);
    keys.connect(vibrato);
    keys.volume.value = -8;

    setupSequences();
    initialized = true;
}

/**
 * Define the music patterns
 */
function setupSequences() {
    // 1. Drum Loop (Boom Bap 4/4)
    const drumLoop = new Tone.Sequence((time, hit) => {
        if (hit === 'K') kick.triggerAttackRelease("C1", "8n", time);
        if (hit === 'S') snare.triggerAttackRelease("16n", time);
        if (hit === 'H') hihat.triggerAttackRelease("32n", time, 0.3);
    }, [
        "K", "H", ["H", "H"], "H", 
        "S", "H", "K", "H",
        "K", ["H", "H"], "H", "H",
        "S", "H", "H", "H"
    ], "4n").start(0);

    // 2. Chords & Progression Logic
    const progressions = [
        ["Cmaj7", "Am7", "Dm7", "G7"],
        ["Fmaj7", "G7", "Em7", "Am7"],
        ["Dm7", "G7", "Cmaj7", "Cmaj7"],
        ["Bbmaj7", "Am7", "Gm7", "C7"]
    ];

    let currentProg = progressions[0];
    
    // Chord trigger every bar
    const chordLoop = new Tone.Loop((time) => {
        const bar = Math.floor(Tone.Transport.seconds / (60/Tone.Transport.bpm.value * 4)) % 4;
        const chord = currentProg[bar];
        
        // Change progression every 8 bars
        if (bar === 0 && Math.random() > 0.7) {
            currentProg = progressions[Math.floor(Math.random() * progressions.length)];
        }

        // Map chord names to frequencies
        const notes = getNotesForChord(chord);
        keys.triggerAttackRelease(notes, "2n", time, 0.4);
        
        // Bass follow root note
        bass.triggerAttackRelease(notes[0].replace('4', '2'), "2n", time, 0.6);
        
        statusText.innerText = `Chilling in ${chord}`;
    }, "1n").start(0);

    Tone.Transport.bpm.value = 80;
    Tone.Transport.swing = 0.2;
}

/**
 * Simple chord helper
 */
function getNotesForChord(chord) {
    const map = {
        "Cmaj7": ["C4", "E4", "G4", "B4"],
        "Am7": ["A3", "C4", "E4", "G4"],
        "Dm7": ["D4", "F4", "A4", "C5"],
        "G7": ["G3", "B3", "D4", "F4"],
        "Fmaj7": ["F3", "A3", "C4", "E4"],
        "Em7": ["E3", "G3", "B3", "D4"],
        "Bbmaj7": ["Bb3", "D4", "F4", "A4"],
        "Gm7": ["G3", "Bb3", "D4", "F4"],
        "C7": ["C4", "E4", "G4", "Bb4"]
    };
    return map[chord] || map["Cmaj7"];
}

// UI Listeners
startStopBtn.addEventListener('click', async () => {
    if (!initialized) {
        statusText.innerText = "Initializing instruments...";
        await initAudio();
    }

    if (isPlaying) {
        Tone.Transport.stop();
        startStopBtn.innerText = "Start Music";
        statusText.innerText = "Paused";
        body.classList.remove('playing');
    } else {
        Tone.Transport.start();
        startStopBtn.innerText = "Stop Music";
        body.classList.add('playing');
    }
    isPlaying = !isPlaying;
});

volumeSlider.addEventListener('input', (e) => {
    if (vol) vol.volume.value = e.target.value;
});
