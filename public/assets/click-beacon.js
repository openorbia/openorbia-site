/* Counts follows of tool links. Every link to a tool on the Launch List and the tool pages is the tool's real address (so the tool gets a
   real link) and carries data-tool="<slug>". When one is followed, the slug goes to POST /api/click and nothing else: no cookie, no
   identifier, no page address. See lib/click.js for what is stored (a count per tool per day). */
(() => {
  'use strict';
  const count = slug => {
    try {
      const body = new Blob([JSON.stringify({ slug })], { type: 'application/json' });
      if (navigator.sendBeacon && navigator.sendBeacon('/api/click', body)) return;
      fetch('/api/click', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ slug }), keepalive: true }).catch(() => {});
    } catch { /* counting is never allowed to break the link */ }
  };
  const follow = e => {
    const link = e.target.closest && e.target.closest('a[data-tool]');
    if (!link) return;
    if (e.type === 'auxclick' && e.button !== 1) return;   // a middle click opens a new tab; a right click does not follow the link
    count(link.dataset.tool);
  };
  document.addEventListener('click', follow);
  document.addEventListener('auxclick', follow);
})();
