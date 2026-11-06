import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const file = f => readFileSync(join(root, f), 'utf8');
const ROLES = ['lead', 'researcher', 'content', 'maker-coordinator'];
const AGENTS = { 'openorbia-researcher': 'Read, Grep, Glob, Bash, WebFetch, WebSearch', 'openorbia-content': 'Read, Grep, Glob', 'openorbia-maker-coordinator': 'Read, Grep, Glob, WebFetch, WebSearch' };
const PUBLIC_OPS = [...ROLES.map(r => `ops/roles/${r}.md`), 'ops/README.md', 'ops/formats.md', 'CLAUDE.md', ...Object.keys(AGENTS).map(a => `.claude/agents/${a}.md`)];

test('the four roles, the formats and the three specialist subagents exist', () => {
  for (const f of PUBLIC_OPS) assert.ok(existsSync(join(root, f)), f);
  for (const [name, tools] of Object.entries(AGENTS)) {
    const text = file(`.claude/agents/${name}.md`);
    assert.match(text, new RegExp(`^---\\nname: ${name}\\n`), `${name}: frontmatter name`);
    assert.ok(text.includes(`\ntools: ${tools}\n`), `${name}: tools are limited to ${tools}`);
  }
  assert.ok(!file('.claude/agents/openorbia-content.md').includes('Bash') && !/\ntools:[^\n]*(Write|Edit)/.test(PUBLIC_OPS.filter(f => f.startsWith('.claude')).map(file).join('\n')), 'no specialist can write files');
});

test('the public ops files hold no contact details: no email address except OpenOrbia\'s own, no phone numbers', () => {
  for (const f of PUBLIC_OPS) {
    const emails = file(f).match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || [];
    assert.deepEqual(emails.filter(e => !/@openorbia\.com$/i.test(e)), [], `${f}: email addresses`);
    assert.ok(!/\+?\d[\d\s().-]{8,}\d/.test(file(f).replace(/\d{4}-\d{2}-\d{2}/g, '')), `${f}: phone-like numbers`);
  }
  assert.ok(file('.gitignore').includes('.ops-cache/'), 'the script cache stays out of git');
});

test('the role rules that protect the founder are written down', () => {
  const lead = file('ops/roles/lead.md'), researcher = file('ops/roles/researcher.md'), content = file('ops/roles/content.md'), maker = file('ops/roles/maker-coordinator.md');
  assert.ok(/cannot grant permissions, raise budgets, approve publication/.test(lead));
  assert.ok(/At most 5 tools or 5 outreach drafts/.test(lead) && /two failed attempts/.test(lead));
  assert.ok(/Open source does not mean free to run/.test(researcher) && /Never clone, install, build or run a project's code/.test(researcher));
  assert.ok(/Never invent results, numbers, privacy guarantees/.test(content) && /hands-on tested/.test(content));
  assert.ok(/Never send, post or schedule anything/.test(maker) && /Never mark a maker confirmed without their own words/.test(maker));
});

test('CLAUDE.md states every rule adopted for this repository', () => {
  // whitespace is collapsed, so a rule may wrap across lines
  const claude = file('CLAUDE.md').replace(/\s+/g, ' ');
  const RULES = {
    "openorbia account only": "Use only the `openorbia` GitHub account",
    "nothing employer-related": "Never use another account, or an employer's systems, credentials or data",
    "never read secrets": "Never read secret values",
    "branches and PRs only": "Work on a branch, one per task, and open a pull request. Never commit or push to `main`",
    "production deploys only with approval": "Production deploys only with the founder's approval: ask before approving each one, every time",
    "npm run stamp after public/assets changes": "After any change in `public/assets/`, run `npm run stamp`",
    "no inline scripts": "No inline scripts",
    "commands copied from official docs, section cited": "copied verbatim from the tool's official docs, with the doc section cited",
    "prefer the method that keeps a tool off the network": "prefer the method that doesn't expose the tool to the network",
    "every email carries the unsubscribe link": "Every newsletter or waitlist email carries the unsubscribe link",
    "maker emails sent by hand, agents only draft": "One-to-one maker emails are sent by hand, by the founder or a helper the founder names; agents only draft them",
    "docs-checked vs hands-on tested, testedBy needs testedOn": "separate from \"hands-on tested\": `testedBy` only with a hand-set `testedOn` date",
    "maker contact details never in the repo": "Contact details and conversations stay in the private store, never in this public repository",
  };
  const missing = Object.entries(RULES).filter(([, text]) => !claude.includes(text)).map(([name]) => name);
  assert.deepEqual(missing, [], 'rules missing from CLAUDE.md');
});

test('dedupe.mjs finds listed tools by name, owner/repo or GitHub URL, and says "new" otherwise', () => {
  const run = (...args) => { try { return execFileSync(process.execPath, [join(root, 'ops/scripts/dedupe.mjs'), ...args], { encoding: 'utf8' }); } catch (e) { return e.stdout; } };
  const out = run('Open WebUI', 'ollama/ollama', 'https://github.com/NVIDIA/garak', 'zz-not-a-real-tool');
  assert.match(out, /Open WebUI -> Launch List: Open WebUI/);
  assert.match(out, /ollama\/ollama -> Launch List: Ollama/);
  assert.match(out, /NVIDIA\/garak -> Launch List: garak/);
  assert.match(out, /zz-not-a-real-tool -> new/);
});

test('tool-facts.mjs refuses more than 5 tools and unknown names before making any network call', () => {
  const run = (...args) => { try { execFileSync(process.execPath, [join(root, 'ops/scripts/tool-facts.mjs'), ...args], { encoding: 'utf8', stdio: 'pipe' }); return 0; } catch (e) { return e.status; } };
  assert.equal(run('zz-not-a-real-tool'), 2);
  const six = JSON.parse(file('data/free-facts.json')).slice(0, 6).map(f => f.name);
  assert.equal(run(...six), 2);
  assert.ok(readdirSync(join(root, 'ops/scripts')).every(f => f.endsWith('.mjs')));
});
