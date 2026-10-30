// "Free facts": what is free, the catch, and where your data goes.
// One module for both places that show them, so the labels, order and date format are the same everywhere: the
// server-rendered launch pages import it from lib/pages.js, and the Launch List loads it in the browser.

// "unknown" is for tools whose card requirement we could not confirm; it is shown as "Not confirmed"
export const CARD_REQUIRED = ['yes', 'no', 'unknown'];
const CARD_LABELS = { yes: 'Yes', no: 'No', unknown: 'Not confirmed' };
export const DATA_LOCATIONS = ['Runs on your computer', 'Your server', 'Vendor cloud'];
export const SETUPS = ['Browser, ready to use', 'Desktop app', 'Install & self-host'];

// The longest "catch" line, in characters (one honest sentence, so it fits a card)
export const CATCH_MAX = 160;

// A data location is one of the three above, optionally followed by a short note in parentheses, e.g.
// "Runs on your computer (cloud AI only if you pick one)". Anything else is not a data location.
export const DATA_LOCATION_NOTE_MAX = 60;
export const isDataLocation = v => typeof v === 'string' && DATA_LOCATIONS.some(base =>
  v === base || (v.startsWith(base + ' (') && v.endsWith(')') && v.length - base.length - 3 >= 1 && v.length - base.length - 3 <= DATA_LOCATION_NOTE_MAX && !v.slice(base.length + 2, -1).includes('(')));
export const TESTED_BY = 'OpenOrbia';

const LABELS = { freeTier: 'Free tier', cardRequired: 'Card required', dataLocation: 'Your data', setup: 'Setup', catch: 'The catch' };
const ORDER = ['freeTier', 'cardRequired', 'dataLocation', 'setup', 'catch'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const text = v => (typeof v === 'string' ? v.trim() : '');

// The rows to show, in a fixed order. A missing or empty field simply has no row.
// -> [{ key, label, value }]
export function factRows(facts) {
  const f = facts && typeof facts === 'object' ? facts : {};
  const rows = [];
  for (const key of ORDER) {
    const raw = key === 'cardRequired' ? CARD_LABELS[f[key]] : f[key];
    const value = text(raw);
    if (value) rows.push({ key, label: LABELS[key], value });
  }
  return rows;
}

// "2026-11-10" -> "Nov 10, 2026"; anything that is not a real date -> ''
export function formatChecked(date) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date ?? ''));
  if (!m) return '';
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const real = new Date(Date.UTC(y, mo - 1, d));
  if (real.getUTCFullYear() !== y || real.getUTCMonth() !== mo - 1 || real.getUTCDate() !== d) return '';
  return `${MONTHS[mo - 1]} ${d}, ${y}`;
}

// Only an exact "OpenOrbia" counts: it is a claim that we tested the tool, so nothing else switches the badge on
export const isTested = facts => !!facts && typeof facts === 'object' && facts.testedBy === TESTED_BY;

// ---- paid dependencies ("Free facts from docs"): what a tool needs that costs money, read from its official docs ----

export const PAID_LEVELS = ['none', 'optional', 'required'];
export const FACT_LEVELS = ['basic'];
export const FACT_LEVEL_LABELS = { basic: 'Basic' };
export const NEEDS_PAID_LABEL = 'Needs paid service';

// A tool whose core function does not work without paying for a service gets the "Needs paid service" label
export const needsPaidService = facts => !!facts && typeof facts === 'object' && !!facts.paidDeps && facts.paidDeps.level === 'required';

// -> '' (nothing known) or "None", "Optional: Ollama (free) or your own OpenAI key", "Required: Paid Claude plan or API credits"
export function paidSummary(facts) {
  const p = facts && typeof facts === 'object' ? facts.paidDeps : null;
  if (!p || !PAID_LEVELS.includes(p.level)) return '';
  const what = text(p.what);
  if (p.level === 'none') return 'None';
  return `${p.level === 'required' ? 'Required' : 'Optional'}${what ? `: ${what}` : ''}`;
}
