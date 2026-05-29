/**
 * Infinite Lo-Fi Audio Engine - Enhanced Version
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
let limiter, vol, reverb, vinylNoise;
let kick, snare, hihat, keys, bass, lead;
let drumBus, keysBus, leadBus, bassBus;

/**
 * Initialize the audio engine
 */
async function initAudio() {
    await Tone.start();
    
    // Master Chain
    limiter = new Tone.Limiter(-1).toDestination();
    vol = new Tone.Volume(-12).connect(limiter);
    reverb = new Tone.Reverb({ decay: 5, wet: 0.2 }).connect(vol);

    // Busses
    drumBus = new Tone.Filter(3000, "lowpass").connect(vol);
    keysBus = new Tone.Filter(2000, "lowpass").connect(reverb);
    leadBus = new Tone.Filter(2500, "lowpass").connect(reverb);
    bassBus = new Tone.Filter(400, "lowpass").connect(vol);

    // Ambient Noise
    vinylNoise = new Tone.Noise("brown").start();
    const noiseFilter = new Tone.AutoFilter({
        frequency: "8n",
        baseFrequency: 300,
        octaves: 2
    }).connect(vol).start();
    vinylNoise.connect(noiseFilter);
    vinylNoise.volume.value = -35;

    // --- INSTRUMENTS ---

    // Kick: Deep & Soft
    kick = new Tone.MembraneSynth({
        pitchDecay: 0.02,
        octaves: 6,
        oscillator: { type: "sine" },
        envelope: { attack: 0.001, decay: 0.4, sustain: 0.01 }
    }).connect(drumBus);
    kick.volume.value = -2;
    
    // Snare: White noise with a bit of body
    snare = new Tone.NoiseSynth({
        noise: { type: "white" },
        envelope: { attack: 0.001, decay: 0.2, sustain: 0 }
    }).connect(drumBus);
    snare.volume.value = -8;

    // Hi-Hat: Crisp and swinging
    hihat = new Tone.MetalSynth({
        frequency: 200,
        envelope: { attack: 0.001, decay: 0.1, release: 0.01 },
        harmonicity: 5.1,
        modulationIndex: 32,
        resonance: 4000,
        octaves: 1.5
    }).connect(drumBus);
    hihat.volume.value = -15;

    // Bass: Warm triangle sub
    bass = new Tone.MonoSynth({
        oscillator: { type: "triangle" },
        envelope: { attack: 0.05, decay: 0.3, sustain: 0.8, release: 1 },
        filterEnvelope: { attack: 0.001, decay: 0.7, sustain: 0.1, baseFrequency: 100, octaves: 2 }
    }).connect(bassBus);
    bass.volume.value = -4;

    // Keys: Wobbly Rhodes style
    keys = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "sine" },
        envelope: { attack: 0.2, decay: 0.1, sustain: 1, release: 2 }
    }).connect(keysBus);
    
    const vibrato = new Tone.Vibrato(4, 0.15).connect(keysBus);
    keys.connect(vibrato);
    keys.volume.value = -10;

    // Lead: Soft flute-like melody
    lead = new Tone.Synth({
        oscillator: { type: "sine" },
        envelope: { attack: 0.5, decay: 0.2, sustain: 0.5, release: 1.5 }
    }).connect(leadBus);
    lead.volume.value = -18;

    setupSequences();
    initialized = true;
}

/**
 * Define the music patterns
 */
function setupSequences() {
    // 1. Drum Loop (Boom Bap - 16th Note Grid)
    // K = Kick, S = Snare, h = HiHat soft, H = HiHat hard
    const drumPattern = [
        "K", "H", "h", null, "S", null, "H", "K",
        null, "H", "K", "h", "S", null, "H", "h"
    ];

    const drumSeq = new Tone.Sequence((time, hit) => {
        if (hit === "K") kick.triggerAttackRelease("C1", "8n", time);
        if (hit === "S") snare.triggerAttackRelease("16n", time);
        if (hit === "H" || hit === "h") {
            const vel = hit === "H" ? 0.5 : 0.2;
            hihat.triggerAttackRelease("32n", time, vel);
        }
        
        // Visualizer pulse
        Tone.Draw.schedule(() => {
            if (hit === "K") {
                visualizer.style.transform = "scale(1.3)";
                setTimeout(() => visualizer.style.transform = "scale(1)", 100);
            }
        }, time);
    }, drumPattern, "16n").start(0);

    // 2. Chords & Lead Logic
    const progressions = [
        ["Cmaj7", "Am7", "Dm7", "G7"],
        ["Fmaj7", "Bbmaj7", "Cmaj7", "C7"],
        ["Dm7", "G7", "Cmaj7", "Am7"],
        ["Abmaj7", "G7", "Cm7", "C7"]
    ];

    let currentProg = progressions[0];
    
    const musicLoop = new Tone.Loop((time) => {
        const bar = Math.floor(Tone.Transport.seconds / (60/Tone.Transport.bpm.value * 4)) % 4;
        const chord = currentProg[bar];
        
        // Progression change logic
        if (bar === 0 && Math.random() > 0.6) {
            currentProg = progressions[Math.floor(Math.random() * progressions.length)];
        }

        const notes = getNotesForChord(chord);
        
        // Play Chords
        keys.triggerAttackRelease(notes, "1n", time, 0.3);
        
        // Play Bass
        bass.triggerAttackRelease(notes[0].replace('4', '2'), "2n", time, 0.5);
        
        // Generative Lead Melody
        if (Math.random() > 0.3) {
            const leadNote = notes[Math.floor(Math.random() * notes.length)].replace('3', '5').replace('4', '5');
            lead.triggerAttackRelease(leadNote, "2n", time + Tone.Time("4n").toSeconds(), 0.3);
        }

        statusText.innerText = `Chilling in ${chord}`;
    }, "1n").start(0);

    Tone.Transport.bpm.value = 84;
    Tone.Transport.swing = 0.3; // Give it that Lo-Fi bounce
}

function getNotesForChord(chord) {
    const map = {
        "Cmaj7": ["C4", "E4", "G4", "B4"],
        "Am7": ["A3", "C4", "E4", "G4"],
        "Dm7": ["D4", "F4", "A4", "C5"],
        "G7": ["G3", "B3", "D4", "F4"],
        "Fmaj7": ["F3", "A3", "C4", "E4"],
        "Bbmaj7": ["Bb3", "D4", "F4", "A4"],
        "C7": ["C4", "E4", "G4", "Bb4"],
        "Abmaj7": ["Ab3", "C4", "Eb4", "G4"],
        "Cm7": ["C4", "Eb4", "G4", "Bb4"]
    };
    return map[chord] || map["Cmaj7"];
}

// UI Listeners
startStopBtn.addEventListener('click', async () => {
    if (!initialized) {
        statusText.innerText = "Tuning instruments...";
        await initAudio();
    }

    if (isPlaying) {
        Tone.Transport.pause();
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

