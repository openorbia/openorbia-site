// Every response under /launch/: first make sure the Launch Week data is in the database (lib/self-seed.js), then the security
// headers (lib/security-headers.js)
import { onRequest as securityHeaders } from '../../lib/security-headers.js';
import { loadLaunches } from '../../lib/self-seed.js';

export const onRequest = [loadLaunches, securityHeaders];
