// Cloudflare Pages Function: GET /contact/ (see lib/contact.js)

import { contactResponse } from '../../lib/contact.js';

export const onRequestGet = () => contactResponse();
export const onRequestHead = () => contactResponse();
