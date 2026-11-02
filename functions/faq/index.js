// Cloudflare Pages Function: GET /faq/ (see lib/faq.js)

import { faqResponse } from '../../lib/faq.js';

export const onRequestGet = () => faqResponse();
export const onRequestHead = () => faqResponse();
