// Cloudflare Pages Function: GET /privacy/ (see lib/privacy.js)

import { privacyResponse } from '../../lib/privacy.js';

export const onRequestGet = () => privacyResponse();
export const onRequestHead = () => privacyResponse();
