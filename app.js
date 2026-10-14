// Lip Service: builds the whole warm-up as one audio track (spoken instructions + piano guide notes),
// so it keeps playing with the phone locked and shows up in CarPlay / the lock screen as "Now Playing".
// The car's skip buttons jump between exercises.

const SR = 24000;          // sample rate of the rendered track (plenty for voice and piano)
const BEAT = 0.42;         // seconds per beat for the guide notes
const $ = (id) => document.getElementById(id);

// Lowest starting note (MIDI number) for baritone; tenor starts 3 semitones higher.
const VOICES = { baritone: { name: 'Baritone', shift: 0 }, tenor: { name: 'Tenor', shift: 3 } };
const LENGTHS = { short: 'Short', full: 'Full' };

// Each exercise: notes are [semitones above the key's root, beats]; glides are a start note then [target, beats] slides.
// keys = how many keys it climbs by half steps; Full also comes back down a few keys at the end.
const EXERCISES = [
  { id: 'breath', name: 'Breathing', what: 'In for 4, hiss out for the count', breath: { short: [8, 10], full: [8, 10, 12] } },
  { id: 'hum', name: 'Humming', what: 'Hum on “mm”, 5 notes down', root: 45,
    notes: [[7, 1], [5, 1], [4, 1], [2, 1], [0, 2.5]], keys: { short: 6, full: 8 } },
  { id: 'trill', name: 'Lip trills', what: '5 notes up and back down', root: 43,
    notes: [[0, .75], [2, .75], [4, .75], [5, .75], [7, .75], [5, .75], [4, .75], [2, .75], [0, 2]], keys: { short: 8, full: 12 } },
  { id: 'siren', name: 'Lip trill sirens', what: 'Slide up an octave and back', root: 45,
    glide: [0, [12, 3], [12, .5], [0, 3]], keys: { short: 5, full: 8 } },
  { id: 'sigh', name: 'Sighs', what: 'Breathy “hoo”, slide down an octave', root: 43,
    glide: [12, [12, .3], [0, 3.5]], keys: { short: 4, full: 6 } },
  { id: 'ng', name: 'NG slides', what: '“Sing” the ng, slide up a fifth and back', root: 45, full: true,
    glide: [0, [7, 2], [7, .5], [0, 2]], keys: { full: 8 } },
  { id: 'vowels', name: 'Vowels', what: 'Mee may mah moh moo, 5 notes down', root: 45,
    notes: [[7, 1], [5, 1], [4, 1], [2, 1], [0, 2.5]], keys: { short: 6, full: 9 } },
  { id: 'yah', name: 'Yah arpeggios', what: '“Yah” on 1-3-5-3-1', root: 45, full: true,
    notes: [[0, 1], [4, 1], [7, 1], [4, 1], [0, 2.5]], keys: { full: 9 } },
];

const CLIP_NAMES = ['intro', 'breath', 'in', 'hiss', 'relax', 'hum', 'trill', 'siren', 'sigh', 'ng', 'vowels', 'yah', 'outro'];
const clips = {};

const store = {
  get(k, d) { try { return localStorage.getItem('vw.' + k) || d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('vw.' + k, v); } catch {} },
};
const state = { voice: store.get('voice', 'baritone'), length: store.get('length', 'full'), plan: null, url: null };
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

function plan(voice, length) {
  const ev = [];   // { t, type, ... }
  const chapters = [];
  const range = [127, 0];
  let t = 0.3;
  const say = (name) => { ev.push({ t, type: 'clip', name }); t += clips[name].duration; };

  for (const ex of EXERCISES) {
    if (ex.full && length !== 'full') continue;
    const ch = { id: ex.id, name: ex.name, what: ex.what, start: Math.max(0, t - 0.3) };
    chapters.push(ch);
    if (chapters.length === 1) { say('intro'); t += 1.2; }
    say(ex.id);
    t += 1.0;

    if (ex.breath) {
      const rounds = ex.breath[length];
      ch.detail = rounds.length + ' rounds';
      for (const count of rounds) {
        say('in');
        t += 0.15;
        for (let i = 0; i < 4; i++) ev.push({ t: t + i, type: 'tick', hi: false });
        t += 4;
        ev.push({ t, type: 'clip', name: 'hiss' });
        for (let i = 1; i <= count; i++) ev.push({ t: t + i, type: 'tick', hi: i === count });
        t += count + 2.5;
      }
      say('relax');
      t += 1.5;
      continue;
    }

    const roots = keyRoots(ex, voice, length);
    const lo = Math.min(...roots), hi = Math.max(...roots) + Math.max(...(ex.notes || [[ex.glide[0]], ...ex.glide.slice(1)]).map((n) => n[0]));
    ch.detail = `${roots.length} keys · ${midiName(lo)}–${midiName(hi)}`;
    range[0] = Math.min(range[0], lo); range[1] = Math.max(range[1], hi);
    for (const root of roots) {
      // Cue: the key's chord, then the pattern to sing along with.
      ev.push({ t, type: 'chord', notes: [root, root + 4, root + 7], dur: BEAT * 1.6 });
      t += BEAT * 2.2;
      if (ex.notes) {
        for (const [semi, beats] of ex.notes) {
          ev.push({ t, type: 'note', midi: root + semi, dur: beats * BEAT });
          t += beats * BEAT;
        }
      } else {
        const [first, ...moves] = ex.glide;
        const path = [[0, root + first]];
        let gt = 0.35;  // hold the first note briefly before sliding
        path.push([gt, root + first]);
        for (const [semi, beats] of moves) { gt += beats * BEAT; path.push([gt, root + semi]); }
        ev.push({ t, type: 'glide', path, dur: gt });
        t += gt;
      }
      t += BEAT * 2;  // breath before the next key
    }
    t += 1.2;
  }
  say('outro');
  t += 1.0;
  return { events: ev, chapters, total: t, range };
}

// ---------- Rendering: synthesises the timeline into a WAV file ----------

const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

function addNote(buf, t0, midi, dur, vol) {
  // A soft electric-piano tone: a few harmonics that fade, plus a quiet sustain so it's easy to sing with.
  const f = midiHz(midi), rel = 0.18;
  const s0 = Math.round(t0 * SR), n = Math.round((dur + rel) * SR);
  const parts = [[1, 1], [2, 0.42], [3, 0.18], [4, 0.08]];
  for (let i = 0; i < n && s0 + i < buf.length; i++) {
    const tt = i / SR;
    let env = Math.min(1, tt / 0.006) * (0.65 * Math.exp(-tt * 2.6) + 0.35);
    if (tt > dur) env *= Math.max(0, 1 - (tt - dur) / rel);
    let v = 0;
    for (const [k, a] of parts) v += a * Math.exp(-tt * k * 0.9) * Math.sin(2 * Math.PI * f * k * tt);
    buf[s0 + i] += v * env * vol;
  }
}

function addGlide(buf, t0, path, dur, vol) {
  // A smooth sustained tone whose pitch slides along the path (for sirens and slides).
  const s0 = Math.round(t0 * SR), n = Math.round((dur + 0.2) * SR);
  let phase = 0, seg = 0;
  for (let i = 0; i < n && s0 + i < buf.length; i++) {
    const tt = i / SR;
    while (seg < path.length - 2 && tt > path[seg + 1][0]) seg++;
    const [ta, ma] = path[seg], [tb, mb] = path[Math.min(seg + 1, path.length - 1)];
    const x = tb > ta ? Math.min(1, Math.max(0, (tt - ta) / (tb - ta))) : 1;
    const m = ma + (mb - ma) * (0.5 - 0.5 * Math.cos(Math.PI * x));
    phase += 2 * Math.PI * midiHz(m) / SR;
    let env = Math.min(1, tt / 0.06);
    if (tt > dur) env *= Math.max(0, 1 - (tt - dur) / 0.2);
    const v = Math.sin(phase) + 0.3 * Math.sin(2 * phase) + 0.12 * Math.sin(3 * phase);
    buf[s0 + i] += v * env * vol;
  }
}

function addTick(buf, t0, hi) {
  const f = hi ? 1320 : 880, s0 = Math.round(t0 * SR), n = Math.round(0.06 * SR);
  for (let i = 0; i < n && s0 + i < buf.length; i++) {
    const tt = i / SR;
    buf[s0 + i] += Math.sin(2 * Math.PI * f * tt) * Math.exp(-tt * 70) * (hi ? 0.3 : 0.2);
  }
}

function addClip(buf, t0, clip) {
  const data = clip.getChannelData(0), s0 = Math.round(t0 * SR);
  for (let i = 0; i < data.length && s0 + i < buf.length; i++) buf[s0 + i] += data[i] * 0.95;
}

function render(p) {
  const buf = new Float32Array(Math.ceil(p.total * SR));
  for (const e of p.events) {
    if (e.type === 'clip') addClip(buf, e.t, clips[e.name]);
    else if (e.type === 'tick') addTick(buf, e.t, e.hi);
    else if (e.type === 'note') addNote(buf, e.t, e.midi, e.dur, 0.2);
    else if (e.type === 'chord') e.notes.forEach((m) => addNote(buf, e.t, m, e.dur, 0.09));
    else if (e.type === 'glide') addGlide(buf, e.t, e.path, e.dur, 0.16);
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

async function loadClips() {
  const ctx = new OfflineAudioContext(1, 1, SR);
  await Promise.all(CLIP_NAMES.map(async (name) => {
    for (let attempt = 1; ; attempt++) {
      try {
        const res = await fetch(`voice/${name}.m4a`);
        if (!res.ok) throw new Error(res.status);
        clips[name] = await ctx.decodeAudioData(await res.arrayBuffer());
        return;
      } catch (err) {
        if (attempt >= 3) throw err;
        await new Promise((r) => setTimeout(r, 500 * attempt));
      }
    }
  }));
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
    state.plan = plan(state.voice, state.length);
    const blob = render(state.plan);
    if (state.url) URL.revokeObjectURL(state.url);
    state.url = URL.createObjectURL(blob);
    audio.src = state.url;
    audio.load();
    current = -1;
    renderList();
    updateLengths();
    $('play').disabled = false;
    tick();
  }, 30);
}

function updateLengths() {
  for (const len of Object.keys(LENGTHS)) {
    const mins = Math.round(plan(state.voice, len).total / 60);
    document.querySelector(`[data-length="${len}"] small`).textContent = `about ${mins} min`;
  }
  for (const v of Object.keys(VOICES)) {
    const r = plan(v, state.length).range;
    document.querySelector(`[data-voice="${v}"] small`).textContent = `${midiName(r[0])}–${midiName(r[1])}`;
  }
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
    document.querySelectorAll('.ex').forEach((b) => b.setAttribute('aria-current', b.dataset.i == i ? 'step' : 'false'));
    setMeta(ch);
  }
  const playing = !audio.paused;
  $('play').setAttribute('aria-label', playing ? 'Pause' : 'Play');
  $('play-icon').innerHTML = playing ? '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>'
    : '<path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/>';
  $('play-label').textContent = playing ? 'Pause' : (time > 0.5 && time < total - 0.5 ? 'Resume' : 'Start');
  document.querySelectorAll('.seg [data-voice], .seg [data-length]').forEach((b) => { b.disabled = playing; });
  $('settings-note').hidden = !playing;
}

function setMeta(ch) {
  if (!('mediaSession' in navigator)) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: ch.name,
    artist: 'Lip Service',
    album: `${VOICES[state.voice].name} warm-up`,
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
}
document.querySelectorAll('[data-voice]').forEach((b) => b.addEventListener('click', () => {
  if (state.voice === b.dataset.voice) return;
  state.voice = b.dataset.voice; store.set('voice', state.voice); markSeg(); prepare();
}));
document.querySelectorAll('[data-length]').forEach((b) => b.addEventListener('click', () => {
  if (state.length === b.dataset.length) return;
  state.length = b.dataset.length; store.set('length', state.length); markSeg(); prepare();
}));

markSeg();
loadClips().then(prepare).catch((err) => {
  console.error(err);
  $('play-label').textContent = 'Couldn’t load the voice clips';
});
