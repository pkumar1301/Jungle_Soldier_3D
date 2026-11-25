// V11: original chiptune soundtrack, synthesized live with Web Audio.
// No audio files. Classic arcade voices: pulse-wave lead, triangle bass,
// thin pulse arpeggio, synthesized kick / snare / hi-hat.
//
// Melody notation: one token per 16th note. A number is a scale degree
// (0 = key root, 7 = an octave up, negative = below), "." holds the previous
// note, "-" is a rest. Chords are scale degrees, one per bar.

const MINOR = [0, 2, 3, 5, 7, 8, 10];
const HARMONIC = [0, 2, 3, 5, 7, 8, 11];

const TRACKS = {
  menu: { title: 'Mission Briefing', bpm: 128, key: 57, scale: MINOR, chords: [0, 2, 5, 6], bass: 'pulse', drums: 'menu',
    form: ['A', 'A', 'B', 'A'],
    A: ['7 . . . 6 . 4 . 7 . . . 9 . 7 .', '9 . . . 7 . 6 . 4 . . . 2 . 4 .',
        '5 . . . 7 . 9 . 12 . . . 11 . 9 .', '8 . . . 6 . . . 4 . . . - . . .'],
    B: ['4 . 7 . 9 . 7 . 4 . 7 . 11 . 9 .', '7 . 9 . 11 . 9 . 7 . 4 . 2 . 4 .',
        '5 . 9 . 12 . 9 . 5 . 9 . 14 . 12 .', '11 . . . 9 . . . 8 . . . 6 . . .'] },
  jungle: { title: 'Jungle Rush', bpm: 160, key: 57, scale: MINOR, chords: [0, 5, 2, 6], bass: 'drive', drums: 'drive',
    form: ['A', 'A', 'B', 'B', 'A'],
    A: ['4 . 4 2 4 . 7 . 6 . 4 . 2 . 0 .', '5 . 5 4 5 . 7 . 9 . 7 . 5 . 4 .',
        '4 . 2 . 4 . 6 . 7 . 6 . 4 . 2 .', '6 . 6 . 4 . 3 . 1 . . . - - 6 .'],
    B: ['7 - 7 - 9 . 7 . 11 . 9 . 7 . 6 .', '5 - 5 - 7 . 5 . 9 . 7 . 5 . 4 .',
        '4 - 4 - 6 . 4 . 7 . 9 . 11 . 9 .', '6 . 8 . 11 . 10 . 9 . 8 . 6 . 4 .'] },
  canopy: { title: 'Canopy Charge', bpm: 168, key: 52, scale: MINOR, chords: [0, 5, 3, 6], bass: 'gallop', drums: 'drive',
    form: ['A', 'A', 'B', 'A', 'B'],
    A: ['0 . 2 4 7 . 4 2 0 . 2 4 6 . 4 2', '5 . 4 2 5 . 7 . 9 . 7 . 5 . 4 .',
        '3 . 5 7 3 . 5 7 10 . 9 7 5 . 3 .', '6 . 8 . 10 . 8 . 6 . 5 . 4 . 3 .'],
    B: ['7 . . 7 9 . 7 . 4 . . 4 6 . 7 .', '5 . . 5 7 . 9 . 12 . 11 . 9 . 7 .',
        '10 . . 10 9 . 7 . 5 . 7 . 9 . 10 .', '11 . 10 . 9 . 8 . 6 . . . 13 . 12 .'] },
  night: { title: 'Night Patrol', bpm: 150, key: 50, scale: MINOR, chords: [0, 5, 6, 4], bass: 'drive', drums: 'half',
    form: ['A', 'A', 'B', 'A'],
    A: ['0 . . 4 . . 7 . 6 . 4 . 2 . 1 .', '0 . . 5 . . 7 . 9 . 7 . 5 . 4 .',
        '1 . . 6 . . 8 . 9 . 8 . 6 . 4 .', '4 . 6 . 8 . 11 . . . 9 . 8 . 7 .'],
    B: ['7 . 7 . 9 . 10 . 9 . 7 . 4 . 7 .', '5 . 5 . 7 . 9 . 12 . 10 . 9 . 7 .',
        '6 . 6 . 8 . 10 . 13 . 12 . 10 . 8 .', '11 . . . 9 . . . 8 . . . 7 . . .'] },
  boss: { title: 'Iron Beetle', bpm: 176, key: 48, scale: HARMONIC, chords: [0, 0, 5, 4], bass: 'gallop', drums: 'boss',
    form: ['A', 'A', 'B', 'A', 'B'],
    A: ['0 . 0 2 0 . -1 . 0 . 0 2 4 . 2 .', '0 . 0 2 0 . -1 . 0 . 4 5 7 . 5 .',
        '5 . 5 4 5 . 7 . 9 . 7 . 5 . 4 .', '4 . 6 . 8 . 11 . 10 . 8 . 6 . 4 .'],
    B: ['7 7 . 7 9 . 7 . 6 . 7 . 9 . 10 .', '11 . 10 . 9 . 7 . 9 . 7 . 6 . 4 .',
        '12 . 11 . 12 . 9 . 10 . 9 . 7 . 5 .', '11 . . . 13 . . . 11 . 10 . 8 . 6 .'] },
  // V15: one track per new biome, the Overmind finale and the 90s ending
  desert: { title: 'Sunken Dunes', bpm: 154, key: 50, scale: HARMONIC, chords: [0, 5, 4, 0], bass: 'drive', drums: 'drive',
    form: ['A', 'A', 'B', 'A'],
    A: ['0 . 1 . 4 . 3 . 1 . 0 . 1 . 3 .', '4 . 5 4 3 . 1 . 0 . . . -1 . 0 .',
        '4 . 4 5 7 . 5 . 4 . 3 . 1 . 3 .', '1 . 0 . -1 . 0 . 4 . . . - . 0 .'],
    B: ['7 . . 8 7 . 5 . 4 . 5 . 7 . 8 .', '9 . 8 . 7 . 5 . 4 . 3 . 1 . 0 .',
        '4 . 5 . 7 . 9 . 10 . 9 . 8 . 7 .', '8 . 7 . 5 . 4 . 3 . . . 1 . . .'] },
  tundra: { title: 'Frozen Reach', bpm: 146, key: 54, scale: MINOR, chords: [0, 3, 5, 4], bass: 'pulse', drums: 'half',
    form: ['A', 'B', 'A', 'B'],
    A: ['7 . . 9 . . 11 . 9 . 7 . 4 . . .', '5 . . 7 . . 9 . 7 . 5 . 4 . . .',
        '7 . . 9 . . 11 . 12 . 11 . 9 . 7 .', '6 . 7 . 9 . 6 . 4 . . . - . . .'],
    B: ['11 . 9 . 7 . 9 . 11 . 12 . 14 . . .', '12 . 11 . 9 . 7 . 9 . . . 5 . . .',
        '7 . 9 . 11 . 12 . 14 . 12 . 11 . 9 .', '8 . . . 9 . . . 11 . . . 7 . . .'] },
  volcano: { title: 'Ashen Caldera', bpm: 172, key: 45, scale: HARMONIC, chords: [0, 5, 6, 4], bass: 'gallop', drums: 'boss',
    form: ['A', 'A', 'B', 'A', 'B'],
    A: ['0 0 . 0 2 . 3 . 2 . 0 . -1 . 0 .', '0 0 . 0 3 . 4 . 5 . 4 . 3 . 2 .',
        '4 4 . 4 5 . 7 . 5 . 4 . 3 . 4 .', '3 . 2 . 0 . -1 . 0 . . . 7 . 6 .'],
    B: ['7 . 7 . 8 . 7 . 5 . 4 . 3 . 4 .', '5 . 5 . 7 . 5 . 4 . 3 . 2 . 3 .',
        '4 . 4 . 5 . 7 . 8 . 10 . 11 . 10 .', '11 . . . 10 . . . 8 . 7 . 6 . 4 .'] },
  space: { title: 'Dead Orbit', bpm: 140, key: 52, scale: MINOR, chords: [0, 6, 5, 3], bass: 'pulse', drums: 'half',
    form: ['A', 'A', 'B', 'A'],
    A: ['0 . 7 . 3 . 7 . 0 . 7 . 5 . 3 .', '-2 . 5 . 2 . 5 . -2 . 5 . 4 . 2 .',
        '-3 . 4 . 0 . 4 . -3 . 4 . 2 . 0 .', '-4 . 3 . 0 . 3 . 4 . . . 5 . . .'],
    B: ['7 . . . 10 . . . 9 . 7 . 5 . 7 .', '5 . . . 9 . . . 7 . 5 . 4 . 2 .',
        '4 . 5 . 7 . 9 . 10 . 12 . 11 . 9 .', '7 . . . 5 . . . 4 . . . 2 . . .'] },
  city: { title: 'The Hive Capital', bpm: 164, key: 49, scale: HARMONIC, chords: [0, 5, 3, 4], bass: 'drive', drums: 'drive',
    form: ['A', 'A', 'B', 'B', 'A'],
    A: ['0 . 2 3 4 . 3 2 0 . 2 3 6 . 4 .', '5 . 4 3 2 . 3 4 5 . 7 . 6 . 4 .',
        '3 . 4 5 7 . 5 4 3 . 4 5 8 . 7 .', '6 . 5 4 3 . 2 . 1 . . . -1 . . .'],
    B: ['7 . 7 . 9 . 10 . 11 . 10 . 9 . 7 .', '8 . 8 . 10 . 11 . 12 . 11 . 10 . 8 .',
        '7 . 9 . 11 . 12 . 14 . 12 . 11 . 9 .', '11 . . . 10 . . . 9 . . . 8 . . .'] },
  finale: { title: 'The Overmind', bpm: 184, key: 46, scale: HARMONIC, chords: [0, 0, 5, 4], bass: 'gallop', drums: 'boss',
    form: ['A', 'A', 'B', 'A', 'B'],
    A: ['0 . 0 1 0 . -1 . 0 . 0 1 4 . 3 .', '0 . 0 1 0 . -1 . 0 . 4 5 7 . 6 .',
        '7 . 7 6 7 . 8 . 10 . 8 . 7 . 6 .', '4 . 6 . 7 . 11 . 10 . 8 . 6 . 4 .'],
    B: ['11 11 . 11 12 . 11 . 10 . 11 . 12 . 14 .', '15 . 14 . 12 . 11 . 12 . 11 . 10 . 8 .',
        '14 . 12 . 14 . 11 . 12 . 11 . 10 . 8 .', '11 . . . 14 . . . 12 . 11 . 10 . 8 .'] },
  ending: { title: 'Mission Complete', bpm: 150, key: 60, scale: [0, 2, 4, 5, 7, 9, 11], chords: [0, 4, 5, 3], bass: 'drive', drums: 'drive',
    form: ['A', 'B', 'A', 'B'],
    A: ['7 . 9 . 11 . 7 . 14 . 11 . 9 . 7 .', '8 . 9 . 11 . 8 . 12 . 11 . 9 . 8 .',
        '9 . 11 . 12 . 9 . 14 . 12 . 11 . 9 .', '11 . 12 . 14 . . . 16 . . . 14 . . .'],
    B: ['14 . 14 . 16 . 14 . 12 . 11 . 9 . 11 .', '12 . 12 . 14 . 12 . 11 . 9 . 8 . 9 .',
        '11 . 12 . 14 . 16 . 18 . 16 . 14 . 12 .', '14 . . . 18 . . . 21 . . . . . . .'] },
  win: { title: 'Victory', bpm: 150, key: 60, scale: [0, 2, 4, 5, 7, 9, 11], chords: [0, 3, 4, 0], bass: 'pulse', drums: 'none', once: true,
    form: ['A'], A: ['0 2 4 7 . . 4 7 9 . . 11 14 . . .', '- - - - - - - - - - - - - - - -'] },
  lose: { title: 'Game Over', bpm: 110, key: 57, scale: MINOR, chords: [0, 5], bass: 'pulse', drums: 'none', once: true,
    form: ['A'], A: ['7 . 6 . 4 . 2 . 1 . . . 0 . . .', '- - - - - - - - - - - - - - - -'] }
};

const DRUMS = { // kick, snare, hat (16 steps)
  drive: ['x...x...x...x...', '....x.......x...', 'x.x.x.x.x.x.x.x.'],
  half:  ['x.....x...x.....', '....x.......x...', 'x.x.x.x.x.x.x.x.'],
  boss:  ['x.x.x...x.x.x.x.', '....x.......x..x', 'xxxxxxxxxxxxxxxx'],
  menu:  ['x.......x.......', '....x.......x...', '..x...x...x...x.'],
  none:  ['................', '................', '................']
};

const midiHz = m => 440 * Math.pow(2, (m - 69) / 12);

export function createMusic() {
  let lift = 1; // V13
  let ctx = null, master, comp, echo, echoGain, pulse25, pulse12, noiseBuf;
  let track = null, trackName = '', step = 0, nextTime = 0, timer = null, volume = .5, onDone = null;

  function init(audioCtx) {
    if (ctx) return;
    ctx = audioCtx;
    comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4;
    master = ctx.createGain(); master.gain.value = 0;
    master.connect(comp).connect(ctx.destination);
    echo = ctx.createDelay(1); echo.delayTime.value = .19; echoGain = ctx.createGain(); echoGain.gain.value = .22;
    echo.connect(echoGain).connect(echo); echoGain.connect(master);
    const pw = duty => { // band-limited pulse wave
      const n = 32, re = new Float32Array(n), im = new Float32Array(n);
      for (let k = 1; k < n; k++) im[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
      return ctx.createPeriodicWave(re, im);
    };
    pulse25 = pw(.25); pulse12 = pw(.125);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * .5, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  function tone(freq, t, dur, {wave = 'square', gain = .2, toEcho = false, vibrato = false, slideTo = null} = {}) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    if (wave === 'p25') o.setPeriodicWave(pulse25); else if (wave === 'p12') o.setPeriodicWave(pulse12); else o.type = wave;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    if (vibrato && dur > .2) {
      const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 6; lg.gain.value = freq * .012;
      lfo.connect(lg).connect(o.frequency); lfo.start(t + .15); lfo.stop(t + dur + .05);
    }
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + .006);
    g.gain.setTargetAtTime(gain * .65, t + .02, .08);
    g.gain.setTargetAtTime(0, t + Math.max(.02, dur - .03), .025);
    o.connect(g); g.connect(master); if (toEcho) g.connect(echo);
    o.start(t); o.stop(t + dur + .2);
  }
  function noise(t, dur, {hp = 6000, gain = .15} = {}) {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; f.type = 'highpass'; f.frequency.value = hp;
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
    s.connect(f).connect(g).connect(master); s.start(t); s.stop(t + dur + .02);
  }
  const kick = t => tone(150, t, .14, {wave: 'sine', gain: .9, slideTo: 42});
  const snare = t => { noise(t, .13, {hp: 1500, gain: .32}); tone(190, t, .06, {wave: 'triangle', gain: .25}); };
  const hat = (t, open) => noise(t, open ? .09 : .035, {hp: 7500, gain: .09});

  const note = (tr, deg) => {
    const oct = Math.floor(deg / 7), idx = ((deg % 7) + 7) % 7;
    return tr.key + 12 * oct + tr.scale[idx];
  };
  // Pre-parse the song into a flat list of bars.
  function build(tr) {
    const bars = [];
    for (const sec of tr.form) tr[sec].forEach((line, i) => bars.push({tokens: line.trim().split(/\s+/), chord: tr.chords[i % tr.chords.length], section: sec, last: i === tr[sec].length - 1}));
    return bars;
  }

  function scheduleStep(t) {
    const tr = track, bars = tr.bars, sixteenth = 60 / (tr.bpm * lift) / 4;
    const barIdx = Math.floor(step / 16) % bars.length, s = step % 16, bar = bars[barIdx];
    if (tr.once && step >= bars.length * 16) { stopScheduling(); onDone?.(); return; }
    // lead
    const tok = bar.tokens[s];
    if (tok && tok !== '.' && tok !== '-') {
      let len = 1; while (s + len < 16 && bar.tokens[s + len] === '.') len++;
      tone(midiHz(note(tr, +tok) + 12), t, len * sixteenth, {wave: 'p25', gain: .13, toEcho: true, vibrato: true});
    }
    // bass
    const root = note(tr, bar.chord) - 12;
    if (tr.bass === 'drive' && s % 2 === 0) tone(midiHz(root + (s % 4 === 2 ? 12 : 0)), t, sixteenth * 1.6, {wave: 'triangle', gain: .42});
    if (tr.bass === 'gallop' && [0, 2, 3, 4, 6, 7, 8, 10, 11, 12, 14, 15].includes(s)) tone(midiHz(root), t, sixteenth * .9, {wave: 'triangle', gain: .42});
    if (tr.bass === 'pulse' && s % 4 === 0) tone(midiHz(root), t, sixteenth * 3.5, {wave: 'triangle', gain: .38});
    // arpeggio in B sections
    if (bar.section === 'B' && !tr.once) {
      const tri = [bar.chord, bar.chord + 2, bar.chord + 4, bar.chord + 7];
      tone(midiHz(note(tr, tri[s % 4]) + 12), t, sixteenth * .8, {wave: 'p12', gain: .045});
    }
    // drums, with a snare fill at the end of each section
    const [k, sn, h] = DRUMS[tr.drums];
    if (k[s] === 'x') kick(t);
    if (sn[s] === 'x' || (bar.last && s >= 12 && tr.drums !== 'none' && tr.drums !== 'menu')) snare(t);
    if (h[s] === 'x') hat(t, s === 14);
    step++;
  }
  function tick() {
    if (!track) return;
    const sixteenth = 60 / (track.bpm * lift) / 4;
    while (track && nextTime < ctx.currentTime + .15) { scheduleStep(nextTime); nextTime += sixteenth; }
  }
  function stopScheduling() { clearInterval(timer); timer = null; track = null; }

  return {
    get current() { return trackName; },
    tracks: Object.fromEntries(Object.entries(TRACKS).map(([k, v]) => [k, v.title])),
    init,
    setVolume(v) { volume = v; if (ctx && track) master.gain.setTargetAtTime(volume * .5, ctx.currentTime, .05); },
    // V13: final stretch: play the current track a little faster and louder.
    lift(factor) { lift = factor; if (ctx && track) master.gain.setTargetAtTime(volume * .5 * Math.min(1.3, factor * 1.1), ctx.currentTime, .2); },
    play(name, done) {
      if (!ctx || !TRACKS[name]) return;
      if (name === trackName && track) return;
      lift = 1;
      stopScheduling();
      const tr = TRACKS[name]; tr.bars = tr.bars || build(tr);
      track = tr; trackName = name; step = 0; onDone = done || null;
      nextTime = ctx.currentTime + .08;
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setValueAtTime(0, ctx.currentTime); master.gain.linearRampToValueAtTime(volume * .5, ctx.currentTime + .08);
      timer = setInterval(tick, 25); tick();
    },
    // Offline render for previews: schedules a whole stretch at once on an OfflineAudioContext.
    renderTo(offline, name, seconds) {
      ctx = null; init(offline);
      const tr = TRACKS[name]; tr.bars = tr.bars || build(tr);
      track = tr; trackName = name; step = 0; nextTime = .05; master.gain.value = volume * .5;
      const sixteenth = 60 / tr.bpm / 4;
      while (track && nextTime < seconds) { scheduleStep(nextTime); nextTime += sixteenth; }
      track = null;
    },
    stop() {
      if (!ctx) return;
      master.gain.setTargetAtTime(0, ctx.currentTime, .06);
      stopScheduling(); trackName = '';
    }
  };
}
