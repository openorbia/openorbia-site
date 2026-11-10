// The header shared by every page: logo, three dropdown menus (Tools, Launches, Makers), a Launch List search and "Submit a tool".
// The server-rendered pages get it from layout.js; the static pages (public/index.html, public/404.html, public/launch-list/index.html)
// carry a copy, and test/header.test.js fails when a copy drifts. HEADER_CSS is the same block in public/assets/launch.css and in the
// inline styles of the homepage and the Launch List; public/assets/nav.js opens and closes the menus.
//
// Without JavaScript nothing is lost: every menu name is a plain link to its main page, the search is a GET form to /launch-list/?q=,
// and on a desktop a menu still opens on hover or when the keyboard moves into it.

const CHEVRON = '<svg aria-hidden="true" focusable="false" viewBox="0 0 12 12" width="12" height="12"><path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICON = {
  find: '<path d="M10.5 4a6.5 6.5 0 1 0 4 11.6l4.2 4.2 1.4-1.4-4.2-4.2A6.5 6.5 0 0 0 10.5 4Zm0 2a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9Z"/>',
  week: '<path d="M12 2c3.3 2 5 5.2 5 9.2 0 1.4-.2 2.8-.7 4.1l2.2 2.2-1.4 1.4-1.8-1.8H8.7l-1.8 1.8-1.4-1.4 2.2-2.2A12.2 12.2 0 0 1 7 11.2C7 7.2 8.7 4 12 2Zm0 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM10 19h4l-2 3-2-3Z"/>',
  maker: '<path d="M12 2 14.6 8.6 21.6 9l-5.4 4.5 1.8 6.8L12 16.6 6 20.3l1.8-6.8L2.4 9l7-.4L12 2Z"/>',
};
const icon = k => `<span class="mm-ic"><svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="20" height="20">${ICON[k]}</svg></span>`;
const feature = (href, k, title, text) => `<a class="mm-feat" href="${href}">${icon(k)}<span><b>${title}</b><small>${text}</small></span></a>`;
const col = (heading, links) => `<div class="mm-col"><p class="mm-h">${heading}</p>${links.map(([href, label]) => `<a href="${href}">${label}</a>`).join('')}</div>`;
const menu = (id, href, label, panel) => `<div class="mm"><a class="mm-top" href="${href}">${label}</a><button class="mm-btn" type="button" aria-expanded="false" aria-controls="mm-${id}" aria-label="${label} menu">${CHEVRON}</button>
    <div class="mm-panel" id="mm-${id}">${panel}</div></div>`;

export const MENUS = {
  tools: menu('tools', '/launch-list/', 'Tools',
    feature('/request/', 'find', 'Find my free setup', 'Tell us the task. We reply with a free setup from tools we\'ve checked against their docs.')
    + `<div class="mm-cols">${col('For', [['/launch-list/?for=biz', 'Small businesses'], ['/launch-list/?for=job', 'Job seekers'], ['/launch-list/?for=sec', 'Security teams'], ['/launch-list/', 'All tools']])}`
    + `${col('Setup', [['/launch-list/?setup=browser', 'No install'], ['/launch-list/?setup=desktop', 'Desktop app'], ['/launch-list/?setup=selfhost', 'Self-host'], ['/launch-list/?local=1', 'Works with local AI'], ['/launch-list/?os=1', 'Open source only']])}</div>`
    + '<a class="mm-foot" href="/how-we-check/">How we check tools →</a>'),
  launches: menu('launches', '/launches/', 'Launches',
    feature('/launches/', 'week', 'Launch Week', 'New free tools every Monday. You upvote, the best rise.')
    + `<div class="mm-cols">${col('Launches', [['/launches/', 'This week’s launches'], ['/how-voting-works/', 'How voting works']])}</div>`),
  makers: menu('makers', '/makers/', 'Makers',
    feature('/submit/', 'maker', 'Launch your tool free', 'Free launches, no paid placement. Ever.')
    + `<div class="mm-cols">${col('Makers', [['/makers/', 'For makers'], ['/submit/', 'Submit a tool'], ['/how-we-check/', 'How we check tools']])}</div>`),
};

// `mark` is the logo SVG (MARK in layout.js), passed in so this file does not import layout.js
export const headerHtml = mark => `<header class="wrap"><div class="nav">
  <a class="brand" href="/" aria-label="OpenOrbia home">${mark}<span>Open<span class="grad">Orbia</span></span></a>
  <nav class="links" aria-label="Main">
  ${MENUS.tools}
  ${MENUS.launches}
  ${MENUS.makers}
  <form class="nsearch" action="/launch-list/" method="get" role="search"><input id="nav-q" name="q" type="search" placeholder="Search free tools" aria-label="Search free tools" maxlength="80" autocomplete="off"><kbd>Ctrl K</kbd></form>
  <a class="btn ghost" href="/submit/">Submit a tool</a>
  </nav>
</div></header>`;

export const HEADER_CSS = [
  '.nav{position:relative}',
  '.mm{position:relative;display:flex;align-items:center}',
  '.mm-btn{display:inline-grid;place-items:center;width:28px;min-height:44px;margin-left:-2px;padding:0;border:0;background:none;color:var(--muted);cursor:pointer;border-radius:8px}',
  '.mm-btn svg{transition:transform .15s}',
  '.mm-btn:hover,.mm:hover>.mm-top,.mm.open>.mm-top{color:var(--ink)}',
  '.mm.open>.mm-btn svg{transform:rotate(180deg)}',
  '.mm-panel{display:none;position:absolute;z-index:50;top:calc(100% + 6px);left:-18px;width:min(460px,calc(100vw - 40px));padding:10px;border:1px solid var(--line);border-radius:16px;background:rgba(10,14,32,.97);box-shadow:0 24px 60px rgba(0,0,0,.55),0 0 0 1px rgba(255,255,255,.03) inset;-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px)}',
  '.mm-panel::before{content:"";position:absolute;left:0;right:0;top:-10px;height:10px}',
  '.mm.open>.mm-panel{display:block}',
  'html:not(.nav-js) .mm:focus-within>.mm-panel{display:block}',
  '@media (hover:hover) and (width>=821px){.mm:hover>.mm-panel{display:block}.mm:hover>.mm-btn svg{transform:rotate(180deg)}}',
  '.nav .links .mm-panel a:not(.btn){display:block;padding:7px 10px;border-radius:9px;color:var(--ink);font-size:14.5px;line-height:1.35}',
  '.nav .links .mm-panel a:not(.btn):hover{background:rgba(143,166,255,.09);color:#fff}',
  '.nav .links .mm-panel a.mm-feat{display:flex;gap:12px;align-items:flex-start;padding:12px;margin-bottom:6px;background:linear-gradient(135deg,rgba(91,124,255,.16),rgba(160,123,255,.10));border:1px solid rgba(143,166,255,.22)}',
  '.nav .links .mm-panel a.mm-feat:hover{background:linear-gradient(135deg,rgba(91,124,255,.24),rgba(160,123,255,.16))}',
  '.mm-feat b{display:block;font:700 15px/1.3 var(--display);color:var(--ink)}',
  '.mm-feat small{display:block;margin-top:3px;font-size:13px;line-height:1.4;color:var(--muted)}',
  '.mm-ic{flex:none;display:grid;place-items:center;width:38px;height:38px;border-radius:11px;background:linear-gradient(135deg,#4258d8,#6840e0);box-shadow:0 6px 18px rgba(91,124,255,.35)}',
  '.mm-ic svg{fill:#fff}',
  '.mm-cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:4px 10px;padding:4px 0}',
  '.mm-col{min-width:0}',
  '.mm-h{margin:8px 10px 4px;font:500 11px/1 var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}',
  '.nav .links .mm-panel a.mm-foot{margin-top:6px;padding-top:10px;border-top:1px solid var(--line);border-radius:0 0 9px 9px;color:var(--blue-l)}',
  '.nsearch{position:relative;display:flex;align-items:center}',
  '.nsearch input{width:220px;min-height:40px;padding:8px 58px 8px 14px;border:1px solid var(--line);border-radius:999px;background:rgba(255,255,255,.04);color:var(--ink);font:inherit;font-size:14px}',
  '.nsearch input:focus{border-color:rgba(143,166,255,.55);background:rgba(255,255,255,.07)}',
  '.nsearch kbd{position:absolute;right:10px;padding:2px 6px;border:1px solid var(--line);border-radius:6px;font:500 11px/1.4 var(--mono);color:var(--muted);pointer-events:none}',
  '@media (max-width:960px){.nsearch{display:none}}',
  '@media (max-width:820px){.mm{position:static}.mm-panel{left:0;right:0;width:auto;top:100%}}',
  // phones: the logo and "Submit a tool" share the first row, the three menus take the second
  '@media (max-width:560px){.nav .links{flex-basis:100%;gap:2px 14px}.nav .links>.btn{position:absolute;top:-3px;right:0;padding:9px 13px}}',
  '@media (prefers-reduced-motion:reduce){.mm-btn svg{transition:none}}',
].join('\n');
