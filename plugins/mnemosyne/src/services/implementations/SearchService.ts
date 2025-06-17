/**
 * Search Service - Backward Compatibility Wrapper
 * This file maintains backward compatibility by re-exporting the refactored SearchService
 */

// Re-export everything from the modular search implementation
export * from './search';
export { SearchService as default } from './search';

// For any code that directly imports SearchService from this file
import { SearchService } from './search';
export { SearchService };