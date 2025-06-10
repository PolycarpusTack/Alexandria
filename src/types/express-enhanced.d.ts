// Enhanced Express type declarations for Alexandria
// This extends Express types properly without conflicts

import 'express';

declare module 'express' {
  interface Request {
    user?: {
      id: string;
      username: string;
      email?: string;
      roles: string[];
      permissions: string[];
    };
    session?: any;
    sessionId?: string;
  }
}

// Joi compatibility layer when package is not available
declare global {
  namespace Joi {
    interface ValidationOptions {
      abortEarly?: boolean;
      stripUnknown?: boolean;
      allowUnknown?: boolean;
    }
    
    interface ValidationResult {
      error?: any;
      value?: any;
    }
    
    interface Schema {
      validate(value: any, options?: ValidationOptions): ValidationResult;
    }
  }
}

export {};
