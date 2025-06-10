// Custom Express type declarations for Alexandria
// This file fixes all Express type issues by extending base interfaces

import { Application } from 'express';

declare global {
  namespace Express {
    interface Request {
      user?: any;
      session?: any;
      sessionId?: string;
      ip: string;
      method: string;
      path: string;
      body: any;
      query: any;
      params: any;
      headers: any;
      app: Application;
      get(name: string): string | undefined;
    }
    
    interface Response {
      status(code: number): Response;
      json(obj: any): Response;
      send(data: any): Response;
      set(field: string, value: string): Response;
      clearCookie(name: string, options?: any): Response;
      redirect(url: string): void;
      redirect(status: number, url: string): void;
      locals: Record<string, any>;
      headersSent: boolean;
    }
    
    interface NextFunction {
      (err?: any): void;
    }
  }
}

export {};
