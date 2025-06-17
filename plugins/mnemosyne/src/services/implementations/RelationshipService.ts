/**
 * RelationshipService - Backward Compatibility Wrapper
 * 
 * This file maintains backward compatibility while delegating to the refactored
 * modular implementation in the ./relationship directory.
 */

import { RelationshipService as ModularRelationshipService } from './relationship';

// Re-export the modular service as the default export
export { ModularRelationshipService as RelationshipService };