// Cloudflare Pages Function: GET /free-ai-apis/ (see lib/free-apis.js)

import { freeApisResponse } from '../../lib/free-apis.js';

export const onRequestGet = () => freeApisResponse();
export const onRequestHead = () => freeApisResponse();
