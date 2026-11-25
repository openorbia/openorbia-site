// /llms.txt and /llms-full.txt (https://llmstxt.org): a plain Markdown index of the Launch List for AI assistants and AI search.
// Built from public/assets/tools.js, like the tool pages, so they say nothing a page doesn't. `npm run build:home` writes them to
// public/; test/llms.test.js fails when the files don't match what this would write.
//
//   llms.txt       one line per tool (link, description, license, setup, free tier, catch), plus the key pages
//   llms-full.txt  every checked fact per tool, with the docs-checked date and the official sources

import { TOOLS, CATEGORIES } from '../public/assets/tools.js';
import { factRows, paidSummary, formatChecked, isTested } from '../public/assets/facts.js';
import { NOT_AN_AUDIT, RECHECK_POLICY } from './how-we-check.js';

const SITE = 'https://openorbia.com';
const one = s => String(s ?? '').replace(/\s+/g, ' ').trim();
const fact = (t, key) => one((factRows(t.facts).find(r => r.key === key) || {}).value) || 'Not confirmed';

const header = full => `# OpenOrbia

> OpenOrbia lists free and open-source AI tools for small businesses, job seekers and security teams. Each tool's free tier, card requirement, data location, setup, paid parts and biggest catch are checked by hand against its official docs, with the date shown.

- No ads. No paid placement. No affiliate links. A tool never pays to be listed.
- ${RECHECK_POLICY}
- "Not confirmed" means the official docs did not say; it is not a yes or a no.
- ${NOT_AN_AUDIT}
- Tools are "Docs checked" unless marked "Hands-on tested", which OpenOrbia gives only to tools it has actually run.
- Each tool page is the source of truth for its facts: ${SITE}/tool/<slug>/. ${full ? `The short index is ${SITE}/llms.txt.` : `Every fact for every tool is in ${SITE}/llms-full.txt.`}
`;

const PAGES = `## Pages

- [How we check tools](${SITE}/how-we-check/): listing rules, what each fact means, how often tools are rechecked, and what the checks don't cover
- [Launch List](${SITE}/launch-list/): every listed tool, filterable by audience, setup, open source and local AI
- [Self-hosted AI tools](${SITE}/collection/self-hosted/): tools you run on your own server or computer
- [Free AI APIs](${SITE}/free-ai-apis/): free tiers of AI model APIs, checked against each provider's own pages
- [This week's launches](${SITE}/launches/): Launch Week, new tools every Monday

## Optional

- [For makers](${SITE}/makers/): how to submit and launch a tool
- [FAQ](${SITE}/faq/)
`;

const byCategory = () => Object.entries(CATEGORIES).map(([key, label]) => [label, TOOLS.filter(t => t.category === key)]);
const marks = t => [t.localAI ? 'works with local AI' : '', t.founder ? "built by OpenOrbia's founder" : '', isTested(t.facts) ? 'hands-on tested' : ''].filter(Boolean);

export function llmsTxt() {
  const line = t => `- [${t.name}](${SITE}/tool/${t.slug}/): ${one(t.description)} License: ${one(t.license)}. Setup: ${fact(t, 'setup')}. Free tier: ${fact(t, 'freeTier')}. The catch: ${fact(t, 'catch')}${marks(t).length ? ` (${marks(t).join(', ')})` : ''}`;
  return `${header(false)}
${byCategory().map(([label, tools]) => `## ${label}\n\n${tools.map(line).join('\n')}\n`).join('\n')}
${PAGES}`;
}

export function llmsFullTxt() {
  const block = t => {
    const f = t.facts, sources = (f.sources || []).filter(u => String(u).startsWith('https://'));
    const rows = [
      ['Page', `${SITE}/tool/${t.slug}/`], ['Source code', t.github], ['License', one(t.license)],
      ['Free tier', fact(t, 'freeTier')], ['Card required', fact(t, 'cardRequired')], ['Your data', fact(t, 'dataLocation')],
      ['Setup', fact(t, 'setup')], ['Paid service', paidSummary(f) || 'Not confirmed'], ['The catch', fact(t, 'catch')],
      ['Helps you', one(f.task) || 'Not confirmed'], ['Local AI', t.localAI ? 'Works with local AI' : 'Not listed'],
      ['Facts checked against the docs', formatChecked(f.lastChecked) || 'Not confirmed'],
      ['Hands-on tested by OpenOrbia', isTested(f) ? formatChecked(f.testedOn) : 'No'],
    ];
    if (t.founder) rows.push(['Note', "Built by Khaja Syed, OpenOrbia's founder; kept off the Launch Week leaderboard"]);
    return `### ${t.name}

${one(t.description)}

${rows.map(([k, v]) => `- ${k}: ${v}`).join('\n')}${sources.length ? `\n- Official sources: ${sources.join(', ')}` : ''}
`;
  };
  return `${header(true)}
${byCategory().map(([label, tools]) => `## ${label}\n\n${tools.map(block).join('\n')}`).join('\n')}
${PAGES}`;
}
