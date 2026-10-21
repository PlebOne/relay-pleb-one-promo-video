// Captures the public relay.pleb.one pages in headless Chromium. capture/login.png, cropped,
// is assets/login-crop.png. The dashboard (capture/dash-feed.png) was taken from a logged-in browser.
import puppeteer from "puppeteer-core";
const b = await puppeteer.launch({ executablePath: "/usr/bin/chromium", args: ["--hide-scrollbars"] });
const p = await b.newPage();
await p.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 1.5 });
for (const [name, path] of [["home", "/"], ["request", "/request"], ["login", "/login"], ["nips", "/nips"]]) {
  await p.goto("https://relay.pleb.one" + path, { waitUntil: "networkidle2" });
  await new Promise(r => setTimeout(r, 2500));
  await p.screenshot({ path: `capture/${name}.png` });
  await p.screenshot({ path: `capture/${name}-full.png`, fullPage: true });
}
await b.close();
