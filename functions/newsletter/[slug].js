// Cloudflare Pages Function: GET /newsletter/<slug>/ (see lib/newsletter.js)

import { issueResponse } from '../../lib/newsletter.js';

export const onRequestGet = ({ params }) => issueResponse(params.slug);
export const onRequestHead = ({ params }) => issueResponse(params.slug);
