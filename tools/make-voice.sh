#!/bin/bash
# Records the spoken instructions into ../voice/*.m4a with the Mac's built-in "Samantha" voice.
# Run after changing any wording below: tools/make-voice.sh  (then bump the version).
cd "$(dirname "$0")/../voice"
VOICE="Samantha"
RATE=175

clip() {
  say -v "$VOICE" -r $RATE -o "/tmp/vw-$1.aiff" "$2"
  afconvert -f m4af -d aac -b 64000 -c 1 "/tmp/vw-$1.aiff" "$1.m4a"
  rm "/tmp/vw-$1.aiff"
  echo "wrote $1.m4a"
}

clip intro   "Let's warm up. Everything here is gentle. If something starts to feel like work, back off and hum it instead."
clip breath  "Breathing. Breathe in low and slow for four counts, then hiss out on a long S until the count ends. Keep your shoulders loose."
clip in      "Breathe in."
clip hiss    "Hiss."
clip relax   "Good. Relax."
clip hum     "Humming. Lips closed, teeth apart, and hum on M. Follow the notes down, and feel the buzz on your lips."
clip trill   "Lip trills. Loose lips, and blow through them like a motorboat. Five notes up, and back down. If your lips won't buzz, hum it instead."
clip siren   "Lip trill sirens. Keep the trill going, and slide smoothly up to the top note and back down. Easy at the top. Don't push."
clip sigh    "Sighs. On a breathy hoo, start up high and slide gently down, like a big sigh of relief."
clip ng      "N.G. slides. Sing the sound at the end of the word, sing. Then glide up and back down. Keep it light."
clip vowels  "Vowels. Sing mee, may, mah, moh, moo, one vowel per note, going down. Keep the same easy buzz you had in the hum."
clip yah     "Yah arpeggios. Sing yah on each note, up and back down. Let your jaw hang loose."
clip outro   "That's the warm-up. Sip some water, and have a great gig."
