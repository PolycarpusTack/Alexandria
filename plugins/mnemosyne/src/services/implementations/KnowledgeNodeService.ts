/**
 * KnowledgeNodeService - Backward Compatibility Wrapper
 * 
 * This file maintains backward compatibility while delegating to the refactored
 * modular implementation in the ./knowledge directory.
 */

import { KnowledgeNodeService as ModularKnowledgeNodeService } from './knowledge';

// Re-export the modular service as the default export
export { ModularKnowledgeNodeService as KnowledgeNodeService };