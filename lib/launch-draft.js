// Drafts a data/launches.json entry from what a maker sent: a /submit/ row (the submissions table) or an email pasted into a
// text file, laid out like the reply checklist ("Tagline: ...", "Description: ...", one label per line). Pure: the caller
// passes the files it found in public/launches/<slug>/ and the date, so the tests can use their own.
//
// The draft is a starting point for review, never a launch: the maker's email address is never copied into it, facts from a
// submission stay without a "lastChecked" date until we have checked them against the tool's docs, screenshots get an empty
// "alt" until someone writes what each one shows, and everything still missing is listed in `todo`.

import { FIRST_LAUNCH_WEEK } from './site.js';
import { SLUG_RE, httpsUrl } from './launch-data.js';

// Email labels -> entry fields. Matched at the start of a line, case-insensitive, followed by ":".
const LABELS = [
  ['name', /^(tool|tool name|name of the tool|product)$/],
  ['tagline', /^tagline$/],
  ['description', /^description$/],
  ['website_url', /^(website|site|homepage)$/],
  ['repo_url', /^(source|source code|repo|repository|github|code)$/],
  ['maker_name', /^(your name|name|maker|maker name)$/],
  ['handles', /^(handles|your handles|links|social)$/],
  ['maker_story', /^(maker story|your maker story|story|why i built it)$/],
  ['category', /^(category|audience|for)$/],
  ['license', /^(license|licence)$/],
  ['video_url', /^(video|gif|demo)$/],
];
const LABEL_LINE = /^\s*(?:[-*]\s*)?([A-Za-z][A-Za-z ']{1,30}?)\s*:\s*(.*)$/;

// Any email address (a sign-off, a quoted header): a line holding one is never copied into a draft
const EMAIL = /[^\s@<>()]+@[^\s@<>()]+\.[a-z]{2,}/i;
// Where a field's text stops: a sign-off line, or a quoted earlier message
const SIGN_OFF = /^\s*(thanks|thank you|cheers|best|regards|kind regards|best regards|--|>|on .+ wrote:)/i;

// "Tagline: x\nDescription: y\n  more" -> { tagline: 'x', description: 'y\nmore' }. Unknown labels end the field before them.
export function parseEmail(text) {
  const out = {};
  let key = null;
  for (const line of String(text || '').replace(/\r\n?/g, '\n').split('\n')) {
    if (EMAIL.test(line)) { key = null; continue; }
    if (SIGN_OFF.test(line)) { key = null; continue; }
    const m = LABEL_LINE.exec(line);
    const label = m && m[1].trim().toLowerCase();
    const hit = label && LABELS.find(([, re]) => re.test(label));
    if (hit) { key = hit[0]; out[key] = m[2].trim(); continue; }
    if (m && !/^https?$/i.test(m[1].trim())) { key = null; continue; } // another "Label:" line we don't use
    if (key && line.trim()) out[key] = out[key] ? `${out[key]}\n${line.trim()}` : line.trim();
    else if (key && out[key]) out[key] += '\n';
  }
  for (const k of Object.keys(out)) out[k] = out[k].replace(/\n{3,}/g, '\n\n').trim();
  return out;
}

export const slugFor = name => String(name || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64);

const CATEGORY_WORDS = [['biz', /small business|business|biz/i], ['job', /job|career/i], ['sec', /secur|soc\b|sec\b/i]];
const categoryOf = v => (CATEGORY_WORDS.find(([, re]) => re.test(String(v || ''))) || [''])[0];

// "https://x.com/mia, https://github.com/mia" -> [{ label: 'X', url }, { label: 'GitHub', url }]; bare handles are left for review
const HOSTS = { 'x.com': 'X', 'twitter.com': 'X', 'github.com': 'GitHub', 'linkedin.com': 'LinkedIn', 'bsky.app': 'Bluesky', 'youtube.com': 'YouTube' };
export function makerLinks(text) {
  const links = [], skipped = [];
  for (const part of String(text || '').split(/[\s,;]+/).filter(Boolean)) {
    const url = httpsUrl(part);
    if (!url) { skipped.push(part); continue; }
    const host = new URL(url).hostname.replace(/^www\./, '');
    links.push({ label: HOSTS[host] || 'Website', url });
  }
  return { links, skipped };
}

// The Monday of launch week n (week 1 is FIRST_LAUNCH_WEEK.date)
export function weekDate(week, first = FIRST_LAUNCH_WEEK) {
  const d = new Date(`${first.date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 7 * (week - first.week));
  return d.toISOString().slice(0, 10);
}

const SETUP = { browser: 'Browser, ready to use', desktop: 'Desktop app', selfhost: 'Install & self-host' };
const IMAGE = /\.(png|jpe?g|webp|gif|svg)$/i;

// fields: what the maker sent, already as entry fields (from parseEmail or fromSubmission). files: names in public/launches/<slug>/.
// -> { entry, todo: [strings] }
export function draftEntry(fields, { slug, week = FIRST_LAUNCH_WEEK.week, files = [] } = {}) {
  const todo = [];
  const name = String(fields.name || '').trim();
  const s = slug || slugFor(name);
  if (!SLUG_RE.test(s)) todo.push(`slug: give one with --slug (lowercase letters, numbers and hyphens; got "${s}")`);

  const repo = httpsUrl(fields.repo_url), site = httpsUrl(fields.website_url);
  // a submission has one "url": a github.com link is the source, anything else the website
  const url = httpsUrl(fields.url);
  const repo_url = repo || (url && new URL(url).hostname === 'github.com' ? url : null);
  const website_url = site || (url && !repo_url ? url : null);

  const { links, skipped } = makerLinks(fields.handles);
  if (skipped.length) todo.push(`maker_links: these are not https links, add them by hand if wanted: ${skipped.join(' ')}`);

  const imgs = files.filter(f => IMAGE.test(f)).sort();
  const logo = imgs.find(f => /^logo\./i.test(f));
  const shots = imgs.filter(f => f !== logo && !/^logo\./i.test(f));

  const entry = {
    slug: s, name, tagline: String(fields.tagline || '').trim(), description: String(fields.description || '').trim(),
    category: categoryOf(fields.category),
    repo_url, website_url,
    logo_url: logo ? `/launches/${s}/${logo}` : null,
    screenshots: shots.map(f => ({ src: `/launches/${s}/${f}`, alt: '' })),
    video_url: httpsUrl(fields.video_url),
    maker_name: String(fields.maker_name || '').trim(),
    maker_links: links,
    maker_story: String(fields.maker_story || '').trim(),
    license: String(fields.license || '').trim(),
    launch_week: week,
    launch_date: weekDate(week),
  };
  // free facts from a /submit/ row: kept, but without lastChecked until they are checked against the docs
  if (fields.freeTier) entry.freeTier = String(fields.freeTier).trim().slice(0, 80);
  if (fields.cardRequired === 'yes' || fields.cardRequired === 'no') entry.cardRequired = fields.cardRequired;
  if (SETUP[fields.setup]) entry.setup = SETUP[fields.setup];

  for (const [key, label] of [['name', 'tool name'], ['tagline', 'tagline (up to 60 characters)'], ['description', 'description (2 to 3 sentences)'], ['maker_name', 'maker name'], ['license', 'license'], ['maker_story', 'maker story']]) {
    if (!entry[key]) todo.push(`${key}: ask the maker for the ${label}`);
  }
  if (!entry.category) todo.push('category: biz, job or sec (the maker said "' + String(fields.category || '').trim() + '")');
  if (!repo_url && !website_url) todo.push('links: no https website or source link');
  if (!logo) todo.push(`logo: put the maker's logo in public/launches/${s}/logo.png (512px square)`);
  if (shots.length < 3) todo.push(`screenshots: ${shots.length} found in public/launches/${s}/; 3 to 5 are needed`);
  if (shots.length) todo.push('screenshots: write each "alt" (what the screenshot shows)');
  if (entry.freeTier || entry.cardRequired || entry.setup) todo.push('facts: confirm them against the tool\'s official docs (and with the maker), then add "lastChecked"');
  else todo.push('facts: add freeTier, cardRequired, dataLocation, setup and catch from the official docs, with "lastChecked"');
  return { entry, todo };
}

// A row of the submissions table (schema.sql) -> fields for draftEntry. The email column is dropped on purpose.
export function fromSubmission(row) {
  const r = row || {};
  return {
    name: r.tool_name, url: r.url, maker_name: r.maker_name, category: r.category, license: r.license,
    freeTier: r.free_tier, cardRequired: r.card_required, setup: r.setup,
  };
}

// data/launches.json with the draft added (or replacing the entry with the same slug), and without any "sample" entry
export function withDraft(data, entry) {
  const launches = (Array.isArray(data && data.launches) ? data.launches : []).filter(l => l && l.slug !== entry.slug);
  return { ...data, launches: [...launches, entry] };
}
