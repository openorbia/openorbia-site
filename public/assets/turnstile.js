/* Cloudflare Turnstile, loaded only when someone starts using a form that has the spam check (homepage waitlist, /submit/, /request/).
   The page itself downloads nothing from Cloudflare's challenge platform until then. Uses Turnstile's explicit rendering
   (https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/#explicitly-render-the-turnstile-widget): the script
   is loaded with ?render=explicit&onload=..., and each <div class="cf-turnstile" data-sitekey data-theme data-appearance> is rendered
   with its own settings. The widget puts its token in the form's cf-turnstile-response field, as before.
   window.openorbiaCheck() starts it (home.js and forms.js call it when a form is sent before the check was started). */
(() => {
  'use strict';
  const boxes = [...document.querySelectorAll('.cf-turnstile[data-sitekey]')];
  if (!boxes.length) return;
  const API = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=openorbiaTurnstileReady';
  let started = false;

  window.openorbiaTurnstileReady = () => {
    for (const el of boxes) {
      if (el.dataset.rendered) continue;
      el.dataset.rendered = '1';
      const options = { sitekey: el.dataset.sitekey };
      if (el.dataset.theme) options.theme = el.dataset.theme;
      if (el.dataset.appearance) options.appearance = el.dataset.appearance;
      try { window.turnstile.render(el, options); } catch { /* the form still posts; the server decides what a missing token means */ }
    }
  };

  const start = () => {
    if (started) return;
    started = true;
    const s = document.createElement('script');
    s.src = API;
    s.async = true;
    document.head.append(s);
  };
  window.openorbiaCheck = start;

  // the first focus, typing or tap inside a form with the check
  for (const el of boxes) {
    const form = el.closest('form');
    if (!form) { start(); continue; }
    for (const type of ['focusin', 'input', 'pointerdown']) form.addEventListener(type, start, { once: true, passive: true });
  }
})();
