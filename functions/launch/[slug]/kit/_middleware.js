// Security headers for the maker kit (see lib/security-headers.js). functions/launch/_middleware.js runs too; setting the same headers
// twice gives the same response.
export { onRequest } from '../../../../lib/security-headers.js';
