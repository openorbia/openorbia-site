// Cloudflare Pages Function: GET /newsletter/ (see lib/newsletter.js)

import { newsletterResponse } from '../../lib/newsletter.js';

export const onRequestGet = () => newsletterResponse();
export const onRequestHead = () => newsletterResponse();
