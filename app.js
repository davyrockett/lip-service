// Lip Service: builds the whole warm-up as one audio track of warm synth guide notes (no voice: the
// instructions and notation are on screen), so it keeps playing with the phone locked and shows up in
// CarPlay / the lock screen as "Now Playing". The car's skip buttons jump between exercises.

const SR = 24000;          // sample rate of the rendered track (plenty for soft synth tones)
const $ = (id) => document.getElementById(id);

// Baritone reads bass clef; tenor reads treble clef an octave down (the usual tenor clef) and sits 3 semitones higher.
const VOICES = { baritone: { name: 'Baritone', shift: 0, clef: 'bass' }, tenor: { name: 'Tenor', shift: 3, clef: 'tenor' } };
const LENGTHS = { short: 'Short', full: 'Full' };

// Each exercise is written on a beat grid so the notation, the highlight and the metronome line up.
// notes: [semitones above the key, beats (1 = quarter note), slide into the next note?]
// Each key starts with one bar of the key's chord, then the pattern; the last bar is filled with rest.
// keys = how many keys it climbs by half steps; Full also comes back down a few keys at the end.
const EXERCISES = [
  { id: 'breath', name: 'Breathing', what: 'In for 4, hiss out for the count', breath: { short: [8, 10], full: [8, 10, 12] },
    how: 'Breathe in low and slow while the soft chord swells (4 counts). Then hiss out on a long “sss” through the ticks and stop at the high tick. Shoulders loose.' },
  { id: 'hum', name: 'Humming', what: 'Hum on “mm”, 5 notes down', root: 45, bpm: 120, bar: 4, lyric: 'mm',
    notes: [[7, 1], [5, 1], [4, 1], [2, 1], [0, 2]], keys: { short: 6, full: 8 },
    how: 'Lips closed, teeth apart, hum on “mm”. Follow the notes down and feel the buzz on your lips.' },
  { id: 'trill', name: 'Lip trills', what: '5 notes up and back down', root: 43, bpm: 96, bar: 2, lyric: 'brr',
    notes: [[0, .5], [2, .5], [4, .5], [5, .5], [7, .5], [5, .5], [4, .5], [2, .5], [0, 2]], keys: { short: 8, full: 12 },
    how: 'Loose lips: blow through them like a motorboat, 5 notes up and back down. If your lips won’t buzz, hum it instead.' },
  { id: 'siren', name: 'Lip trill sirens', what: 'Slide up an octave and back', root: 45, bpm: 96, bar: 4, lyric: 'brr',
    notes: [[0, 2, true], [12, 2, true], [0, 2]], keys: { short: 5, full: 8 },
    how: 'Keep the lip trill going and slide smoothly up to the top note and back down. Easy at the top: don’t push.' },
  { id: 'sigh', name: 'Sighs', what: 'Breathy “hoo”, slide down an octave', root: 43, bpm: 96, bar: 4, lyric: 'hoo',
    notes: [[12, 2, true], [0, 2]], keys: { short: 4, full: 6 },
    how: 'On a breathy “hoo”, start high and slide gently down, like a big sigh of relief.' },
  { id: 'ng', name: 'NG slides', what: '“Sing” the ng, slide up a fifth and back', root: 45, bpm: 100, bar: 4, lyric: 'ng', full: true,
    notes: [[0, 2, true], [7, 2, true], [0, 2]], keys: { full: 8 },
    how: 'Sing the “ng” at the end of the word “sing” and glide up and back down. Keep it light.' },
  { id: 'vowels', name: 'Vowels', what: 'Mee may mah moh moo, 5 notes down', root: 45, bpm: 120, bar: 4,
    lyric: ['mee', 'may', 'mah', 'moh', 'moo'],
    notes: [[7, 1], [5, 1], [4, 1], [2, 1], [0, 2]], keys: { short: 6, full: 9 },
    how: 'Sing mee, may, mah, moh, moo, one vowel per note going down. Keep the easy buzz from the hum.' },
  { id: 'yah', name: 'Yah arpeggios', what: '“Yah” on 1-3-5-3-1', root: 45, bpm: 120, bar: 4, lyric: 'yah', full: true,
    notes: [[0, 1], [4, 1], [7, 1], [4, 1], [0, 2]], keys: { full: 9 },
    how: 'Sing “yah” on each note, up and back down. Let your jaw hang loose.' },
];

const store = {
  get(k, d) { try { return localStorage.getItem('vw.' + k) || d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('vw.' + k, v); } catch {} },
};
const state = { voice: store.get('voice', 'baritone'), length: store.get('length', 'full'),
  click: store.get('click', 'off') === 'on', plan: null, url: null };
if (!VOICES[state.voice]) state.voice = 'baritone';
if (!LENGTHS[state.length]) state.length = 'full';

// ---------- Planning: turns the exercises into a timeline of sounds ----------

const midiName = (m) => ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'][m % 12] + (Math.floor(m / 12) - 1);

function keyRoots(ex, voice, length) {
  const n = ex.keys[length];
  const start = ex.root + VOICES[voice].shift;
  const up = Array.from({ length: n }, (_, i) => start + i);
  // Full: after climbing, come back down a few keys so it ends somewhere comfortable.
  if (length === 'full') for (let i = n - 2; i >= Math.max(0, n - 4); i--) up.push(start + i);
  return up;
}

// The pattern of one key, with a closing rest so it fills whole bars.
function barsOf(ex) {
  const notes = ex.notes.map(([semi, beats, slide]) => ({ semi, beats, slide: !!slide }));
  const used = notes.reduce((a, n) => a + n.beats, 0), pad = Math.ceil(used / ex.bar) * ex.bar - used;
  if (pad) notes.push({ rest: true, beats: pad });
  return notes;
}

function plan(voice, length, click) {
  const ev = [];        // sounds: { t, type, ... }
  const chapters = [];
  const segs = [];      // what the screen shows: one per key (notation) or per breath round
  const range = [127, 0];
  let t = 0;

  for (const ex of EXERCISES) {
    if (ex.full && length !== 'full') continue;
    const ci = chapters.length;
    const ch = { id: ex.id, name: ex.name, what: ex.what, how: ex.how, start: t };
    chapters.push(ch);
    // A soft two-note chime marks each new exercise, then a moment to get ready.
    ev.push({ t: t + 0.3, type: 'chime' });
    t += 3.5;

    if (ex.breath) {
      const rounds = ex.breath[length];
      ch.detail = rounds.length + ' rounds';
      const br = 48 + VOICES[voice].shift;
      for (const count of rounds) {
        // Breathe in while a soft chord swells for 4 counts, then hiss through the ticks until the high tick.
        segs.push({ ch: ci, type: 'breath', t0: t, count, end: t + 4 + count + 2.5 });
        ev.push({ t, type: 'swell', notes: [br, br + 7, br + 12, br + 16], dur: 4 });
        t += 4;
        for (let i = 0; i < count; i++) ev.push({ t: t + i, type: 'tick', hi: i === count - 1 });
        t += count + 2.5;
      }
      t += 1;
      continue;
    }

    const beat = 60 / ex.bpm, pattern = barsOf(ex);
    const roots = keyRoots(ex, voice, length);
    const sung = pattern.filter((n) => !n.rest).map((n) => n.semi);
    const lo = Math.min(...roots) + Math.min(...sung), hi = Math.max(...roots) + Math.max(...sung);
    ch.detail = `${roots.length} keys · ${midiName(lo)}–${midiName(hi)}`;
    range[0] = Math.min(range[0], lo); range[1] = Math.max(range[1], hi);
    ch.bpm = ex.bpm;
    for (const root of roots) {
      // Cue bar: the key's chord, then the pattern to sing along with.
      const cueBeats = ex.bar, sing = t + cueBeats * beat;
      ev.push({ t, type: 'chord', notes: [root, root + 4, root + 7], dur: beat * Math.min(2, cueBeats - 0.5) });
      const notes = [];
      let bt = 0;
      for (const n of pattern) {
        notes.push({ ...n, midi: n.rest ? null : root + n.semi, t0: sing + bt * beat, t1: sing + (bt + n.beats) * beat });
        bt += n.beats;
      }
      const end = sing + bt * beat;
      if (click) for (let b = 0; b < cueBeats + bt; b++) ev.push({ t: t + b * beat, type: 'click', down: b % ex.bar === 0 });
      // Notes that slide into the next one become one continuous glide.
      for (let i = 0; i < notes.length; i++) {
        const n = notes[i];
        if (n.rest) continue;
        if (!n.slide) { ev.push({ t: n.t0, type: 'note', midi: n.midi, dur: n.t1 - n.t0 }); continue; }
        const path = [];
        let j = i;
        for (; notes[j].slide; j++) {
          const a = notes[j], hold = (a.t1 - a.t0) * 0.35;
          path.push([a.t0 - n.t0, a.midi], [a.t0 - n.t0 + hold, a.midi]);
        }
        path.push([notes[j].t0 - n.t0, notes[j].midi], [notes[j].t1 - n.t0, notes[j].midi]);
        ev.push({ t: n.t0, type: 'glide', path, dur: notes[j].t1 - n.t0 });
        i = j;
      }
      segs.push({ ch: ci, type: 'key', t0: t, sing, end, root, ex, notes });
      t = end;
    }
    t += 1.2;
  }
  // A gentle closing chord to say it's done.
  const end = 48 + VOICES[voice].shift;
  ev.push({ t: t + 0.2, type: 'swell', notes: [end, end + 7, end + 12, end + 16], dur: 3.5, fade: true });
  t += 5;
  return { events: ev, chapters, segs, total: t, range };
}

// ---------- Rendering: synthesises the timeline into a WAV file ----------

const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

// The warm synth: one cycle of a mellow, rounded wave (a few soft harmonics), played by two slightly
// detuned copies for a gentle chorus. Read from a table so rendering stays fast on a phone.
const TABLE = (() => {
  const n = 2048, t = new Float32Array(n + 1);
  for (let i = 0; i <= n; i++) {
    let v = 0;
    for (let k = 1; k <= 7; k++) v += Math.sin(2 * Math.PI * k * i / n) / Math.pow(k, 1.9);
    t[i] = v * 0.8;
  }
  return t;
})();
const wave = (ph) => { const x = (ph - Math.floor(ph)) * 2048, i = x | 0; return TABLE[i] + (TABLE[i + 1] - TABLE[i]) * (x - i); };

// pitch(tt) gives the MIDI note at time tt (constant for notes, sliding for glides).
function addSynth(buf, t0, dur, pitch, vol, attack, release) {
  const s0 = Math.round(t0 * SR), n = Math.round((dur + release) * SR);
  let p1 = 0, p2 = 0.37;
  for (let i = 0; i < n && s0 + i < buf.length; i++) {
    const tt = i / SR, f = midiHz(pitch(tt));
    p1 += f * 1.0029 / SR;  // +5 cents
    p2 += f * 0.9971 / SR;  // -5 cents
    let env = Math.min(1, tt / attack) * (0.8 + 0.2 * Math.exp(-tt * 1.5));
    if (tt > dur) env *= Math.max(0, 1 - (tt - dur) / release);
    buf[s0 + i] += (wave(p1) + wave(p2)) * 0.5 * env * vol;
  }
}

function addNote(buf, t0, midi, dur, vol) { addSynth(buf, t0, dur, () => midi, vol, 0.03, 0.3); }

function addGlide(buf, t0, path, dur, vol) {
  // Pitch slides smoothly along the path (for sirens and slides).
  let seg = 0;
  addSynth(buf, t0, dur, (tt) => {
    while (seg < path.length - 2 && tt > path[seg + 1][0]) seg++;
    const [ta, ma] = path[seg], [tb, mb] = path[Math.min(seg + 1, path.length - 1)];
    const x = tb > ta ? Math.min(1, Math.max(0, (tt - ta) / (tb - ta))) : 1;
    return ma + (mb - ma) * (0.5 - 0.5 * Math.cos(Math.PI * x));
  }, vol, 0.06, 0.3);
}

function addSwell(buf, t0, notes, dur, vol, fade) {
  // A soft chord that slowly grows (breathe in), or fades away at the very end.
  notes.forEach((m) => addSynth(buf, t0, dur, () => m, vol, fade ? 0.4 : dur * 0.85, fade ? 2.5 : 0.5));
}

function addChime(buf, t0) {
  // Two soft bell notes that mark the start of each exercise.
  [[76, 0], [83, 0.18]].forEach(([m, d]) => {
    const f = midiHz(m), s0 = Math.round((t0 + d) * SR), n = Math.round(1.6 * SR);
    for (let i = 0; i < n && s0 + i < buf.length; i++) {
      const tt = i / SR;
      const v = Math.sin(2 * Math.PI * f * tt) + 0.25 * Math.sin(2 * Math.PI * f * 2.01 * tt) * Math.exp(-tt * 4);
      buf[s0 + i] += v * Math.min(1, tt / 0.004) * Math.exp(-tt * 3) * 0.12;
    }
  });
}

function addTick(buf, t0, hi) {
  const f = hi ? 1320 : 880, s0 = Math.round(t0 * SR), n = Math.round(0.06 * SR);
  for (let i = 0; i < n && s0 + i < buf.length; i++) {
    const tt = i / SR;
    buf[s0 + i] += Math.sin(2 * Math.PI * f * tt) * Math.exp(-tt * 70) * (hi ? 0.3 : 0.2);
  }
}

function addClick(buf, t0, down) {
  // Metronome: a short, soft woodblock-like click; the first beat of each bar is a little higher.
  const f = down ? 1700 : 1250, s0 = Math.round(t0 * SR), n = Math.round(0.035 * SR);
  for (let i = 0; i < n && s0 + i < buf.length; i++) {
    const tt = i / SR;
    buf[s0 + i] += Math.sin(2 * Math.PI * f * tt) * Math.exp(-tt * 120) * (down ? 0.22 : 0.15);
  }
}

function render(p) {
  const buf = new Float32Array(Math.ceil(p.total * SR));
  for (const e of p.events) {
    if (e.type === 'tick') addTick(buf, e.t, e.hi);
    else if (e.type === 'click') addClick(buf, e.t, e.down);
    else if (e.type === 'chime') addChime(buf, e.t);
    else if (e.type === 'note') addNote(buf, e.t, e.midi, e.dur, 0.22);
    else if (e.type === 'chord') e.notes.forEach((m) => addNote(buf, e.t, m, e.dur, 0.09));
    else if (e.type === 'glide') addGlide(buf, e.t, e.path, e.dur, 0.2);
    else if (e.type === 'swell') addSwell(buf, e.t, e.notes, e.dur, 0.07, e.fade);
  }
  return wav(buf);
}

function wav(buf) {
  const out = new DataView(new ArrayBuffer(44 + buf.length * 2));
  const str = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); out.setUint32(4, 36 + buf.length * 2, true); str(8, 'WAVE');
  str(12, 'fmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 1, true);
  out.setUint32(24, SR, true); out.setUint32(28, SR * 2, true); out.setUint16(32, 2, true); out.setUint16(34, 16, true);
  str(36, 'data'); out.setUint32(40, buf.length * 2, true);
  let peak = 0;
  for (let i = 0; i < buf.length; i++) peak = Math.max(peak, Math.abs(buf[i]));
  const g = peak > 0.95 ? 0.95 / peak : 1;
  for (let i = 0; i < buf.length; i++) out.setInt16(44 + i * 2, Math.max(-1, Math.min(1, buf[i] * g)) * 32767, true);
  return new Blob([out.buffer], { type: 'audio/wav' });
}

// ---------- Player ----------

const audio = $('audio');
const fmt = (s) => { s = Math.max(0, Math.floor(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
let current = -1;

function chapterAt(time) {
  const ch = state.plan.chapters;
  let i = 0;
  while (i < ch.length - 1 && time >= ch[i + 1].start) i++;
  return i;
}

function prepare() {
  audio.pause();
  $('play').disabled = true;
  $('play-label').textContent = 'Preparing…';
  // Let the "Preparing…" label paint before the (brief) heavy work.
  setTimeout(() => {
    state.plan = plan(state.voice, state.length, state.click);
    const blob = render(state.plan);
    if (state.url) URL.revokeObjectURL(state.url);
    state.url = URL.createObjectURL(blob);
    audio.src = state.url;
    audio.load();
    current = -1;
    shown = null;
    renderList();
    updateLengths();
    $('play').disabled = false;
    tick();
  }, 30);
}

function updateLengths() {
  const p = state.plan;
  $('summary').textContent = `${VOICES[state.voice].name} range ${midiName(p.range[0])}–${midiName(p.range[1])} · about ${Math.round(p.total / 60)} min${state.click ? ' · metronome on' : ''}`;
}

function renderList() {
  const ol = $('list');
  ol.innerHTML = '';
  state.plan.chapters.forEach((ch, i) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ex';
    b.dataset.i = i;
    b.innerHTML = `<span class="ex-time"></span><span class="ex-text"><b></b><small></small></span>`;
    b.querySelector('.ex-time').textContent = fmt(ch.start);
    b.querySelector('b').textContent = ch.name;
    const small = b.querySelector('small'), keep = document.createElement('span');
    keep.className = 'nowrap';
    keep.textContent = ch.detail;
    small.append(`${ch.what} · `, keep);
    b.addEventListener('click', () => jump(i, true));
    li.append(b);
    ol.append(li);
  });
}

function jump(i, play) {
  const ch = state.plan.chapters;
  i = Math.max(0, Math.min(ch.length - 1, i));
  audio.currentTime = ch[i].start;
  if (play) audio.play();
  tick();
}

function tick() {
  if (!state.plan) return;
  const time = audio.currentTime || 0, total = state.plan.total;
  $('time').textContent = `${fmt(time)} / ${fmt(total)}`;
  $('seek').max = total;
  if (!$('seek').matches(':active')) $('seek').value = time;
  const i = chapterAt(time);
  if (i !== current) {
    current = i;
    const ch = state.plan.chapters[i];
    $('now').textContent = ch.name;
    $('now-how').textContent = ch.how;
    document.querySelectorAll('.ex').forEach((b) => b.setAttribute('aria-current', b.dataset.i == i ? 'step' : 'false'));
    setMeta(ch);
  }
  const playing = !audio.paused;
  $('play').setAttribute('aria-label', playing ? 'Pause' : 'Play');
  $('play-icon').innerHTML = playing ? '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>'
    : '<path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/>';
  $('play-label').textContent = playing ? 'Pause' : (time > 0.5 && time < total - 0.5 ? 'Resume' : 'Start');
  document.querySelectorAll('[data-voice], [data-length], [data-click]').forEach((b) => { b.disabled = playing; });
  if (playing) startLoop();
  updateScore();
  $('settings-note').hidden = !playing;
}

// ---------- Notation: the current key's pattern, drawn with VexFlow like Page Fright's Read section ----------

const VF = window.Vex && Vex.Flow;
const LETTERS = ['c', 'd', 'e', 'f', 'g', 'a', 'b'];
const NATURAL = [0, 2, 4, 5, 7, 9, 11];
const KEY_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const DEGREE = { 0: 0, 2: 1, 4: 2, 5: 3, 7: 4, 9: 5, 11: 6, 12: 7 };
const VF_DUR = { 4: 'w', 3: 'hd', 2: 'h', 1.5: 'qd', 1: 'q', 0.5: '8' };
const scoreEl = $('score');
let shown = null, noteEls = [], litNote = -1, lastWidth = 0;

// Spells a scale degree in the key's own letters (so D major gets F#, not Gb). Tenor is written an octave up.
function spell(root, semi) {
  const written = root + semi + (state.voice === 'tenor' ? 12 : 0);
  const li = (LETTERS.indexOf(KEY_NAMES[root % 12][0].toLowerCase()) + DEGREE[semi]) % 7;
  let oct = Math.floor(written / 12) - 1, nat = (oct + 1) * 12 + NATURAL[li];
  if (nat - written > 6) { oct--; nat -= 12; } else if (written - nat > 6) { oct++; nat += 12; }
  return `${LETTERS[li]}${{ '-2': 'bb', '-1': 'b', 0: '', 1: '#', 2: '##' }[written - nat]}/${oct}`;
}

function drawKey(seg) {
  const W = scoreEl.clientWidth;
  lastWidth = W;
  scoreEl.replaceChildren();
  noteEls = []; litNote = -1;
  if (!VF || W <= 0) return;
  const ex = seg.ex, clef = VOICES[state.voice].clef === 'bass' ? 'bass' : 'treble';
  const key = KEY_NAMES[seg.root % 12];

  // Split the pattern into bars.
  const bars = [[]];
  let inBar = 0;
  for (const n of seg.notes) {
    if (inBar >= ex.bar) { bars.push([]); inBar = 0; }
    bars[bars.length - 1].push(n);
    inBar += n.beats;
  }
  const startX = (st) => st.getNoteStartX() - st.getX();
  const head = (st) => { st.addClef(clef, 'default', clef === 'treble' ? '8vb' : undefined).addKeySignature(key).addTimeSignature(`${ex.bar}/4`); return st; };
  const extra = startX(head(new VF.Stave(0, 0, 300))) - startX(new VF.Stave(0, 0, 300));
  // Room each bar needs; the whole score shrinks a little if the screen is narrower than that.
  const weight = bars.map((b) => 28 + b.reduce((w, n) => w + (n.rest ? 24 : Array.isArray(ex.lyric) ? 46 : 26), 0));
  const total = weight.reduce((a, b) => a + b, 0);
  const scale = Math.min(W >= 480 ? 1.15 : 1, W / (extra + total + 8));
  const lw = W / scale - 4, H = 140;
  const r = new VF.Renderer(scoreEl, VF.Renderer.Backends.SVG);
  r.resize(W, H);
  const ctx = r.getContext();
  ctx.scale(scale, scale);
  let x = 2;
  const vfNotes = [];
  let sungIndex = 0;
  bars.forEach((bar, bi) => {
    const w = (lw - extra) * weight[bi] / total + (bi === 0 ? extra : 0);
    const st = new VF.Stave(x, 4, w, { space_above_staff_ln: 3.5 });
    if (bi === 0) head(st);
    if (bi === bars.length - 1) st.setEndBarType(VF.Barline.type.END);
    st.setContext(ctx).draw();
    const notes = bar.map((n) => {
      const d = VF_DUR[n.beats];
      const sn = n.rest
        ? new VF.StaveNote({ clef, keys: [clef === 'bass' ? 'd/3' : 'b/4'], duration: d + 'r' })
        : new VF.StaveNote({ clef, keys: [spell(seg.root, n.semi)], duration: d, auto_stem: true });
      if (d.endsWith('d')) VF.Dot.buildAndAttach([sn], { all: true });
      if (!n.rest) {
        const word = Array.isArray(ex.lyric) ? ex.lyric[sungIndex] : (sungIndex === 0 ? ex.lyric : null);
        if (word) {
          const a = new VF.Annotation(word).setVerticalJustification(VF.Annotation.VerticalJustify.BOTTOM);
          a.setFont('Atkinson Hyperlegible, sans-serif', 12);
          sn.addModifier(a, 0);
        }
        sungIndex++;
      }
      vfNotes.push({ sn, n });
      return sn;
    });
    const beams = VF.Beam.generateBeams(notes, { groups: [new VF.Fraction(1, 4)] });
    const voice = new VF.Voice({ num_beats: ex.bar, beat_value: 4 }).addTickables(notes);
    VF.Accidental.applyAccidentals([voice], key);
    new VF.Formatter().joinVoices([voice]).format([voice], st.getNoteEndX() - st.getNoteStartX() - 10);
    voice.draw(ctx, st);
    beams.forEach((b) => b.setContext(ctx).draw());
    x += w;
  });
  // Slides: a straight line from one note head to the next (a glissando).
  vfNotes.forEach(({ sn, n }, i) => {
    const next = vfNotes[i + 1];
    if (!n.slide || !next) return;
    const x1 = sn.getAbsoluteX() + sn.getGlyphWidth() + 4, y1 = sn.getYs()[0];
    const x2 = next.sn.getAbsoluteX() - 4, y2 = next.sn.getYs()[0];
    ctx.save(); ctx.setLineWidth(1.6);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.restore();
  });
  noteEls = [...scoreEl.querySelectorAll('.vf-stavenote')];
}

function drawBreath(seg) {
  scoreEl.replaceChildren();
  noteEls = []; litNote = -1;
  const box = document.createElement('div');
  box.className = 'breath';
  const row = (label, n) => {
    const d = document.createElement('div');
    d.className = 'breath-row';
    const b = document.createElement('b');
    b.textContent = label;
    d.append(b);
    for (let i = 1; i <= n; i++) { const c = document.createElement('span'); c.textContent = i; d.append(c); noteEls.push(c); }
    return d;
  };
  box.append(row('In', 4), row('Hiss', seg.count));
  scoreEl.append(box);
}

function segAt(time) {
  const segs = state.plan.segs, ci = chapterAt(time);
  let found = null;
  for (const sg of segs) { if (sg.t0 <= time) found = sg; else break; }
  // In the gap before an exercise's first key, show what's coming.
  if (!found || found.ch !== ci) found = segs.find((sg) => sg.ch === ci) || null;
  return found;
}

function updateScore(force) {
  if (!state.plan) return;
  const time = audio.currentTime || 0, seg = segAt(time);
  if (!seg) { scoreEl.replaceChildren(); shown = null; $('score-cap').textContent = ''; return; }
  if (seg !== shown || force) {
    shown = seg;
    if (seg.type === 'key') {
      drawKey(seg);
      const name = KEY_NAMES[seg.root % 12].replace('b', '♭').replace('#', '♯');
      $('score-cap').textContent = `${name} major · ♩ = ${seg.ex.bpm}`;
    } else {
      drawBreath(seg);
      $('score-cap').textContent = 'One count per second';
    }
  }
  // Which note (or breath count) is sounding now.
  let lit = -1;
  if (seg.type === 'key') {
    lit = seg.notes.findIndex((n) => !n.rest && time >= n.t0 && time < n.t1);
  } else if (time >= seg.t0) {
    const s = time - seg.t0;
    if (s < 4) lit = Math.floor(s);
    else if (s < 4 + seg.count) lit = 4 + Math.floor(s - 4);
  }
  if (lit !== litNote) {
    noteEls[litNote]?.classList.remove('on');
    noteEls[lit]?.classList.add('on');
    litNote = lit;
  }
}

let raf = 0;
function loop() {
  updateScore();
  raf = !audio.paused && document.visibilityState === 'visible' ? requestAnimationFrame(loop) : 0;
}
function startLoop() { if (!raf) raf = requestAnimationFrame(loop); }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && !audio.paused) startLoop(); });
new ResizeObserver(() => { if (shown && scoreEl.clientWidth !== lastWidth) updateScore(true); }).observe(scoreEl);

function setMeta(ch) {
  if (!('mediaSession' in navigator)) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: ch.name,
    artist: ch.what,
    album: `Lip Service · ${VOICES[state.voice].name}`,
    artwork: [{ src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }],
  });
}

if ('mediaSession' in navigator) {
  const ms = navigator.mediaSession;
  const set = (a, fn) => { try { ms.setActionHandler(a, fn); } catch {} };
  set('play', () => audio.play());
  set('pause', () => audio.pause());
  // Car / headphone skip buttons move between exercises. Skipping back restarts the current one first.
  set('nexttrack', () => jump(current + 1, !audio.paused));
  set('previoustrack', () => {
    const ch = state.plan.chapters[current];
    jump(audio.currentTime - ch.start > 4 ? current : current - 1, !audio.paused);
  });
  set('seekto', (d) => { audio.currentTime = d.seekTime; tick(); });
}

$('play').addEventListener('click', () => {
  if (audio.paused) {
    if (audio.currentTime >= state.plan.total - 0.5) audio.currentTime = 0;
    audio.play();
  } else audio.pause();
});
$('prev').addEventListener('click', () => {
  const ch = state.plan.chapters[current];
  jump(audio.currentTime - ch.start > 4 ? current : current - 1, !audio.paused);
});
$('next').addEventListener('click', () => jump(current + 1, !audio.paused));
$('seek').addEventListener('input', (e) => { audio.currentTime = Number(e.target.value); tick(); });
['play', 'pause', 'timeupdate', 'seeked', 'loadedmetadata'].forEach((e) => audio.addEventListener(e, tick));
audio.addEventListener('ended', () => { audio.currentTime = 0; tick(); });

function markSeg() {
  document.querySelectorAll('[data-voice]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.voice === state.voice));
  document.querySelectorAll('[data-length]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.length === state.length));
  document.querySelectorAll('[data-click]').forEach((b) => b.setAttribute('aria-pressed', state.click));
}
document.querySelectorAll('[data-click]').forEach((b) => b.addEventListener('click', () => {
  state.click = !state.click; store.set('click', state.click ? 'on' : 'off'); markSeg(); prepare();
}));
document.querySelectorAll('[data-voice]').forEach((b) => b.addEventListener('click', () => {
  if (state.voice === b.dataset.voice) return;
  state.voice = b.dataset.voice; store.set('voice', state.voice); markSeg(); prepare();
}));
document.querySelectorAll('[data-length]').forEach((b) => b.addEventListener('click', () => {
  if (state.length === b.dataset.length) return;
  state.length = b.dataset.length; store.set('length', state.length); markSeg(); prepare();
}));

markSeg();
prepare();
