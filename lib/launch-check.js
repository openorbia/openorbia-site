// The launch preflight: what `npm run launch:check` checks in data/launches.json before seeding (scripts/launch-check.mjs prints it).
// Read-only. Pure: the file reader, the Launch List and the clock are passed in, so the tests can use their own fixtures.
//
// Per launch, six columns, each PASS or FAIL (or WARN where noted):
//   fields   name, tagline (60 characters at most), description, category, maker name, license, plus everything validateLaunches checks
//   links    https only, and at least a website or a source link
//   images   a logo and 3 to 5 screenshots, all files inside public/launches/<slug>/, with sane file sizes and pixel sizes, a
//            file name that matches the real format, and alt text on every screenshot
//   date     launch_week and launch_date are Launch Week 1 (lib/site.js), a Monday, and still in the future
//            (with --ci a date that has passed is WARN: the launch already happened)
//   facts    free facts only where known: no placeholder text, cardRequired "unknown" left out, a lastChecked date with any fact;
//            testedBy only with a hand-set testedOn date (the day we ran it ourselves)
//   listing  not the same tool as one already on the Launch List, unless "duplicateNote" says why it launches anyway
// Entries with "sample": true are flagged SAMPLE: their problems are listed, but they never fail the run and never count as real.
// Then the number of real launches against MAKERS_CONFIRMED (WARN when they differ, since makers are still sending theirs).

import { validateLaunches, httpsUrl, CATEGORIES } from './launch-data.js';
import { launchOpensAt } from './time.js';
import { FIRST_LAUNCH_WEEK, MAKERS_CONFIRMED } from './site.js';
import { TESTED_BY } from '../public/assets/facts.js';

export const TAGLINE_MAX = 60;
export const SHOTS_MIN = 3, SHOTS_MAX = 5;
export const ALT_MIN = 8;
export const LIMITS = {
  logo: { minBytes: 100, maxBytes: 512 * 1024, minPx: 256, maxPx: 2048 },
  shot: { minBytes: 1024, maxBytes: 3 * 1024 * 1024, minWidth: 640, maxWidth: 4000 },
};
const IMAGE_EXT = /\.(png|jpe?g|webp|gif|svg)$/i;
const PLACEHOLDER = /\b(tbd|todo|tba|unknown|lorem|placeholder|n\/a|xxx)\b|\?\?|^\s*-\s*$|^\s*\?\s*$/i;
export const COLUMNS = ['fields', 'links', 'images', 'date', 'facts', 'listing'];

// ---- image sizes from the file's first bytes (PNG, JPEG, GIF, WebP); null for SVG or anything else ----
export function imageSize(buf) {
  if (!buf || buf.length < 24) return null;
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  const be16 = i => (u8[i] << 8) | u8[i + 1], le16 = i => u8[i] | (u8[i + 1] << 8);
  const be32 = i => ((u8[i] << 24) >>> 0) + (u8[i + 1] << 16) + (u8[i + 2] << 8) + u8[i + 3];
  const ascii = (i, n) => String.fromCharCode(...u8.subarray(i, i + n));
  if (u8[0] === 0x89 && ascii(1, 3) === 'PNG') return { type: 'png', width: be32(16), height: be32(20) };
  if (ascii(0, 3) === 'GIF') return { type: 'gif', width: le16(6), height: le16(8) };
  if (ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') {
    const kind = ascii(12, 4);
    if (kind === 'VP8X') return { type: 'webp', width: 1 + (u8[24] | (u8[25] << 8) | (u8[26] << 16)), height: 1 + (u8[27] | (u8[28] << 8) | (u8[29] << 16)) };
    if (kind === 'VP8 ' && u8.length >= 30) return { type: 'webp', width: le16(26) & 0x3fff, height: le16(28) & 0x3fff };
    if (kind === 'VP8L' && u8.length >= 25) { const b = u8.subarray(21, 25); return { type: 'webp', width: 1 + (((b[1] & 0x3f) << 8) | b[0]), height: 1 + (((b[3] & 0xf) << 10) | (b[2] << 2) | ((b[1] & 0xc0) >> 6)) }; }
    return null;
  }
  if (u8[0] === 0xff && u8[1] === 0xd8) {
    let i = 2;
    while (i + 9 < u8.length) {
      if (u8[i] !== 0xff) { i++; continue; }
      const marker = u8[i + 1];
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { type: 'jpeg', width: be16(i + 7), height: be16(i + 5) };
      i += 2 + be16(i + 2);
    }
  }
  return null;
}

const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
// "https://github.com/Owner/Repo/" -> "owner/repo"; anything else -> ''
const githubRepo = u => { try { const x = new URL(u); return x.hostname === 'github.com' ? x.pathname.split('/').filter(Boolean).slice(0, 2).join('/').toLowerCase() : ''; } catch { return ''; } };

// -> { rows: [{ slug, name, sample, cols: {fields:'PASS'|'FAIL'|'WARN', ...}, problems: [{ col, msg }], status: 'PASS'|'FAIL'|'SAMPLE' }],
//      real, makersConfirmed, countStatus, ok }
// `readFile(path)` -> Uint8Array or null; paths look like "public/launches/<slug>/logo.png" (samples: "test/fixtures/launches/...").
export function checkLaunches(data, { now = Date.now(), readFile = () => null, tools = [], ci = false, site = FIRST_LAUNCH_WEEK, makersConfirmed = MAKERS_CONFIRMED } = {}) {
  const { launches, errors } = validateLaunches(data);
  const raws = data && Array.isArray(data.launches) ? data.launches : [];
  const rows = raws.map((raw, i) => {
    const r = raw && typeof raw === 'object' ? raw : {};
    const slug = String(r.slug || `launches[${i}]`);
    const sample = r.sample === true;
    const problems = [];
    const cols = Object.fromEntries(COLUMNS.map(c => [c, 'PASS']));
    const fail = (col, msg) => { problems.push({ col, msg }); cols[col] = 'FAIL'; };
    const warn = (col, msg) => { problems.push({ col, msg: `warning: ${msg}` }); if (cols[col] === 'PASS') cols[col] = 'WARN'; };

    // fields: everything validateLaunches found for this entry, plus the stricter tagline limit
    const prefix = `launches[${i}]`;
    for (const e of errors.filter(x => x.startsWith(`${prefix}:`) || x.startsWith(`${prefix} (`))) {
      const msg = e.slice(e.indexOf(': ') + 2);
      fail(/link|https|repo_url|website_url/.test(msg) && !/path inside/.test(msg) ? 'links' : /path inside|screenshots/.test(msg) ? 'images' : /launch_date|launch_week/.test(msg) ? 'date' : /freeTier|cardRequired|dataLocation|setup|catch|lastChecked|testedBy/.test(msg) ? 'facts' : 'fields', msg);
    }
    const tagline = typeof r.tagline === 'string' ? r.tagline.trim() : '';
    if (tagline.length > TAGLINE_MAX) fail('fields', `"tagline" is ${tagline.length} characters; keep it to ${TAGLINE_MAX}`);
    if (!Object.hasOwn(CATEGORIES, r.category) && !problems.some(p => p.msg.includes('"category"'))) fail('fields', '"category" must be one of: biz, job, sec');

    // links: every link field is https (validateLaunches covers repo, website and maker links; logo and video too if remote)
    for (const key of ['repo_url', 'website_url', 'video_url']) {
      const v = r[key];
      if (v && typeof v === 'string' && /^[a-z]+:/i.test(v) && !httpsUrl(v) && !problems.some(p => p.msg.includes(`"${key}"`))) fail('links', `"${key}" must be an https:// link`);
    }

    // images: logo and 3 to 5 screenshots, as files in this launch's own folder
    const folder = sample ? 'test/fixtures/launches' : 'public/launches';
    const local = (key, v, kind) => {
      const src = typeof v === 'string' ? v : v && v.src;
      if (!src) { fail('images', `${key} is missing`); return; }
      const m = /^\/launches\/([a-z0-9-]+)\/([A-Za-z0-9._-]+)$/.exec(src);
      if (!m || m[1] !== r.slug) { fail('images', `${key} must be a file in public/launches/${r.slug}/ (got ${src})`); return; }
      if (!IMAGE_EXT.test(m[2])) { fail('images', `${key} must be a .png, .jpg, .webp, .gif or .svg file`); return; }
      const path = `${folder}/${m[1]}/${m[2]}`;
      const buf = readFile(path);
      if (!buf) { fail('images', `${key}: ${path} does not exist`); return; }
      const lim = LIMITS[kind], kb = n => `${Math.round(n / 1024)} KB`;
      if (buf.length < lim.minBytes || buf.length > lim.maxBytes) fail('images', `${key}: ${path} is ${kb(buf.length)}; expected ${lim.minBytes} bytes to ${kb(lim.maxBytes)}`);
      const size = imageSize(buf);
      const ext = m[2].split('.').pop().toLowerCase().replace('jpg', 'jpeg');
      if (size && size.type !== ext) fail('images', `${key}: ${path} is really a ${size.type.toUpperCase()} file; give it a .${size.type === 'jpeg' ? 'jpg' : size.type} name`);
      if (!size && ext !== 'svg') fail('images', `${key}: ${path} is not a readable ${ext.toUpperCase()} image`);
      if (!size) return; // SVG: no pixel size to check
      if (kind === 'logo') {
        if (Math.abs(size.width - size.height) > Math.max(2, size.width * 0.02)) fail('images', `logo is ${size.width}×${size.height}; it must be square (512×512 is ideal)`);
        else if (size.width < lim.minPx || size.width > lim.maxPx) fail('images', `logo is ${size.width}×${size.height}; expected ${lim.minPx} to ${lim.maxPx} pixels square`);
      } else if (size.width < lim.minWidth || size.width > lim.maxWidth) fail('images', `${key} is ${size.width} pixels wide; expected ${lim.minWidth} to ${lim.maxWidth}`);
    };
    local('logo_url', r.logo_url, 'logo');
    const shots = Array.isArray(r.screenshots) ? r.screenshots : [];
    if (shots.length < SHOTS_MIN || shots.length > SHOTS_MAX) fail('images', `${shots.length} screenshot${shots.length === 1 ? '' : 's'}; give ${SHOTS_MIN} to ${SHOTS_MAX}`);
    shots.forEach((s, j) => local(`screenshots[${j}]`, s, 'shot'));
    // every screenshot needs its own alt text: what it shows, for people using a screen reader (the page would otherwise
    // fall back to "<name> screenshot 1", which says nothing)
    shots.forEach((s, j) => {
      const alt = s && typeof s === 'object' && typeof s.alt === 'string' ? s.alt.trim() : '';
      if (!alt) fail('images', `screenshots[${j}] needs "alt" text saying what it shows`);
      else if (alt.length < ALT_MIN || /^(image|screenshot|shot|picture)\s*\d*$/i.test(alt)) fail('images', `screenshots[${j}]: "alt" should say what the screenshot shows (got "${alt}")`);
    });

    // date: Launch Week 1, a Monday, still ahead
    const opens = launchOpensAt(r.launch_date);
    if (r.launch_week !== site.week) fail('date', `"launch_week" is ${r.launch_week}; Launch Week ${site.week} is the one being prepared (lib/site.js)`);
    if (Number.isNaN(opens)) { if (!problems.some(p => p.col === 'date' && p.msg.includes('launch_date'))) fail('date', '"launch_date" must be a real date like 2026-11-23'); } else {
      if (new Date(`${r.launch_date}T12:00:00Z`).getUTCDay() !== 1) fail('date', `${r.launch_date} is not a Monday`);
      if (r.launch_date !== site.date) fail('date', `${r.launch_date} is not Launch Week ${site.week}'s launch day (${site.date}, lib/site.js)`);
      if (now >= opens) (ci ? warn : fail)('date', `${r.launch_date} has already started (12:01 AM Pacific)`);
    }

    // facts: only where known
    const FACT_KEYS = ['freeTier', 'cardRequired', 'dataLocation', 'setup', 'catch'];
    for (const key of FACT_KEYS) if (typeof r[key] === 'string' && PLACEHOLDER.test(r[key]) && !(key === 'cardRequired')) fail('facts', `"${key}" looks like a placeholder ("${r[key]}"); leave it out until it is known`);
    if (typeof r.cardRequired === 'string' && r.cardRequired.trim().toLowerCase() === 'unknown') fail('facts', '"cardRequired" is "unknown"; leave it out until it is known');
    if (FACT_KEYS.some(k => r[k] !== undefined && r[k] !== null && r[k] !== '') && !r.lastChecked) fail('facts', 'free facts need a "lastChecked" date (when they were checked against the docs)');
    if (r.testedBy !== undefined && r.testedBy !== null && r.testedBy !== '') {
      const on = typeof r.testedOn === 'string' ? launchOpensAt(r.testedOn) : NaN;
      if (r.testedBy !== TESTED_BY) fail('facts', `"testedBy" can only be "${TESTED_BY}"`);
      else if (Number.isNaN(on)) fail('facts', '"testedBy" is set, but "testedOn" is missing: it is set by hand, with the date we ran the tool ourselves');
      else if (on > now) fail('facts', '"testedOn" is in the future');
    }

    // listing: not already on the Launch List, unless explained
    const repo = githubRepo(r.repo_url);
    const twin = tools.find(t => (repo && String(t.repo || '').toLowerCase() === repo) || (norm(t.name) && norm(t.name) === norm(r.name)) || t.slug === r.slug);
    if (twin) {
      const note = typeof r.duplicateNote === 'string' ? r.duplicateNote.trim() : '';
      if (!note) fail('listing', `same tool as "${twin.name}" on the Launch List (/tool/${twin.slug}/); add a "duplicateNote" saying why it launches anyway`);
      else warn('listing', `also on the Launch List as "${twin.name}" (note: ${note})`);
    }

    const failed = Object.values(cols).includes('FAIL');
    return { slug, name: String(r.name || ''), sample, cols, problems, status: sample ? 'SAMPLE' : failed ? 'FAIL' : 'PASS' };
  });

  // a file-level error (not about one entry)
  const fileErrors = errors.filter(e => !/^launches\[\d+\]/.test(e));
  const real = rows.filter(r => !r.sample).length;
  const countStatus = real === makersConfirmed ? 'PASS' : 'WARN';
  const ok = !fileErrors.length && rows.every(r => r.status !== 'FAIL');
  return { rows, fileErrors, real, makersConfirmed, countStatus, ok, parsed: launches.length };
}

// The printed report: one table row per launch, then the problems, then the count
export function formatReport(result) {
  const head = ['launch', ...COLUMNS, 'result'];
  const body = result.rows.map(r => [r.slug, ...COLUMNS.map(c => r.cols[c]), r.status]);
  const widths = head.map((h, i) => Math.max(h.length, ...body.map(b => b[i].length)));
  const line = cells => cells.map((c, i) => c.padEnd(widths[i])).join('  ').trimEnd();
  const out = [line(head), line(widths.map(w => '-'.repeat(w))), ...body.map(line)];
  for (const e of result.fileErrors) out.push('', `FILE: ${e}`);
  for (const r of result.rows.filter(x => x.problems.length)) {
    out.push('', `${r.slug}${r.sample ? ' (sample: placeholder, never seeded to the live site; does not fail the check)' : ''}:`);
    for (const p of r.problems) out.push(`  [${p.col}] ${p.msg}`);
  }
  const diff = result.real - result.makersConfirmed;
  out.push('', `Real launches: ${result.real} of ${result.makersConfirmed} confirmed makers (MAKERS_CONFIRMED, lib/site.js): ${result.countStatus}${diff ? ` (${diff < 0 ? `${-diff} still to come` : `${diff} more than confirmed`})` : ''}`);
  const samples = result.rows.filter(r => r.sample).length;
  if (samples) out.push(`Sample entries: ${samples} (flagged; delete them when the real launches are in)`);
  out.push(result.ok ? 'Launch check: PASS' : 'Launch check: FAIL');
  return out.join('\n');
}
