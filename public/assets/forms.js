/* /submit/ and /request/: sends the form as JSON to /api/submit or /api/request, with the Turnstile token the widget put in the form.
   Shows the server's own message next to the field it is about. No cookies, no storage. */
(() => {
  'use strict';
  const form = document.getElementById('form');
  if (!form) return;
  const msg = document.getElementById('form-msg');
  const btn = document.getElementById('form-btn');
  const label = btn.textContent;

  const say = (text, ok) => { msg.className = `form-msg${ok === undefined ? '' : ok ? ' ok' : ' err'}`; msg.textContent = text; };
  const clearErrors = () => form.querySelectorAll('.ff-err').forEach(n => { n.hidden = true; n.textContent = ''; });
  const showError = (name, text) => {
    const n = document.getElementById(`${name}-err`);
    if (!n) return say(text, false);
    n.textContent = text; n.hidden = false;
    const c = form.elements[name];
    const first = c && c.length !== undefined && !c.tagName ? c[0] : c;
    if (first && first.focus) first.focus();
    say('Please fix the highlighted field.', false);
  };
  const resetCheck = () => { try { if (window.turnstile) window.turnstile.reset(); } catch { /* the widget is not there yet */ } };

  form.addEventListener('submit', async e => {
    e.preventDefault();
    clearErrors(); say('');
    const data = {};
    for (const el of form.elements) {
      if (!el.name || el.name === 'cf-turnstile-response') continue;
      if (el.type === 'checkbox') data[el.name] = el.checked;
      else if (el.type === 'radio') { if (el.checked) data[el.name] = el.value; }
      else data[el.name] = el.value;
    }
    const token = form.querySelector('[name="cf-turnstile-response"]');
    data.turnstile = token ? token.value : '';
    if (!data.turnstile) { say('Please wait for the spam check to finish (it is under the form), then send again.', false); return; }
    btn.disabled = true; btn.textContent = 'Sending...';
    try {
      const res = await fetch(form.action, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
      const out = await res.json().catch(() => ({}));
      if (res.ok && out.ok) {
        form.reset(); resetCheck();
        say(out.message || 'Thanks, we got it.', true);
        msg.scrollIntoView({ block: 'nearest' });
      } else {
        resetCheck(); // a token works once
        if (out.field) showError(out.field, out.error); else say(out.error || 'Something went wrong. Please try again.', false);
      }
    } catch {
      resetCheck();
      say('Could not reach the server. Check your connection and try again.', false);
    }
    btn.disabled = false; btn.textContent = label;
  });
})();
