// One-off script: extracts the embedded 256x256 PNG from public/favicon.ico and
// generates the PWA icon set. Not run on every build — rerun manually if the logo changes.
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import sharp from "sharp";

const root = resolve(import.meta.dirname, "..");
const icoPath = resolve(root, "public/favicon.ico");
const ico = readFileSync(icoPath);

const count = ico.readUInt16LE(4);
let best = null;
for (let i = 0; i < count; i++) {
  const off = 6 + i * 16;
  let w = ico.readUInt8(off);
  if (w === 0) w = 256;
  const size = ico.readUInt32LE(off + 8);
  const dataOffset = ico.readUInt32LE(off + 12);
  if (!best || w > best.w) best = { w, size, dataOffset };
}
if (!best) throw new Error("No image found in favicon.ico");

const sourcePng = ico.subarray(best.dataOffset, best.dataOffset + best.size);
console.log(`Extracted ${best.w}x${best.w} PNG from favicon.ico (${best.size} bytes)`);

const BG = "#0A0C10";

await sharp(sourcePng).resize(192, 192).png().toFile(resolve(root, "public/icon-192.png"));
await sharp(sourcePng).resize(512, 512).png().toFile(resolve(root, "public/icon-512.png"));

// Maskable: logo at ~80% inside a solid safe-zone background (spec-compliant safe zone is a centered 80% circle).
await sharp({ create: { width: 512, height: 512, channels: 4, background: BG } })
  .composite([{ input: await sharp(sourcePng).resize(410, 410).png().toBuffer(), gravity: "center" }])
  .png()
  .toFile(resolve(root, "public/icon-512-maskable.png"));

// Apple touch icon: iOS ignores alpha, so composite over a solid background.
await sharp({ create: { width: 180, height: 180, channels: 4, background: BG } })
  .composite([{ input: await sharp(sourcePng).resize(180, 180).png().toBuffer(), gravity: "center" }])
  .flatten({ background: BG })
  .png()
  .toFile(resolve(root, "public/apple-touch-icon.png"));

console.log("Generated icon-192.png, icon-512.png, icon-512-maskable.png, apple-touch-icon.png");
