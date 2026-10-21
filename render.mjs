// Renders scene.html frame-by-frame in headless Chromium and pipes to ffmpeg.
// Timings come from out/cues.json (tts/narrate.mjs), so the pictures follow the narration.
// Usage: node render.mjs                 -> out/video-silent.mp4
//        node render.mjs --stills 3 8 15  -> out/still-<t>.png
import puppeteer from "puppeteer-core";
import { spawn } from "node:child_process";
import fs from "node:fs";

const FPS = 30;
const cues = JSON.parse(fs.readFileSync("out/cues.json", "utf8"));
const DURATION = cues.duration;
const args = process.argv.slice(2);

const html = fs.readFileSync("scene.html", "utf8").replace("CUES_PLACEHOLDER", JSON.stringify(cues));
fs.writeFileSync("out/scene.built.html", html); // assets resolve as ../assets from out/

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--hide-scrollbars", "--force-color-profile=srgb", "--disable-gpu-vsync", "--allow-file-access-from-files"],
});
const page = await browser.newPage();
page.on("pageerror", e => console.error("page error:", e.message));
page.on("console", m => { if (m.type() === "error") console.error("console:", m.text()); });
await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
await page.goto("file://" + process.cwd() + "/out/scene.built.html", { waitUntil: "networkidle0" });
await page.evaluate(() => Promise.all(["400", "500", "600", "700", "800", "900"].map(w => document.fonts.load(`${w} 40px Inter`))));
await page.evaluate(() => Promise.all(["400", "500", "600", "700"].map(w => document.fonts.load(`${w} 40px "Space Grotesk"`))));
await page.evaluate(() => Promise.all([document.fonts.load('40px Anton'), document.fonts.load('400 20px "JetBrainsMono Nerd Font"')]));
await page.evaluate(() => document.fonts.ready);
const fonts = await page.evaluate(() => ["Inter", "Anton", "Space Grotesk", "JetBrainsMono Nerd Font"].map(f => f + ":" + document.fonts.check(`20px "${f}"`)));
console.log("fonts", fonts.join(" "), "duration", DURATION);
// Every screenshot must be decoded before frames are taken.
await page.evaluate(() => Promise.all(["login-crop", "dashboard-crop"].map(n => {
  const i = new Image(); i.src = `../assets/${n}.png`; return i.decode();
})));

if (args[0] === "--stills") {
  for (const t of args.slice(1)) {
    await page.evaluate(t => window.render(t), Number(t));
    await page.screenshot({ path: `out/still-${t}.png` });
  }
} else {
  const ff = spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "png", "-i", "-",
    "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-pix_fmt", "yuv420p", "out/video-silent.mp4"], { stdio: ["pipe", "inherit", "inherit"] });
  const total = Math.round(FPS * DURATION);
  for (let f = 0; f < total; f++) {
    await page.evaluate(t => window.render(t), f / FPS);
    const buf = await page.screenshot({ type: "png" });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once("drain", r));
    if (f % 300 === 0) console.log(`frame ${f}/${total}`);
  }
  ff.stdin.end();
  await new Promise((res, rej) => ff.on("close", c => c === 0 ? res() : rej(new Error("ffmpeg exit " + c))));
}
await browser.close();
