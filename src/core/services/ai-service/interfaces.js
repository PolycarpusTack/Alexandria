"use strict";
/**
 * AI Service Interfaces
 *
 * Defines the contracts for the centralized AI service that all plugins use.
 * This service provides model management, text completion, streaming, and embeddings.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompletionError = exports.ModelLoadError = exports.ModelNotFoundError = exports.AIServiceError = exports.AICapability = void 0;
var AICapability;
(function (AICapability) {
    AICapability["CHAT"] = "chat";
    AICapability["CODE"] = "code";
    AICapability["EMBEDDINGS"] = "embeddings";
    AICapability["INSTRUCT"] = "instruct";
    AICapability["FUNCTION_CALLING"] = "function_calling";
    AICapability["VISION"] = "vision";
})(AICapability || (exports.AICapability = AICapability = {}));
// Error Types
class AIServiceError extends Error {
    constructor(message, code, details) {
        super(message);
        this.code = code;
        this.details = details;
        this.name = 'AIServiceError';
    }
}
exports.AIServiceError = AIServiceError;
class ModelNotFoundError extends AIServiceError {
    constructor(modelId) {
        super(`Model not found: ${modelId}`, 'MODEL_NOT_FOUND', { modelId });
    }
}
exports.ModelNotFoundError = ModelNotFoundError;
class ModelLoadError extends AIServiceError {
    constructor(modelId, reason) {
        super(`Failed to load model ${modelId}: ${reason}`, 'MODEL_LOAD_ERROR', { modelId, reason });
    }
}
exports.ModelLoadError = ModelLoadError;
class CompletionError extends AIServiceError {
    constructor(message, details) {
        super(message, 'COMPLETION_ERROR', details);
    }
}
exports.CompletionError = CompletionError;
