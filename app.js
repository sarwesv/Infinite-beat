/**
 * Infinite Lo-Fi Audio Engine - Full Band Version
 * Uses Tone.js for generative music synthesis
 */

let isPlaying = false;
let initialized = false;

// UI Elements
const startStopBtn = document.getElementById('start-stop');
const volumeSlider = document.getElementById('volume');
const visualizer = document.getElementById('visualizer');
const body = document.body;

// Instruments & Effects
let limiter, vol, reverb, vinylNoise;
let kick, snare, hihat, rim, keys, bass, lead, pad;
let drumBus, keysBus, leadBus, bassBus, padBus;

/**
 * Initialize the audio engine
 */
async function initAudio() {
    await Tone.start();
    
    // Master Chain
    limiter = new Tone.Limiter(-1).toDestination();
    vol = new Tone.Volume(-12).connect(limiter);
    
    // Global Reverb (Rich and Deep)
    reverb = new Tone.Freeverb({ roomSize: 0.7, dampening: 3000, wet: 0.25 }).connect(vol);

    // Busses with specific filtering for Lo-Fi warmth
    drumBus = new Tone.Filter(4000, "lowpass").connect(vol);
    keysBus = new Tone.Filter(1800, "lowpass").connect(reverb);
    leadBus = new Tone.Filter(2200, "lowpass").connect(reverb);
    bassBus = new Tone.Filter(600, "lowpass").connect(vol);
    padBus = new Tone.Filter(1200, "lowpass").connect(reverb);

    // --- AMBIENCE ---
    vinylNoise = new Tone.Noise("brown").start();
    const noiseFilter = new Tone.AutoFilter({
        frequency: "8n",
        baseFrequency: 400,
        octaves: 2.5
    }).connect(vol).start();
    vinylNoise.connect(noiseFilter);
    vinylNoise.volume.value = -38;

    // --- DRUMS ---
    kick = new Tone.MembraneSynth({
        pitchDecay: 0.05,
        octaves: 4,
        oscillator: { type: "sine" },
        envelope: { attack: 0.001, decay: 0.4, sustain: 0.01 }
    }).connect(drumBus);
    
    snare = new Tone.NoiseSynth({
        noise: { type: "white" },
        envelope: { attack: 0.005, decay: 0.2, sustain: 0 }
    }).connect(drumBus);

    hihat = new Tone.MetalSynth({
        frequency: 250,
        envelope: { attack: 0.001, decay: 0.1, release: 0.05 },
        harmonicity: 5.1,
        modulationIndex: 32,
        resonance: 4000,
        octaves: 1.5
    }).connect(drumBus);

    rim = new Tone.MembraneSynth({
        pitchDecay: 0.001,
        octaves: 2,
        oscillator: { type: "square" },
        envelope: { attack: 0.001, decay: 0.05, sustain: 0 }
    }).connect(drumBus);

    // --- INSTRUMENTS ---
    bass = new Tone.MonoSynth({
        oscillator: { type: "triangle" },
        envelope: { attack: 0.1, decay: 0.3, sustain: 0.8, release: 1 },
        filterEnvelope: { attack: 0.01, decay: 0.5, sustain: 0.2, baseFrequency: 100, octaves: 2 }
    }).connect(bassBus);
    bass.volume.value = -6;

    keys = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "triangle" },
        envelope: { attack: 0.2, decay: 0.1, sustain: 1, release: 2 }
    }).connect(keysBus);
    keys.volume.value = -12;

    pad = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "sine" },
        envelope: { attack: 1.5, decay: 0.5, sustain: 0.8, release: 3 }
    }).connect(padBus);
    pad.volume.value = -22;

    lead = new Tone.Synth({
        oscillator: { type: "sine" },
        envelope: { attack: 0.8, decay: 0.3, sustain: 0.6, release: 2 }
    }).connect(leadBus);
    lead.volume.value = -20;

    setupSequences();
    initialized = true;
}

/**
 * Define the music patterns
 */
function setupSequences() {
    // 1. Drum Loop (Boom Bap 16th Grid)
    const drumPattern = [
        "K", null, "h", "K", "S", "h", null, "h",
        "K", "h", "K", null, "S", "h", "R", "h"
    ];

    const drumSeq = new Tone.Sequence((time, hit) => {
        if (hit === "K") kick.triggerAttackRelease("C1", "8n", time, 0.8);
        if (hit === "S") snare.triggerAttackRelease("16n", time, 0.6);
        if (hit === "h") hihat.triggerAttackRelease("32n", time, 0.2);
        if (hit === "R") rim.triggerAttackRelease("G4", "32n", time, 0.3);
        
        // Visualizer pulse on Kick or Snare
        if (hit === "K" || hit === "S") {
            Tone.Draw.schedule(() => {
                visualizer.style.transform = "scale(1.25)";
                setTimeout(() => visualizer.style.transform = "scale(1)", 120);
            }, time);
        }
    }, drumPattern, "16n").start(0);

    // 2. Chords, Bass & Melody Logic
    const progressions = [
        ["Cmaj7", "Am7", "Dm7", "G7"],
        ["Fmaj7", "Bbmaj7", "Cmaj7", "C7"],
        ["Dm7", "G7", "Cmaj7", "Am7"],
        ["Abmaj7", "G7", "Cm7", "C7"],
        ["Em7", "A7", "Dm7", "G7"]
    ];

    let currentProg = progressions[0];
    let barCount = 0;

    const musicLoop = new Tone.Loop((time) => {
        const barInProg = barCount % 4;
        const chord = currentProg[barInProg];

        // Change progression every 8 bars
        if (barInProg === 0 && barCount > 0 && Math.random() > 0.5) {
            currentProg = progressions[Math.floor(Math.random() * progressions.length)];
        }

        const notes = getNotesForChord(chord);
        
        // Play Chords (Keys)
        keys.triggerAttackRelease(notes, "1n", time, 0.4);
        
        // Play Ambient Pad
        pad.triggerAttackRelease(notes, "1n", time, 0.2);
        
        // Play Bass (Root Note)
        bass.triggerAttackRelease(notes[0].replace('4', '2').replace('3', '2'), "1n", time, 0.7);
        
        // Generative Lead Melody
        if (Math.random() > 0.4) {
            const melodyNotes = [...notes];
            const leadNote = melodyNotes[Math.floor(Math.random() * melodyNotes.length)].replace(/[34]/, '5');
            // Play melody on the 2nd or 3rd beat
            const offset = Math.random() > 0.5 ? "2n" : "4n";
            lead.triggerAttackRelease(leadNote, "2n", time + Tone.Time(offset).toSeconds(), 0.3);
        }

        barCount++;
    }, "1n").start(0);

    Tone.Transport.bpm.value = 82;
    Tone.Transport.swing = 0.25;
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
        "Cm7": ["C4", "Eb4", "G4", "Bb4"],
        "Em7": ["E3", "G3", "B3", "D4"],
        "A7": ["A3", "C#4", "E4", "G4"]
    };
    return map[chord] || map["Cmaj7"];
}

// UI Listeners
startStopBtn.addEventListener('click', async () => {
    if (!initialized) {
        await initAudio();
    }

    if (isPlaying) {
        Tone.Transport.stop();
        startStopBtn.innerText = "Start Music";
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
