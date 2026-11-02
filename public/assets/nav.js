// The header menus (lib/header.js): the arrow next to Tools, Launches or Makers opens its panel, one at a time. Escape, a click
// outside or Tab out of the menu closes it. Ctrl+K (Cmd+K on a Mac) or "/" jumps to the search. Without this file the menus still
// open on hover and keyboard focus, and every menu name is a link.
(() => {
  document.documentElement.classList.add('nav-js');
  const menus = [...document.querySelectorAll('.nav .mm')];
  const close = (m, focus) => {
    m.classList.remove('open');
    const b = m.querySelector('.mm-btn');
    b.setAttribute('aria-expanded', 'false');
    if (focus) b.focus();
  };
  const closeAll = except => menus.forEach(m => m !== except && m.classList.contains('open') && close(m));
  for (const m of menus) {
    const b = m.querySelector('.mm-btn');
    b.addEventListener('click', () => {
      const open = !m.classList.contains('open');
      closeAll(m);
      m.classList.toggle('open', open);
      b.setAttribute('aria-expanded', String(open));
    });
    m.addEventListener('focusout', e => { if (!m.contains(e.relatedTarget)) close(m); });
  }
  document.addEventListener('click', e => { if (!e.target.closest('.nav .mm')) closeAll(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { const m = menus.find(x => x.classList.contains('open')); if (m) close(m, true); return; }
    // the Launch List has its own search box: the shortcut goes there; elsewhere it is the header search (hidden on small screens)
    const q = [document.getElementById('q'), document.getElementById('nav-q')].find(x => x && x.offsetParent);
    if (!q) return;
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
    if ((e.key === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !typing)) { e.preventDefault(); q.focus(); q.select(); }
  });
  const kbd = document.querySelector('.nsearch kbd');
  if (kbd && /Mac|iPhone|iPad/.test(navigator.platform)) kbd.textContent = '⌘K';
})();
