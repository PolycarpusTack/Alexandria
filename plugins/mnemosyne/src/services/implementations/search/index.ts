/**
 * Search Service Module Exports
 * Maintains backward compatibility while exposing new modular structure
 */

// Export the main service
export { SearchService } from './SearchService';

// Export specialized handlers for advanced usage
export { SearchValidator } from './SearchValidator';
export { QueryBuilder } from './QueryBuilder';
export { SearchAnalyticsHandler } from './SearchAnalyticsHandler';
export { FacetGenerator } from './FacetGenerator';

// Export types
export * from './types';

// Default export for backward compatibility
import { SearchService } from './SearchService';
export default SearchService;