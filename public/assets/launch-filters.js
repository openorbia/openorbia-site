// The Launch List filters and what goes in the address bar for them, as plain functions so the page and the tests share them.
//
//   /launch-list/?for=job&setup=browser&free=1     for = category (biz | job | sec), setup = browser | desktop | selfhost,
//                                                  free = 1 hides "Needs paid service", os = 1 (open source only),
//                                                  local = 1 (works with local AI), q = search text
// The older links ending in #biz / #job / #sec (they are in public posts) still work: a hash is read when there is no ?for=.

import { CATEGORIES } from './tools.js';
import { needsPaidService } from './facts.js';

// The three ways to get started, in the words people use; the keys are what goes in the URL
export const SETUP_FILTERS = { browser: 'No install', desktop: 'Desktop app', selfhost: 'Self-host' };
const SETUP_KEY = { 'Browser, ready to use': 'browser', 'Desktop app': 'desktop', 'Install & self-host': 'selfhost' };
// own keys only: "constructor" or "__proto__" in the data or in a URL must never match a table lookup
const own = (table, key) => typeof key === 'string' && Object.hasOwn(table, key);
export const setupKey = facts => (own(SETUP_KEY, facts && facts.setup) ? SETUP_KEY[facts.setup] : '');

export const emptyFilters = () => ({ for: 'all', setup: '', free: false, os: false, local: false, q: '' });

// location.search (and location.hash) -> a filter state. Anything not recognised is ignored.
export function parseFilters(search = '', hash = '') {
  const p = new URLSearchParams(search);
  const state = emptyFilters();
  const fromHash = String(hash).replace(/^#/, '');
  const cat = p.get('for');
  if (own(CATEGORIES, cat)) state.for = cat;
  else if (!p.has('for') && own(CATEGORIES, fromHash)) state.for = fromHash;
  const setup = p.get('setup');
  if (own(SETUP_FILTERS, setup)) state.setup = setup;
  state.free = p.get('free') === '1';
  state.os = p.get('os') === '1';
  state.local = p.get('local') === '1';
  state.q = (p.get('q') || '').trim().slice(0, 80);
  return state;
}

// a filter state -> '' (nothing set) or '?for=job&setup=browser&...' with only what differs from the defaults
export function filterQuery(state) {
  const p = new URLSearchParams();
  if (state.for !== 'all' && own(CATEGORIES, state.for)) p.set('for', state.for);
  if (own(SETUP_FILTERS, state.setup)) p.set('setup', state.setup);
  if (state.free) p.set('free', '1');
  if (state.os) p.set('os', '1');
  if (state.local) p.set('local', '1');
  if (state.q && state.q.trim()) p.set('q', state.q.trim().slice(0, 80));
  const s = p.toString();
  return s ? `?${s}` : '';
}

// Does a Launch List row [name, repo, description, category, badge, license, local AI, founder, facts] pass the filters?
export function matchesRow(t, state) {
  const [name, repo, desc, category, badge, , local, , facts] = t;
  if (state.for !== 'all' && category !== state.for) return false;
  if (state.setup && setupKey(facts) !== state.setup) return false;
  if (state.free && needsPaidService(facts)) return false;
  if (state.os && badge !== 'os') return false;
  if (state.local && !local) return false;
  const q = String(state.q || '').trim().toLowerCase();
  // the search looks in the name, the repo, the description and the plain-language task line ("Tailor your resume to each job...")
  return !q || `${name} ${repo} ${desc} ${(facts && facts.task) || ''}`.toLowerCase().includes(q);
}
