// Custom Express type declarations for Alexandria
// This file fixes all Express type issues by extending base interfaces

import { Request as ExpressRequest, Response as ExpressResponse, NextFunction as ExpressNextFunction, Application } from 'express';

// User interface for authenticated requests
interface AuthenticatedUser {
  id: string;
  username: string;
  email: string;
  roles: string[];
  permissions?: string[];
}

// Session interface
interface SessionData {
  id: string;
  userId?: string;
  data?: Record<string, unknown>;
  expires?: Date;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      session?: SessionData;
      sessionId?: string;
      ip: string;
      method: string;
      path: string;
      body: Record<string, unknown> | unknown[] | string | number | boolean | null;
      query: Record<string, string | string[] | undefined>;
      params: Record<string, string>;
      headers: Record<string, string | string[] | undefined>;
      app: Application;
      get(name: string): string | undefined;
    }
    
    interface Response {
      status(code: number): Response;
      json(obj: unknown): Response;
      send(data: unknown): Response;
      set(field: string, value: string): Response;
      clearCookie(name: string, options?: Record<string, unknown>): Response;
      redirect(url: string): void;
      redirect(status: number, url: string): void;
      locals: Record<string, unknown>;
      headersSent: boolean;
    }
    
    interface NextFunction {
      (err?: Error | unknown): void;
    }
  }
}

export {};
