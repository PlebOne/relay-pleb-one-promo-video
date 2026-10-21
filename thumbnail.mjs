// Renders thumbnail.html to out/thumbnail.png (1280x720, YouTube's recommended size).
import puppeteer from "puppeteer-core";

const browser = await puppeteer.launch({ executablePath: "/usr/bin/chromium", args: ["--hide-scrollbars", "--force-color-profile=srgb"] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
await page.goto("file://" + process.cwd() + "/thumbnail.html", { waitUntil: "networkidle0" });
await page.evaluate(() => Promise.all([document.fonts.load("40px Anton"), document.fonts.load('700 40px "Space Grotesk"'), document.fonts.load('500 40px "Space Grotesk"')]));
await page.evaluate(() => document.fonts.ready);
console.log("fonts", await page.evaluate(() => ["Anton", "Space Grotesk"].map(f => f + ":" + document.fonts.check(`20px "${f}"`)).join(" ")));
await page.screenshot({ path: "out/thumbnail.png" });
await browser.close();
