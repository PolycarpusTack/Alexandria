import { EventEmitter } from 'events';

export interface ErrorContext {
  component?: string;
  action?: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, any>;
}

export interface ErrorReport {
  id: string;
  message: string;
  stack?: string;
  context: ErrorContext;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  handled: boolean;
}

export class AlfredErrorHandler extends EventEmitter {
  private errors: ErrorReport[] = [];
  private maxErrors = 100;

  handleError(error: Error, context: ErrorContext = {}): ErrorReport {
    const report: ErrorReport = {
      id: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      message: error.message,
      stack: error.stack,
      context,
      timestamp: new Date(),
      severity: this.determineSeverity(error, context),
      handled: true
    };

    this.errors.push(report);
    if (this.errors.length > this.maxErrors) {
      this.errors.shift();
    }

    this.emit('error', report);
    
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Alfred Error:', report);
    }

    return report;
  }

  private determineSeverity(error: Error, context: ErrorContext): ErrorReport['severity'] {
    if (error.name === 'TypeError' || error.name === 'ReferenceError') return 'high';
    if (context.component === 'ai-service') return 'medium';
    if (context.action === 'user-interaction') return 'low';
    return 'medium';
  }

  getErrorStats(): { total: number; bySeverity: Record<string, number> } {
    const bySeverity = this.errors.reduce((acc, error) => {
      acc[error.severity] = (acc[error.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return { total: this.errors.length, bySeverity };
  }
}