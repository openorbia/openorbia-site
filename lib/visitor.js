// Who is asking, without keeping who they are: an HMAC over the IP address and user agent, keyed with the server secret. The IP and the
// user agent are read here only to be hashed (votes, and the rate limits in lib/ratelimit.js); neither is ever stored.

const enc = new TextEncoder();

export async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function expandV6(s) {
  const halves = s.split('::');
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  if (halves.length === 1 && left.length !== 8) return null;
  const fill = halves.length === 2 ? 8 - left.length - right.length : 0;
  if (fill < 0) return null;
  const groups = [...left, ...Array(fill).fill('0'), ...right];
  if (groups.length !== 8 || groups.some(g => !/^[0-9a-f]{1,4}$/.test(g))) return null;
  return groups.map(g => g.padStart(4, '0'));
}

// IPv4 as is. IPv6 reduced to its /64 so hopping between addresses of one network is still the same visitor.
export function normalizeIp(ip) {
  const s = String(ip || '').trim().toLowerCase();
  if (!s) return 'unknown';
  if (!s.includes(':')) return s;
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(s);
  if (mapped) return mapped[1];
  const groups = expandV6(s);
  return groups ? `${groups.slice(0, 4).join(':')}::/64` : s;
}

export function visitor(request) {
  return {
    ip: normalizeIp(request.headers.get('CF-Connecting-IP')),
    ua: (request.headers.get('User-Agent') || '').slice(0, 300),
  };
}
