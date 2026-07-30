// One-off script: builds the PWA icon set from a generated SVG (brand gradient +
// the "Pill" glyph already used as the brand mark in AppHeader.tsx), since
// public/favicon.ico turned out to be a "sticker mockup" photo (drop shadow,
// peeling corner) — unusable as a home-screen icon at small sizes.
// Not run on every build — rerun manually if the brand mark changes.
import { writeFileSync } from "fs";
import { resolve } from "path";
import sharp from "sharp";

const root = resolve(import.meta.dirname, "..");

const ACCENT = "#2EC2B3"; // hsl(174,62%,47%), brand teal
const DARK = "#0A0C10"; // hsl(220,25%,5%), app background

// lucide-react "Pill" glyph, viewBox 0 0 24 24, stroke-only.
const PILL_PATH_1 = "m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z";
const PILL_PATH_2 = "m8.5 8.5 7 7";

function iconSvg({ size, cornerRadius, glyphScale }) {
  const strokeWidth = (2 / 24) * glyphScale;
  const translate = (size - glyphScale) / 2;
  return `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${ACCENT}" />
      <stop offset="100%" stop-color="${DARK}" />
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${size}" height="${size}" rx="${cornerRadius}" fill="url(#bg)" />
  <g transform="translate(${translate}, ${translate}) scale(${glyphScale / 24})" fill="none" stroke="#ffffff" stroke-width="${strokeWidth * (24 / glyphScale)}" stroke-linecap="round" stroke-linejoin="round">
    <path d="${PILL_PATH_1}" />
    <path d="${PILL_PATH_2}" />
  </g>
</svg>`;
}

async function renderIcon(path, size, { cornerRadius = size * 0.18, glyphScale = size * 0.56 } = {}) {
  const svg = iconSvg({ size, cornerRadius, glyphScale });
  await sharp(Buffer.from(svg)).png().toFile(resolve(root, path));
  console.log(`wrote ${path}`);
}

await renderIcon("public/icon-192.png", 192);
await renderIcon("public/icon-512.png", 512);
// Maskable: OS clips to a centered ~80% safe-zone circle, so keep the background
// full-bleed (no rounded corners of our own) and shrink the glyph a bit more.
await renderIcon("public/icon-512-maskable.png", 512, { cornerRadius: 0, glyphScale: 512 * 0.42 });
// Apple touch icon: iOS applies its own corner rounding, so ship a plain square.
await renderIcon("public/apple-touch-icon.png", 180, { cornerRadius: 0, glyphScale: 180 * 0.56 });

console.log("Generated icon-192.png, icon-512.png, icon-512-maskable.png, apple-touch-icon.png");
