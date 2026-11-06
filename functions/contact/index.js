// Cloudflare Pages Function: GET /contact/ (see lib/contact.js)

import { contactResponse } from '../../lib/contact.js';

export const onRequestGet = context => contactResponse(context);
export const onRequestHead = context => contactResponse(context);
