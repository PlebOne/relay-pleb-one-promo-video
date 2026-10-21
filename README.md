# relay.pleb.one promo video

A 93-second 1080p30 narrated promo for [relay.pleb.one](https://relay.pleb.one), done as a
90s movie-trailer parody. Output: `out/relay-pleb-one-promo.mp4`.

Narration is **David – Movie Trailer Narrator** (ElevenLabs voice library, `FF7KdobWPaiR0vkcALHF`,
`eleven_multilingual_v2`), recorded in one take from `tts/script.txt`. The ⟦markers⟧ in the
script are stripped before recording; ElevenLabs returns a timestamp for every character, so
each marker becomes a cue (`out/cues.json`) and the pictures, sound effects and burned-in
captions follow his words. "Nostr" is spelled `Noster` in the script so it's said right; the
captions show the written form. Samples of three other trailer voices are in `samples/`
(Don, Chuck Fresh, Stanley); swapping is one line in `tts/narrate.mjs` plus a new take.

The login and dashboard images are real screenshots of relay.pleb.one (`capture/`). The bot
feed, the giveaway post and the reply guys are fictional and drawn in HTML. The music is
original 80s synthwave synthesized in `audio.mjs` (arp, pads, gated snare, trailer BRAAMs),
ducked under the voice.

## Build

```bash
npm install
node tts/narrate.mjs            # -> tts/narration.mp3, tts/alignment.json, out/cues.json (~1,150 ElevenLabs characters)
node tts/narrate.mjs --cues     # rebuild cues and captions from the saved alignment, no API call
node audio.mjs                  # -> out/audio.wav: score + effects + narration, ducked
node render.mjs                 # -> out/video-silent.mp4 via headless Chromium
ffmpeg -y -i out/video-silent.mp4 -i out/audio.wav -c:v copy \
  -af "loudnorm=I=-14:TP=-1.5:LRA=11" -c:a aac -b:a 192k -ar 48000 -shortest \
  -movflags +faststart out/relay-pleb-one-promo.mp4
```

YouTube thumbnail: `node thumbnail.mjs` renders `thumbnail.html` to `out/thumbnail.png` (1280x720).

Preview frames: `node render.mjs --stills 12 30 52`, then `./sheet.sh out/sheet.png 12 30 52`.
`node audio.mjs --music` writes `out/music-only.wav` (same mix, no voice) for checking the balance.

The ElevenLabs API key is read from `~/.config/elevenlabs/api_key`. Adding or moving a
⟦marker⟧ is free (`--cues`) as long as the spoken words stay the same; changing a word means
a new take.

## Timeline (follows the narration)

| Cue | Scene |
|-----|-------|
| (cold open) | "A Pleb.one Production" over matrix rain |
| hook | IN A WORLD... the feed floods with bots, reply guys pile on, "Satoshi Nakamoto Official Real" collects checkmarks |
| one / ask | The feed goes dark, a lone relay, bots close in; record scratch; WAIT. WHO INVITED YOU? and the bots get bounced |
| title | THIS FALL; the ⚡ relay.pleb.one logo; "The community Nostr relay" |
| rust | The relay's start-up terminal (Rust: axum, tokio, sqlx); Lightning fast, Censorship-resistant, No trackers |
| hack | HACK THE PLANET (Hackers, 1995) with a "...but politely." sticky note |
| wot | Its secret weapon? The Web of Trust graph; a bot is denied at the ring; a newcomer is vouched in; five invite tickets |
| strike | A 🥸 "totally a human" takes an invite and turns out to be a bot; SUSPENDED; three Family Feud strikes; three good months; 15 invites |
| login | The real login page: NIP-07 extension, NIP-46 remote signer; the key stays on the laptop; Unlike E.T., it does not phone home |
| dash | The real dashboard: control surface, live feed, NIP-05 (the callout cycles you@relay, id, me and nostr.pleb.one), invites |
| end | Logo, Quality > Quantity, Get an invite / Request Invite, then the WarGames terminal: SHALL WE PLAY A GAME? |

Fonts: Anton, Space Grotesk and Inter (Google Fonts, so rendering needs network) and
JetBrainsMono Nerd Font (local). Emoji come from the system emoji font.
