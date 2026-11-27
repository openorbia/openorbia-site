#!/usr/bin/env node
// Read-only check of the live site (or a preview): only GET requests, never a form post.
//
//   npm run check:live                                    https://openorbia.com
//   BASE_URL=https://pr-92.openorbia.pages.dev npm run check:live
//
// For /, /launches/, /how-voting-works/, /makers/, /faq/ and /submit/ it checks: HTTP 200; at most one time zone named in the
// visible text; no "free and open-source", "Join the waitlist" or "checked by hand"; and it lists every "<number> tools / makers /
// subscribers / stars / readers" phrase for a person to verify (listed, not failed). Then it reads /sitemap.xml and checks that
// every URL in it answers 200, 8 at a time, without following redirects. It prints a table of PASS/FAIL and exits 1 on any FAIL.

import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const PAGES = ['/', '/launches/', '/how-voting-works/', '/makers/', '/faq/', '/submit/'];
export const BATCH = 8;
const UA = 'openorbia-check-live (read-only)';

// The text a visitor reads: tags, comments, <script>, <style> and <template> contents left out, entities decoded, spaces squeezed.
// A small scanner rather than a regular expression, so nothing is half-removed.
const SKIP_BLOCKS = ['script', 'style', 'template', 'noscript'];
export function visibleText(html) {
  const s = String(html), lower = s.toLowerCase();
  let out = '', i = 0;
  while (i < s.length) {
    const lt = s.indexOf('<', i);
    if (lt < 0) { out += s.slice(i); break; }
    out += s.slice(i, lt);
    if (s.startsWith('<!--', lt)) { const end = s.indexOf('-->', lt + 4); i = end < 0 ? s.length : end + 3; continue; }
    const name = (/^<([a-zA-Z][\w-]*)/.exec(s.slice(lt, lt + 40)) || [])[1]?.toLowerCase();
    const gt = s.indexOf('>', lt + 1);
    if (gt < 0) break;
    if (name && SKIP_BLOCKS.includes(name)) {
      const close = lower.indexOf(`</${name}`, gt + 1);
      const closeEnd = close < 0 ? -1 : s.indexOf('>', close);
      i = closeEnd < 0 ? s.length : closeEnd + 1;
    } else {
      i = gt + 1;
    }
    out += ' ';
  }
  return decode(out).replace(/\s+/g, ' ').trim();
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', middot: '·', mdash: '—', ndash: '–', hellip: '…', rarr: '→' };
function decode(t) {
  return t.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return Object.hasOwn(ENTITIES, e.toLowerCase()) ? ENTITIES[e.toLowerCase()] : m;
  });
}

// Time zones named in the text, as families: "Central" / "CT" / "CST" / "CDT" are one zone
const ZONES = [
  ['Central', /\b(?:Central|CT|CST|CDT)\b/],
  ['Pacific', /\b(?:Pacific|PT|PST|PDT)\b/],
  ['Eastern', /\b(?:Eastern|ET|EST|EDT)\b/],
  ['Mountain', /\b(?:Mountain Time|MST|MDT)\b/],
];
export const zonesIn = text => ZONES.filter(([, re]) => re.test(text)).map(([name]) => name);

export const BANNED = [
  ['free and open-source', /free and open-source/i],
  ['Join the waitlist', /Join the waitlist/i],
  ['checked by hand', /checked by hand/i],
];
export const bannedIn = text => BANNED.filter(([, re]) => re.test(text)).map(([label]) => label);

// "47 tools", "1.8M+ GitHub stars", "12 makers": every count phrase, for a person to check against the data
const COUNT = /\b\d[\d,.]*\s*[KkMm]?\+?\s+(?:\w+\s+)?(?:tools?|makers?|subscribers?|stars?|readers?)\b/g;
export const countsIn = text => [...new Set(text.match(COUNT) || [])];

// <loc> addresses in a sitemap, moved onto `base` when it is a preview (the sitemap always names openorbia.com)
export function sitemapUrls(xml, base) {
  const locs = [...String(xml).matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map(m => m[1].replace(/&amp;/g, '&'));
  return locs.map(u => { const url = new URL(u); return new URL(url.pathname + url.search, base).href; });
}

// One page's result rows: [{ check, page, result: 'PASS' | 'FAIL', detail }]
export function pageRows(path, status, html) {
  const row = (check, ok, detail = '') => ({ check, page: path, result: ok ? 'PASS' : 'FAIL', detail });
  const rows = [row('HTTP 200', status === 200, String(status))];
  if (status !== 200) return rows;
  const text = visibleText(html);
  const zones = zonesIn(text);
  rows.push(row('one time zone', zones.length <= 1, zones.join(', ') || 'none'));
  const banned = bannedIn(text);
  rows.push(row('no old wording', banned.length === 0, banned.join(', ')));
  return rows;
}

const get = (url, fetchImpl) => fetchImpl(url, { method: 'GET', redirect: 'manual', headers: { 'user-agent': UA, accept: 'text/html,application/xml' } });

export async function checkLive({ base = 'https://openorbia.com', fetchImpl = fetch, log = console } = {}) {
  const rows = [], counts = [];
  for (const path of PAGES) {
    let status = 0, html = '';
    try { const res = await get(new URL(path, base).href, fetchImpl); status = res.status; html = res.status === 200 ? await res.text() : ''; }
    catch (e) { status = `error: ${e.message}`; }
    rows.push(...pageRows(path, status, html));
    if (status === 200) for (const c of countsIn(visibleText(html))) counts.push({ page: path, phrase: c });
  }
  // the sitemap
  let urls = [];
  try {
    const res = await get(new URL('/sitemap.xml', base).href, fetchImpl);
    rows.push({ check: 'sitemap.xml 200', page: '/sitemap.xml', result: res.status === 200 ? 'PASS' : 'FAIL', detail: String(res.status) });
    if (res.status === 200) urls = sitemapUrls(await res.text(), base);
  } catch (e) { rows.push({ check: 'sitemap.xml 200', page: '/sitemap.xml', result: 'FAIL', detail: e.message }); }
  const bad = [];
  for (let i = 0; i < urls.length; i += BATCH) {
    const results = await Promise.all(urls.slice(i, i + BATCH).map(async u => {
      try { const r = await get(u, fetchImpl); return [u, r.status]; } catch (e) { return [u, `error: ${e.message}`]; }
    }));
    for (const [u, s] of results) if (s !== 200) bad.push(`${new URL(u).pathname} ${s}`);
  }
  rows.push({ check: 'sitemap URLs 200', page: `${urls.length} URLs`, result: urls.length && !bad.length ? 'PASS' : 'FAIL', detail: bad.slice(0, 10).join('; ') });
  log.table(rows);
  if (counts.length) { log.log('Counts to verify against the data:'); log.table(counts); }
  return { rows, counts, failed: rows.some(r => r.result === 'FAIL') };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const base = process.env.BASE_URL || 'https://openorbia.com';
  console.log(`Checking ${base} (GET only)`);
  const { failed } = await checkLive({ base });
  process.exit(failed ? 1 : 0);
}
