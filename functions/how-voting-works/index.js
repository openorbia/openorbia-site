// Cloudflare Pages Function: GET /how-voting-works/ (see lib/how-voting-works.js)

import { howVotingWorksResponse } from '../../lib/how-voting-works.js';

export const onRequestGet = () => howVotingWorksResponse();
export const onRequestHead = () => howVotingWorksResponse();
