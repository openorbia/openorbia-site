/* OpenOrbia launch pages: countdowns, upvotes, and the homepage "This week's launches" section. No cookies, no storage. */
(() => {
  'use strict';
  const pad = n => String(n).padStart(2, '0');

  // ---- copy buttons: <button data-copy="text" data-copied="Copied"> ----
  document.addEventListener('click', async e => {
    const b = e.target.closest && e.target.closest('[data-copy]');
    if (!b) return;
    const was = b.textContent;
    try { await navigator.clipboard.writeText(b.dataset.copy); b.textContent = b.dataset.copied || 'Copied'; }
    catch { const code = b.parentElement.querySelector('code'); if (code) { const r = document.createRange(); r.selectNodeContents(code); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); } b.textContent = 'Selected'; }
    setTimeout(() => { b.textContent = was; }, 2000);
  });

  // ---- countdowns: [data-countdown="<ISO time>"] with <b data-unit="d|h|m|s"> inside; data-now is the server's clock ----
  const timers = new WeakMap();
  function startCountdown(el) {
    clearInterval(timers.get(el)); // restarting (new target time) replaces the old timer
    const target = Date.parse(el.dataset.countdown);
    if (Number.isNaN(target)) return;
    const serverNow = Number(el.dataset.now);
    const offset = Number.isFinite(serverNow) ? serverNow - Date.now() : 0; // follow the server's clock, not the visitor's
    const unit = u => el.querySelector(`[data-unit="${u}"]`);
    const timer = setInterval(tick, 1000);
    timers.set(el, timer);
    function tick() {
      const left = target - (Date.now() + offset);
      if (left <= 0) {
        clearInterval(timer);
        // The launch is open: the server-rendered pages reload to show the leaderboard; the homepage refreshes its own section
        if (el.dataset.onZero === 'reload') setTimeout(() => location.reload(), 1500);
        else document.dispatchEvent(new Event('launch:opened'));
        return;
      }
      const s = Math.floor(left / 1000);
      const set = (u, v) => { const n = unit(u); if (n) n.textContent = v; };
      set('d', String(Math.floor(s / 86400)));
      set('h', pad(Math.floor((s % 86400) / 3600)));
      set('m', pad(Math.floor((s % 3600) / 60)));
      set('s', pad(s % 60));
    }
    tick();
  }
  document.querySelectorAll('[data-countdown]').forEach(startCountdown);

  // ---- upvotes ----
  const say = msg => { const status = document.getElementById('vote-status'); if (status) status.textContent = msg; };

  function markVoted(slug, count) {
    document.querySelectorAll('button.vote').forEach(b => {
      if (b.dataset.slug !== slug) return;
      b.dataset.state = 'voted';
      b.disabled = false;
      b.setAttribute('aria-pressed', 'true');
      const n = b.querySelector('[data-count]');
      if (n && Number.isFinite(count)) n.textContent = new Intl.NumberFormat('en-US').format(count);
      const sr = b.querySelector('[data-sr]');
      if (sr) sr.textContent = `You have upvoted. ${count} upvotes`;
    });
  }

  document.addEventListener('click', async e => {
    const btn = e.target.closest && e.target.closest('button.vote');
    if (!btn || btn.disabled || btn.dataset.state !== 'ready') return;
    btn.disabled = true; // one request at a time
    try {
      const res = await fetch('/api/vote', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug: btn.dataset.slug }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        markVoted(btn.dataset.slug, data.count);
        say(data.already ? 'You had already upvoted this launch.' : 'Thanks, your upvote is counted.');
      } else {
        btn.disabled = false;
        say(data.error || 'Could not record your upvote. Please try again.');
      }
    } catch {
      btn.disabled = false;
      say('Could not reach the server. Check your connection and try again.');
    }
  });

  // ---- homepage: #week-live shows the countdown before launch day and the top launches after ----
  const root = document.getElementById('week-live');
  if (root) {
    const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };

    // The heading reads "Launch Week 1 is coming" until the week opens, then "This week's launches"
    const heading = document.getElementById('week-h');
    const setHeading = text => { if (heading) heading.textContent = text; };

    const show = data => {
      if (!data || !data.ok) return;
      if (!data.week) {
        // Nothing scheduled yet: keep the static "Coming Monday Nov 23" and countdown, unless that time has already passed
        const cd = root.querySelector('[data-countdown]');
        if (cd && Number.isFinite(data.now) && data.now >= Date.parse(cd.dataset.countdown)) {
          setHeading("This week's launches");
          const intro = root.querySelector('[data-week-intro]');
          if (intro) intro.textContent = 'Launch Week 1 is open. The first launches are being added, so check back soon.';
          const coming = root.querySelector('[data-week-coming]');
          if (coming) coming.remove();
          cd.remove();
        }
        return;
      }
      const head = document.getElementById('week-badge');
      if (head) head.lastChild.textContent = `Launch Week ${data.week}`;
      if (!data.open) {
        setHeading(`Launch Week ${data.week} is coming`);
        const coming = root.querySelector('[data-week-coming]');
        if (coming && data.label) coming.textContent = `Coming ${data.label}`;
        const intro = root.querySelector('[data-week-intro]');
        if (intro && data.total > 0) intro.textContent = `${data.total} free AI tool${data.total === 1 ? '' : 's'} launch on ${data.label}. Voting opens at 12:01 AM Pacific.`;
        const cd = root.querySelector('[data-countdown]');
        if (cd && data.opens_at) { cd.dataset.countdown = data.opens_at; cd.dataset.now = String(data.now); startCountdown(cd); }
        return;
      }
      const ended = !!data.closed;
      setHeading(ended ? `Launch Week ${data.week} results` : "This week's launches");
      const voted = new Set(Array.isArray(data.voted) ? data.voted : []);
      const num = n => new Intl.NumberFormat('en-US').format(n || 0);
      const list = el('ol', 'mini');
      data.launches.forEach((l, i) => {
        const li = el('li');
        const row = el('div', 'mini-row');
        const link = el('a', 'mini-text');
        link.href = `/launch/${encodeURIComponent(l.slug)}/`;
        link.append(el('b', '', l.name), el('span', '', l.tagline));
        const state = ended ? 'ended' : voted.has(l.slug) ? 'voted' : 'ready';
        const btn = el('button', 'vote');
        btn.type = 'button';
        btn.dataset.slug = l.slug;
        btn.dataset.state = state;
        btn.setAttribute('aria-pressed', state === 'voted' ? 'true' : 'false');
        btn.disabled = ended;
        const sr = el('span', 'sr', ended ? `Voting for ${l.name} is closed. Final result: ${num(l.votes)} upvotes` : `Upvote ${l.name}. ${num(l.votes)} upvotes${state === 'voted' ? ', you have upvoted' : ''}`);
        sr.dataset.sr = '';
        const n = el('span', 'n', num(l.votes));
        n.dataset.count = '';
        btn.append(el('span', 'arrow', '▲'), n, sr);
        row.append(el('span', 'mini-rank', String(i + 1)), link, btn);
        li.append(row);
        list.append(li);
      });
      const note = el('p', 'week-note', ended ? 'Voting closed. Final results.' : 'Voting closes Sunday 11:59 PM PT');
      const more = el('a', 'btn ghost', ended ? 'See the final results →' : `See all ${data.total} launch${data.total === 1 ? '' : 'es'} →`);
      more.href = ended ? `/launches/week-${data.week}/results/` : '/launches/';
      const status = el('p', 'vote-note', '');
      status.id = 'vote-status';
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      const how = el('p', 'vote-note vote-how');
      const howLink = el('a', '', 'How voting works');
      howLink.href = '/how-voting-works/';
      how.append(howLink);
      root.replaceChildren(note, list, status, how, more);
    };

    const load = () => fetch('/api/launches?limit=3', { headers: { accept: 'application/json' } })
      .then(r => (r.ok ? r.json() : null)).then(show).catch(() => {});
    load();
    document.addEventListener('launch:opened', load);
  }
})();
