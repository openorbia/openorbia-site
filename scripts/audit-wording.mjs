#!/usr/bin/env node
// Read-only wording audit: prints file:line for each phrase the Launch Week 1 cleanup has to look at. It changes nothing.
//
//   npm run audit:wording            all patterns, grouped
//   node scripts/audit-wording.mjs --json
//
// It walks the repository (skipping node_modules, .git, .wrangler and binary files) and reports, per pattern, every line that
// matches. The patterns are case-sensitive where the abbreviation would otherwise match ordinary words (PT, CT, CST...).

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SKIP_DIRS = new Set(['node_modules', '.git', '.wrangler']);
// This audit's own script and test spell out every phrase on purpose, so they would only add noise
export const SKIP_FILES = new Set(['scripts/audit-wording.mjs', 'test/audit-wording.test.js']);
// Text files only: images, fonts and other binaries are skipped by extension
export const TEXT_EXT = new Set(['.js', '.mjs', '.cjs', '.json', '.html', '.css', '.md', '.txt', '.yml', '.yaml', '.toml', '.sql', '.svg', '.xml', '']);

export const PATTERNS = [
  { key: 'time-zone', label: 'Time zone words (Central, Pacific, Eastern, PT, PST, PDT, CT, CST, CDT)',
    re: /\b(?:Central|Pacific|Eastern|PT|PST|PDT|CT|CST|CDT)\b/ },
  { key: 'free-and-open-source', label: '"free and open-source"', re: /free and open[- ]source/i },
  { key: 'waitlist', label: '"waitlist"', re: /waitlist/i },
  { key: 'checked-by-hand', label: '"checked by hand" / "by hand against"', re: /checked by hand|by hand against/i },
  { key: 'nothing-about-you', label: '"nothing about you"', re: /nothing about you/i },
  { key: 'hardcoded-count', label: 'Hardcoded counts (a number followed by tools, makers, subscribers, stars or readers)',
    re: /\b\d[\d,.]*\s*[KkMm]?\+?\s+(?:tools?|makers?|subscribers?|stars?|readers?)\b/ },
  { key: 'openorbia-launch', label: '"openorbia-launch"', re: /openorbia-launch/ },
];

// Every file under `root` that is text, as paths relative to root, sorted
export function listFiles(root, dir = root, out = []) {
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) { if (!SKIP_DIRS.has(name)) listFiles(root, p, out); }
    else if (TEXT_EXT.has(extname(name).toLowerCase())) {
      const rel = relative(root, p).split('\\').join('/');
      if (!SKIP_FILES.has(rel)) out.push(rel);
    }
  }
  return out;
}

// -> { [key]: [{ file, line, text }] } for the given files' contents ({ path: text })
export function audit(files) {
  const hits = Object.fromEntries(PATTERNS.map(p => [p.key, []]));
  for (const [file, text] of Object.entries(files)) {
    text.split(/\r?\n/).forEach((line, i) => {
      for (const p of PATTERNS) if (p.re.test(line)) hits[p.key].push({ file, line: i + 1, text: line.trim().slice(0, 200) });
    });
  }
  return hits;
}

export function report(hits) {
  const out = [];
  for (const p of PATTERNS) {
    out.push(`## ${p.label}: ${hits[p.key].length} line(s)`);
    for (const h of hits[p.key]) out.push(`${h.file}:${h.line}  ${h.text}`);
    out.push('');
  }
  return out.join('\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const files = Object.fromEntries(listFiles(root).map(f => [f, readFileSync(join(root, f), 'utf8')]));
  const hits = audit(files);
  console.log(process.argv.includes('--json') ? JSON.stringify(hits, null, 2) : report(hits));
}
