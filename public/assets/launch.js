/* OpenOrbia launch pages: countdowns, upvotes, and the homepage "This week's launches" section. No cookies, no storage. */
(() => {
  'use strict';
  const pad = n => String(n).padStart(2, '0');

  // ---- copy buttons: <button data-copy="text" data-copied="Copied"> ----
  // One visually hidden status line, shared by every copy button on the page, tells screen readers what happened: a changed button
  // label is not reliably read out. It exists before any click, so the first message is announced too.
  let copyStatus = null;
  if (document.querySelector('[data-copy]')) {
    copyStatus = document.createElement('p');
    copyStatus.id = 'copy-status';
    copyStatus.setAttribute('role', 'status');
    Object.assign(copyStatus.style, { position: 'absolute', width: '1px', height: '1px', margin: '-1px', padding: '0', border: '0', overflow: 'hidden', clip: 'rect(0 0 0 0)', clipPath: 'inset(50%)', whiteSpace: 'nowrap' });
    document.body.append(copyStatus);
  }
  const announce = text => {
    if (!copyStatus) return;
    copyStatus.textContent = '';
    setTimeout(() => { copyStatus.textContent = text; }, 50); // emptied first, so the same message twice is read twice
  };
  document.addEventListener('click', async e => {
    const b = e.target.closest && e.target.closest('[data-copy]');
    if (!b) return;
    const was = b.dataset.label || (b.dataset.label = b.textContent);
    try { await navigator.clipboard.writeText(b.dataset.copy); b.textContent = b.dataset.copied || 'Copied'; announce('Copied to clipboard'); }
    catch { const code = b.parentElement.querySelector('code'); if (code) { const r = document.createRange(); r.selectNodeContents(code); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); } b.textContent = 'Selected'; announce('Selected'); }
    clearTimeout(b._reset);
    b._reset = setTimeout(() => { b.textContent = was; }, 2000);
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

  // ---- the leaderboard after an upvote: rows move to their new place (sliding there unless reduced motion is on), ranks and
  // medal colors follow (equal upvotes share a rank, as on the server), and the podium is rebuilt from the new top three ----
  const board = document.querySelector('ol.lboard');
  const rowVotes = r => { const n = r.querySelector('[data-count]'); return n ? Number(n.textContent.replace(/D/g, '')) || 0 : 0; };
  function rebuildPodium(rows, ranks) {
    const list = document.querySelector('.podium-steps');
    if (!list) return;
    const top = rows.map((r, i) => ({ r, rank: ranks[i], v: rowVotes(r) })).filter(t => t.v > 0 && t.rank <= 3).slice(0, 3);
    list.replaceChildren(...top.map(({ r, rank, v }, i) => {
      const li = document.createElement('li');
      li.className = `pstep place-${i + 1} p-${rank}`;
      const link = r.querySelector('.lrow-main'), who = document.createElement('a');
      who.className = 'pwho'; who.href = link.getAttribute('href');
      const mark = r.querySelector('.logo').cloneNode(true);
      mark.style.setProperty('--s', '64px'); if (mark.tagName === 'IMG') { mark.width = 64; mark.height = 64; }
      const name = document.createElement('b'); name.textContent = r.querySelector('.lrow-text b').textContent;
      const count = document.createElement('span'); count.className = 'pvotes'; count.textContent = `${new Intl.NumberFormat('en-US').format(v)} upvote${v === 1 ? '' : 's'}`;
      who.append(mark, name, count);
      const block = document.createElement('span'); block.className = 'pblock'; block.setAttribute('aria-hidden', 'true');
      const num = document.createElement('span'); num.className = 'pnum'; num.textContent = String(rank);
      block.append(num); li.append(who, block);
      return li;
    }));
  }
  function reorderBoard() {
    if (!board) return;
    const rows = [...board.children].filter(r => r.classList.contains('lrow') && r.querySelector('.rank'));
    if (rows.length < 2) return rebuildPodium(rows, rows.map(() => 1));
    const before = new Map(rows.map(r => [r, r.getBoundingClientRect().top]));
    // most upvotes first; equal upvotes by name, case-insensitive, as the server orders them (ORDER BY votes DESC, name COLLATE NOCASE)
    const rowName = r => r.querySelector('.lrow-text b').textContent.toLowerCase();
    const sorted = [...rows].sort((a, b) => rowVotes(b) - rowVotes(a) || (rowName(a) < rowName(b) ? -1 : rowName(a) > rowName(b) ? 1 : 0));
    board.append(...sorted);
    let rank = 0, prev = null;
    const ranks = sorted.map((r, i) => {
      const v = rowVotes(r);
      if (v !== prev) { rank = i + 1; prev = v; }
      const n = r.querySelector('.rank'); n.textContent = String(rank); n.setAttribute('aria-label', `Rank ${rank}`);
      r.classList.remove('top', 'top-1', 'top-2', 'top-3');
      if (v > 0 && rank <= 3) r.classList.add('top', `top-${rank}`);
      return rank;
    });
    rebuildPodium(sorted, ranks);
    const still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (still) return;
    for (const r of sorted) {
      const dy = before.get(r) - r.getBoundingClientRect().top;
      if (dy && r.animate) r.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 500, easing: 'cubic-bezier(.2,.7,.2,1)' });
    }
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
        if (!data.already) reorderBoard();
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

    // One launch for the homepage lists: its logo (an address the server checked) or first letter, and a link with the name,
    // tagline, category chip and "Runs free · <setup>" / "Needs paid service" when its facts have been checked
    const launchBits = l => {
      const link = el('a', 'mini-text');
      link.href = `/launch/${encodeURIComponent(l.slug)}/`;
      link.append(el('b', '', l.name), el('span', '', l.tagline));
      const parts = [];
      if (l.category_name) parts.push(el('span', 'mini-cat', l.category_name));
      if (l.signal) parts.push(el('span', `mini-signal${l.signal === 'Needs paid service' ? ' paid' : ''}`, l.signal));
      if (parts.length) { const meta = el('span', 'mini-meta'); meta.append(...parts); link.append(meta); }
      let mark;
      if (l.logo_url) { mark = el('img', 'mini-logo'); mark.src = l.logo_url; mark.alt = ''; mark.width = 40; mark.height = 40; mark.decoding = 'async'; }
      else { mark = el('span', 'mini-logo mini-initial', (l.name || '?').trim().charAt(0).toUpperCase()); mark.setAttribute('aria-hidden', 'true'); }
      return { mark, link };
    };

    // The hero planet's moons (#o3, in public/index.html) carry the logos of this week's top launches, in leaderboard order. A
    // logo shows only once it has loaded; without one (or without JavaScript) a moon keeps its plain color.
    const orbitLogos = launches => {
      const moons = document.querySelectorAll('#o3 .o3-moon');
      launches.filter(l => l.logo_url).slice(0, moons.length).forEach((l, i) => {
        const img = el('img'); img.src = l.logo_url; img.alt = ''; img.width = 40; img.height = 40; img.decoding = 'async';
        img.addEventListener('load', () => moons[i].classList.add('has-logo'), { once: true });
        moons[i].replaceChildren(img);
      });
    };

    const show = data => {
      if (!data || !data.ok) return;
      if (!data.week) {
        // Nothing scheduled yet: keep the static "Coming Monday, Nov 23, 2026" and countdown, unless that time has already passed
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
      if (Array.isArray(data.launches)) orbitLogos(data.launches);
      const head = document.getElementById('week-badge');
      if (head) head.lastChild.textContent = `Launch Week ${data.week}`;
      if (!data.open) {
        setHeading(`Launch Week ${data.week} is coming`);
        const coming = root.querySelector('[data-week-coming]');
        if (coming && data.label) coming.textContent = `Coming ${data.label}`;
        const intro = root.querySelector('[data-week-intro]');
        if (intro && data.total > 0) intro.textContent = `${data.total} free AI tool${data.total === 1 ? ' launches' : 's launch'} on ${data.label}. Voting opens at 12:00 AM Central.`;
        const cd = root.querySelector('[data-countdown]');
        if (cd && data.opens_at) { cd.dataset.countdown = data.opens_at; cd.dataset.now = String(data.now); startCountdown(cd); }
        // the lineup is announced (the server sends launches only from the Wednesday before launch day): list next Monday's
        // launches, up to 6, instead of offering the lineup by email
        if (data.total > 0) {
          const shown = data.launches.slice(0, 6);
          const lineup = el('ol', 'mini mini-lineup');
          lineup.setAttribute('aria-label', `Launching ${data.label || 'next Monday'}`);
          for (const l of shown) {
            const { mark, link } = launchBits(l);
            const li = el('li');
            const row = el('div', 'mini-row');
            row.append(mark, link);
            li.append(row);
            lineup.append(li);
          }
          const cta = root.querySelector('[data-lineup-cta]');
          if (cta) {
            cta.href = '/launches/';
            cta.textContent = data.total > shown.length ? `See all ${data.total} launches →` : 'See the lineup →';
            if (cta.parentElement && cta.parentElement.before) cta.parentElement.before(lineup);
          }
          const when = root.querySelector('[data-lineup-date]');
          if (when) when.remove();
        }
        return;
      }
      const ended = !!data.closed;
      setHeading(ended ? `Launch Week ${data.week} results` : "This week's launches");
      const voted = new Set(Array.isArray(data.voted) ? data.voted : []);
      const num = n => new Intl.NumberFormat('en-US').format(n || 0);
      const list = el('ol', 'mini');
      data.launches.slice(0, 3).forEach((l, i) => {   // the top 3 (the lineup above asks for up to 6)
        const li = el('li');
        const row = el('div', 'mini-row');
        const { mark, link } = launchBits(l);
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
        // ties share a rank (1, 1, 3), worked out by the server over the whole week
        const rank = Number.isInteger(l.rank) ? l.rank : i + 1;
        const rankEl = el('span', 'mini-rank', String(rank));
        rankEl.setAttribute('aria-label', `Rank ${rank}`);
        row.append(rankEl, mark, link, btn);
        li.append(row);
        list.append(li);
      });
      const note = el('p', 'week-note', ended ? 'Voting closed. Final results.' : 'Voting closes Sunday 11:59 PM CT');
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

    const load = () => fetch('/api/launches?limit=6', { headers: { accept: 'application/json' } })
      .then(r => (r.ok ? r.json() : null)).then(show).catch(() => {});
    load();
    document.addEventListener('launch:opened', load);
  }
})();
