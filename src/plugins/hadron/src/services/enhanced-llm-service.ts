/**
 * Enhanced LLM Service - Backward Compatibility Wrapper
 * 
 * This file maintains backward compatibility while delegating to the refactored
 * modular implementation in the ./llm directory.
 */

import { EnhancedLlmService as ModularEnhancedLlmService } from './llm';

// Re-export the modular service as the default export
export { ModularEnhancedLlmService as EnhancedLlmService };