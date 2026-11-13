// =========================================================================
// MOTOR ACÚSTICO DE MODELADO FÍSICO (KARPLUS-STRONG, PIANO REAL & SALA 3D)
// =========================================================================
let audioCtx = null;
let masterGain = null;
let reverbNode = null;
let dryBus = null;
let wetBus = null;
let masterVolumeValue = 0.85;

// Buffers en caché para ruido y sala acústica
let noiseBufferCache = null;

function getAudioContext() {
    if (!audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContextClass();

        // Compresor de estudio para empastar la banda sin saturar
        const compressor = audioCtx.createDynamicsCompressor();
        compressor.threshold.setValueAtTime(-14, audioCtx.currentTime);
        compressor.knee.setValueAtTime(18, audioCtx.currentTime);
        compressor.ratio.setValueAtTime(4, audioCtx.currentTime);
        compressor.attack.setValueAtTime(0.004, audioCtx.currentTime);
        compressor.release.setValueAtTime(0.18, audioCtx.currentTime);

        masterGain = audioCtx.createGain();
        masterGain.gain.value = masterVolumeValue;

        dryBus = audioCtx.createGain();
        wetBus = audioCtx.createGain();
        dryBus.gain.value = 0.88;
        wetBus.gain.value = 0.24; // Cantidad de Reverb Acústica de Estudio

        // Crear Reverb de Convolución (Sala de estudio cálida)
        reverbNode = createStudioReverb(audioCtx, 1.6, 3.2);

        dryBus.connect(masterGain);
        wetBus.connect(reverbNode);
        reverbNode.connect(masterGain);

        masterGain.connect(compressor);
        compressor.connect(audioCtx.destination);

        noiseBufferCache = createWhiteNoiseBuffer(audioCtx, 1.5);
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    updateAudioUIStatus();
    return audioCtx;
}

// Genera una respuesta al impulso (Impulse Response) de sala real
function createStudioReverb(ctx, durationSec, decayRate) {
    const rate = ctx.sampleRate;
    const length = Math.floor(rate * durationSec);
    const impulse = ctx.createBuffer(2, length, rate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
        const n = i / length;
        const env = Math.pow(1 - n, decayRate);
        left[i] = (Math.random() * 2 - 1) * env;
        right[i] = (Math.random() * 2 - 1) * env;
    }
    const convolver = ctx.createConvolver();
    convolver.buffer = impulse;
    return convolver;
}

function createWhiteNoiseBuffer(ctx, durationSec) {
    const len = Math.floor(ctx.sampleRate * durationSec);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
        data[i] = Math.random() * 2 - 1;
    }
    return buf;
}

function connectToStudioBuses(node, sendReverbAmount) {
    node.connect(dryBus);
    if (sendReverbAmount > 0 && wetBus) {
        const send = audioCtx.createGain();
        send.gain.value = sendReverbAmount;
        node.connect(send);
        send.connect(wetBus);
    }
}

function updateAudioUIStatus() {
    const dot = document.getElementById('audioStatusDot');
    const txt = document.getElementById('audioStatusText');
    if (dot && txt && audioCtx) {
        dot.classList.add('ready');
        txt.textContent = 'Motor Acústico HD: ACTIVO (Modelado Físico de Piano, Guitarra, Bajo y Batería)';
        txt.style.color = '#10b981';
    }
}

function updateMasterVolume(val) {
    masterVolumeValue = parseFloat(val) / 100;
    if (masterGain && audioCtx) {
        masterGain.gain.setValueAtTime(masterVolumeValue, audioCtx.currentTime);
    }
}

function midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
}

// =========================================================================
// 2. INSTRUMENTOS REALISTAS (PIANO DE COLA, GUITARRA KARPLUS-STRONG, BAJO)
// =========================================================================

// A) PIANO ACÚSTICO DE COLA (Síntesis Inarmónica + Macillo de Fieltro + Caja de Resonancia)
function playAcousticPiano(freq, duration, volume, delaySec) {
    duration = Math.max(duration || 1.2, 0.7);
    volume = volume || 0.35;
    delaySec = delaySec || 0;

    const ctx = getAudioContext();
    const start = ctx.currentTime + delaySec;

    const noteOut = ctx.createGain();
    noteOut.gain.setValueAtTime(0.0001, start);
    noteOut.gain.linearRampToValueAtTime(volume, start + 0.006); // Ataque rápido de macillo
    noteOut.gain.exponentialRampToValueAtTime(volume * 0.38, start + 0.22); // Caída inicial natural
    noteOut.gain.exponentialRampToValueAtTime(0.0001, start + duration + 0.35);

    // Filtro dinámico (el timbre del piano es brillante en el golpe y se vuelve cálido al sostenerse)
    const toneFilter = ctx.createBiquadFilter();
    toneFilter.type = 'lowpass';
    const maxBright = Math.min(freq * 7.5, 9500);
    const warmSustain = Math.max(freq * 2.2, 650);
    toneFilter.frequency.setValueAtTime(maxBright, start);
    toneFilter.frequency.exponentialRampToValueAtTime(warmSustain, start + duration * 0.75);

    // Cuerdas dobles y parciales armónicos del piano
    const partials = [
        { ratio: 1.0,   detune: -2.5, gain: 0.60, type: 'triangle' },
        { ratio: 1.0,   detune: +2.5, gain: 0.45, type: 'sine' },
        { ratio: 2.001, detune: 0,    gain: 0.25, type: 'sine' }, // Ligera inarmonicidad real de cuerda gruesa
        { ratio: 3.003, detune: 0,    gain: 0.10, type: 'sine' },
        { ratio: 4.006, detune: 0,    gain: 0.04, type: 'sine' }
    ];

    partials.forEach(function(p) {
        if (freq * p.ratio > 14000) return;
        const osc = ctx.createOscillator();
        const pGain = ctx.createGain();

        osc.type = p.type;
        osc.frequency.setValueAtTime(freq * p.ratio, start);
        osc.detune.setValueAtTime(p.detune, start);

        // Los armónicos agudos decaen más rápido que la fundamental
        const harmonicDecay = (duration + 0.3) / Math.pow(p.ratio, 0.75);
        pGain.gain.setValueAtTime(p.gain, start);
        pGain.gain.exponentialRampToValueAtTime(0.0001, start + harmonicDecay);

        osc.connect(pGain);
        pGain.connect(toneFilter);
        osc.start(start);
        osc.stop(start + harmonicDecay + 0.05);
    });

    // Golpe físico del macillo de fieltro ("Hammer Thump")
    const hammerNoise = ctx.createBufferSource();
    hammerNoise.buffer = noiseBufferCache;
    const hammerFilter = ctx.createBiquadFilter();
    hammerFilter.type = 'bandpass';
    hammerFilter.frequency.setValueAtTime(Math.min(freq * 2.5, 2200), start);
    hammerFilter.Q.setValueAtTime(1.8, start);

    const hammerGain = ctx.createGain();
    hammerGain.gain.setValueAtTime(volume * 0.28, start);
    hammerGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.028);

    hammerNoise.connect(hammerFilter);
    hammerFilter.connect(hammerGain);
    hammerGain.connect(toneFilter);
    hammerNoise.start(start);
    hammerNoise.stop(start + 0.032);

    toneFilter.connect(noteOut);
    connectToStudioBuses(noteOut, 0.35);
}

// B) GUITARRA REAL (MODELADO FÍSICO DE CUERDA PULSADA KARPLUS-STRONG)
function playPluckedGuitar(freq, duration, volume, delaySec) {
    duration = Math.max(duration || 1.4, 0.85);
    volume = volume || 0.42;
    delaySec = delaySec || 0;

    const ctx = getAudioContext();
    const start = ctx.currentTime + delaySec;
    const sampleRate = ctx.sampleRate;
    const totalSamples = Math.floor(sampleRate * duration);

    // Creamos un buffer donde simulamos la física exacta de la cuerda vibrando
    const stringBuffer = ctx.createBuffer(1, totalSamples, sampleRate);
    const out = stringBuffer.getChannelData(0);

    const period = Math.max(2, Math.round(sampleRate / freq));
    const ring = new Float32Array(period);

    // Excitación inicial de la púa/uña (suavizada para que suene a cuerda cálida, no a ruido)
    let prev = 0;
    for (let i = 0; i < period; i++) {
        const raw = Math.random() * 2 - 1;
        ring[i] = 0.55 * raw + 0.45 * prev;
        prev = ring[i];
    }

    // Factor de amortiguación según la altura de la cuerda
    const damping = freq < 140 ? 0.9965 : 0.9945;
    let idx = 0;

    for (let i = 0; i < totalSamples; i++) {
        const nextIdx = (idx + 1) % period;
        // Promedio de filtro paso-bajo en el puente de la guitarra
        const avg = (ring[idx] + ring[nextIdx]) * 0.5 * damping;
        out[i] = ring[idx];
        ring[idx] = avg;
        idx = nextIdx;
    }

    const src = ctx.createBufferSource();
    src.buffer = stringBuffer;

    // Resonancia de la caja/cuerpo de madera de la guitarra (~210 Hz)
    const bodyResonance = ctx.createBiquadFilter();
    bodyResonance.type = 'peaking';
    bodyResonance.frequency.setValueAtTime(215, start);
    bodyResonance.Q.setValueAtTime(1.4, start);
    bodyResonance.gain.setValueAtTime(4.5, start);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

    src.connect(bodyResonance);
    bodyResonance.connect(gain);
    connectToStudioBuses(gain, 0.30);

    src.start(start);
}

// C) BAJO ELÉCTRICO REALISTA (Cuerda Entorchada + Sub-Grave + Envelope Pluck)
function playElectricBass(freq, duration, volume, delaySec) {
    duration = Math.max(duration || 0.45, 0.25);
    volume = volume || 0.48;
    delaySec = delaySec || 0;

    const ctx = getAudioContext();
    const start = ctx.currentTime + delaySec;

    // Oscilador 1: Fundamental sub-grave redonda
    const subOsc = ctx.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(freq, start);

    // Oscilador 2: Armónicos magnéticos de pastilla (Precision/Jazz Bass)
    const wireOsc = ctx.createOscillator();
    wireOsc.type = 'sawtooth';
    wireOsc.frequency.setValueAtTime(freq, start);

    // Filtro envolvente que imita el ataque del dedo ("Pluck")
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.setValueAtTime(3.2, start);
    filter.frequency.setValueAtTime(freq * 9.5, start);
    filter.frequency.exponentialRampToValueAtTime(freq * 2.1, start + 0.09);

    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0.65, start);

    const wireGain = ctx.createGain();
    wireGain.gain.setValueAtTime(0.40, start);

    const masterNoteGain = ctx.createGain();
    masterNoteGain.gain.setValueAtTime(0.001, start);
    masterNoteGain.gain.linearRampToValueAtTime(volume, start + 0.008);
    masterNoteGain.gain.exponentialRampToValueAtTime(volume * 0.65, start + 0.12);
    masterNoteGain.gain.exponentialRampToValueAtTime(0.0001, start + duration + 0.05);

    subOsc.connect(subGain);
    wireOsc.connect(wireGain);
    subGain.connect(filter);
    wireGain.connect(filter);
    filter.connect(masterNoteGain);

    connectToStudioBuses(masterNoteGain, 0.06); // El bajo lleva muy poca reverb para sonar firme

    subOsc.start(start);
    wireOsc.start(start);
    subOsc.stop(start + duration + 0.06);
    wireOsc.stop(start + duration + 0.06);
}

// D) VOZ / LEAD CÁLIDO EXPRESIVO (Con Vibrato Humano Progresivo)
function playWarmLead(freq, duration, volume, delaySec) {
    duration = Math.max(duration || 0.6, 0.35);
    volume = volume || 0.30;
    delaySec = delaySec || 0;

    const ctx = getAudioContext();
    const start = ctx.currentTime + delaySec;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc2.type = 'triangle';
    osc1.frequency.setValueAtTime(freq, start);
    osc2.frequency.setValueAtTime(freq, start);
    osc2.detune.setValueAtTime(6, start);

    // Vibrato natural (5.5 Hz)
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.setValueAtTime(5.5, start);
    lfoGain.gain.setValueAtTime(0.1, start);
    lfoGain.gain.linearRampToValueAtTime(4.5, start + 0.25);
    lfo.connect(lfoGain);
    lfoGain.connect(osc1.frequency);
    lfoGain.connect(osc2.frequency);

    // Filtro formante vocal suave
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2100, start);
    filter.Q.setValueAtTime(1.6, start);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.035);
    gain.gain.exponentialRampToValueAtTime(0.0008, start + duration + 0.08);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    connectToStudioBuses(gain, 0.42);

    osc1.start(start);
    osc2.start(start);
    lfo.start(start);
    osc1.stop(start + duration + 0.1);
    osc2.stop(start + duration + 0.1);
    lfo.stop(start + duration + 0.1);
}

// ENRUTADOR INTELIGENTE DE INSTRUMENTOS
// Detecta automáticamente según el registro y tipo qué instrumento real tocar
function playSynthNote(freq, duration, type, volume, delaySec) {
    if (type === 'piano' || type === 'triangle') {
        playAcousticPiano(freq, duration, volume, delaySec);
    } else if (type === 'guitar') {
        playPluckedGuitar(freq, duration, volume, delaySec);
    } else if (type === 'bass') {
        playElectricBass(freq, duration, volume, delaySec);
    } else if (type === 'lead') {
        playWarmLead(freq, duration, volume, delaySec);
    } else if (type === 'sawtooth') {
        // Si es registro grave (< 145 Hz, como E1-D3), usa Bajo Eléctrico; si es medio/agudo, usa Guitarra Real
        if (freq < 145) {
            playElectricBass(freq, duration, volume, delaySec);
        } else {
            playPluckedGuitar(freq, duration, volume, delaySec);
        }
    } else {
        playAcousticPiano(freq, duration, volume, delaySec);
    }
}

// =========================================================================
// 3. DEMOSTRACIONES INTERACTIVAS DE LOS MÓDULOS
// =========================================================================
function testAudioEngine() {
    // Toca un acorde Cmaj9 en el Piano Acústico de Cola y luego un arpegio en Guitarra Real
    const pianoChord = [48, 55, 59, 64, 67, 74]; // C3 - G3 - B3 - E4 - G4 - D5
    pianoChord.forEach(function(midi, i) {
        playAcousticPiano(midiToFreq(midi), 1.8, 0.28, i * 0.08);
    });
}

function playSingleNote(midi) {
    playAcousticPiano(midiToFreq(midi), 1.2, 0.42, 0);
}

function demoOctaves() {
    // La1 y La2 en Bajo Eléctrico -> La3 y La4 en Guitarra Acústica/Eléctrica
    playElectricBass(55, 0.85, 0.50, 0.0);
    playElectricBass(110, 0.85, 0.45, 0.6);
    playPluckedGuitar(220, 1.1, 0.42, 1.2);
    playPluckedGuitar(440, 1.3, 0.42, 1.8);
}

function playIntervalDemo(semitones) {
    const rootMidi = 60;
    const targetMidi = 60 + semitones;
    playAcousticPiano(midiToFreq(rootMidi), 0.7, 0.38, 0);
    playAcousticPiano(midiToFreq(targetMidi), 0.7, 0.38, 0.48);
    playAcousticPiano(midiToFreq(rootMidi), 1.4, 0.30, 1.02);
    playAcousticPiano(midiToFreq(targetMidi), 1.4, 0.30, 1.02);
}

function playSelectedChord(intervals, description) {
    const selectEl = document.getElementById('chordRootSelect');
    const rootMidi = selectEl ? parseInt(selectEl.value) : 60;
    const infoEl = document.getElementById('chordInfoOutput');
    if (infoEl) {
        infoEl.innerHTML = '<strong>Sonando ahora (Piano Acústico + Guitarra):</strong> ' + description;
    }

    // Primero arpegiado en Guitarra Real
    intervals.forEach(function(intv, i) {
        playPluckedGuitar(midiToFreq(rootMidi + intv), 1.2, 0.35, i * 0.14);
    });

    // Luego en bloque en Piano Acústico de Cola (con nota de bajo una octava abajo)
    const blockDelay = intervals.length * 0.14 + 0.38;
    playAcousticPiano(midiToFreq(rootMidi - 12), 1.8, 0.28, blockDelay);
    intervals.forEach(function(intv) {
        playAcousticPiano(midiToFreq(rootMidi + intv), 1.8, 0.25, blockDelay);
    });
}

function demoVoiceLeading(smooth) {
    const chordsJump = [[60, 64, 67], [65, 69, 72], [67, 71, 74], [60, 64, 67]];
    const chordsSmooth = [[60, 64, 67], [60, 65, 69], [59, 62, 67], [60, 64, 67]];
    const roots = [48, 53, 55, 48];
    const sequence = smooth ? chordsSmooth : chordsJump;

    sequence.forEach(function(chord, idx) {
        playElectricBass(midiToFreq(roots[idx]), 0.8, 0.35, idx * 0.85);
        chord.forEach(function(midi) {
            playAcousticPiano(midiToFreq(midi), 0.95, 0.26, idx * 0.85);
        });
    });
}

function demoRiffAudio() {
    const riffEvents = [
        { midi: 45, time: 0.0, dur: 0.22 },
        { midi: 45, time: 0.24, dur: 0.22 },
        { midi: 57, time: 0.48, dur: 0.30 },
        { midi: 55, time: 0.76, dur: 0.30 },
        { midi: 52, time: 1.12, dur: 0.25 },
        { midi: 48, time: 1.38, dur: 0.25 },
        { midi: 50, time: 1.64, dur: 0.85 }
    ];
    riffEvents.forEach(function(ev) {
        playPluckedGuitar(midiToFreq(ev.midi), ev.dur + 0.3, 0.45, ev.time);
        playElectricBass(midiToFreq(ev.midi - 12), ev.dur, 0.35, ev.time);
    });
}

// =========================================================================
// 4. VISUALIZADOR DE ESCALAS (PIANO DE COLA Y MÁSTIL DE GUITARRA/BAJO)
// =========================================================================
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const SCALES = {
    major: {
        name: 'Mayor Natural (Jónica)',
        intervals: [0, 2, 4, 5, 7, 9, 11],
        formula: 'Fórmula: T - T - S - T - T - T - S | Grados: 1 - 2 - 3 - 4 - 5 - 6 - 7',
        desc: 'Sonoridad brillante, optimista y resolutiva.'
    },
    minor: {
        name: 'Menor Natural (Eólica)',
        intervals: [0, 2, 3, 5, 7, 8, 10],
        formula: 'Fórmula: T - S - T - T - S - T - T | Grados: 1 - 2 - b3 - 4 - 5 - b6 - b7',
        desc: 'Sonoridad melancólica, seria y épica.'
    },
    pent_minor: {
        name: 'Pentatónica Menor',
        intervals: [0, 3, 5, 7, 10],
        formula: 'Grados: 1 - b3 - 4 - 5 - b7',
        desc: 'La reina de los riffs de guitarra, líneas de bajo y solos de Blues/Rock.'
    },
    pent_major: {
        name: 'Pentatónica Mayor',
        intervals: [0, 2, 4, 7, 9],
        formula: 'Grados: 1 - 2 - 3 - 5 - 6',
        desc: 'Sonoridad abierta, luminosa e hímnica.'
    },
    blues: {
        name: 'Escala de Blues',
        intervals: [0, 3, 5, 6, 7, 10],
        formula: 'Grados: 1 - b3 - 4 - b5 (Blue Note) - 5 - b7',
        desc: 'Añade el tritono (b5) a la pentatónica menor.'
    },
    dorian: {
        name: 'Modo Dórico',
        intervals: [0, 2, 3, 5, 7, 9, 10],
        formula: 'Grados: 1 - 2 - b3 - 4 - 5 - 6 - b7',
        desc: 'Menor con 6ª Mayor luminosa (Funk, Neo-Soul, Santana).'
    },
    mixolydian: {
        name: 'Modo Mixolidio',
        intervals: [0, 2, 4, 5, 7, 9, 10],
        formula: 'Grados: 1 - 2 - 3 - 4 - 5 - 6 - b7',
        desc: 'Mayor con 7ª menor rebelde (Rock clásico y Groove).'
    },
    harmonic_minor: {
        name: 'Menor Armónica',
        intervals: [0, 2, 3, 5, 7, 8, 11],
        formula: 'Grados: 1 - 2 - b3 - 4 - 5 - b6 - 7',
        desc: 'Crea el acorde V7 dominante en tonalidades menores.'
    }
};

function updateScaleVisualizer() {
    const rootEl = document.getElementById('rootSelect');
    const scaleEl = document.getElementById('scaleSelect');
    if (!rootEl || !scaleEl) return;

    const root = parseInt(rootEl.value);
    const scaleKey = scaleEl.value;
    const scaleObj = SCALES[scaleKey] || SCALES.major;

    const activePitchClasses = scaleObj.intervals.map(function(i) { return (root + i) % 12; });
    const scaleNoteNames = activePitchClasses.map(function(pc) { return NOTE_NAMES[pc]; }).join(' – ');

    const infoBox = document.getElementById('scaleFormulaInfo');
    if (infoBox) {
        infoBox.innerHTML =
            '<strong>Notas de ' + NOTE_NAMES[root] + ' ' + scaleObj.name + ':</strong> ' +
            '<span style="color:var(--accent-gold);">' + scaleNoteNames + '</span><br>' +
            '<span style="color:var(--text-muted);">' + scaleObj.formula + ' — ' + scaleObj.desc + '</span>';
    }

    // 1. Piano Interactivo (Toca Piano Acústico de Cola Real)
    const pianoContainer = document.getElementById('pianoContainer');
    if (pianoContainer) {
        pianoContainer.innerHTML = '';
        for (let midi = 60; midi <= 83; midi++) {
            const pc = midi % 12;
            const isBlack = [1, 3, 6, 8, 10].indexOf(pc) !== -1;
            const keyDiv = document.createElement('div');
            keyDiv.className = isBlack ? 'key-black' : 'key-white';

            if (pc === root) {
                keyDiv.classList.add('is-root');
            } else if (activePitchClasses.indexOf(pc) !== -1) {
                keyDiv.classList.add('in-scale');
            }

            keyDiv.innerHTML = '<span>' + NOTE_NAMES[pc] + '</span>';
            keyDiv.addEventListener('click', function() {
                playAcousticPiano(midiToFreq(midi), 1.3, 0.42, 0);
                keyDiv.classList.add('playing');
                setTimeout(function() { keyDiv.classList.remove('playing'); }, 220);
            });
            pianoContainer.appendChild(keyDiv);
        }
    }

    // 2. Mástil de Guitarra (Toca Cuerda Pulsada Karplus-Strong Real)
    const fbContainer = document.getElementById('fretboardContainer');
    if (fbContainer) {
        fbContainer.innerHTML = '';
        const stringTunings = [
            { label: 'e (1ª)', midi: 64 },
            { label: 'B (2ª)', midi: 59 },
            { label: 'G (3ª)', midi: 55 },
            { label: 'D (4ª)', midi: 50 },
            { label: 'A (5ª)', midi: 45 },
            { label: 'E (6ª)', midi: 40 }
        ];

        stringTunings.forEach(function(str) {
            const row = document.createElement('div');
            row.className = 'fretboard-row';

            const lbl = document.createElement('div');
            lbl.className = 'string-label';
            lbl.textContent = str.label;
            row.appendChild(lbl);

            for (let fret = 0; fret <= 12; fret++) {
                const cell = document.createElement('div');
                cell.className = 'fret-cell';

                const noteMidi = str.midi + fret;
                const pc = noteMidi % 12;

                const badge = document.createElement('div');
                badge.className = 'fret-note';
                badge.textContent = NOTE_NAMES[pc];

                if (pc === root) {
                    badge.classList.add('root');
                } else if (activePitchClasses.indexOf(pc) !== -1) {
                    badge.classList.add('active');
                }

                badge.addEventListener('click', function() {
                    playPluckedGuitar(midiToFreq(noteMidi), 1.5, 0.46, 0);
                });
                cell.appendChild(badge);
                row.appendChild(cell);
            }
            fbContainer.appendChild(row);
        });

        const numRow = document.createElement('div');
        numRow.className = 'fret-numbers';
        for (let fret = 0; fret <= 12; fret++) {
            const n = document.createElement('div');
            n.className = 'fret-num';
            n.textContent = fret === 0 ? '0 (Aire)' : fret;
            numRow.appendChild(n);
        }
        fbContainer.appendChild(numRow);
    }
}

function playCurrentScale() {
    const root = parseInt(document.getElementById('rootSelect').value);
    const scaleKey = document.getElementById('scaleSelect').value;
    const scaleObj = SCALES[scaleKey] || SCALES.major;
    const intervals = scaleObj.intervals.concat([12]);

    intervals.forEach(function(interval, idx) {
        const midi = 60 + root + interval;
        playAcousticPiano(midiToFreq(midi), 0.9, 0.36, idx * 0.25);
        playPluckedGuitar(midiToFreq(midi), 0.9, 0.26, idx * 0.25);
    });
}

// =========================================================================
// 5. BATERÍA ACÚSTICA REALISTA Y SECUENCIADOR DE SECCIÓN RÍTMICA
// =========================================================================
const GROOVE_PRESETS = {
    rock: {
        hihat: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
        snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
        kick:  [1,0,0,0, 0,0,1,0, 1,0,1,0, 0,0,0,0],
        bass:  [1,0,1,0, 0,0,1,0, 1,0,1,0, 0,0,1,1],
        info: "Rock / Pop Clásico: Bombo y Bajo golpean juntos en 1, 2+, 3 y 3+; en el 4+ el bajo camina al siguiente acorde."
    },
    funk: {
        hihat: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1],
        snare: [0,0,0,0, 1,0,0,1, 0,1,0,0, 1,0,0,0],
        kick:  [1,0,0,1, 0,0,1,0, 0,0,1,0, 0,0,0,1],
        bass:  [1,0,0,1, 0,0,1,0, 0,1,1,0, 0,0,1,1],
        info: "Funk Sincopado: El tiempo 3 queda vacío para resaltar las semicorcheas débiles y el golpe de Caja."
    },
    motown: {
        hihat: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
        snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,1,0],
        kick:  [1,0,0,0, 0,0,1,1, 1,0,0,0, 0,0,1,0],
        bass:  [1,0,0,1, 0,0,1,1, 1,0,1,0, 0,1,1,0],
        info: "Soul / Indie Melódico: El bajo dialoga con el bombo anticipando el tiempo 3."
    },
    reggaeton: {
        hihat: [1,0,0,1, 0,0,1,0, 1,0,0,1, 0,0,1,0],
        snare: [0,0,0,1, 0,0,1,0, 0,0,0,1, 0,0,1,0],
        kick:  [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
        bass:  [1,0,0,0, 0,0,1,0, 0,0,0,0, 1,0,0,0],
        info: "Urbano / Pop Latino (3+3+2): Bombo en negras, caja en tresillo (casillas 4 y 7) y bajo en Tumbao (2+ y 4)."
    }
};

let currentSeqState = JSON.parse(JSON.stringify(GROOVE_PRESETS.rock));
let seqInterval = null;
let currentStep = 0;

function renderSequencer() {
    const container = document.getElementById('sequencerGrid');
    if (!container) return;
    container.innerHTML = '';

    const stepLabels = ['1','e','+','a','2','e','+','a','3','e','+','a','4','e','+','a'];
    const tracks = [
        { key: 'hihat', label: 'Hi-Hat (Agudo)', activeClass: 'on-hihat' },
        { key: 'snare', label: 'Caja (Snare)', activeClass: 'on-snare' },
        { key: 'kick',  label: 'Bombo (Kick)', activeClass: 'on-kick' },
        { key: 'bass',  label: 'Bajo Eléctrico', activeClass: 'on-bass' }
    ];

    tracks.forEach(function(t) {
        const row = document.createElement('div');
        row.className = 'seq-row';

        const lbl = document.createElement('div');
        lbl.className = 'seq-label';
        lbl.textContent = t.label;
        row.appendChild(lbl);

        for (let i = 0; i < 16; i++) {
            const step = document.createElement('div');
            step.className = 'seq-step step-col-' + i;
            if (currentSeqState[t.key][i]) {
                step.classList.add(t.activeClass);
            }
            step.textContent = stepLabels[i];
            step.addEventListener('click', function() {
                currentSeqState[t.key][i] = currentSeqState[t.key][i] ? 0 : 1;
                if (currentSeqState[t.key][i]) {
                    if (t.key === 'hihat') triggerHiHat(false, 0.25);
                    if (t.key === 'snare') triggerSnare(0.50);
                    if (t.key === 'kick') triggerKick(0.90);
                    if (t.key === 'bass') triggerBassNote(i);
                }
                renderSequencer();
            });
            row.appendChild(step);
        }
        container.appendChild(row);
    });

    const expEl = document.getElementById('grooveExplanation');
    if (expEl) expEl.textContent = currentSeqState.info;
}

function loadGroovePreset() {
    const key = document.getElementById('groovePreset').value;
    currentSeqState = JSON.parse(JSON.stringify(GROOVE_PRESETS[key]));
    renderSequencer();
}

// Bombo Acústico con Golpe de Maza ("Beater Click") y Sub-grave de Parche
function triggerKick(vol) {
    vol = vol || 0.90;
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // 1. Parche grave
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(155, now);
    osc.frequency.exponentialRampToValueAtTime(46, now + 0.065);
    osc.frequency.exponentialRampToValueAtTime(34, now + 0.26);

    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    osc.connect(gain);
    connectToStudioBuses(gain, 0.05);
    osc.start(now);
    osc.stop(now + 0.29);

    // 2. Click de la maza contra el parche
    const clickOsc = ctx.createOscillator();
    const clickGain = ctx.createGain();
    clickOsc.type = 'triangle';
    clickOsc.frequency.setValueAtTime(950, now);
    clickOsc.frequency.exponentialRampToValueAtTime(120, now + 0.018);
    clickGain.gain.setValueAtTime(vol * 0.35, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);

    clickOsc.connect(clickGain);
    connectToStudioBuses(clickGain, 0.04);
    clickOsc.start(now);
    clickOsc.stop(now + 0.022);
}

// Caja Acústica Realista (Casco de madera + Bordona metálica)
function triggerSnare(vol) {
    vol = vol || 0.50;
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // 1. Resonancia del casco (185 Hz y 330 Hz)
    const bodyOsc = ctx.createOscillator();
    const bodyGain = ctx.createGain();
    bodyOsc.type = 'triangle';
    bodyOsc.frequency.setValueAtTime(210, now);
    bodyOsc.frequency.exponentialRampToValueAtTime(115, now + 0.09);

    bodyGain.gain.setValueAtTime(vol * 0.65, now);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

    bodyOsc.connect(bodyGain);
    connectToStudioBuses(bodyGain, 0.25);
    bodyOsc.start(now);
    bodyOsc.stop(now + 0.12);

    // 2. Bordona inferior (Snare wires)
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBufferCache;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2400, now);
    filter.Q.setValueAtTime(0.8, now);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(vol * 0.85, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.004, now + 0.19);

    noise.connect(filter);
    filter.connect(noiseGain);
    connectToStudioBuses(noiseGain, 0.32);
    noise.start(now);
    noise.stop(now + 0.20);
}

// Platos Metálicos (Hi-Hat / Crash con armónicos de bronce + aire)
function triggerHiHat(isOpen, vol) {
    vol = vol || 0.22;
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const dur = isOpen ? 0.38 : 0.055;

    const noise = ctx.createBufferSource();
    noise.buffer = noiseBufferCache;

    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.setValueAtTime(8800, now);
    bandpass.Q.setValueAtTime(1.2, now);

    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.setValueAtTime(5500, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + dur);

    noise.connect(bandpass);
    bandpass.connect(highpass);
    highpass.connect(gain);
    connectToStudioBuses(gain, isOpen ? 0.28 : 0.08);

    noise.start(now);
    noise.stop(now + dur + 0.02);
}

function triggerBassNote(stepIdx) {
    const bassMelodicMap = [55, 55, 110, 98, 55, 65.41, 82.41, 73.42, 55, 55, 82.41, 98, 65.41, 73.42, 82.41, 98];
    playElectricBass(bassMelodicMap[stepIdx % 16], 0.24, 0.48, 0);
}

function toggleSequencer() {
    const btn = document.getElementById('playSeqBtn');
    if (bandInterval) stopFullBandArrangement();

    if (seqInterval) {
        clearInterval(seqInterval);
        seqInterval = null;
        if (btn) btn.textContent = '▶ Reproducir Groove';
        document.querySelectorAll('.seq-step').forEach(function(el) { el.classList.remove('current-step'); });
        return;
    }

    getAudioContext();
    currentStep = 0;
    if (btn) btn.textContent = '⏹ Detener Groove';

    seqInterval = setInterval(function() {
        document.querySelectorAll('.seq-step').forEach(function(el) { el.classList.remove('current-step'); });
        document.querySelectorAll('.step-col-' + currentStep).forEach(function(el) { el.classList.add('current-step'); });

        if (currentSeqState.hihat[currentStep]) triggerHiHat(false, 0.22);
        if (currentSeqState.snare[currentStep]) triggerSnare(0.50);
        if (currentSeqState.kick[currentStep]) triggerKick(0.90);
        if (currentSeqState.bass[currentStep]) triggerBassNote(currentStep);

        currentStep = (currentStep + 1) % 16;
    }, 135);
}

// =========================================================================
// 6. REPRODUCTOR DE BANDA COMPLETA (MÓDULO 12 - TIMBRES DIFERENCIADOS)
// =========================================================================
let bandInterval = null;
let bandStep = 0;

const FULL_BAND_SCORE = {
    chordNames: [
        'Compás 1: [ Am7 ]',
        'Compás 2: [ Fmaj7 ]',
        'Compás 3: [ C ]',
        'Compás 4: [ G ] -> [ E7/G# ]'
    ],
    melody: [
        null, 76, null, 74, null, 72, null, null,
        72, null, 69, null, null, null, 67, null,
        67, null, 76, null, 74, null, 72, null,
        71, null, null, null, null, null, 71, null
    ],
    bass: [
        45, null, null, 45, null, 55, 57, null,
        41, null, null, 41, null, 48, 45, null,
        48, null, null, 48, null, 55, 48, 47,
        43, null, 43, null, 44, null, 44, null
    ],
    elecGtr: [
        74, 72, 76, 72, 74, 72, 76, 72,
        74, 72, 76, 72, 74, 72, 76, 72,
        72, 72, 76, 72, 72, 72, 76, 72,
        67, 71, 74, 71, 68, 71, 76, 71
    ],
    kick:  [1,0,0,1,0,1,0,0,  1,0,0,1,0,1,0,1,  1,0,0,1,0,1,0,0,  1,0,1,0,1,0,1,0],
    snare: [0,0,1,0,0,0,1,0,  0,0,1,0,0,0,1,0,  0,0,1,0,0,0,1,0,  0,0,1,0,0,0,1,1]
};

function stopFullBandArrangement() {
    if (bandInterval) {
        clearInterval(bandInterval);
        bandInterval = null;
    }
    const btn = document.getElementById('playFullBandBtn');
    if (btn) btn.textContent = '▶ Escuchar Arreglo Completo en Vivo';
}

function toggleFullBandArrangement() {
    if (seqInterval) toggleSequencer();
    if (bandInterval) {
        stopFullBandArrangement();
        return;
    }

    getAudioContext();
    bandStep = 0;
    const btn = document.getElementById('playFullBandBtn');
    if (btn) btn.textContent = '⏹ Detener Arreglo Completo';

    const playTick = function() {
        const barIndex = Math.floor(bandStep / 8);
        const status = document.getElementById('bandNowPlayingBar');
        if (status) {
            status.textContent = '🔊 Reproduciendo Banda Real: ' + FULL_BAND_SCORE.chordNames[barIndex];
        }

        const useMel   = document.getElementById('muteMelody') ? document.getElementById('muteMelody').checked : true;
        const usePiano = document.getElementById('mutePiano') ? document.getElementById('mutePiano').checked : true;
        const useElec  = document.getElementById('muteElecGtr') ? document.getElementById('muteElecGtr').checked : true;
        const useBass  = document.getElementById('muteBass') ? document.getElementById('muteBass').checked : true;
        const useDrums = document.getElementById('muteDrums') ? document.getElementById('muteDrums').checked : true;

        // 1. Piano Acústico de Cola
        if (usePiano) {
            if (bandStep === 0) [57, 67, 72, 76].forEach(function(m) { playAcousticPiano(midiToFreq(m), 2.1, 0.22, 0); });
            if (bandStep === 8) [53, 69, 72, 76].forEach(function(m) { playAcousticPiano(midiToFreq(m), 2.1, 0.22, 0); });
            if (bandStep === 16) [60, 67, 72, 76].forEach(function(m) { playAcousticPiano(midiToFreq(m), 2.1, 0.22, 0); });
            if (bandStep === 24) [55, 67, 71, 74].forEach(function(m) { playAcousticPiano(midiToFreq(m), 1.05, 0.22, 0); });
            if (bandStep === 28) [56, 68, 71, 74, 76].forEach(function(m) { playAcousticPiano(midiToFreq(m), 1.05, 0.24, 0); });
        }

        // 2. Melodía Principal con Vibrato Expresivo
        if (useMel && FULL_BAND_SCORE.melody[bandStep] !== null) {
            const melDur = (bandStep === 10 || bandStep === 24) ? 1.15 : 0.52;
            playWarmLead(midiToFreq(FULL_BAND_SCORE.melody[bandStep]), melDur, 0.28, 0);
        }

        // 3. Guitarra Eléctrica / Acústica Pulsada (Karplus-Strong)
        if (useElec && FULL_BAND_SCORE.elecGtr[bandStep] !== null) {
            playPluckedGuitar(midiToFreq(FULL_BAND_SCORE.elecGtr[bandStep]), 0.65, 0.28, 0);
        }

        // 4. Bajo Eléctrico Realista
        if (useBass && FULL_BAND_SCORE.bass[bandStep] !== null) {
            playElectricBass(midiToFreq(FULL_BAND_SCORE.bass[bandStep]), 0.48, 0.50, 0);
        }

        // 5. Batería Acústica
        if (useDrums) {
            triggerHiHat(bandStep === 0 || bandStep === 28, 0.18);
            if (FULL_BAND_SCORE.kick[bandStep]) triggerKick(0.88);
            if (FULL_BAND_SCORE.snare[bandStep]) triggerSnare(0.48);
        }

        bandStep = (bandStep + 1) % 32;
    };

    playTick();
    bandInterval = setInterval(playTick, 285);
}

// =========================================================================
// 7. PUENTE AUTOMÁTICO ANTI-CSP E INICIALIZACIÓN
// =========================================================================
function filterNav() {
    const input = document.getElementById('navSearch');
    if (!input) return;
    const query = input.value.toLowerCase();
    document.querySelectorAll('#navList .nav-item').forEach(function(item) {
        item.style.display = item.textContent.toLowerCase().indexOf(query) !== -1 ? 'block' : 'none';
    });
}

function executeActionString(code) {
    if (!code) return;
    code = code.trim();

    if (code.indexOf('testAudioEngine') !== -1) return testAudioEngine();
    if (code.indexOf('demoOctaves') !== -1) return demoOctaves();
    if (code.indexOf('playCurrentScale') !== -1) return playCurrentScale();
    if (code.indexOf('demoRiffAudio') !== -1) return demoRiffAudio();
    if (code.indexOf('toggleSequencer') !== -1) return toggleSequencer();
    if (code.indexOf('toggleFullBandArrangement') !== -1) return toggleFullBandArrangement();
    if (code.indexOf('sidebar') !== -1) {
        const sb = document.getElementById('sidebar');
        if (sb) sb.classList.toggle('open');
        return;
    }

    let m = code.match(/playSingleNote\((\d+)\)/);
    if (m) return playSingleNote(parseInt(m[1], 10));

    m = code.match(/playIntervalDemo\((\d+)\)/);
    if (m) return playIntervalDemo(parseInt(m[1], 10));

    m = code.match(/demoVoiceLeading\((true|false)\)/);
    if (m) return demoVoiceLeading(m[1] === 'true');

    m = code.match(/playSelectedChord\(\[([0-9,\s]+)\],\s*'([^']+)'\)/);
    if (m) {
        const arr = m[1].split(',').map(function(n) { return parseInt(n.trim(), 10); });
        return playSelectedChord(arr, m[2]);
    }
}

function bindAllEventsWithoutCSP() {
    document.querySelectorAll('[onclick]').forEach(function(el) {
        const code = el.getAttribute('onclick');
        el.removeAttribute('onclick');
        el.addEventListener('click', function(e) {
            e.preventDefault();
            executeActionString(code);
        });
    });

    const rootSel = document.getElementById('rootSelect');
    if (rootSel) {
        rootSel.removeAttribute('onchange');
        rootSel.addEventListener('change', updateScaleVisualizer);
    }

    const scaleSel = document.getElementById('scaleSelect');
    if (scaleSel) {
        scaleSel.removeAttribute('onchange');
        scaleSel.addEventListener('change', updateScaleVisualizer);
    }

    const grooveSel = document.getElementById('groovePreset');
    if (grooveSel) {
        grooveSel.removeAttribute('onchange');
        grooveSel.addEventListener('change', loadGroovePreset);
    }

    const volSlider = document.getElementById('masterVolSlider');
    if (volSlider) {
        volSlider.removeAttribute('oninput');
        volSlider.addEventListener('input', function() {
            updateMasterVolume(this.value);
        });
    }

    const navSearch = document.getElementById('navSearch');
    if (navSearch) {
        navSearch.removeAttribute('onkeyup');
        navSearch.addEventListener('keyup', filterNav);
    }
}

function initApp() {
    bindAllEventsWithoutCSP();
    updateScaleVisualizer();
    renderSequencer();
}
// =========================================================================
// EXPANSIÓN: 15 ESCALAS, MODELADO FÍSICO DE QUENA ANDINA Y PROGRESIONES
// =========================================================================

// 1. Ampliar el diccionario SCALES con las nuevas fórmulas matemáticas (=12)
Object.assign(SCALES, {
    phrygian: {
        name: 'Modo Frigio',
        intervals: [0, 1, 3, 5, 7, 8, 10],
        formula: 'Suma: 1+2+2+2+1+2+2 = 12 | Grados: 1 - b2 - b3 - 4 - 5 - b6 - b7',
        desc: 'El semitono inicial (b2) crea una atmósfera oscura, flamenca o de Metal.'
    },
    lydian: {
        name: 'Modo Lidio',
        intervals: [0, 2, 4, 6, 7, 9, 11],
        formula: 'Suma: 2+2+2+1+2+2+1 = 12 | Grados: 1 - 2 - 3 - #4 - 5 - 6 - 7',
        desc: 'La cuarta aumentada (#4) produce una sensación mágica, flotante y cinematográfica.'
    },
    melodic_minor: {
        name: 'Menor Melódica',
        intervals: [0, 2, 3, 5, 7, 9, 11],
        formula: 'Suma: 2+1+2+2+2+2+1 = 12 | Grados: 1 - 2 - b3 - 4 - 5 - 6 - 7',
        desc: 'Tercera menor con sexto y séptimo grados mayores. Sofisticación de Jazz y Cine.'
    },
    phrygian_dom: {
        name: 'Frigia Dominante (Flamenca / Árabe)',
        intervals: [0, 1, 4, 5, 7, 8, 10],
        formula: 'Suma: 1+3+1+2+1+2+2 = 12 | Grados: 1 - b2 - 3 - 4 - 5 - b6 - b7',
        desc: 'Salto exótico de 3 semitonos entre b2 y 3 Mayor. Ideal sobre acordes V7.'
    },
    double_harmonic: {
        name: 'Doble Armónica (Bizantina)',
        intervals: [0, 1, 4, 5, 7, 8, 11],
        formula: 'Suma: 1+3+1+2+1+3+1 = 12 | Grados: 1 - b2 - 3 - 4 - 5 - b6 - 7',
        desc: 'Dos saltos de 3 semitonos; máxima tensión oriental y cinematográfica.'
    },
    hirajoshi: {
        name: 'Pentatónica Japonesa (Hirajoshi)',
        intervals: [0, 2, 3, 7, 8],
        formula: 'Suma: 2+1+4+1+4 = 12 | Grados: 1 - 2 - b3 - 5 - b6',
        desc: 'Pentatónica contemplativa y misteriosa que combina semitonos con saltos de 4 semitonos.'
    },
    whole_tone: {
        name: 'Escala de Tonos Enteros (Simétrica)',
        intervals: [0, 2, 4, 6, 8, 10],
        formula: 'Suma: 2+2+2+2+2+2 = 12 | Grados: 1 - 2 - 3 - #4 - #5 - b7',
        desc: 'Sin semitonos ni centro gravitacional fijo; sensación de sueño o ingravidez.'
    }
});

// 2. MODELADO FÍSICO DE QUENA ANDINA (Tubo de Caña/Bambú + Soplo en Bisel + Ataque "Tuku" + Vibrato)
function playAndeanQuena(freq, duration, volume, delaySec) {
    duration = Math.max(duration || 0.75, 0.30);
    volume = volume || 0.38;
    delaySec = delaySec || 0;

    const ctx = getAudioContext();
    const start = ctx.currentTime + delaySec;

    // Tubo resonante de madera/caña (Fundamental + 2º y 3er armónico de flauta abierta)
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const osc3 = ctx.createOscillator();

    osc1.type = 'sine';
    osc2.type = 'triangle';
    osc3.type = 'sine';

    // Pequeño "portamento/arrastre" ascendente típico al atacar la nota en la Quena
    osc1.frequency.setValueAtTime(freq * 0.985, start);
    osc1.frequency.exponentialRampToValueAtTime(freq, start + 0.045);

    osc2.frequency.setValueAtTime(freq * 2, start);
    osc3.frequency.setValueAtTime(freq * 3, start);

    const g1 = ctx.createGain(); g1.gain.value = 0.70;
    const g2 = ctx.createGain(); g2.gain.value = 0.22;
    const g3 = ctx.createGain(); g3.gain.value = 0.08;

    // Vibrato expresivo andino (entra gradualmente tras sostener la nota)
    const vibrato = ctx.createOscillator();
    const vibGain = ctx.createGain();
    vibrato.frequency.setValueAtTime(5.8, start);
    vibGain.gain.setValueAtTime(0.01, start);
    vibGain.gain.linearRampToValueAtTime(freq * 0.014, start + 0.22);

    vibrato.connect(vibGain);
    vibGain.connect(osc1.frequency);

    // Soplo de aire continuo rozando el bisel de la Quena ("Breath Noise")
    const breathNoise = ctx.createBufferSource();
    breathNoise.buffer = noiseBufferCache;
    breathNoise.loop = true;

    const breathFilter = ctx.createBiquadFilter();
    breathFilter.type = 'bandpass';
    breathFilter.frequency.setValueAtTime(Math.min(freq * 3.2, 3400), start);
    breathFilter.Q.setValueAtTime(2.8, start);

    const breathGain = ctx.createGain();
    // Ataque inicial de lengua ("Tuku / Chiff") y luego aire suave sostenido
    breathGain.gain.setValueAtTime(0.001, start);
    breathGain.gain.linearRampToValueAtTime(volume * 0.55, start + 0.018);
    breathGain.gain.exponentialRampToValueAtTime(volume * 0.16, start + 0.07);
    breathGain.gain.linearRampToValueAtTime(0.0001, start + duration);

    // Envolvente del cuerpo tonal de la Quena
    const quenaOut = ctx.createGain();
    quenaOut.gain.setValueAtTime(0.0001, start);
    quenaOut.gain.linearRampToValueAtTime(volume, start + 0.038);
    quenaOut.gain.setValueAtTime(volume * 0.92, start + duration * 0.75);
    quenaOut.gain.exponentialRampToValueAtTime(0.0001, start + duration + 0.08);

    osc1.connect(g1); g1.connect(quenaOut);
    osc2.connect(g2); g2.connect(quenaOut);
    osc3.connect(g3); g3.connect(quenaOut);

    breathNoise.connect(breathFilter);
    breathFilter.connect(breathGain);
    breathGain.connect(quenaOut);

    // La Quena brilla enormemente con una reverb amplia de cañón/sala
    connectToStudioBuses(quenaOut, 0.52);

    osc1.start(start);
    osc2.start(start);
    osc3.start(start);
    vibrato.start(start);
    breathNoise.start(start);

    const stopTime = start + duration + 0.1;
    osc1.stop(stopTime);
    osc2.stop(stopTime);
    osc3.stop(stopTime);
    vibrato.stop(stopTime);
    breathNoise.stop(stopTime);
}

// 3. Diccionario de Acordes para el Reproductor de Progresiones y Modulaciones
const CHORD_VOICINGS = {
    'C':     { bass: 48, notes: [60, 64, 67, 72] },
    'G':     { bass: 43, notes: [59, 62, 67, 71] },
    'G/B':   { bass: 47, notes: [59, 62, 67, 74] },
    'Am':    { bass: 45, notes: [60, 64, 69, 72] },
    'Am7':   { bass: 45, notes: [60, 64, 67, 72] },
    'F':     { bass: 41, notes: [60, 65, 69, 72] },
    'Fmaj7': { bass: 41, notes: [60, 64, 69, 72] },
    'Fm':    { bass: 41, notes: [60, 65, 68, 72] },
    'Fm6':   { bass: 41, notes: [60, 65, 68, 74] },
    'Dm':    { bass: 50, notes: [62, 65, 69, 74] },
    'Dm7':   { bass: 50, notes: [60, 65, 69, 74] },
    'Em':    { bass: 40, notes: [59, 64, 67, 71] },
    'Em7':   { bass: 40, notes: [59, 62, 67, 71] },
    'E7':    { bass: 40, notes: [59, 62, 68, 71] },
    'G7':    { bass: 43, notes: [59, 62, 65, 67] },
    'C7':    { bass: 48, notes: [58, 64, 67, 72] },
    'D7':    { bass: 50, notes: [60, 62, 66, 69] },
    'D':     { bass: 50, notes: [62, 66, 69, 74] },
    'A':     { bass: 45, notes: [61, 64, 69, 73] },
    'A7':    { bass: 45, notes: [61, 64, 67, 69] },
    'B7':    { bass: 47, notes: [59, 63, 66, 69] },
    'Ab':    { bass: 44, notes: [60, 63, 68, 72] },
    'Bb':    { bass: 46, notes: [58, 62, 65, 70] },
    'Db7':   { bass: 49, notes: [59, 61, 65, 68] }
};

function playChordProgressionList(chordKeys, stepSec, withQuenaMelody) {
    stepSec = stepSec || 0.95;
    chordKeys.forEach(function(key, idx) {
        const ch = CHORD_VOICINGS[key] || CHORD_VOICINGS['C'];
        const t = idx * stepSec;

        // Bajo Eléctrico en el tiempo 1 y 3 del compás
        playElectricBass(midiToFreq(ch.bass), stepSec * 0.55, 0.45, t);
        playElectricBass(midiToFreq(ch.bass), stepSec * 0.40, 0.35, t + stepSec * 0.5);

        // Piano Acústico en bloque
        ch.notes.forEach(function(m) {
            playAcousticPiano(midiToFreq(m), stepSec * 1.1, 0.24, t);
        });

        // Arpegio de Guitarra Acústica
        ch.notes.forEach(function(m, nIdx) {
            playPluckedGuitar(midiToFreq(m), stepSec * 0.8, 0.26, t + nIdx * (stepSec / 5));
        });
    });

    if (withQuenaMelody) {
        const quenaNotes = [
            { midi: 76, time: 0.0, dur: 0.45 },
            { midi: 79, time: 0.48, dur: 0.42 },
            { midi: 76, time: 0.95, dur: 0.45 },
            { midi: 74, time: 1.42, dur: 0.42 },
            { midi: 72, time: 1.90, dur: 0.55 },
            { midi: 71, time: 2.50, dur: 0.40 },
            { midi: 69, time: 2.95, dur: 1.10 }
        ];
        quenaNotes.forEach(function(q) {
            playAndeanQuena(midiToFreq(q.midi), q.dur, 0.38, q.time);
        });
    }
}

// 4. Audios de Quena Andina (Escala, Arreglo Fusión y Dúo en Terceras)
function demoQuenaScaleAndMelody() {
    // Escala pentatónica de Mi menor en Quena (E5 - G5 - A5 - B5 - D6 - E6) seguida de fraseo expresivo
    const notes = [
        { m: 64, d: 0.35, t: 0.00 },
        { m: 67, d: 0.35, t: 0.38 },
        { m: 69, d: 0.35, t: 0.76 },
        { m: 71, d: 0.35, t: 1.14 },
        { m: 74, d: 0.35, t: 1.52 },
        { m: 76, d: 0.65, t: 1.90 },
        { m: 74, d: 0.30, t: 2.60 },
        { m: 71, d: 0.45, t: 2.92 },
        { m: 69, d: 0.30, t: 3.40 },
        { m: 67, d: 0.35, t: 3.72 },
        { m: 64, d: 1.10, t: 4.10 }
    ];
    notes.forEach(function(n) {
        playAndeanQuena(midiToFreq(n.m), n.d, 0.40, n.t);
    });
}

function demoQuenaFusionArrangement() {
    // Progresión Cmaj7 -> D7 -> G -> B7 -> Em con Quena, Guitarra, Piano, Bajo y Bombo Legüero/Batería
    const chords = ['Fmaj7', 'D7', 'G', 'B7', 'Em'];
    playChordProgressionList(['C', 'D7', 'G', 'B7', 'Em'], 1.1, false);

    // Melodía de Quena "Viento de la Cordillera"
    const quenaLine = [
        { m: 79, t: 0.00, d: 0.55 },
        { m: 81, t: 0.56, d: 0.25 },
        { m: 83, t: 0.82, d: 0.30 },
        { m: 81, t: 1.12, d: 0.55 },
        { m: 79, t: 1.68, d: 0.25 },
        { m: 78, t: 1.94, d: 0.25 },
        { m: 76, t: 2.22, d: 0.55 },
        { m: 79, t: 2.78, d: 0.50 },
        { m: 78, t: 3.30, d: 0.85 },
        { m: 76, t: 4.40, d: 1.35 }
    ];
    quenaLine.forEach(function(n) {
        playAndeanQuena(midiToFreq(n.m), n.d, 0.38, n.t);
    });
}

function demoQuenaDuetThirds() {
    // Dos Quenas tocando en terceras diatónicas paralelas sobre Mi menor
    const duet = [
        { q1: 76, q2: 71, t: 0.00, d: 0.45 },
        { q1: 79, q2: 76, t: 0.48, d: 0.45 },
        { q1: 81, q2: 78, t: 0.96, d: 0.45 },
        { q1: 83, q2: 79, t: 1.44, d: 0.65 },
        { q1: 81, q2: 78, t: 2.15, d: 0.35 },
        { q1: 79, q2: 76, t: 2.52, d: 0.35 },
        { q1: 76, q2: 71, t: 2.90, d: 1.20 }
    ];
    playChordProgressionList(['Em', 'C', 'D', 'Em'], 0.85, false);
    duet.forEach(function(d) {
        playAndeanQuena(midiToFreq(d.q1), d.d, 0.34, d.t);
        playAndeanQuena(midiToFreq(d.q2), d.d, 0.28, d.t);
    });
}

// 5. Enlazar todos los botones nuevos con atributo data-audio (100% libre de CSP)
function bindNewExpansionButtons() {
    document.querySelectorAll('[data-audio]').forEach(function(btn) {
        if (btn.dataset.bound) return;
        btn.dataset.bound = 'true';

        btn.addEventListener('click', function(e) {
            e.preventDefault();
            const action = btn.getAttribute('data-audio');

            if (action === 'prog:I-V-vi-IV') return playChordProgressionList(['C', 'G', 'Am', 'F'], 0.9);
            if (action === 'prog:vi-IV-I-V') return playChordProgressionList(['Am', 'F', 'C', 'G'], 0.9);
            if (action === 'prog:andaluz')   return playChordProgressionList(['Am', 'G', 'F', 'E7'], 0.9);
            if (action === 'prog:royal')     return playChordProgressionList(['Fmaj7', 'G7', 'Em7', 'Am7'], 0.95);
            if (action === 'prog:andino')    return playChordProgressionList(['F', 'C', 'E7', 'Am'], 0.95, true);
            if (action === 'prog:modal-ivm') return playChordProgressionList(['C', 'G/B', 'Am', 'Fm6'], 0.95);

            if (action === 'prog:eolic-borrow')  return playChordProgressionList(['C', 'F', 'Fm6', 'C'], 0.95);
            if (action === 'prog:dorian-borrow') return playChordProgressionList(['Am7', 'Dm7', 'Am7', 'D7'], 0.95);
            if (action === 'prog:picardy')       return playChordProgressionList(['Am', 'Dm', 'E7', 'A'], 0.95);

            if (action === 'mod:pivot') return playChordProgressionList(['C', 'F', 'Am', 'D7', 'G'], 0.85);
            if (action === 'mod:lift')  return playChordProgressionList(['F', 'G', 'C', 'A7', 'D', 'A', 'D'], 0.80);

            if (action === 'quena:scale')  return demoQuenaScaleAndMelody();
            if (action === 'quena:fusion') return demoQuenaFusionArrangement();
            if (action === 'quena:duet')   return demoQuenaDuetThirds();

            if (action === 'customprog:play') {
                const c1 = document.getElementById('progSlot1').value;
                const c2 = document.getElementById('progSlot2').value;
                const c3 = document.getElementById('progSlot3').value;
                const c4 = document.getElementById('progSlot4').value;
                const st = document.getElementById('customProgStatus');
                if (st) st.textContent = '🔊 Reproduciendo tu progresión: ' + c1 + ' → ' + c2 + ' → ' + c3 + ' → ' + c4;
                playChordProgressionList([c1, c2, c3, c4], 0.95);
            }
        });
    });
}

// Inicializar inmediatamente la expansión y actualizar el selector de escalas
bindNewExpansionButtons();
updateScaleVisualizer();
window.addEventListener('DOMContentLoaded', function() {
    bindNewExpansionButtons();
    updateScaleVisualizer();
});

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
