/* OpenOrbia launch pages: countdowns, upvotes, and the homepage "This week's launches" section. No cookies, no storage. */
(() => {
  'use strict';
  const pad = n => String(n).padStart(2, '0');

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
  const status = document.getElementById('vote-status');
  const say = msg => { if (status) status.textContent = msg; };

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
      setHeading("This week's launches");
      const list = el('ol', 'mini');
      data.launches.forEach((l, i) => {
        const li = el('li');
        const a = el('a', 'mini-row');
        a.href = `/launch/${encodeURIComponent(l.slug)}/`;
        a.append(el('span', 'mini-rank', String(i + 1)), el('span', 'mini-text'), el('span', 'mini-votes', `▲ ${new Intl.NumberFormat('en-US').format(l.votes || 0)}`));
        a.querySelector('.mini-text').append(el('b', '', l.name), el('span', '', l.tagline));
        li.append(a);
        list.append(li);
      });
      const more = el('a', 'btn ghost', `See all ${data.total} launch${data.total === 1 ? '' : 'es'} →`);
      more.href = '/launches/';
      root.replaceChildren(el('p', 'week-intro', 'Ranked by community upvotes. Launch week is live.'), list, more);
    };

    const load = () => fetch('/api/launches?limit=3', { headers: { accept: 'application/json' } })
      .then(r => (r.ok ? r.json() : null)).then(show).catch(() => {});
    load();
    document.addEventListener('launch:opened', load);
  }
})();
