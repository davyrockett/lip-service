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
- Commit messages: a short, plain description of the change.
- When renaming or moving an app, keep the old address working with a redirect repo.

**New apps:** create the repo under davyrockett and turn on GitHub Pages; David's Mac downloads new
davyrockett repos into `~/Dropbox/Local/Claude Apps/` automatically. Give each new app its own CLAUDE.md
with this section (copy it from any other app) plus an "## This app" section.
<!-- shared-preferences:end -->

## This app

**Lip Service**: a gentle vocal warm-up David plays in the car on the way to gigs (Bluetooth / CarPlay audio).
Repo `vocal-warmup`. Live: https://davyrockett.github.io/vocal-warmup/ See README.md for features.

- **How it works:** `app.js` renders the whole routine (spoken instructions + synthesised piano guide notes) into
  one WAV track in the browser, played by an `<audio>` element. That's what keeps it playing with the phone locked
  and shows it in CarPlay's Now Playing. Media Session next/previous jump between exercises (chapters).
  Don't switch to live Web Audio playback: iOS stops that when the screen locks.
- **Exercises** live in the `EXERCISES` list in `app.js` (notes as [semitones above the key, beats], or glides).
  Baritone starts from the listed `root`; tenor is 3 semitones higher (`VOICES`). Keep everything gentle.
- **Spoken clips** are in `voice/*.m4a`, made with the Mac's Samantha voice by `tools/make-voice.sh` (Mac only).
  A new clip must also be added to `CLIP_NAMES` in `app.js` and to `ASSETS` in `sw.js`.
- **Publish:** run `tools/bump.sh` (bumps `sw.js` and index.html together), commit, push, confirm live.
- **Test locally:** `Start Lip Service.command`, or `python3 -m http.server 8772` here and open http://localhost:8772/.
