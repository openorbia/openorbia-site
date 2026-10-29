// Small helpers for building the server-rendered pages. Everything that goes into HTML goes through esc().

import { CATEGORIES, httpsUrl } from './launch-data.js';

const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ENTITIES[c]);

// Plain text -> <p> paragraphs (blank line = new paragraph, single newline = <br>)
export function paragraphs(text) {
  return String(text ?? '').split(/\n{2,}/).map(p => p.trim()).filter(Boolean)
    .map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
}

export const initial = name => (String(name ?? '').trim()[0] || '?').toUpperCase();
export const number = n => new Intl.NumberFormat('en-US').format(n);

export const CATEGORY_COLORS = { biz: ['#5b7cff', '#7a4dff'], job: ['#2fb8a0', '#5b7cff'], sec: ['#ff6b8a', '#7a4dff'] };
export const categoryName = c => CATEGORIES[c] || 'Other';

// Open-source licences get the green badge, anything else the yellow "free" one (same as the Launch List)
export const isOpenLicense = l => /\b(MIT|Apache|BSD|GPL|AGPL|LGPL|MPL|ISC|Unlicense|CC0)\b/i.test(String(l));

const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be']);

// How to show a launch's video: an embed (YouTube without cookies, Vimeo), a local file, or just a link. null if none.
export function videoEmbed(url) {
  if (!url) return null;
  if (url.startsWith('/')) return /\.(mp4|webm)$/i.test(url) ? { kind: 'file', src: url } : null;
  const safe = httpsUrl(url);
  if (!safe) return null;
  const u = new URL(safe);
  if (YOUTUBE_HOSTS.has(u.hostname)) {
    const id = u.hostname === 'youtu.be' ? u.pathname.slice(1) : u.searchParams.get('v') || (/^\/(?:embed|shorts)\/([^/]+)/.exec(u.pathname) || [])[1];
    if (id && /^[A-Za-z0-9_-]{11}$/.test(id)) return { kind: 'iframe', src: `https://www.youtube-nocookie.com/embed/${id}` };
  }
  if (u.hostname === 'vimeo.com' || u.hostname === 'www.vimeo.com') {
    const id = /^\/(\d+)$/.exec(u.pathname);
    if (id) return { kind: 'iframe', src: `https://player.vimeo.com/video/${id[1]}` };
  }
  return { kind: 'link', href: safe };
}
