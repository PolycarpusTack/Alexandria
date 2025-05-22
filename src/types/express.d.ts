/**
 * Type extensions for Express
 * 
 * This file extends the Express namespace with customized types for the Alexandria Platform.
 */

import { User } from '../core/system/interfaces';

// Extend Express namespace
declare global {
  namespace Express {
    // Extend Express.User interface with our internal User properties
    export interface User extends Omit<User, 'metadata'> {
      id: string;
      username: string;
      email: string;
      roles: string[];
      permissions: string[];
      isActive: boolean;
      metadata?: Record<string, any>;
    }
  }
}