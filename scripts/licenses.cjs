/* Preserve actual license/notice texts from locked npm packages and bundle them offline. */
const fs = require('node:fs');
const path = require('node:path');
const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
const notices = [];
for (const [dir, info] of Object.entries(lock.packages)) {
  if (!dir || info.dev || !fs.existsSync(dir)) continue;
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
  const files = fs
    .readdirSync(dir)
    .filter(
      (f) =>
        /^(licen[sc]e|copying|notice|copyright)([._-]|$)/i.test(f) &&
        fs.statSync(path.join(dir, f)).isFile(),
    );
  const texts = files.map((f) => `${f}\n${fs.readFileSync(path.join(dir, f), 'utf8')}`);
  notices.push({
    name: manifest.name,
    version: manifest.version,
    license: manifest.license || info.license || 'Consultare il pacchetto',
    texts,
  });
}
notices.sort((a, b) => a.name.localeCompare(b.name));
fs.mkdirSync('assets', { recursive: true });
fs.writeFileSync('assets/third-party-notices.json', JSON.stringify(notices));
fs.writeFileSync(
  'THIRD_PARTY_NOTICES.txt',
  notices
    .map((n) => `${n.name}@${n.version} (${n.license})\n${n.texts.join('\n\n')}\n`)
    .join('\n----------------\n'),
);
console.log(
  `Avvisi conservati per ${notices.length} pacchetti; inclusi in assets/third-party-notices.json.`,
);
