// Cloudflare Pages Function: GET /makers/ (see lib/makers.js)

import { makersResponse } from '../../lib/makers.js';

export const onRequestGet = () => makersResponse();
export const onRequestHead = () => makersResponse();
