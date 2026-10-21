// Records the narration in one take with ElevenLabs and turns the ⟦cue⟧
// markers in tts/script.txt into timings the scene and the score follow.
//
//   node tts/narrate.mjs          -> tts/narration.mp3, tts/alignment.json, out/cues.json
//   node tts/narrate.mjs --cues   -> rebuild out/cues.json from the saved alignment (no API call)
//
// The API key is read from ~/.config/elevenlabs/api_key.
import fs from "node:fs";
import os from "node:os";

const VOICE = "FF7KdobWPaiR0vkcALHF"; // David - Movie Trailer Narrator (ElevenLabs voice library)
const MODEL = "eleven_multilingual_v2";
const LEAD_IN = 2.0; // seconds of the cold open before David's first word

const raw = fs.readFileSync("tts/script.txt", "utf8").trim();
// Strip markers, remembering where each one sat in the spoken text.
const marks = [];
let text = "";
for (const part of raw.split(/(⟦[a-z0-9]+⟧)/)) {
  const m = part.match(/^⟦([a-z0-9]+)⟧$/);
  if (m) marks.push({ id: m[1], at: text.length });
  else text += part;
}
text = text.replace(/\n\n/g, "\n\n");

if (!process.argv.includes("--cues")) {
  const key = fs.readFileSync(os.homedir() + "/.config/elevenlabs/api_key", "utf8").trim();
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}/with-timestamps?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({ text, model_id: MODEL, voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.5, use_speaker_boost: true } }),
  });
  if (!res.ok) { console.error("ElevenLabs", res.status, await res.text()); process.exit(1); }
  const data = await res.json();
  fs.writeFileSync("tts/narration.mp3", Buffer.from(data.audio_base64, "base64"));
  fs.writeFileSync("tts/alignment.json", JSON.stringify({ text, alignment: data.alignment }, null, 1));
  console.log("characters", text.length);
}

const { alignment } = JSON.parse(fs.readFileSync("tts/alignment.json", "utf8"));
const starts = alignment.character_start_times_seconds, ends = alignment.character_end_times_seconds;
// A marker's time is the first non-space character at or after it.
const cues = { leadIn: LEAD_IN };
for (const { id, at } of marks) {
  let i = at;
  while (i < text.length - 1 && /\s/.test(text[i])) i++;
  cues[id] = +(starts[i] + LEAD_IN).toFixed(3);
}
// Captions: one sentence at a time, in written form (the script spells some
// words the way they should sound).
const WRITTEN = [[/Noster/g, "Nostr"], [/relay dot pleb dot one/gi, "relay.pleb.one"], [/pleb dot one/g, "pleb.one"]];
cues.captions = [];
const sentence = /(?:E\.T\.|[^.?!])+[.?!]+["”]?/g; // "E.T." is not a full stop
const pushCap = (a, b) => {
  let shown = text.slice(a, b + 1).trim();
  for (const [re, w] of WRITTEN) shown = shown.replace(re, w);
  cues.captions.push({ t0: +(starts[a] + LEAD_IN).toFixed(3), t1: +(ends[b] + LEAD_IN).toFixed(3), text: shown });
};
for (let m; (m = sentence.exec(text));) {
  let a = m.index, b = m.index + m[0].length - 1;
  while (/\s/.test(text[a])) a++;
  // Long sentences are split after commas and colons so a caption stays on one or two lines.
  while (b - a > 60) {
    let cut = -1;
    for (let i = a + 20; i < b - 8; i++) if (/[,:]/.test(text[i]) && text[i + 1] === " ") { cut = i; if (i - a > 34) break; }
    if (cut < 0) break;
    pushCap(a, cut);
    a = cut + 1; while (/\s/.test(text[a])) a++;
  }
  pushCap(a, b);
}
cues.speechEnd = +(ends[ends.length - 1] + LEAD_IN).toFixed(3);
cues.duration = +(cues.speechEnd + 4.0).toFixed(2);
fs.mkdirSync("out", { recursive: true });
fs.writeFileSync("out/cues.json", JSON.stringify(cues, null, 1));
console.log(Object.entries(cues).map(([k, v]) => `${k}=${v}`).join("  "));
