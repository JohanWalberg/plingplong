// CI check: both message catalogues must have identical key sets and matching
// ICU argument names per key.
import { readFileSync } from "node:fs";

type Tree = { [k: string]: string | Tree };

function flatten(tree: Tree, prefix = "", out: Record<string, string> = {}) {
  for (const [k, v] of Object.entries(tree)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out[key] = v;
    else flatten(v, key, out);
  }
  return out;
}

// Collect top-level ICU argument names: `{name}` and `{name, plural, ...}`.
// Nested option bodies (`one {# rum}`) are skipped by tracking depth.
function args(s: string) {
  const names = new Set<string>();
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "{") {
      depth++;
      if (depth === 1) {
        const m = /^\{\s*(\w+)/.exec(s.slice(i));
        if (m) names.add(m[1]);
      }
    } else if (c === "}") depth--;
  }
  return [...names].sort().join(",");
}

const sv = flatten(JSON.parse(readFileSync("messages/sv.json", "utf8")));
const en = flatten(JSON.parse(readFileSync("messages/en.json", "utf8")));

const problems: string[] = [];
for (const k of Object.keys(sv)) {
  if (!(k in en)) problems.push(`missing in en: ${k}`);
  else if (args(sv[k]) !== args(en[k]))
    problems.push(`argument mismatch: ${k} (sv: ${args(sv[k])} en: ${args(en[k])})`);
}
for (const k of Object.keys(en)) if (!(k in sv)) problems.push(`missing in sv: ${k}`);

if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(`ok: ${Object.keys(sv).length} keys in both catalogues`);
