// The Launch Week lineup email (lib/lineup-email.js) and its send script (lib/lineup-send.js, scripts/send-lineup.mjs).
// Nothing here touches the network: Brevo and the live site are a fake fetch that records each call.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lineupEmail, groupByCategory, cleanPostal, launchLink } from '../lib/lineup-email.js';
import { runLineup, parseArgs, BATCH_SIZE, SAMPLE_UNSUBSCRIBE } from '../lib/lineup-send.js';
import { unsubscribeUrl } from '../lib/unsubscribe.js';
import { welcomeEmail, BREVO_URL, SENDER } from '../lib/email.js';
import { launchOpensAt, launchClosesAt, dayLabelLong } from '../lib/time.js';
import { esc } from '../lib/html.js';

const file = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const SECRET = 'test-secret-0123456789abcdef';
const POSTAL = '123 Example Street, Suite 4, Springfield, IL 62701, USA';
const KEY = 'xkeysib-test-0000000000000000';
const DATE = '2026-11-23';
const L = (slug, name, category, tagline = `${name} does one useful thing`) => ({ slug, name, tagline, category, launch_week: 1, launch_date: DATE });
const LAUNCHES = [L('zeta-sec', 'Zeta Scan', 'sec'), L('alpha-biz', 'Alpha Books', 'biz'), L('beta-job', 'Beta CV', 'job'), L('aardvark-sec', 'Aardvark Guard', 'sec')];
const SAMPLE = SAMPLE_UNSUBSCRIBE;

// ---- rendering ----

test('the lineup is built from the launches: name, tagline and link, grouped by category in the site order', () => {
  const e = lineupEmail(LAUNCHES, { unsubscribeUrl: SAMPLE, postalAddress: POSTAL });
  assert.deepEqual(groupByCategory(LAUNCHES).map(g => [g.name, g.items.map(l => l.name)]),
    [['Small Business', ['Alpha Books']], ['Job Seekers', ['Beta CV']], ['Cybersecurity & SOC', ['Aardvark Guard', 'Zeta Scan']]]);
  for (const l of LAUNCHES) {
    assert.ok(e.html.includes(`href="https://openorbia.com/launch/${l.slug}/"`) && e.html.includes(`>${l.name}</a>`), l.slug);
    assert.ok(e.text.includes(`* ${l.name}: ${l.tagline}\n  https://openorbia.com/launch/${l.slug}/`), l.slug);
  }
  const t = e.text;
  assert.ok(t.indexOf('Small Business') < t.indexOf('Job Seekers') && t.indexOf('Job Seekers') < t.indexOf('Cybersecurity & SOC'));
  assert.equal(e.subject, 'Launch Week 1 lineup: 4 free AI tools on Nov 23');
});

test('launch day and the voting close come from lib/time.js, with no hard-coded dates in the email code', () => {
  const e = lineupEmail(LAUNCHES, { unsubscribeUrl: SAMPLE, postalAddress: POSTAL });
  const day = dayLabelLong(launchOpensAt(DATE)), closes = dayLabelLong(launchClosesAt(DATE));
  assert.equal(day, 'Monday, Nov 23, 2026'); assert.equal(closes, 'Sunday, Nov 29, 2026');
  assert.ok(e.text.includes(`Launch Week 1 starts ${day}, at 12:01 AM Pacific.`) && e.text.includes(`Voting closes ${closes}, at 11:59 PM Pacific`));
  const moved = lineupEmail(LAUNCHES.map(l => ({ ...l, launch_date: '2027-03-08', launch_week: 16 })), { unsubscribeUrl: SAMPLE, postalAddress: POSTAL });
  assert.ok(moved.text.includes('Launch Week 16 starts Monday, Mar 8, 2027') && moved.text.includes('Voting closes Sunday, Mar 14, 2027'));
  for (const f of ['lib/lineup-email.js', 'lib/lineup-send.js', 'scripts/send-lineup.mjs']) assert.ok(!/20\d\d-\d\d-\d\d|Nov 2\d/.test(file(f)), f);
});

test('the same design as the welcome email: the shared shell, header art, email-safe markup, no scripts', () => {
  const lineup = lineupEmail(LAUNCHES, { unsubscribeUrl: SAMPLE, postalAddress: POSTAL }).html;
  const welcome = welcomeEmail('reader').html;
  const headOf = h => h.slice(h.indexOf('<style>'), h.indexOf('</style>'));
  assert.equal(headOf(lineup), headOf(welcome));
  for (const piece of ['https://openorbia.com/email/header.png', 'class="oo-wrap"', 'class="oo-px oo-body"', '<meta name="color-scheme" content="light dark">'])
    assert.ok(lineup.includes(piece), piece);
  assert.ok(!lineup.toLowerCase().includes('<script') && !/\son[a-z]+=/i.test(lineup));
});

test('everything from the database is escaped', () => {
  const bad = [L('x', '<img src=x onerror=alert(1)>', 'biz', '"><script>alert(1)</script>')];
  const { html } = lineupEmail(bad, { unsubscribeUrl: SAMPLE, postalAddress: '<b>1 Main St</b>, Town' });
  assert.ok(!html.includes('<img src=x') && !html.includes('<script>') && !html.includes('<b>1 Main St</b>'));
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
});

test('the footer carries the unsubscribe link and the postal address; the email cannot be built without either', () => {
  const url = 'https://openorbia.com/unsubscribe/?id=42&t=0123456789abcdef0123456789abcdef';
  const e = lineupEmail(LAUNCHES, { unsubscribeUrl: url, postalAddress: '123 Example Street\nSpringfield, IL 62701' });
  assert.ok(e.html.includes(`<a href="${esc(url)}" style="color:#22d3ee;text-decoration:underline">Unsubscribe</a><br>`));
  assert.ok(e.html.includes('OpenOrbia, 123 Example Street, Springfield, IL 62701') && e.text.includes('OpenOrbia, 123 Example Street, Springfield, IL 62701'));
  assert.ok(e.text.includes(`Unsubscribe: ${url}`));
  assert.throws(() => lineupEmail(LAUNCHES, { unsubscribeUrl: url, postalAddress: '' }), /POSTAL_ADDRESS/);
  assert.throws(() => lineupEmail(LAUNCHES, { unsubscribeUrl: '', postalAddress: POSTAL }), /unsubscribe/);
  assert.throws(() => lineupEmail([], { unsubscribeUrl: url, postalAddress: POSTAL }), /No launches/);
  assert.equal(cleanPostal('  '), ''); assert.equal(cleanPostal('x'.repeat(201)), '');
  assert.equal(launchLink('a-b'), 'https://openorbia.com/launch/a-b/');
});

// ---- the send script ----

const PEOPLE = [{ id: 1, email: 'ann@example.com' }, { id: 2, email: 'bob@example.org' }, { id: 3, email: 'cy@example.net' }];
function harness({ env = {}, people = PEOPLE, launches = LAUNCHES, gone = [], brevoStatus = 201, liveStatus = 200, sent = [] } = {}) {
  const calls = [], lines = [], files = {};
  const done = new Map([[1, new Set(sent)]]);
  const h = {
    calls, lines, files,
    db: {
      launches: async () => launches,
      recipients: async () => people,
      stillSubscribed: async ids => new Set(ids.filter(id => !gone.includes(id))),
    },
    ledger: { read: w => new Set(done.get(w) || []), add: (w, ids) => done.set(w, new Set([...(done.get(w) || []), ...ids])) },
    done,
    out: { write: (name, text) => { files[name] = text; return `/tmp/${name}`; } },
    fetchImpl: async (url, init = {}) => {
      calls.push({ url: String(url), init });
      if (String(url).startsWith('https://openorbia.com/unsubscribe/')) return { status: liveStatus, ok: liveStatus === 200, text: async () => '' };
      return { status: brevoStatus, ok: brevoStatus < 300, text: async () => (brevoStatus < 300 ? '{}' : '{"code":"unauthorized","message":"Key not found"}') };
    },
    log: m => lines.push(m), err: m => lines.push(m), sleep: async () => {},
    env: { ...env },
  };
  h.run = argv => runLineup({ argv, env: h.env, db: h.db, fetchImpl: h.fetchImpl, ledger: h.ledger, out: h.out, log: h.log, err: h.err, sleep: h.sleep });
  h.brevo = () => calls.filter(c => c.url === BREVO_URL);
  return h;
}
const FULL = { POSTAL_ADDRESS: POSTAL, BREVO_API_KEY: KEY, UNSUBSCRIBE_SECRET: SECRET };
const noAddressesIn = (lines, people = PEOPLE) => {
  const all = lines.join('\n');
  for (const p of people) assert.ok(!all.includes(p.email), 'an address reached the log');
  assert.ok(!/[^\s@]+@[^\s@]+\.[a-z]{2,}/i.test(all.replace(/@openorbia\.com/g, '')), all);
  assert.ok(!all.includes(KEY) && !all.includes(SECRET), 'a secret reached the log');
};

test('the dry run is the default: it counts, writes one sample to a local file, and sends nothing', async () => {
  for (const argv of [[], ['--dry-run']]) {
    const h = harness({ env: FULL });
    assert.equal(await h.run(argv), 0);
    assert.equal(h.calls.length, 0, 'no network call at all');
    assert.ok(h.lines.some(l => l.includes('4 launches; 3 signups on the waitlist')));
    assert.ok(h.files['lineup-week-1-sample.html'].includes('Here’s the lineup.') && h.files['lineup-week-1-sample.txt'].startsWith('Subject: Launch Week 1 lineup'));
    assert.ok(h.lines.some(l => l.includes('Nothing was sent.')));
    noAddressesIn(h.lines);
  }
  assert.equal(parseArgs([]).mode, 'dry-run');
});

test('the dry run without POSTAL_ADDRESS still writes a sample, and says that sending will refuse', async () => {
  const h = harness();
  assert.equal(await h.run([]), 0);
  assert.equal(h.calls.length, 0);
  assert.ok(h.lines.some(l => l.includes('POSTAL_ADDRESS is not set: --test and --send will refuse')));
});

test('no send without POSTAL_ADDRESS, whatever else is set', async () => {
  for (const argv of [['--send', '--yes'], ['--test', 'me@example.com']]) {
    const h = harness({ env: { BREVO_API_KEY: KEY, UNSUBSCRIBE_SECRET: SECRET } });
    assert.equal(await h.run(argv), 2);
    assert.equal(h.calls.length, 0, argv.join(' '));
    assert.ok(h.lines.some(l => l.includes('POSTAL_ADDRESS is not set') && l.includes('CAN-SPAM')));
  }
});

test('no send without --yes, without the Brevo key, or without the unsubscribe secret', async () => {
  const cases = [[['--send'], FULL, '--send also needs --yes'], [['--send', '--yes'], { ...FULL, BREVO_API_KEY: '' }, 'BREVO_API_KEY'], [['--send', '--yes'], { ...FULL, UNSUBSCRIBE_SECRET: '' }, 'UNSUBSCRIBE_SECRET']];
  for (const [argv, env, why] of cases) {
    const h = harness({ env });
    assert.equal(await h.run(argv), 2, why);
    assert.equal(h.calls.length, 0, why);
    assert.ok(h.lines.some(l => l.includes(why)), why);
  }
});

test('no send when the live site rejects the unsubscribe links (a wrong UNSUBSCRIBE_SECRET); the check is a GET, which changes nothing', async () => {
  const h = harness({ env: FULL, liveStatus: 400 });
  assert.equal(await h.run(['--send', '--yes']), 2);
  assert.equal(h.brevo().length, 0);
  assert.equal(h.calls.length, 1); assert.equal(h.calls[0].init.method, 'GET');
});

test('no launches in the week: nothing to send, in any mode', async () => {
  for (const argv of [[], ['--send', '--yes']]) {
    const h = harness({ env: FULL, launches: [] });
    assert.equal(await h.run(argv), 1); assert.equal(h.calls.length, 0);
  }
});

test('--send gives every signup their own unsubscribe link and the one-click headers, like the welcome email', async () => {
  const h = harness({ env: FULL });
  assert.equal(await h.run(['--send', '--yes']), 0);
  const sends = h.brevo();
  assert.equal(sends.length, 3);
  for (const [i, p] of PEOPLE.entries()) {
    const body = JSON.parse(sends[i].init.body), url = await unsubscribeUrl(SECRET, p.id);
    assert.deepEqual(body.to, [{ email: p.email }]);
    assert.deepEqual(body.sender, SENDER);
    assert.deepEqual(body.headers, { 'List-Unsubscribe': `<${url}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' });
    assert.ok(body.htmlContent.includes(esc(url)) && body.textContent.includes(`Unsubscribe: ${url}`), `${p.id}: own link`);
    for (const other of PEOPLE.filter(o => o.id !== p.id)) assert.ok(!body.textContent.includes(`id=${other.id}&`), 'no one else’s link');
    assert.ok(body.textContent.includes(POSTAL));
    assert.equal(sends[i].init.headers['api-key'], KEY);
  }
  noAddressesIn(h.lines);
});

test('--send skips signups that unsubscribed (their row is gone) and ids already sent in an earlier run', async () => {
  const h = harness({ env: FULL, gone: [2], sent: [3] });
  assert.equal(await h.run(['--send', '--yes']), 0);
  assert.deepEqual(h.brevo().map(c => JSON.parse(c.init.body).to[0].email), ['ann@example.com']);
  assert.ok(h.lines.some(l => l.includes('Sent 1, failed 0, skipped (unsubscribed) 1.')));
  assert.deepEqual([...h.done.get(1)].sort(), [1, 3], 'the ledger keeps ids, never addresses');
  noAddressesIn(h.lines);
});

test('--send goes in small batches with a pause between them, and logs counts only', async () => {
  const people = Array.from({ length: BATCH_SIZE * 2 + 5 }, (_, i) => ({ id: i + 1, email: `p${i + 1}@example.com` }));
  const h = harness({ env: FULL, people });
  let pauses = 0; h.sleep = async () => { pauses++; };
  assert.equal(await h.run(['--send', '--yes']), 0);
  assert.equal(h.brevo().length, people.length);
  assert.equal(pauses, 2);
  assert.equal(h.lines.filter(l => l.startsWith('Batch ')).length, 3);
  noAddressesIn(h.lines, people);
});

test('a refused Brevo key stops the run at once, and the error in the log has no address or key in it', async () => {
  const h = harness({ env: FULL, brevoStatus: 401 });
  assert.equal(await h.run(['--send', '--yes']), 1);
  assert.equal(h.brevo().length, 1);
  assert.ok(h.lines.some(l => l.includes('Stopped: Brevo refused the key (HTTP 401)')));
  noAddressesIn(h.lines);
});

test('--test sends exactly one "[Test]" copy with a sample unsubscribe link, and needs a real address', async () => {
  const h = harness({ env: { POSTAL_ADDRESS: POSTAL, BREVO_API_KEY: KEY } });
  assert.equal(await h.run(['--test', 'me@example.com']), 0);
  assert.equal(h.calls.length, 1);
  const body = JSON.parse(h.calls[0].init.body);
  assert.deepEqual(body.to, [{ email: 'me@example.com' }]);
  assert.ok(body.subject.startsWith('[Test] Launch Week 1 lineup'));
  assert.equal(body.headers['List-Unsubscribe'], `<${SAMPLE}>`);
  const bad = harness({ env: { POSTAL_ADDRESS: POSTAL, BREVO_API_KEY: KEY } });
  assert.equal(await bad.run(['--test', 'not-an-address']), 2); assert.equal(bad.calls.length, 0);
});

test('the command line: npm run email:lineup, the sample and the ledger go to .ops-cache (ignored by git), wrangler output is never printed', () => {
  assert.equal(JSON.parse(file('package.json')).scripts['email:lineup'], 'node scripts/send-lineup.mjs');
  assert.ok(file('.gitignore').split(/\r?\n/).some(l => l.trim().replace(/\/$/, '') === '.ops-cache'));
  const cli = file('scripts/send-lineup.mjs');
  assert.ok(cli.includes("|| '.ops-cache'") && !cli.includes("stdio: 'inherit'") && !/console\.log\([^)]*stdout/.test(cli));
  assert.deepEqual(parseArgs(['--send', '--test', 'a@b.co']).error, 'Choose one of --dry-run, --test <address> or --send.');
});

// ---- the GitHub Actions workflow that runs it ----

test('the "Send lineup email" workflow: manual only, from main, in the production environment, secrets only where needed', () => {
  const y = file('.github/workflows/send-lineup.yml');
  const on = y.slice(y.indexOf('\non:'), y.indexOf('\npermissions:'));
  assert.ok(on.includes('workflow_dispatch:') && !/\n  (push|pull_request|schedule|workflow_run|repository_dispatch):/.test(on), 'workflow_dispatch only');
  assert.ok(y.includes('name: Send lineup email') && y.includes('options: [dry-run, test, send]') && y.includes('default: dry-run'));
  assert.ok(y.includes("if: github.ref == 'refs/heads/main'") && y.includes('    environment: production\n'));
  assert.ok(y.includes('permissions:\n  contents: read'));
  // secrets come from the environment, through env:, never written into a command
  for (const s of ['BREVO_API_KEY', 'UNSUBSCRIBE_SECRET', 'POSTAL_ADDRESS', 'CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID']) assert.ok(y.includes(`secrets.${s}`), s);
  assert.ok(y.includes("BREVO_API_KEY: ${{ inputs.mode != 'dry-run' && secrets.BREVO_API_KEY || '' }}"), 'no Brevo key on a dry run');
  assert.ok(y.includes("UNSUBSCRIBE_SECRET: ${{ inputs.mode == 'send' && secrets.UNSUBSCRIBE_SECRET || '' }}"), 'the signing secret only for send');
  const runs = [...y.matchAll(/\n {8}run: \|?\n?([\s\S]*?)(?=\n      - |\n?$)/g)].map(m => m[1]).join('\n');
  assert.equal([...y.matchAll(/\n {8}run: /g)].length, 3, 'three run steps');
  assert.ok(!runs.includes('${{'), 'no ${{ }} inside a run: script (inputs go through env)');
  assert.ok(y.includes('echo "::add-mask::${TEST_ADDRESS}"'), 'the test address is masked');
  assert.ok(y.includes('send)    set -- --send --yes'));
  assert.ok(y.includes('actions/upload-artifact@') && y.includes("if: inputs.mode == 'dry-run'") && y.includes('.ops-cache/lineup-week-${{ inputs.week }}-sample.*'));
  assert.ok(!y.includes('-sent.json\n          retention') && !/upload-artifact[\s\S]*-sent\.json/.test(y.slice(y.indexOf('Upload the sample'))), 'the sent ids are never uploaded');
  for (const [, ref] of y.matchAll(/uses: ([^\s]+)/g)) assert.match(ref, /@[0-9a-f]{40}$/, `${ref} is pinned to a commit`);
  assert.ok(y.includes(`WRANGLER_VERSION: ${file('.github/workflows/deploy.yml').match(/WRANGLER_VERSION: ([\d.]+)/)[1]}`), 'same wrangler as deploy.yml');
});
