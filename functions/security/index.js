// Cloudflare Pages Function: GET /security/ (see lib/security.js)

import { securityResponse } from '../../lib/security.js';

export const onRequestGet = () => securityResponse();
export const onRequestHead = () => securityResponse();
