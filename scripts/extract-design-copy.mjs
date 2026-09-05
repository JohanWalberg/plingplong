// One-off extraction of the COPY decks and fixture arrays from the Claude Design
// prototypes in project_design/ (git-ignored). Writes JSON to /tmp/design-extract/.
// Usage: node scripts/extract-design-copy.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import vm from 'node:vm';

const files = {
  public: 'project_design/Bostadssök.dc.html',
  portal: 'project_design/Hyresvärdsportal.dc.html',
  access: 'project_design/Åtkomst och inloggning.dc.html',
};
const out = '/tmp/design-extract';
mkdirSync(out, { recursive: true });

function grab(src, name) {
  const start = src.indexOf(`const ${name} = `);
  if (start < 0) return null;
  // find matching bracket
  let i = src.indexOf('=', start) + 1;
  while (/\s/.test(src[i])) i++;
  const open = src[i];
  const close = open === '[' ? ']' : '}';
  let depth = 0, j = i, inStr = null;
  for (; j < src.length; j++) {
    const c = src[j];
    if (inStr) { if (c === '\\') { j++; continue; } if (c === inStr) inStr = null; continue; }
    if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
    if (c === open) depth++;
    else if (c === close) { depth--; if (depth === 0) break; }
  }
  return src.slice(i, j + 1);
}

for (const [key, path] of Object.entries(files)) {
  const src = readFileSync(path, 'utf8');
  const ctx = { Date, NOW: new Date(2026, 8, 4, 14, 43) };
  vm.createContext(ctx);
  const copy = vm.runInContext('(' + grab(src, 'COPY') + ')', ctx);
  writeFileSync(`${out}/${key}.copy.json`, JSON.stringify(copy, null, 2));
  const listings = grab(src, 'LISTINGS');
  if (listings) {
    const arr = vm.runInContext('(' + listings + ')', ctx);
    writeFileSync(`${out}/${key}.listings.json`, JSON.stringify(arr, null, 2));
  }
  console.log(key, 'sv keys:', Object.keys(copy.sv).length, 'en keys:', Object.keys(copy.en).length, listings ? 'listings ok' : '');
}
