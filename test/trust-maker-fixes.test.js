// PR 8: trust and maker-page fixes. /how-we-check/ and the submit page say what we check (the official docs), not "by hand"; the
// site's one-line rule for what is listed; /makers/ gives the Week 1 dates, what happens after submitting, the maker kit and the
// same-treatment rule; the FAQ privacy answer says exactly what is kept; /submit/ marks required fields; the confirmation says
// it is not approved yet and that we reply within 2 days.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderHowWeCheck } from '../lib/how-we-check.js';
import { renderMakers } from '../lib/makers.js';
import { FAQ } from '../lib/faq.js';
import { renderSubmit } from '../lib/form-pages.js';
import { confirmationEmail } from '../lib/email.js';
import { assetDeadlineAt, lineupAnnouncedAt, weekdayLabel, launchOpensAt } from '../lib/time.js';
import { FIRST_LAUNCH_WEEK } from '../lib/site.js';

const text = html => html.replace(/<[^>]+>/g, ' ').replace(/&#39;|&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
const faqAnswer = q => FAQ.find(([question]) => question === q)[1].flat(2).filter(p => typeof p === 'string').join('');

test('/how-we-check/ says tools are checked against their official docs, not by hand', () => {
  const t = text(renderHowWeCheck());
  assert.ok(t.includes('Every tool is checked against its official docs, and every page says when.'));
  assert.ok(!t.includes('checked by hand'));
});

test('the submit page states the rule: free AI tools, open source or a real free plan with no trial and no card', () => {
  const html = renderSubmit({ siteKey: 'k' });
  assert.ok(html.includes('Free AI tools: open source, or a real free plan with no trial and no card.'));
  assert.ok(!html.includes('Free and open-source AI tools only'));
  assert.ok(!/by hand/.test(html));
});

test('the asset deadline is the Monday a week before launch day, worked out from the date', () => {
  assert.equal(weekdayLabel(assetDeadlineAt('2026-11-23')), 'Monday, Nov 16');
  assert.ok(assetDeadlineAt('2026-11-23') < lineupAnnouncedAt('2026-11-23'));
  assert.equal(launchOpensAt('2026-11-23') - assetDeadlineAt('2026-11-23'), 7 * 86400 * 1000);
  assert.ok(Number.isNaN(assetDeadlineAt('not a date')));
});

test('/makers/ gives the Week 1 dates, what happens after submitting, the maker kit, the newsletter and the same-treatment rule', () => {
  const t = text(renderMakers());
  for (const s of [
    `Assets due ${weekdayLabel(assetDeadlineAt(FIRST_LAUNCH_WEEK.date))}: logo, screenshots, description and your story`,
    'Assets due Monday, Nov 16', 'Lineup announced Wednesday, Nov 18', 'Voting Monday 12:00 AM to Sunday 11:59 PM Central',
    'After you submit', 'We reply within 2 days with a decision or any questions.',
    'Your maker kit', 'ready-to-post text for X and LinkedIn', 'You get it as soon as your launch page is set up from your assets, before launch day',
    "Launch-week makers in security and AI are featured in Khaja's Cyber Chronicle newsletter.",
    'No paid queue-skipping, no premium spots: every launch gets the same treatment.',
  ]) assert.ok(t.includes(s), s);
});

test('the FAQ privacy answer says what is kept, plainly, and no longer says "nothing about you"', () => {
  const a = faqAnswer('What data does OpenOrbia keep?');
  for (const s of ['one-way scrambled code made from your network address and browser', 'never stored raw', 'Clicks are counted per tool per day', 'The forms store what you type in them'])
    assert.ok(a.includes(s), s);
  assert.ok(!a.includes('nothing about you'));
});

test('/submit/ marks every required field and only those, with a note, and says we reply within 2 days', () => {
  const html = renderSubmit({ siteKey: 'k' });
  assert.ok(html.includes('Fields marked <span aria-hidden="true">*</span> are required.'));
  const fields = [...html.matchAll(/<div class="ff"><label for="([a-z_]+)">(.*?)<\/label>(<(?:input|select|textarea)[^>]*>)/g)];
  assert.ok(fields.length >= 10);
  for (const [, id, label, control] of fields) {
    const required = / required[ >]/.test(control);
    assert.equal(label.includes('class="ff-req"'), required, id);
    if (!required) assert.ok(label.includes('(optional)'), `${id} says optional`);
  }
  assert.ok(html.includes('We reply within 2 days with a decision or any questions.'));
  assert.ok(html.includes('about a launch or a correction, and <a href="mailto:hello@openorbia.com">hello@openorbia.com</a> about anything else.'));
});

test('/submit/: the assets field has its own placeholder, and the hidden spam trap no longer reads "Leave this empty"', () => {
  const html = renderSubmit({ siteKey: 'k' });
  assert.match(html, /id="assets_link"[^>]*placeholder="https:\/\/ link to a shared folder"/);
  assert.ok(!html.includes('Leave this empty'));
  assert.match(html, /<div class="hp" aria-hidden="true"><label>Company<input name="company" tabindex="-1"/);
});

test('/submit/ category labels match the site', () => {
  const html = renderSubmit({ siteKey: 'k' });
  for (const l of ['Small businesses', 'Job seekers', 'Security teams']) assert.ok(html.includes(`>${l}</option>`), l);
});

test('the submit confirmation email is the agreed text', () => {
  assert.equal(confirmationEmail('submit', 'Orbit Notes').text.split('\n\n')[0],
    "We got your submission of Orbit Notes to OpenOrbia. Thank you! This confirms we've received it. It isn't approved yet. We check every tool against its official docs (licence, free plan, card, data, activity) before listing it, and we'll reply within 2 days with a decision or any questions.");
});
