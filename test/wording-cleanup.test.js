// PR D wording and signup cleanup: the new positioning line, "Get Monday's launches", the subscribed messages, "Launch Week 1 is
// live" once, the honeypot, and no "checked by hand". Tool facts and makers' own words are left as they are: a tool whose docs say
// "Free and open source when self-hosted" keeps that fact.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleWaitlist } from '../functions/api/waitlist.js';
import { MAIN_CATEGORIES } from '../lib/categories.js';
import { createDb } from './helpers/d1.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const file = p => readFileSync(join(root, p), 'utf8');
const SLOGAN = 'Free AI tools: open source, or a real free plan with no trial and no card.';
const OK = "You're subscribed. We'll email you each week's new launches.";
const ALREADY = "You're already subscribed.";

const walk = dir => readdirSync(join(root, dir)).flatMap(n => { const p = `${dir}/${n}`; return statSync(join(root, p)).isDirectory() ? walk(p) : [p]; });
// everything a visitor, a reader of an email or feed, or an AI assistant can read, plus README and the issue form
const SITE_FILES = [...walk('lib'), ...walk('functions'), ...walk('public/assets'), 'public/index.html', 'public/launch-list/index.html',
  'public/404.html', 'public/llms.txt', 'public/llms-full.txt', 'scripts/build-home.mjs', 'README.md', '.github/ISSUE_TEMPLATE/submit-a-tool.yml']
  .filter(p => /\.(js|mjs|html|txt|md|yml)$/.test(p));

test('none of the old wording is left in the site: "free and open-source", "Join the waitlist", "checked by hand", "nothing about you"', () => {
  // "free and open-source" with the hyphen is the old positioning phrase; tools' own free-tier facts read "Free and open source when ..."
  const old = [/free and open-source/i, /Join the waitlist/, /checked by hand|by hand against/i, /nothing about you/i];   // the privacy claim; garak's fact "say nothing about your own chatbot" is about a model
  const hits = [];
  for (const p of SITE_FILES) file(p).split('\n').forEach((l, i) => { for (const re of old) if (re.test(l)) hits.push(`${p}:${i + 1} ${re}`); });
  assert.deepEqual(hits, []);
});

test('the new line is in the hero, the head (meta, OG, structured data), the footer, the Launch List, the feeds, llms.txt and the email', () => {
  const home = file('public/index.html');
  const head = home.slice(0, home.indexOf('</head>'));
  assert.equal(head.split(SLOGAN).length - 1, 3, 'meta description, og:description and the Organization description');
  assert.ok(home.includes(`<p class="lede">${SLOGAN} `));
  for (const p of ['public/index.html', 'public/launch-list/index.html', 'public/404.html']) assert.ok(file(p).includes(`<p>${SLOGAN} Checked against their official docs.`), `${p} footer`);
  assert.ok(file('public/launch-list/index.html').includes(`<meta property="og:description" content="${SLOGAN}`));
  for (const p of ['lib/feeds.js', 'lib/llms.js', 'lib/email.js', 'lib/makers.js', 'lib/faq.js', '.github/ISSUE_TEMPLATE/submit-a-tool.yml']) {
    assert.ok(file(p).includes('open source, or a real free plan with no trial and no card'), p);
  }
});

test('meta descriptions stay under 160 characters and still name the four categories', () => {
  for (const p of ['public/index.html', 'public/launch-list/index.html']) {
    for (const m of file(p).matchAll(/<meta (?:name="description"|property="og:description") content="([^"]*)"/g)) assert.ok(m[1].length < 160, `${p}: ${m[1].length}`);
  }
  for (const c of MAIN_CATEGORIES) assert.ok(c.description.length < 160, `${c.slug}: ${c.description.length}`);
  const desc = file('public/index.html').match(/<meta name="description" content="([^"]*)"/)[1].toLowerCase();
  for (const w of ['productivity', 'automation', 'careers', 'security']) assert.ok(desc.includes(w), w);
});

test('the signup: "Get Monday\'s launches", and the subscribed messages with and without JavaScript', () => {
  const home = file('public/index.html'), js = file('public/assets/home.js');
  assert.ok(home.includes('id="wl-btn">Get Monday\'s launches</button>'));
  assert.ok(home.includes(`id="wl-ok" role="status">${OK}</p>`));
  assert.ok(home.includes(`id="wl-already" role="status">${ALREADY}</p>`));
  assert.ok(js.includes("btn.textContent=\"Get Monday's launches\";") && js.includes(`d.message||"${OK}"`));
  assert.ok(file('public/launch-list/index.html').includes('<a class="btn pri" href="/#join">Get Monday\'s launches</a>'));
});

let db, env;
beforeEach(() => { db = createDb(); env = { DB: db }; });
const asJson = body => new Request('https://openorbia.com/api/waitlist', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://openorbia.com' }, body: JSON.stringify(body) });
const count = () => db.rows('SELECT COUNT(*) AS n FROM waitlist')[0].n;

test('the API answers with the subscribed messages; the form and the waitlist table are unchanged', async () => {
  const first = await handleWaitlist({ request: asJson({ email: 'a@example.com', role: 'reader' }), env });
  assert.equal((await first.json()).message, OK);
  const again = await handleWaitlist({ request: asJson({ email: 'a@example.com', role: 'reader' }), env });
  assert.equal((await again.json()).message, ALREADY);
  assert.equal(count(), 1, 'still stored in the waitlist table, once');
});

test('the honeypot: a filled field is rejected (nothing stored) with the same answer a person gets, so a bot cannot tell', async () => {
  const bot = await handleWaitlist({ request: asJson({ email: 'bot@example.com', role: 'reader', company: 'Acme Inc' }), env });
  assert.equal(bot.status, 200);
  assert.equal((await bot.json()).message, OK);
  assert.equal(count(), 0, 'nothing stored');
  const home = file('public/index.html');
  const hp = home.match(/<div class="hp"[^>]*>[\s\S]*?<\/div>/)[0];
  assert.ok(hp.includes('aria-hidden="true"') && hp.includes('name="company"') && hp.includes('tabindex="-1"') && hp.includes('autocomplete="off"'));
  assert.ok(!hp.includes('Leave empty'), 'no instruction that shows in text-only views');
  assert.ok(/\.hp\{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden\}/.test(home), 'off-screen, not display:none');
  assert.ok(!/\.hp\{[^}]*display:\s*none/.test(home));
});

test('"Launch Week 1 is live" appears once on the homepage', () => {
  const home = file('public/index.html');
  assert.equal(home.split('Launch Week 1 is live').length - 1, 1);
  assert.ok(!home.includes('Launch Week 1 is open now'));
});
