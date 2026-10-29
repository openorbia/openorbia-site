// Validation and SQL generation for data/launches.json. Used by scripts/seed-launches.mjs and the tests.

import { launchOpensAt } from './time.js';
import { CARD_REQUIRED, DATA_LOCATIONS, SETUPS, TESTED_BY } from '../public/assets/facts.js';

export const CATEGORIES = { biz: 'Small Business', job: 'Job Seekers', sec: 'Cybersecurity & SOC' };

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const MAX_SCREENSHOTS = 8;

const LOCAL_PATH_RE = /^\/launches\/([a-z0-9]+(?:-[a-z0-9]+)*)\/[A-Za-z0-9._-]+$/;

export function httpsUrl(u) {
  try {
    const x = new URL(String(u));
    return x.protocol === 'https:' && x.hostname.includes('.') ? x.toString() : null;
  } catch { return null; }
}

// An image/video path inside this launch's own folder, or an https URL
export function assetUrl(u, slug) {
  const s = String(u ?? '');
  const m = LOCAL_PATH_RE.exec(s);
  if (m) return m[1] === slug && !s.includes('..') ? s : null;
  return httpsUrl(s);
}

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max + 1) : '');

// The optional "Free facts" fields of one entry (freeTier, cardRequired, dataLocation, setup, catch, lastChecked, testedBy).
// Anything empty or missing is left out; anything present must be valid. -> { facts, problems: [strings] }
export function cleanFacts(raw) {
  const facts = {};
  const problems = [];
  const present = key => raw[key] !== undefined && raw[key] !== null && raw[key] !== '';
  const oneOf = (key, allowed, norm = v => v) => {
    if (!present(key)) return;
    const v = typeof raw[key] === 'string' ? norm(raw[key].trim()) : raw[key];
    if (allowed.includes(v)) facts[key] = v;
    else problems.push(`"${key}" must be one of: ${allowed.map(a => `"${a}"`).join(', ')}`);
  };
  for (const [key, max] of [['freeTier', 80], ['catch', 140]]) {
    if (!present(key)) continue;
    const v = str(raw[key], max);
    if (!v) problems.push(`"${key}" must be text`);
    else if (v.length > max) problems.push(`"${key}" is too long (max ${max} characters)`);
    else facts[key] = v;
  }
  oneOf('cardRequired', CARD_REQUIRED, v => v.toLowerCase());
  oneOf('dataLocation', DATA_LOCATIONS);
  oneOf('setup', SETUPS);
  if (present('lastChecked')) {
    if (typeof raw.lastChecked === 'string' && !Number.isNaN(launchOpensAt(raw.lastChecked.trim()))) facts.lastChecked = raw.lastChecked.trim();
    else problems.push('"lastChecked" must be a real date like 2026-11-10');
  }
  if (present('testedBy')) {
    if (raw.testedBy === TESTED_BY) facts.testedBy = TESTED_BY;
    else problems.push(`"testedBy" can only be "${TESTED_BY}" (it says we tested the tool), or left out`);
  }
  return { facts, problems };
}

// -> { launches: [normalised rows], errors: [strings], localFiles: ['/launches/<slug>/x.png', ...] }
export function validateLaunches(data) {
  const errors = [];
  const out = [];
  const localFiles = [];
  const list = data && Array.isArray(data.launches) ? data.launches : null;
  if (!list) return { launches: [], errors: ['The file must be an object with a "launches" array.'], localFiles };

  const seen = new Set();
  list.forEach((raw, i) => {
    const at = `launches[${i}]${raw && raw.slug ? ` (${raw.slug})` : ''}`;
    const bad = msg => errors.push(`${at}: ${msg}`);
    if (!raw || typeof raw !== 'object') return bad('must be an object');

    const slug = str(raw.slug, 64);
    if (!slug || slug.length > 64 || !SLUG_RE.test(slug)) bad('"slug" must be lowercase letters, numbers and hyphens (max 64), e.g. "my-tool"');
    else if (seen.has(slug)) bad('duplicate slug');
    else seen.add(slug);

    const need = (key, max) => {
      const v = str(raw[key], max);
      if (!v) bad(`"${key}" is required`);
      else if (v.length > max) bad(`"${key}" is too long (max ${max} characters)`);
      return v.slice(0, max);
    };
    const name = need('name', 80);
    const tagline = need('tagline', 140);
    const description = need('description', 3000);
    const maker_name = need('maker_name', 80);
    const license = need('license', 60);

    const category = raw.category;
    if (!Object.hasOwn(CATEGORIES, category)) bad('"category" must be one of: biz, job, sec');

    const week = raw.launch_week;
    if (!Number.isInteger(week) || week < 1) bad('"launch_week" must be a whole number, 1 or more');
    const launch_date = str(raw.launch_date, 10);
    if (Number.isNaN(launchOpensAt(launch_date))) bad('"launch_date" must be a real date like 2026-11-23');

    const url = (key, { required = false } = {}) => {
      const v = raw[key];
      if (v === undefined || v === null || v === '') { if (required) bad(`"${key}" is required`); return null; }
      const ok = httpsUrl(v);
      if (!ok) bad(`"${key}" must be an https:// link`);
      return ok;
    };
    const repo_url = url('repo_url');
    const website_url = url('website_url');
    if (!repo_url && !website_url) bad('give at least one of "repo_url" or "website_url"');

    const asset = (key, v) => {
      const ok = assetUrl(v, slug);
      if (!ok) bad(`"${key}" must be a path inside /launches/${slug}/ (like /launches/${slug}/logo.png) or an https:// link`);
      else if (ok.startsWith('/')) localFiles.push(ok);
      return ok;
    };
    let logo_url = null;
    if (raw.logo_url) logo_url = asset('logo_url', raw.logo_url);

    const shots = [];
    if (raw.screenshots !== undefined && !Array.isArray(raw.screenshots)) bad('"screenshots" must be a list');
    else {
      if ((raw.screenshots || []).length > MAX_SCREENSHOTS) bad(`at most ${MAX_SCREENSHOTS} screenshots`);
      (raw.screenshots || []).slice(0, MAX_SCREENSHOTS).forEach((s, j) => {
        const item = typeof s === 'string' ? { src: s } : s;
        const src = item && asset(`screenshots[${j}].src`, item.src);
        if (src) shots.push({ src, alt: str(item.alt, 160) || `${name || slug} screenshot ${j + 1}` });
      });
    }

    let video_url = null;
    if (raw.video_url) video_url = asset('video_url', raw.video_url);

    const links = [];
    if (raw.maker_links !== undefined && !Array.isArray(raw.maker_links)) bad('"maker_links" must be a list');
    else (raw.maker_links || []).forEach((l, j) => {
      const label = str(l && l.label, 40);
      const u = l && httpsUrl(l.url);
      if (!label || !u) bad(`"maker_links[${j}]" needs a "label" and an https:// "url"`);
      else links.push({ label, url: u });
    });

    const maker_story = str(raw.maker_story, 4000);
    if (maker_story.length > 4000) bad('"maker_story" is too long (max 4000 characters)');

    const { facts, problems } = cleanFacts(raw);
    problems.forEach(bad);

    out.push({
      slug, name, tagline, description, category, repo_url, website_url, logo_url,
      screenshots: shots, video_url, maker_name, maker_links: links, maker_story: maker_story.slice(0, 4000),
      license, launch_week: week, launch_date, facts, sample: raw.sample === true,
    });
  });
  return { launches: out, errors, localFiles };
}

// Which entries go to a database: everything locally; for the live database, not the placeholder samples unless asked
export function forTarget(launches, { remote = false, includeSamples = false } = {}) {
  return remote && !includeSamples ? launches.filter(l => !l.sample) : launches;
}

// A SQL string literal. The seed file is built from data you edit, so quotes are doubled and NUL bytes refused.
export function sqlStr(v) {
  if (v === null || v === undefined) return 'NULL';
  const s = String(v);
  if (s.includes('\0')) throw new Error('A value contains a NUL character');
  return `'${s.replace(/'/g, "''")}'`;
}

const COLUMNS = ['slug', 'name', 'tagline', 'description', 'category', 'repo_url', 'website_url', 'logo_url', 'screenshots',
  'video_url', 'maker_name', 'maker_links', 'maker_story', 'license', 'launch_week', 'launch_date', 'facts'];

// Upserts (never INSERT OR REPLACE: that would delete the row and, through ON DELETE CASCADE, its votes).
// With prune, launches that are no longer in the file are deleted together with their votes.
export function toSql(launches, { prune = false } = {}) {
  const rows = launches.map(l => {
    const v = { ...l, screenshots: JSON.stringify(l.screenshots), maker_links: JSON.stringify(l.maker_links), facts: JSON.stringify(l.facts || {}) };
    const values = COLUMNS.map(c => (c === 'launch_week' ? String(Number(v[c])) : sqlStr(v[c])));
    const updates = COLUMNS.filter(c => c !== 'slug').map(c => `${c} = excluded.${c}`).join(', ');
    return `INSERT INTO launches (${COLUMNS.join(', ')}) VALUES (${values.join(', ')}) ON CONFLICT(slug) DO UPDATE SET ${updates};`;
  });
  if (prune) {
    const keep = launches.map(l => sqlStr(l.slug)).join(', ') || "''";
    rows.push(`DELETE FROM votes WHERE launch_slug NOT IN (${keep});`);
    rows.push(`DELETE FROM launches WHERE slug NOT IN (${keep});`);
  }
  return rows.join('\n') + '\n';
}
