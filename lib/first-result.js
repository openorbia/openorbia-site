// "First useful result" on /tool/<slug>/: one specific task you can finish for free, what it needs, the steps, what you should see,
// and the catch. It is optional (facts.firstResult in public/assets/tools.js, kept in step with data/free-facts.json) and every line
// of it comes from the tool's official docs. "docs" and "tested" stay two different labels: reading the docs is not running the tool.

import { esc } from './html.js';
import { formatChecked } from '../public/assets/facts.js';

export const FIRST_RESULT_LABELS = { docs: 'Facts checked against docs', tested: 'Hands-on tested' };
const FIELDS = ['canFinish', 'needs', 'steps', 'expected', 'catch', 'label', 'sources', 'lastChecked'];
const TEXT_MAX = 240;

// -> [] when the object has the right shape, else a list of what is wrong
export function firstResultProblems(fr) {
  if (!fr || typeof fr !== 'object' || Array.isArray(fr)) return ['not an object'];
  const problems = [];
  const text = v => typeof v === 'string' && v.trim().length > 0 && v.length <= TEXT_MAX;
  const extra = Object.keys(fr).filter(k => !FIELDS.includes(k));
  if (extra.length) problems.push(`unknown fields: ${extra.join(', ')}`);
  for (const k of ['canFinish', 'expected', 'catch']) if (!text(fr[k])) problems.push(`${k}: one non-empty line of at most ${TEXT_MAX} characters`);
  if (!Array.isArray(fr.needs) || fr.needs.length < 1 || fr.needs.length > 6 || !fr.needs.every(text)) problems.push('needs: 1 to 6 lines');
  if (!Array.isArray(fr.steps) || fr.steps.length < 3 || fr.steps.length > 6 || !fr.steps.every(text)) problems.push('steps: 3 to 6 lines');
  else if (fr.steps.some(s => (s.match(/`/g) || []).length % 2)) problems.push('steps: every `command` needs an opening and a closing backtick');
  if (!Object.hasOwn(FIRST_RESULT_LABELS, fr.label)) problems.push('label: "docs" or "tested"');
  if (!Array.isArray(fr.sources) || fr.sources.length < 1 || !fr.sources.every(u => typeof u === 'string' && /^https:\/\/[^\s]+$/.test(u))) problems.push('sources: at least one https URL');
  if (!formatChecked(fr.lastChecked)) problems.push('lastChecked: a real YYYY-MM-DD date');
  return problems;
}

// "https://docs.jan.ai/desktop/quickstart" -> "docs.jan.ai/desktop/quickstart"
const shortUrl = url => { try { const u = new URL(url); return `${u.hostname.replace(/^www\./, '')}${u.pathname === '/' ? '' : u.pathname}${u.hash}`; } catch { return url; } };

// A step: escaped first, then each `backtick span` (a command to type) becomes <code>. Escaping first means a span's content is
// already plain text, so markup inside backticks shows as text; only backticks are turned into tags.
export const stepHtml = s => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>');

// The section, or '' when the tool has none (or it is not valid: nothing half-checked goes on a page)
export function renderFirstResult(fr) {
  if (!fr || firstResultProblems(fr).length) return '';
  const sources = fr.sources.map(u => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(shortUrl(u))}</a>`).join(', ');
  return `<section class="about first-result" aria-labelledby="fr-h"><h2 id="fr-h">First useful result</h2>
  <h3>What you can finish for free</h3>
  <p class="fr-lead">${esc(fr.canFinish)}</p>
  <h3>What you need</h3>
  <ul class="fr-list">${fr.needs.map(n => `<li>${esc(n)}</li>`).join('')}</ul>
  <h3>Steps</h3>
  <ol class="fr-steps">${fr.steps.map(s => `<li>${stepHtml(s)}</li>`).join('')}</ol>
  <h3>Expected result</h3>
  <p>${esc(fr.expected)}</p>
  <h3>The catch</h3>
  <p>${esc(fr.catch)}</p>
  <p class="fr-check"><span class="fr-label">${esc(FIRST_RESULT_LABELS[fr.label])}</span> · First result checked ${esc(formatChecked(fr.lastChecked))}</p>
  <p class="tool-note">Sources: ${sources}</p>
</section>`;
}

// ---- the homepage strip, "Get a first result": each tool that has a valid first result, by name and what you can finish ----
// Written into public/index.html between <!-- first-results:start --> and <!-- first-results:end --> by scripts/build-home.mjs.

export const toolsWithFirstResult = tools => tools.filter(t => t.facts && t.facts.firstResult && !firstResultProblems(t.facts.firstResult).length);

export function renderFirstResultStrip(tools) {
  return toolsWithFirstResult(tools)
    .map(t => `<li><a class="frs" href="/tool/${esc(t.slug)}/#fr-h"><b>${esc(t.name)}</b><span>${esc(t.facts.firstResult.canFinish)}</span></a></li>`)
    .join('\n    ');
}
