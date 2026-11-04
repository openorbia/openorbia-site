// Community: GitHub Discussions on the site's repository, linked from the footer, every tool page, /contact/ and /privacy/
import test from 'node:test';
import assert from 'node:assert/strict';
import { COMMUNITY, footerHtml } from '../lib/footer.js';
import { renderTool } from '../lib/tool-pages.js';
import { renderContact } from '../lib/contact.js';
import { renderPrivacy } from '../lib/privacy.js';
import { TOOLS } from '../public/assets/tools.js';

const D = 'https://github.com/openorbia/openorbia-site/discussions';

test('the Community links are exact: the repository, its Q&A category and its Show and tell category', () => {
  assert.deepEqual(COMMUNITY, { href: D, qa: D + '/categories/q-a', setups: D + '/categories/show-and-tell' });
});

test('the footer lists Community in the OpenOrbia column, after the FAQ', () => {
  assert.ok(footerHtml(2026).includes('<li><a href="/faq/">FAQ</a></li><li><a href="' + D + '">Community</a></li>'));
});

test('every tool page says where to ask for install help and where to share a setup, and that posts are public', () => {
  for (const t of TOOLS) {
    const html = renderTool(t);
    const line = html.slice(html.indexOf('<p class="tool-note tool-help">'));
    assert.ok(html.includes('<p class="tool-note tool-help">'), t.slug);
    assert.ok(line.includes('href="' + COMMUNITY.qa + '">Ask in Community Q&amp;A</a>') && line.includes('href="' + COMMUNITY.setups + '">share your free setup</a>'), t.slug);
    assert.ok(line.includes('Posts there are public, on GitHub.'), t.slug);
  }
});

test("/contact/ and /privacy/ mention Community, and /privacy/ says posts are public under GitHub's policy", () => {
  assert.ok(renderContact().includes('<a href="' + D + '">Community</a>: get help installing a tool, or share your free setup.'));
  const pv = renderPrivacy();
  assert.ok(pv.includes('<b>Community.</b>') && pv.includes('what you post is public, and GitHub’s privacy policy applies'));
});
