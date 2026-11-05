// Weekly source check: re-reads the official pages behind every Launch List tool (the `sources` in
// data/free-facts.json) and reports what changed since the last run, so a free tier, price or card
// requirement that changed upstream is caught before a visitor finds it. Pure functions only; the
// network and file work is in scripts/check-sources.mjs.

import { createHash } from 'node:crypto';

// One entry per distinct source URL, with the tools that cite it.
export function sourceTargets(facts) {
  const byUrl = new Map();
  for (const t of facts) {
    for (const url of t.sources || []) {
      if (!byUrl.has(url)) byUrl.set(url, { url, fetchUrl: toFetchUrl(url), tools: [] });
      byUrl.get(url).tools.push(t.name);
    }
  }
  return [...byUrl.values()];
}

// GitHub pages are fetched as the raw file: the HTML page around a README changes with every star and
// commit, the README itself only when the maker edits it.
export function toFetchUrl(url) {
  const u = new URL(url);
  if (u.hostname === 'github.com') {
    const [owner, repo, kind, ref, ...path] = u.pathname.split('/').filter(Boolean);
    if (owner && repo && !kind) return `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/README.md`;
    if (owner && repo && kind === 'blob' && ref && path.length) return `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${path.join('/')}`;
  }
  u.hash = '';
  return u.toString();
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–', hellip: '…', euro: '€', pound: '£' };

// The readable text of a page, one line per block, so a diff shows whole sentences.
export function pageText(body, contentType = '') {
  let s = String(body);
  if (/html/i.test(contentType) || /^\s*<(!doctype|html)/i.test(s)) {
    s = s
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<(script|style|noscript|svg|template|head)\b[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<\/?(p|div|li|ul|ol|tr|td|th|table|section|article|header|footer|nav|main|aside|h[1-6]|br|hr|dd|dt|dl|blockquote|pre)\b[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) => {
        if (e[0] === '#') { const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) ? String.fromCodePoint(n) : m; }
        return ENTITIES[e.toLowerCase()] ?? m;
      });
  }
  return s.split(/\r?\n/).map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');
}

// Words that decide whether a tool is still free for our readers.
const PRICING = /\b(free|freemium|pricing|prices?|paid|trial|credit card|card required|subscriptions?|per month|monthly|per year|annual|per seat|per user|plans?|tiers?|licen[cs]e[sd]?|enterprise|billing|billed|pay as you go|usage limits?|quota|open[- ]source|self[- ]host(ed|ing)?)\b|[$€£]\s?\d/i;

export function pricingLines(text) {
  const out = new Set();
  for (const line of text.split('\n')) {
    if (!PRICING.test(line)) continue;
    out.add(line.length > 300 ? `${line.slice(0, 297)}...` : line);
  }
  return [...out];
}

export const hashText = text => createHash('sha256').update(text).digest('hex').slice(0, 16);

// What a fetch turned into, stored per URL in the snapshots file (.ops-cache/source-snapshots.json; the Actions cache in CI).
export function snapshotOf(text) {
  return { hash: hashText(text), pricing: pricingLines(text) };
}

// prev = last stored snapshot (or undefined), now = { ok, httpStatus, error?, snapshot? }.
export function compare(prev, now) {
  if (!now.ok) return { status: now.httpStatus === 404 || now.httpStatus === 410 ? 'broken' : 'error', detail: now.error || `HTTP ${now.httpStatus}` };
  if (!prev) return { status: 'new' };
  if (prev.hash === now.snapshot.hash) return { status: 'unchanged' };
  const before = new Set(prev.pricing || []), after = new Set(now.snapshot.pricing);
  const added = [...after].filter(l => !before.has(l)), removed = [...before].filter(l => !after.has(l));
  return added.length || removed.length ? { status: 'pricing', added, removed } : { status: 'changed' };
}

// ---- robots.txt (RFC 9309) ----

export const AGENT_TOKEN = 'OpenOrbiaSourceCheck';
export const USER_AGENT = `${AGENT_TOKEN}/1.0 (+https://openorbia.com/how-we-check/)`;

// The rules that apply to us: the groups naming our product token, or else the "*" groups. [] = everything allowed.
export function robotsRules(text, token = AGENT_TOKEN) {
  const groups = [];
  let cur = null, lastWasAgent = false;
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    const m = /^([a-z-]+)\s*:\s*(.*)$/i.exec(line);
    if (!m) continue;
    const key = m[1].toLowerCase(), value = m[2].trim();
    if (key === 'user-agent') {
      if (!lastWasAgent) groups.push(cur = { agents: [], rules: [] });
      cur.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else {
      lastWasAgent = false;
      if (cur && (key === 'allow' || key === 'disallow') && value) cur.rules.push({ allow: key === 'allow', path: value });
    }
  }
  const mine = groups.filter(g => g.agents.includes(token.toLowerCase()));
  return (mine.length ? mine : groups.filter(g => g.agents.includes('*'))).flatMap(g => g.rules);
}

// "*" matches anything, a "$" at the end anchors the end; every other character is literal
const ruleRegex = path => new RegExp('^' + path.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$'));

// The longest matching rule wins; on a tie, Allow wins. /robots.txt itself is always allowed.
export function robotsAllows(rules, pathAndQuery) {
  if (pathAndQuery === '/robots.txt') return true;
  let best = null;
  for (const r of rules) {
    if (!ruleRegex(r.path).test(pathAndQuery)) continue;
    if (!best || r.path.length > best.path.length || (r.path.length === best.path.length && r.allow)) best = r;
  }
  return !best || best.allow;
}

// What a robots.txt fetch means: 2xx = its rules; 4xx = no rules (allowed); 5xx or unreachable = assume everything is disallowed.
export function robotsPolicy({ ok, httpStatus, text }) {
  if (ok) return { rules: robotsRules(text) };
  if (httpStatus >= 400 && httpStatus < 500) return { rules: [] };
  return { blocked: `robots.txt could not be read${httpStatus ? ` (HTTP ${httpStatus})` : ''}, so the site is skipped` };
}

// ---- pacing ----

export const MIN_DAYS_BETWEEN_RUNS = 6;

// True when the last saved run is under 6 days old, so no page is fetched twice in a week.
export function tooSoon(checkedAt, now = Date.now(), days = MIN_DAYS_BETWEEN_RUNS) {
  const last = Date.parse(checkedAt || '');
  return Number.isFinite(last) && now - last < days * 864e5;
}

// Targets grouped by the host they are fetched from: each host gets one request at a time.
export function byHost(targets) {
  const groups = new Map();
  for (const t of targets) {
    const host = new URL(t.fetchUrl).host;
    if (!groups.has(host)) groups.set(host, []);
    groups.get(host).push(t);
  }
  return [...groups.entries()].map(([host, list]) => ({ host, targets: list }));
}

// ---- the report ----

// Page text as a Markdown code span, so nothing in it is a link, a format or an @mention.
export function codeSpan(text) {
  const s = String(text).replace(/[\r\n]+/g, ' ');
  const longest = Math.max(0, ...(s.match(/`+/g) || []).map(r => r.length));
  const fence = '`'.repeat(longest + 1);
  return `${fence} ${s} ${fence}`;
}

const quote = l => `    - ${codeSpan(l)}`;

// Markdown for the weekly issue. `results` = [{ url, tools, status, detail?, added?, removed? }].
export function buildReport(results, date) {
  const by = s => results.filter(r => r.status === s);
  const pricing = by('pricing'), broken = by('broken'), errors = by('error'), changed = by('changed'), fresh = by('new'), robots = by('robots');
  const name = r => `**${r.tools.join(', ')}**: ${r.url}`;
  const checked = results.length - robots.length;
  const lines = [`# Source check, ${date}`, '',
    `${checked} official pages checked. ${pricing.length} with pricing words changed, ${broken.length} broken, ${errors.length} unreachable, ${changed.length} changed elsewhere, ${by('unchanged').length} unchanged. ${robots.length} skipped (robots.txt).`];
  if (fresh.length && fresh.length === checked) lines.push('', 'First run: every page was saved as the starting point, so there is nothing to compare yet.');
  if (pricing.length) {
    lines.push('', '## Check these listings', '', 'Lines that mention pricing, free tiers, cards or licenses changed. Update the facts and `lastChecked` if the listing is now wrong.');
    for (const r of pricing) {
      lines.push('', `- ${name(r)}`);
      if (r.added.length) lines.push('  - Now says:', ...r.added.map(quote));
      if (r.removed.length) lines.push('  - No longer says:', ...r.removed.map(quote));
    }
  }
  if (broken.length) lines.push('', '## Broken source links', '', ...broken.map(r => `- ${name(r)} (${codeSpan(r.detail)})`));
  if (errors.length) lines.push('', '## Could not be read this week', '', 'Often temporary (rate limits, bot checks). Check by hand if a page shows up here two weeks in a row.', '', ...errors.map(r => `- ${name(r)} (${codeSpan(r.detail)})`));
  if (robots.length) lines.push('', '## Skipped: robots.txt does not allow it', '', 'Not fetched. Check these by hand.', '', ...robots.map(r => `- ${name(r)} (${codeSpan(r.detail)})`));
  if (changed.length) lines.push('', '## Changed, but no pricing words moved', '', ...changed.map(r => `- ${name(r)}`));
  if (fresh.length && fresh.length < checked) lines.push('', '## New sources (saved as a starting point)', '', ...fresh.map(r => `- ${name(r)}`));
  return lines.join('\n') + '\n';
}

// GitHub refuses an issue body of 65,536 characters or more: cut at a line, below the limit, and say where the rest is.
export const ISSUE_BODY_MAX = 60000;
export function capReport(md, max = ISSUE_BODY_MAX) {
  if (md.length <= max) return md;
  const note = '\n\n_The report was cut here to fit in an issue. The full report is in the run summary._\n';
  const cut = md.slice(0, max - note.length);
  return cut.slice(0, Math.max(0, cut.lastIndexOf('\n'))) + note;
}

// True when a person should look this week.
export const needsLook = results => results.some(r => r.status === 'pricing' || r.status === 'broken');
