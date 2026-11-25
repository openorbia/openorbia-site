/* Launch lock: until launch time, every page shows the launch countdown instead of its content, except the pages makers need
   (tool pages, /makers/, /submit/, /privacy/, /contact/, /security/, /how-we-check/, /unsubscribe/ and maker kits), which get a
   slim countdown bar. At launch time it takes itself away and reloads the page, so the site opens with no deploy.

   The launch instant comes from <meta name="openorbia-launch" content="ISO time"> and its wording from
   <meta name="openorbia-launch-time"> (the opening time in words), both written from lib/voting-window.js and lib/site.js
   (layout.js for the server pages, build:home for the static ones). This file loads in <head> without defer, so the page is
   never shown unlocked first. The page content is still in the HTML (search engines and visitors without JavaScript see it);
   this is a launch curtain, not access control. No inline script: the Content Security Policy forbids it; inline styles are
   allowed, so the styles are added from here. */
(() => {
  'use strict';
  const OPEN_PATHS = [/^\/tool\/[^/]+\/?$/, /^\/makers\/?$/, /^\/submit\/?$/, /^\/privacy\/?$/, /^\/contact\/?$/, /^\/security\/?$/,
    /^\/how-we-check\/?$/, /^\/unsubscribe\/?$/, /^\/launch\/[^/]+\/kit\/?$/];
  const isOpen = path => OPEN_PATHS.some(re => re.test(path));
  const before = (now, at) => Number.isFinite(at) && now < at;
  const shouldLock = (path, now, at) => before(now, at) && !isOpen(path);
  const shouldBar = (path, now, at) => before(now, at) && isOpen(path);
  // "3 days 10 hours 05 min 09 sec" pieces for the time left
  const left = ms => { const s = Math.max(0, Math.floor(ms / 1000)); return { d: Math.floor(s / 86400), h: Math.floor(s / 3600) % 24, m: Math.floor(s / 60) % 60, s: s % 60 }; };
  window.openorbiaLaunchLock = { shouldLock, shouldBar, isOpen, left, OPEN_PATHS };

  const meta = document.querySelector('meta[name="openorbia-launch"]');
  // the opening time's wording ("12:00 AM Central"), written next to the instant from lib/voting-window.js
  const timeMeta = document.querySelector('meta[name="openorbia-launch-time"]');
  const atText = timeMeta && timeMeta.content ? timeMeta.content : '';
  const zoneMeta = document.querySelector('meta[name="openorbia-launch-zone"]');
  const zone = zoneMeta && zoneMeta.content ? zoneMeta.content : undefined;
  const at = meta ? Date.parse(meta.content) : NaN;
  const path = location.pathname;
  if (!before(Date.now(), at)) return;
  const locked = shouldLock(path, Date.now(), at);
  const root = document.documentElement;
  root.classList.add(locked ? 'oo-locked' : 'oo-prelaunch');

  const style = document.createElement('style');
  style.textContent = [
    'html.oo-locked main>*:not(.oo-lock):not(#join),html.oo-locked .nav .mm,html.oo-locked .nsearch,html.oo-locked footer .sf-top{display:none!important}',
    '.oo-lock{padding:clamp(36px,9vh,96px) 0 28px;text-align:center}',
    '.oo-lock-k{margin:0;font:500 12px/1 var(--mono,monospace);letter-spacing:.14em;text-transform:uppercase;color:var(--cyan,#7fe7ff)}',
    '.oo-lock-h{font:800 clamp(38px,7vw,76px)/1.02 var(--display,sans-serif);letter-spacing:-.01em;margin:16px 0 14px;color:var(--ink,#fff)}',
    '.oo-lock-h em{font-style:normal;background:linear-gradient(90deg,var(--blue-l,#8fa6ff),var(--blue,#5b7cff) 45%,var(--violet,#a07bff));-webkit-background-clip:text;background-clip:text;color:transparent}',
    '.oo-lock-when{margin:0 auto 26px;max-width:60ch;color:#c9d2ee;font-size:clamp(16px,2vw,19px)}',
    '.oo-count{display:flex;justify-content:center;gap:clamp(8px,2vw,18px);margin:0 0 28px}',
    '.oo-count div{min-width:clamp(64px,16vw,104px);padding:14px 8px;border:1px solid var(--line,#2a3150);border-radius:16px;background:rgba(255,255,255,.03)}',
    '.oo-count b{display:block;font:800 clamp(30px,6vw,52px)/1 var(--display,sans-serif);color:var(--ink,#fff);font-variant-numeric:tabular-nums}',
    '.oo-count span{display:block;margin-top:6px;font:500 11px var(--mono,monospace);letter-spacing:.12em;text-transform:uppercase;color:var(--muted,#9aa3c7)}',
    '.oo-lock-acts{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin:0}',
    '.oo-bar{padding:10px 16px;text-align:center;font-size:14px;color:var(--ink,#fff);background:linear-gradient(90deg,rgba(91,124,255,.22),rgba(160,123,255,.18));border-bottom:1px solid var(--line,#2a3150)}',
    '.oo-bar b{font-variant-numeric:tabular-nums}',
  ].join('\n');
  document.head.append(style);

  const when = new Intl.DateTimeFormat('en-US', { timeZone: zone, weekday: 'long', month: 'short', day: 'numeric' }).format(at);
  const pad = n => String(n).padStart(2, '0');
  let ticks = [];

  const build = () => {
    if (locked) {
      const main = document.querySelector('main') || document.body;
      const home = path === '/' || path === '/index.html';
      const panel = document.createElement('section');
      panel.className = 'oo-lock';
      panel.setAttribute('aria-labelledby', 'oo-lock-h');
      panel.innerHTML = `<p class="oo-lock-k">Launch Week 1</p>
<p class="oo-lock-h" id="oo-lock-h" role="heading" aria-level="1">Where free AI tools <em>take off</em>.</p>
<p class="oo-lock-when">OpenOrbia launches ${when}${atText ? ` at ${atText}` : ''}. Free and open-source AI tools, with the catch shown up front.</p>
<div class="oo-count" role="timer" aria-label="Time until OpenOrbia launches"><div><b data-u="d">0</b><span>days</span></div><div><b data-u="h">00</b><span>hours</span></div><div><b data-u="m">00</b><span>min</span></div><div><b data-u="s">00</b><span>sec</span></div></div>
<p class="oo-lock-acts">${home ? '<a class="btn pri" href="#join">Get the launch email</a>' : '<a class="btn pri" href="/#join">Get the launch email</a>'}<a class="btn ghost" href="/makers/">Launch your tool free</a></p>`;
      main.prepend(panel);
      ticks = [...panel.querySelectorAll('[data-u]')];
    } else {
      const bar = document.createElement('div');
      bar.className = 'oo-bar';
      bar.setAttribute('role', 'status');
      bar.innerHTML = `OpenOrbia launches in <b data-u="all"></b> · ${when}${atText ? `, ${atText}` : ''}`;
      document.body.prepend(bar);
      ticks = [...bar.querySelectorAll('[data-u]')];
    }
    tick();
  };

  const tick = () => {
    const ms = at - Date.now();
    if (ms <= 0) { location.reload(); return; }   // launch time: show the live site
    const t = left(ms);
    for (const el of ticks) {
      const u = el.dataset.u;
      el.textContent = u === 'all' ? `${t.d}d ${pad(t.h)}h ${pad(t.m)}m ${pad(t.s)}s` : u === 'd' ? String(t.d) : pad(t[u]);
    }
    setTimeout(tick, 1000 - (Date.now() % 1000));
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build, { once: true });
  else build();
})();
