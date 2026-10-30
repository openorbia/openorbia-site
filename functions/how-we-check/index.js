// Cloudflare Pages Function: GET /how-we-check/ (see lib/how-we-check.js)

import { howWeCheckResponse } from '../../lib/how-we-check.js';

export const onRequestGet = () => howWeCheckResponse();
export const onRequestHead = () => howWeCheckResponse();
