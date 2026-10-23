/* Original, deterministic vector assets. Renderer runs only during development/builds. */
const fs = require('node:fs');
const path = require('node:path');
const { Resvg } = require('@resvg/resvg-js');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/ui/brand.ts'), 'utf8');
const artwork = source.match(/export const brandArtwork = `([\s\S]*?)`;/)?.[1];
if (!artwork) throw new Error('Sorgente vettoriale logo mancante');
const svg = (body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 256 256">${body}</svg>`;
const icon = svg(
  `<defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#302858"/><stop offset="1" stop-color="#101021"/></linearGradient></defs><rect width="256" height="256" fill="url(#bg)"/>${artwork}`,
);
const foreground = svg(
  `<g transform="translate(128 128) scale(.74) translate(-128 -128)">${artwork}</g>`,
);
fs.writeFileSync(path.join(root, 'assets/logo.svg'), svg(artwork));
fs.writeFileSync(path.join(root, 'assets/icon.svg'), icon);
for (const [filename, content] of [
  ['icon.png', icon],
  ['adaptive-icon.png', foreground],
]) {
  fs.writeFileSync(path.join(root, 'assets', filename), new Resvg(content).render().asPng());
  console.log(`Logo generato: assets/${filename}`);
}
