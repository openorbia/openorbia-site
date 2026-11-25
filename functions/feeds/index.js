// Cloudflare Pages Function: GET /feeds/, the page that lists the feeds (see lib/feeds.js)

import { feedsPageResponse } from '../../lib/feeds.js';

export const onRequestGet = () => feedsPageResponse();
export const onRequestHead = () => feedsPageResponse();
