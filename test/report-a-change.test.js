// "Something changed or didn't work? Report it" on every tool page, and /contact/?tool=<slug> starting a correction email.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TOOLS } from '../public/assets/tools.js';
import { renderTool } from '../lib/tool-pages.js';
import { contactResponse, reportTool } from '../lib/contact.js';
import { renderFirstResult } from '../lib/first-result.js';

const LINE = slug => `<p class="tool-note tool-report">Something changed or didn't work? <a href="/contact/?tool=${slug}">Report it</a></p>`;
const contact = async query => (await contactResponse({ request: new Request(`https://openorbia.com/contact/${query}`) })).text();

test('every tool page has the Report it line under the facts, and under the First useful result when there is one', () => {
  let withFirst = 0;
  for (const tool of TOOLS) {
    const html = renderTool(tool);
    const count = html.split(LINE(tool.slug)).length - 1;
    const hasFirst = !!renderFirstResult(tool.facts.firstResult);
    assert.equal(count, hasFirst ? 2 : 1, tool.slug);
    if (hasFirst) {
      withFirst++;
      assert.ok(html.indexOf(LINE(tool.slug)) > html.indexOf('id="fr-h"'), `${tool.slug}: after the First useful result`);
    }
    const facts = html.indexOf('id="ff-h"'), after = html.lastIndexOf(LINE(tool.slug));
    if (facts > -1) assert.ok(after > facts && after - html.indexOf('</section>', facts) < 20, `${tool.slug}: right after the Free facts`);
  }
  assert.ok(withFirst > 0, 'some tools have a First useful result');
});

test('/contact/?tool=<real slug> starts a correction for that tool, with Copy buttons for the address and the subject', async () => {
  const tool = TOOLS.find(t => t.slug === 'jan');
  const html = await contact('?tool=jan');
  assert.ok(html.includes(`<b>Reporting a change to ${tool.name}</b>: email launch@openorbia.com with the subject 'Correction: ${tool.name}'`));
  assert.ok(html.includes('<code id="ct-r-mail">launch@openorbia.com</code><button class="copy" type="button" data-copy="launch@openorbia.com" data-copied="Copied" aria-describedby="ct-r-mail">Copy</button>'));
  assert.ok(html.includes(`<code id="ct-r-subj">Correction: ${tool.name}</code><button class="copy" type="button" data-copy="Correction: ${tool.name}" data-copied="Copied" aria-describedby="ct-r-subj">Copy</button>`));
  assert.ok(html.indexOf('ct-report') < html.indexOf('id="ct-h"'), 'at the top');
  const lower = html.toLowerCase();
  assert.equal(lower.split('<script').length, lower.split('<script src="/assets/').length, 'no inline scripts: every script is a file in /assets/');
  // a name with characters that need escaping is escaped
  const amp = TOOLS.find(t => /[&<>"']/.test(t.name));
  if (amp) assert.ok(!(await contact(`?tool=${amp.slug}`)).includes(`Reporting a change to ${amp.name}<`));
});

test('an unknown, empty or malicious ?tool= shows the normal page, with nothing extra', async () => {
  const normal = await contact('');
  assert.ok(!normal.includes('ct-report'));
  for (const q of ['?tool=', '?tool=not-a-tool', '?tool=JAN', '?tool=%3Cscript%3Ealert(1)%3C%2Fscript%3E', '?tool=jan%22%3E%3Cimg%20src%3Dx%3E', '?tool=../jan', '?tool=jan&tool=x', '?tool=' + 'a'.repeat(200)]) {
    const html = await contact(q);
    if (q === '?tool=jan&tool=x') { assert.ok(html.includes('Reporting a change to Jan'), 'the first value counts'); continue; }
    assert.equal(html, normal, q);
  }
  assert.equal(reportTool(undefined), null);
  assert.equal(reportTool('<b>'), null);
});
