// The soundtrack: an original synthesized 80s synthwave score (arpeggios, pads,
// gated snare) with movie-trailer hits, plus sound effects on the narration's
// cues, with the music ducked under David's voice. -> out/audio.wav
import fs from "node:fs";
import { spawnSync } from "node:child_process";

const C = JSON.parse(fs.readFileSync("out/cues.json", "utf8"));
const SR = 48000, DUR = C.duration, N = Math.ceil(SR * DUR);
const ML = new Float32Array(N), MR = new Float32Array(N);   // music
const XL = new Float32Array(N), XR = new Float32Array(N);   // effects
const hz = m => 440 * Math.pow(2, (m - 69) / 12);
let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647 * 2 - 1;
let BUS = "m";
const put = (i, v, pan = 0) => { if (i >= 0 && i < N) { const L = BUS === "m" ? ML : XL, R = BUS === "m" ? MR : XR; L[i] += v * (.5 - pan * .4); R[i] += v * (.5 + pan * .4); } };

// ------------------------------------------------- shared voices & effects --
function kick(at, gain) {
  const i0 = Math.floor(at * SR); let ph = 0;
  for (let n = 0; n < SR * .3; n++) { const t = n / SR, f = 50 + 70 * Math.exp(-t * 35); ph += 6.2832 * f / SR; put(i0 + n, Math.sin(ph) * Math.exp(-t * 11) * gain); }
}
function crash(at, gain) {
  const i0 = Math.floor(at * SR); let hp = 0, last = 0;
  for (let n = 0; n < SR * 2.6; n++) { const t = n / SR, x = rnd(); hp = .85 * (hp + x - last); last = x; put(i0 + n, hp * Math.exp(-t * 1.6) * Math.min(1, t * 800) * gain, .2); }
}
function pop(at, gain, pan = 0) {
  const i0 = Math.floor(at * SR); let ph = 0;
  for (let n = 0; n < SR * .09; n++) { const t = n / SR; ph += 6.2832 * (700 + 900 * Math.exp(-t * 40)) / SR; put(i0 + n, Math.sin(ph) * Math.exp(-t * 45) * gain, pan); }
}
function keyclick(at, gain, pan = 0) {
  const i0 = Math.floor(at * SR); let lp = 0;
  for (let n = 0; n < SR * .04; n++) { const t = n / SR; lp += (rnd() - lp) * .6; put(i0 + n, (lp * .8 + Math.sin(6.2832 * 2100 * t) * .25) * Math.exp(-t * 200) * gain, pan); }
}
function thock(at, gain) { // a big keycap
  const i0 = Math.floor(at * SR); let lp = 0, ph = 0;
  for (let n = 0; n < SR * .1; n++) { const t = n / SR; lp += (rnd() - lp) * .4; ph += 6.2832 * 320 / SR; put(i0 + n, (Math.sin(ph) * .8 + lp) * Math.exp(-t * 70) * gain); }
}
function chime(at, gain) { // the notification
  for (const [dt, m] of [[0, 84], [.13, 91]]) {
    const i0 = Math.floor((at + dt) * SR), f = hz(m);
    for (let n = 0; n < SR * 1.4; n++) { const t = n / SR; put(i0 + n, (Math.sin(6.2832 * f * t) + .3 * Math.sin(6.2832 * f * 2.76 * t) * Math.exp(-t * 5)) * Math.exp(-t * 3) * Math.min(1, t * 900) * gain, .45); }
  }
}
function whoosh(from, to, gain, down = false) {
  let lp = 0; const i0 = Math.floor(from * SR), i1 = Math.floor(to * SR);
  for (let i = i0; i < i1 + SR * .25; i++) {
    const x = Math.min(1, (i - i0) / (i1 - i0)), k = down ? .25 - .22 * x : .02 + .25 * x * x;
    lp += (rnd() - lp) * k; put(i, lp * (i < i1 ? x : Math.max(0, 1 - (i - i1) / (SR * .25))) * gain, x - .5);
  }
}

// ------------------------------------------------------------ synth voices --
// band-limited saw/square from a few harmonics; `bright` is how many
function osc(ph, bright, odd = false) { let v = 0; for (let h = 1; h <= bright; h += odd ? 2 : 1) v += Math.sin(ph * h) / h; return v; }
function saw(at, m, len, gain, { bright = 8, pan = 0, att = .005, rel = .08, det = 0, bend = 0 } = {}) {
  const i0 = Math.floor(at * SR), f = hz(m) * (1 + det);
  let ph = 0;
  for (let n = 0; n < SR * (len + rel); n++) {
    const t = n / SR, e = Math.min(1, t / att) * (t < len ? 1 : Math.exp(-(t - len) / rel * 4));
    ph += 6.2832 * f * (1 - bend * Math.min(1, t / len)) / SR;
    put(i0 + n, osc(ph, bright) * e * gain, pan);
  }
}
function pad(at, notes, len, gain) { // three detuned saws per note, slow swell
  for (const m of notes) for (const [d, p] of [[-.004, -.5], [0, 0], [.004, .5]]) {
    const i0 = Math.floor(at * SR), f = hz(m) * (1 + d); let ph = Math.abs(d) * 900;
    for (let n = 0; n < SR * (len + .8); n++) {
      const t = n / SR, e = Math.min(1, t / .5) * (t < len ? 1 : Math.exp(-(t - len) * 4));
      ph += 6.2832 * f / SR; put(i0 + n, osc(ph, 5) * e * gain, p);
    }
  }
}
function pluck(at, m, gain, pan = 0) { // the arpeggio: squarish, quick decay
  const i0 = Math.floor(at * SR), f = hz(m); let ph = 0;
  for (let n = 0; n < SR * .35; n++) { const t = n / SR; ph += 6.2832 * f / SR;
    put(i0 + n, osc(ph, 2 + Math.floor(9 * Math.exp(-t * 18)), true) * Math.exp(-t * 9) * Math.min(1, t * 500) * gain, pan); }
}
function snare(at, gain) { // gated, very 1986
  const i0 = Math.floor(at * SR); let ph = 0, lp = 0;
  for (let n = 0; n < SR * .3; n++) { const t = n / SR; ph += 6.2832 * (190 - 40 * t) / SR; lp += (rnd() - lp) * .55;
    const gate = t < .2 ? 1 : Math.max(0, 1 - (t - .2) / .03);
    put(i0 + n, (Math.sin(ph) * Math.exp(-t * 30) * .7 + lp * (.35 + .65 * Math.exp(-t * 25))) * gate * gain, .05); }
}
function hat(at, gain, len = .05) {
  const i0 = Math.floor(at * SR); let hp = 0, last = 0;
  for (let n = 0; n < SR * len; n++) { const t = n / SR, x = rnd(); hp = .5 * (hp + x - last); last = x; put(i0 + n, hp * Math.exp(-t * 60) * gain, .35); }
}
function braam(at, gain, root = 33) { // the trailer horn hit
  for (const [m, g] of [[root, 1], [root + 12, .8], [root + 19, .5], [root + 24, .45], [root + 12.1, .5]]) {
    const i0 = Math.floor(at * SR), f = hz(m); let ph = 0;
    for (let n = 0; n < SR * 3.2; n++) { const t = n / SR;
      ph += 6.2832 * f * (1 - .015 * Math.min(1, t / 2)) / SR;
      const b = 2 + Math.floor(10 * Math.min(1, t / .12) * Math.exp(-t * .8));
      put(i0 + n, osc(ph, b) * Math.min(1, t * 60) * Math.exp(-t * 1.1) * g * gain, (m % 2 ? .3 : -.3)); }
  }
  kick(at, gain * 2.2);
}
function subdrop(at, gain) { const i0 = Math.floor(at * SR); let ph = 0;
  for (let n = 0; n < SR * 1.6; n++) { const t = n / SR; ph += 6.2832 * (30 + 60 * Math.exp(-t * 3)) / SR; put(i0 + n, Math.sin(ph) * Math.exp(-t * 2) * Math.min(1, t * 200) * gain); } }
function riser(from, to, gain) { const i0 = Math.floor(from * SR), len = to - from; let lp = 0, ph = 0;
  for (let n = 0; n < SR * len; n++) { const t = n / SR, x = t / len; lp += (rnd() - lp) * (.02 + .5 * x * x); ph += 6.2832 * (200 + 1800 * x * x) / SR;
    put(i0 + n, (lp * .8 + Math.sin(ph) * .2) * x * x * gain, Math.sin(t * 6) * .4); } }
function scratch(at, gain) { // record scratch: a sawtooth through a fast back-and-forth pitch sweep
  const i0 = Math.floor(at * SR); let ph = 0, lp = 0;
  for (let n = 0; n < SR * .55; n++) { const t = n / SR, sp = Math.sin(t * 2 * Math.PI * (t < .25 ? 6 : 3.5));
    ph += 6.2832 * (300 + 900 * Math.abs(sp)) / SR; lp += (rnd() - lp) * .5;
    put(i0 + n, (osc(ph, 6) * .6 + lp * .5) * Math.min(1, t * 80) * Math.min(1, (.55 - t) * 15) * gain, 0); }
}
function buzzer(at, gain) { // the game-show strike
  const i0 = Math.floor(at * SR); let a = 0, b = 0;
  for (let n = 0; n < SR * .55; n++) { const t = n / SR; a += 6.2832 * 116 / SR; b += 6.2832 * 123 / SR;
    put(i0 + n, (osc(a, 9, true) + osc(b, 9, true)) * .5 * Math.min(1, t * 100) * Math.min(1, (.55 - t) * 30) * gain, 0); }
}
function heartbeat(at, gain) { kick(at, gain); kick(at + .22, gain * .7); }
function ring(at, len, gain) { // a 1980s telephone bell
  const i0 = Math.floor(at * SR);
  for (let n = 0; n < SR * len; n++) { const t = n / SR, am = Math.sin(t * 2 * Math.PI * 20) > 0 ? 1 : .2;
    put(i0 + n, (Math.sin(6.2832 * 440 * t) + Math.sin(6.2832 * 480 * t) + .4 * Math.sin(6.2832 * 1320 * t)) * am * Math.min(1, t * 50) * Math.min(1, (len - t) * 40) * gain, .3); }
}
function rip(at, gain) { const i0 = Math.floor(at * SR); let lp = 0;
  for (let n = 0; n < SR * .4; n++) { const t = n / SR; lp += (rnd() - lp) * (.7 - t); put(i0 + n, lp * (.6 + .4 * Math.sign(Math.sin(t * 380))) * Math.exp(-t * 6) * gain, -.2); } }
function beep(at, f, len, gain) { const i0 = Math.floor(at * SR);
  for (let n = 0; n < SR * len; n++) { const t = n / SR; put(i0 + n, osc(6.2832 * f * t, 5, true) * Math.min(1, t * 400) * Math.min(1, (len - t) * 400) * gain, 0); } }

// ------------------------------------------------------------------ score --
// A minor synthwave at 100 bpm: Am - F - C - G.
BUS = "m";
const BPM = 100, B = 60 / BPM, BAR = B * 4, S16 = B / 4;
const PROG = [{ b: 45, pad: [57, 60, 64], arp: [69, 72, 76, 81] }, { b: 41, pad: [53, 57, 60], arp: [65, 69, 72, 77] },
  { b: 48, pad: [55, 60, 64], arp: [67, 72, 76, 79] }, { b: 43, pad: [55, 59, 62], arp: [67, 71, 74, 79] }];

// cold open: a low drone that swells into "In a world..."
pad(0, [33, 45], C.hook + 1, .02); subdrop(C.hook, .5); braam(C.hook - .05, .12);
// tension under the bot feed: pulsing bass and ticking hats
for (let t = C.spam - .4, i = 0; t < C.one - .3; t += B / 2, i++) {
  const ch = PROG[Math.floor((t - C.spam) / BAR) % 2 === 0 ? 0 : 1];
  saw(t, ch.b - 12, B / 2 * .7, .09, { bright: 5, pan: -.1 });
  hat(t + B / 4, .05);
  if (i % 4 === 0) kick(t, .25);
}
pad(C.spam, [57, 60, 64], (C.one - C.spam) / 2, .012); pad(C.spam + (C.one - C.spam) / 2, [53, 57, 60], (C.one - C.spam) / 2 - .3, .012);
// silence and a heartbeat while one relay dares to ask...
for (let t = C.one + .3; t < C.ask - .3; t += .85) heartbeat(t, .35);
riser(C.one + .4, C.ask, .1);
braam(C.ask, .35); crash(C.ask, .2);
// "This fall": riser into the title
pad(C.title, [45, 52, 57], C.name - C.title, .02); riser(C.title, C.name, .22);
braam(C.name, .4); crash(C.name, .3); subdrop(C.name, .6);

// the groove, from the logo to the end card
const G0 = C.name + BAR / 2, G1 = C.game - .1;
for (let t = G0, bar = 0; t < G1 - .01; t += BAR, bar++) {
  const ch = PROG[bar % 4];
  // break down for "Its secret weapon?", the strikes and the E.T. phone call
  const hush = (t >= C.wot - BAR && t < C.wot2) || (t >= C.three - .3 && t < C.good - .5) || (t >= C.et - BAR / 2 && t < C.dash - .5);
  pad(t, ch.pad, BAR - .05, hush ? .016 : .011);
  for (let s = 0; s < 16; s++) {
    const st = t + s * S16; if (st >= G1) break;
    if (!hush) pluck(st, ch.arp[[0, 1, 2, 3, 2, 1, 2, 3][s % 8]] + (s >= 8 ? 0 : 0), .05, s % 2 ? .45 : -.45);
    if (s % 2 === 0) saw(st, ch.b - 12, S16 * 1.6, hush ? .04 : .085, { bright: 6, pan: -.1 });
    if (!hush && s % 4 === 0) kick(st, .5);
    if (!hush && (s === 4 || s === 12)) snare(st, .3);
    if (!hush && s % 2 === 1) hat(st, .06);
  }
}
for (const k of ["rust", "hack", "wot2", "strike", "login", "end"]) crash(C[k], .14);
braam(C.hack, .3); braam(C.wot2, .22); braam(C.end, .35); subdrop(C.end, .5);
braam(C.quality, .18, 36);
// the WOPR: quiet hum under the terminal, then one last hit
pad(C.game, [33, 40], DUR - C.game - 1.2, .02);
braam(C.speechEnd + .6, .32); crash(C.speechEnd + .6, .2);

// ---------------------------------------------------------------- effects --
BUS = "x";
// the bot feed: a pop per post, then the reply guys and the giveaway
const nPosts = 10; for (let i = 0; i < nPosts; i++) pop(C.spam + .1 + i * ((C.reply - C.spam) / nPosts) + .05, .3, (i % 2 ? .4 : -.4));
for (let i = 0; i < 5; i++) pop(C.reply + i * ((C.scam - C.reply) / 5) * .9 + .03, .35, (i % 2 ? .6 : -.6));
whoosh(C.scam - .3, C.scam + .05, .3); thock(C.scam + .05, .7);
for (let i = 0; i < 11; i++) pop(C.sat + .5 + i * ((C.one - .6 - C.sat - .5) / 11) + .03, .12, .3); // the checkmarks
scratch(C.one - .45, .5);
for (let i = 0; i < 9; i++) whoosh(C.ask + .1, C.ask + .5 + i * .04, .05);
whoosh(C.title - .5, C.title, .25);
// terminal and features
{ let tt = C.rust + .3; const L = [26, 0, 0, 0, 0, 0];
  for (const n of L) { if (n) { for (let c = 0; c < n; c += 2) keyclick(tt + c / 34, .3, .1); tt += n / 34; } else beep(tt, 1800, .03, .03); tt += .28; } }
for (const k of ["fast", "cr", "priv"]) { whoosh(C[k] - .3, C[k] + .05, .2); thock(C[k] + .1, .5); }
pop(C.polite + .05, .4, .3);
// web of trust
for (let i = 0; i < 12; i++) pop(C.wot2 + .1 + i * .12, .15, (i % 3 - 1) * .5);
whoosh(C.door, C.door + 1, .25); buzzer(C.door + .95, .08); whoosh(C.door + 1.1, C.door + 1.9, .2, true);
whoosh(C.vouch, C.vouch + .9, .2); chime(C.vouch + 1, .25);
for (let i = 0; i < 5; i++) pop(C.five + .2 + i * .18 + .02, .3, (i - 2) * .3);
// accountability
whoosh(C.strike + .6, C.strike + 1.4, .2); pop(C.lose - .45, .35);
rip(C.lose + .5, .5); thock(C.lose + .95, .8);
for (let i = 0; i < 3; i++) buzzer(C.three + .1 + i * .55, .2);
for (let i = 0; i < 3; i++) chime(C.good + .2 + i * .45, .12);
for (let i = 0; i < 15; i++) pop(C.fifteen + .05 + i * .05, .14, (i % 5 - 2) * .25);
for (const [dt, m] of [[.5, 84], [.6, 88], [.7, 91], [.8, 96]]) chime(C.fifteen + dt, .06);
// login and the phone call
pop(C.login + .5, .25); pop(C.bunker + .05, .25);
chime(C.keys + .4, .12);
ring(C.et + .3, Math.min(C.nophone - C.et - .3, 1.1), .06);
thock(C.nophone, .9); kick(C.nophone, .4);
// dashboard
for (const k of ["dash", "feed", "nip05", "invites"]) pop(C[k] + .35, .28, .4);
// end card
pop(C.cta + .05, .3, -.3); pop(C.request + .05, .3, .3);
for (let c = 0; c < 21; c++) keyclick(C.game - .2 + .2 + c / 16, .3, 0); // "SHALL WE PLAY A GAME?" typed at 16 cps
// ---------------------------------------------------------------- narration --
const nar = spawnSync("ffmpeg", ["-v", "error", "-i", "tts/narration.mp3", "-f", "f32le", "-ac", "1", "-ar", String(SR), "-"], { maxBuffer: 1 << 30 });
const V = new Float32Array(nar.stdout.buffer, nar.stdout.byteOffset, nar.stdout.byteLength / 4);
const voiceAt = Math.floor(C.leadIn * SR);
// Voice envelope (fast attack, slow release) drives the ducking.
const env = new Float32Array(N); { let e = 0; const att = Math.exp(-1 / (SR * .03)), rel = Math.exp(-1 / (SR * .45));
  for (let i = 0; i < N; i++) { const j = i - voiceAt, x = j >= 0 && j < V.length ? Math.abs(V[j]) : 0; e = x > e ? att * e + (1 - att) * x : rel * e + (1 - rel) * x; env[i] = e; } }
let envMax = 0; for (let i = 0; i < N; i++) envMax = Math.max(envMax, env[i]);

// ------------------------------------------------------------------ mix --
function reverb(x, delays, fb, mix) {
  const out = new Float32Array(N);
  for (const d0 of delays) { const d = Math.floor(d0 * SR), buf = new Float32Array(d); let j = 0, lp = 0;
    for (let i = 0; i < N; i++) { const y = buf[j]; lp = lp * .35 + y * .65; buf[j] = x[i] + lp * fb; out[i] += y / delays.length; j = (j + 1) % d; } }
  for (let i = 0; i < N; i++) x[i] = x[i] * (1 - mix) + out[i] * mix * 2;
}
reverb(ML, [.0297, .0371, .0411, .0437], .8, .22); reverb(MR, [.0311, .0357, .0423, .0451], .8, .22);
reverb(XL, [.0297, .0371], .6, .12); reverb(XR, [.0311, .0357], .6, .12);
const peakOf = (a, b) => { let p = 0; for (let i = 0; i < N; i++) p = Math.max(p, Math.abs(a[i]), Math.abs(b[i])); return p; };
const mg = .55 / peakOf(ML, MR), xg = .5 / peakOf(XL, XR);
let vpeak = 0; for (const s of V) vpeak = Math.max(vpeak, Math.abs(s));
const MUSIC_ONLY = process.argv.includes("--music"); // for checking the balance: no voice, same ducking
const vg = MUSIC_ONLY ? 0 : .8 / vpeak;
const L = new Float32Array(N), R = new Float32Array(N);
for (let i = 0; i < N; i++) {
  const duck = 1 - .65 * Math.min(1, env[i] / (envMax * .35));   // music sits well under the voice
  const t = i / SR, fade = Math.max(0, Math.min(1, (DUR - .05 - t) / 1.0, t / .02));
  const j = i - voiceAt, v = j >= 0 && j < V.length ? V[j] * vg : 0;
  L[i] = (ML[i] * mg * duck + XL[i] * xg + v) * fade;
  R[i] = (MR[i] * mg * duck + XR[i] * xg + v) * fade;
}
let peak = peakOf(L, R); const g = .95 / peak;
const buf = Buffer.alloc(44 + N * 4);
buf.write("RIFF", 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write("WAVEfmt ", 8); buf.writeUInt32LE(16, 16);
buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28);
buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write("data", 36); buf.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) { buf.writeInt16LE(Math.round(Math.tanh(L[i] * g) * 32000), 44 + i * 4); buf.writeInt16LE(Math.round(Math.tanh(R[i] * g) * 32000), 46 + i * 4); }
fs.writeFileSync(MUSIC_ONLY ? "out/music-only.wav" : "out/audio.wav", buf);
console.log("duration", DUR, "voice samples", V.length, "peak", peak.toFixed(3));
