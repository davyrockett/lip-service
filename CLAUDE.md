<!-- shared-preferences:start -->
## David's preferences (shared across all of David's apps)

This section is the same in every one of David's app repos. If David states a new general preference
(not specific to this app), add it here, in this file, and commit it. David's Mac copies it to the other repos.

**Who David is.** A guitar teacher and gigging guitarist (he/him) who builds personal and teaching apps with Claude.
Comfortable with tech but not a programmer: explain in plain words, skip jargon, keep replies short and
concrete. Likes to see things working: verify before saying "done".

**How the apps are built and hosted**
- Public web apps on GitHub Pages under the **davyrockett** GitHub account (never an Artifact or a hosted
  service). Live at `https://davyrockett.github.io/<repo>/`.
- Each app: `index.html` (+ `app.js` / `styles.css` when bigger), `sw.js` service worker for offline use
  with an update banner, `manifest.webmanifest`, `icons/` drawn by `tools/make-icons.py`, a
  `Start <App>.command` for local testing on the Mac, and a README written for David.
- **`move.js`** (since 2026-10-17): every app loads `move.js` as its first script and lists it in `sw.js`
  `ASSETS`. It carries the app's settings over when the apps move from davyrockett.github.io to
  davyrockett.com (plan: `Claude Apps/move-to-davyrockett-com.md`; master copy `Claude Apps/tools/move.js`).
  Keep it; a new app gets a copy with `data-keep` set to its own localStorage key prefix.
- **Every change must bump the version** (`tools/bump.sh` where it exists, otherwise `VERSION` in `sw.js`
  and the matching app version). Without it, installed copies on phones never update.
- Settings (gear icon) always has **Appearance: Light / Dark / Auto** and **Check for updates**.
  Apps open in **Light** unless changed in Settings.
- Design follows David's First Frets app: warm off-white / dark-brown palette, bright orange accent (#F57C14; dark mode #FF9433; David tried his logo orange #E27039, too red) and
  davyrockett grey secondary text (#676767; dark mode #A3A3A3),
  Big Shoulders Display headings, Atkinson Hyperlegible body text, works well on a phone.
- Data lives on the device (localStorage / IndexedDB). Apps whose data must sync between phone and Mac
  use a separate `davyrockett/<app>-data` repo (`data.json`) and an access key pasted into Settings.
  Never commit keys, tokens or anything in `private/`.
- **Publish when done:** commit, push to `main`, and confirm the live site shows the new version.
  End with a brief summary of what changed. David's Mac pulls GitHub changes into its Dropbox copy
  automatically, so pushing is all that's needed.

**Taste**
- Labels and descriptions plain and descriptive. Jokes belong in names (e.g. "Page Fright"), not taglines.
- Keep screens uncluttered: show extra controls only when they're relevant.
- Nothing should jump around: when a control doesn't apply, grey it out in place rather than hiding it, and
  reserve space for things that appear, so other controls never shift.
- **No AI voices, ever:** no text-to-speech or synthesised singing in any app. Use written instructions on
  screen, and instrument or synth sounds for audio.
- Commit messages: a short, plain description of the change.
- When renaming or moving an app, keep the old address working with a redirect repo.

**New apps:** create the repo under davyrockett and turn on GitHub Pages; David's Mac downloads new
davyrockett repos into `~/Dropbox/Local/Claude Apps/` automatically. Give each new app its own CLAUDE.md
with this section (copy it from any other app) plus an "## This app" section.
<!-- shared-preferences:end -->

## This app

**Lip Service**: a gentle vocal warm-up David plays in the car on the way to gigs (Bluetooth / CarPlay audio).
Repo `lip-service` (renamed from `vocal-warmup` on 2026-10-14; the `vocal-warmup` repo now only redirects here). Live: https://davyrockett.github.io/lip-service/ See README.md for features.

- **How it works:** `app.js` renders the whole routine (warm-synth guide notes, chimes, breathing ticks) into
  one WAV track in the browser, played by an `<audio>` element. That's what keeps it playing with the phone locked
  and shows it in CarPlay's Now Playing. Media Session next/previous jump between exercises (chapters).
  Don't switch to live Web Audio playback: iOS stops that when the screen locks.
- **Exercises** live in the `EXERCISES` list in `app.js`, on a beat grid: `bpm`, `bar` (beats per bar),
  notes as [semitones above the key, beats, slide-into-next?], `lyric`. Everything is 4/4 with no chord cue between keys
  (David wants the momentum kept); each pattern is padded to whole bars and a count-in bar starts each exercise. `plan()` also returns `segs` (one per key / breath round) that drive the notation.
- **Notation:** VexFlow (`vendor/`, same copy as Page Fright) draws the current key's pattern; the sounding note
  gets `.on` (orange), like Page Fright's Read section. Baritone = bass clef, tenor = treble 8vb, alto/soprano = treble.
- **Metronome** option re-renders the track with clicks on every beat (downbeat higher).
- **Breathing** is on the same grid (♩ = 60, 4/4): bar in, hiss bars (tied whole notes), rest bar; drawn on a
  percussion clef with a beat counter in the caption. Hiss counts must be multiples of 4.
  Baritone starts from the listed `root`; the others are shifted up by `VOICES[...].shift` (tenor 3, alto 10, soprano 15). `extra` adds keys to every exercise
  (tenor climbs 3 more, David asked for tenor to go higher). A note with pitch `null` is a rest. `restBars` adds whole bars
  of rest after each key (played and counted, not drawn). Keep everything gentle.
- **No voice, ever** (David's rule): no spoken or sung audio. Instructions are written (`how` on each exercise,
  shown in the player card); the audio is only synth tones. A chime marks each new exercise.
- The voice and length switches copy Page Fright's Read | Improv pill switch (`.views`).
- **Publish:** run `tools/bump.sh` (bumps `sw.js` and index.html together), commit, push, confirm live.
- **Test locally:** `Start Lip Service.command`, or `python3 -m http.server 8772` here and open http://localhost:8772/.
