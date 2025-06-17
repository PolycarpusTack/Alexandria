// Simple logger implementation for Mnemosyne plugin
export class Logger {
  private prefix: string;

  constructor(context?: string) {
    this.prefix = context ? `[Mnemosyne:${context}]` : '[Mnemosyne]';
  }

  info(message: string, meta?: any): void {
    console.log(`${this.prefix} INFO:`, message, meta || '');
  }

  error(message: string, error?: Error | any): void {
    console.error(`${this.prefix} ERROR:`, message, error || '');
  }

  warn(message: string, meta?: any): void {
    console.warn(`${this.prefix} WARN:`, message, meta || '');
  }

  debug(message: string, meta?: any): void {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`${this.prefix} DEBUG:`, message, meta || '');
    }
  }
}

export const logger = new Logger();
export default logger;