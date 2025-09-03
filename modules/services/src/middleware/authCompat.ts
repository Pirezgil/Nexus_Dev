/**
 * Compatibility middleware for Gateway Authentication
 * 
 * This file provides drop-in replacements for the old auth middleware
 * while using the new Gateway-based authentication approach
 */

// Import the new Gateway auth functions
import { 
  gatewayAuthenticate as newAuthenticate, 
  authorize as newAuthorize,
  requireCompanyAccess as newRequireCompanyAccess 
} from './gatewayAuth';

// Export with old names for compatibility
export const authenticate = newAuthenticate;
export const authorize = newAuthorize;
export const requireCompanyAccess = newRequireCompanyAccess;

// Default export
export default {
  authenticate,
  authorize,
  requireCompanyAccess,
};