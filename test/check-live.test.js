// scripts/check-live.mjs (npm run check:live): the parsing helpers against saved HTML, and the whole run against a fake fetch.
// No network: every response here comes from test/fixtures/check-live/.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { visibleText, zonesIn, bannedIn, countsIn, sitemapUrls, pageRows, checkLive, PAGES, BATCH } from '../scripts/check-live.mjs';

const fx = name => readFileSync(new URL(`./fixtures/check-live/${name}`, import.meta.url), 'utf8');
const good = fx('good.html'), bad = fx('bad.html'), sitemap = fx('sitemap.xml');

test('visibleText keeps what a visitor reads: no tags, comments, scripts, styles or templates; entities decoded', () => {
  const t = visibleText(good);
  assert.ok(t.includes('Where free AI tools take off .'));
  assert.ok(t.includes('47 tools across 4 categories (9 in more than one) · 1.8M+ GitHub stars'));
  assert.ok(t.includes('11:59 PM Central') && t.includes("tool's official docs") && t.includes('Get Monday’s launches'));
  for (const hidden of ['Pacific', 'Eastern', 'Join the waitlist', 'checked by hand', 'free and open-source', '<', 'ld+json']) assert.ok(!t.includes(hidden), hidden);
  assert.equal(visibleText('<p>a<b>b</b><!-- x --> c</p><script>if(a<b){}</script>d'), 'a b c d');
  assert.equal(visibleText('<p>open <script'), 'open', 'an unclosed tag ends the text instead of leaking');
});

test('zonesIn names each time zone family once: Central, CT, CST and CDT are one zone', () => {
  assert.deepEqual(zonesIn(visibleText(good)), ['Central']);
  assert.deepEqual(zonesIn(visibleText(bad)), ['Central', 'Pacific']);
  assert.deepEqual(zonesIn('script, CPT codes, PTSD, centrally, the eastern seaboard'), []);
  assert.deepEqual(zonesIn('9 AM ET or 8 AM CDT'), ['Central', 'Eastern']);
});

test('bannedIn finds the old wording, in any case', () => {
  assert.deepEqual(bannedIn(visibleText(good)), []);
  assert.deepEqual(bannedIn(visibleText(bad)), ['free and open-source', 'Join the waitlist', 'checked by hand']);
});

test('countsIn lists every count phrase for a person to check, once each', () => {
  assert.deepEqual(countsIn(visibleText(good)), ['47 tools', '1.8M+ GitHub stars']);
  assert.deepEqual(countsIn(visibleText(bad)), ['12,000 subscribers', '300 makers']);
  assert.deepEqual(countsIn('150+ security tools and 150+ security tools'), ['150+ security tools']);
});

test('sitemapUrls reads every <loc>, decodes &amp;, and moves them onto a preview host', () => {
  const live = sitemapUrls(sitemap, 'https://openorbia.com');
  assert.equal(live.length, 9);
  assert.equal(live[0], 'https://openorbia.com/');
  assert.ok(live.includes('https://openorbia.com/launch-list/?a=1&b=2'));
  const preview = sitemapUrls(sitemap, 'https://pr-92.openorbia.pages.dev');
  assert.ok(preview.every(u => u.startsWith('https://pr-92.openorbia.pages.dev/')));
  assert.equal(preview[2], 'https://pr-92.openorbia.pages.dev/tool/ollama/');
});

test('pageRows: PASS for the good page, FAIL for two zones and the old wording, FAIL for a non-200', () => {
  assert.ok(pageRows('/', 200, good).every(r => r.result === 'PASS'));
  const b = Object.fromEntries(pageRows('/', 200, bad).map(r => [r.check, r]));
  assert.equal(b['one time zone'].result, 'FAIL');
  assert.equal(b['no old wording'].result, 'FAIL');
  const down = pageRows('/faq/', 503, '');
  assert.deepEqual(down.map(r => [r.check, r.result, r.detail]), [['HTTP 200', 'FAIL', '503']]);
});

// a fake site: the page paths answer with `pages`, /sitemap.xml with the fixture, and its URLs with `status(url)`
function fakeSite({ html = good, status = () => 200 } = {}) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    const path = new URL(url).pathname + new URL(url).search;
    if (path === '/sitemap.xml') return { status: 200, text: async () => sitemap };
    return { status: PAGES.includes(path) ? 200 : status(url), text: async () => html };
  };
  return { fetchImpl, calls };
}
const quiet = { table() {}, log() {} };

test('a full run: GET only, redirects not followed, sitemap URLs in batches of 8, PASS when everything answers 200', async () => {
  const { fetchImpl, calls } = fakeSite();
  const res = await checkLive({ base: 'https://pr-1.openorbia.pages.dev', fetchImpl, log: quiet });
  assert.equal(res.failed, false);
  assert.ok(calls.every(c => c.init.method === 'GET' && c.init.redirect === 'manual'), 'GET only, never a post, no redirect following');
  assert.ok(calls.every(c => c.url.startsWith('https://pr-1.openorbia.pages.dev/')));
  assert.equal(calls.length, PAGES.length + 1 + 9);
  assert.equal(BATCH, 8);
  assert.deepEqual(res.counts.map(c => c.phrase).slice(0, 2), ['47 tools', '1.8M+ GitHub stars']);
});

test('a full run FAILs (exit 1) on old wording, or a sitemap URL that does not answer 200', async () => {
  assert.equal((await checkLive({ ...fakeSite({ html: bad }), log: quiet })).failed, true);
  const res = await checkLive({ ...fakeSite({ status: url => (url.includes('/tool/ollama/') ? 301 : 200) }), log: quiet });
  assert.equal(res.failed, true);
  assert.ok(res.rows.find(r => r.check === 'sitemap URLs 200').detail.includes('/tool/ollama/ 301'));
});

test('npm run check:live is wired; the script defaults to openorbia.com and never sends anything but GET', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.scripts['check:live'], 'node scripts/check-live.mjs');
  const src = readFileSync(new URL('../scripts/check-live.mjs', import.meta.url), 'utf8');
  assert.ok(src.includes("process.env.BASE_URL || 'https://openorbia.com'"));
  assert.ok(!/method:\s*'(?:POST|PUT|PATCH|DELETE)'/i.test(src));
  assert.deepEqual(PAGES, ['/', '/launches/', '/how-voting-works/', '/makers/', '/faq/', '/submit/']);
});
