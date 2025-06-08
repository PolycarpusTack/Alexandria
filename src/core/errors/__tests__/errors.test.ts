import {
  AlexandriaError,
  NotFoundError,
  AuthenticationError,
  AuthorizationError,
  ValidationError,
  ConflictError,
  ServiceUnavailableError,
  TimeoutError,
  RateLimitError,
  ConfigurationError,
  PluginError,
  isAlexandriaError,
  isNotFoundError,
  isAuthenticationError,
  isAuthorizationError,
  isValidationError,
  ErrorHandler
} from '../index';

describe('Alexandria Error System', () => {
  describe('NotFoundError', () => {
    it('should create error with resource and id', () => {
      const error = new NotFoundError('User', '123');
      
      expect(error.message).toBe('User not found: 123');
      expect(error.code).toBe('RESOURCE_NOT_FOUND');
      expect(error.context?.resource).toBe('User');
      expect(error.context?.id).toBe('123');
      expect(error.timestamp).toBeInstanceOf(Date);
    });
    
    it('should create error with just resource', () => {
      const error = new NotFoundError('Configuration');
      
      expect(error.message).toBe('Configuration not found');
      expect(error.code).toBe('RESOURCE_NOT_FOUND');
    });
  });
  
  describe('AuthenticationError', () => {
    it('should create authentication error', () => {
      const error = new AuthenticationError('Invalid credentials');
      
      expect(error.message).toBe('Invalid credentials');
      expect(error.code).toBe('AUTHENTICATION_FAILED');
    });
  });
  
  describe('AuthorizationError', () => {
    it('should create authorization error with resource', () => {
      const error = new AuthorizationError('delete', 'User');
      
      expect(error.message).toBe('Not authorized to delete User');
      expect(error.code).toBe('AUTHORIZATION_FAILED');
      expect(error.context?.action).toBe('delete');
      expect(error.context?.resource).toBe('User');
    });
    
    it('should create authorization error without resource', () => {
      const error = new AuthorizationError('access admin panel');
      
      expect(error.message).toBe('Not authorized to access admin panel');
      expect(error.code).toBe('AUTHORIZATION_FAILED');
    });
  });
  
  describe('ValidationError', () => {
    it('should create validation error with multiple fields', () => {
      const errors = [
        { field: 'email', message: 'Invalid email format' },
        { field: 'password', message: 'Password too short' }
      ];
      
      const error = new ValidationError(errors);
      
      expect(error.message).toBe('Validation failed: email - Invalid email format, password - Password too short');
      expect(error.code).toBe('VALIDATION_FAILED');
      expect(error.validationErrors).toEqual(errors);
    });
    
    it('should include validation errors in JSON', () => {
      const errors = [{ field: 'test', message: 'Test error' }];
      const error = new ValidationError(errors);
      const json = error.toJSON();
      
      expect(json.validationErrors).toEqual(errors);
    });
  });
  
  describe('ConflictError', () => {
    it('should create conflict error', () => {
      const error = new ConflictError('User', 'email already exists');
      
      expect(error.message).toBe('User conflict: email already exists');
      expect(error.code).toBe('RESOURCE_CONFLICT');
      expect(error.context?.resource).toBe('User');
      expect(error.context?.conflictType).toBe('email already exists');
    });
  });
  
  describe('ServiceUnavailableError', () => {
    it('should create service unavailable error with reason', () => {
      const error = new ServiceUnavailableError('Database', 'Connection timeout');
      
      expect(error.message).toBe("Service 'Database' is unavailable: Connection timeout");
      expect(error.code).toBe('SERVICE_UNAVAILABLE');
    });
    
    it('should create service unavailable error without reason', () => {
      const error = new ServiceUnavailableError('LLM Service');
      
      expect(error.message).toBe("Service 'LLM Service' is unavailable");
      expect(error.code).toBe('SERVICE_UNAVAILABLE');
    });
  });
  
  describe('TimeoutError', () => {
    it('should create timeout error', () => {
      const error = new TimeoutError('API call', 5000);
      
      expect(error.message).toBe("Operation 'API call' timed out after 5000ms");
      expect(error.code).toBe('OPERATION_TIMEOUT');
      expect(error.context?.operation).toBe('API call');
      expect(error.context?.timeoutMs).toBe(5000);
    });
  });
  
  describe('RateLimitError', () => {
    it('should create rate limit error', () => {
      const error = new RateLimitError(100, 'hour', 3600);
      
      expect(error.message).toBe('Rate limit exceeded: 100 requests per hour');
      expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(error.retryAfter).toBe(3600);
    });
  });
  
  describe('ConfigurationError', () => {
    it('should create configuration error', () => {
      const error = new ConfigurationError('Database', 'Missing connection string');
      
      expect(error.message).toBe('Configuration error in Database: Missing connection string');
      expect(error.code).toBe('CONFIGURATION_ERROR');
    });
  });
  
  describe('PluginError', () => {
    it('should create plugin error', () => {
      const error = new PluginError('crash-analyzer', 'activation', 'Missing dependencies');
      
      expect(error.message).toBe("Plugin 'crash-analyzer' error during activation: Missing dependencies");
      expect(error.code).toBe('PLUGIN_ERROR');
      expect(error.context?.pluginId).toBe('crash-analyzer');
      expect(error.context?.operation).toBe('activation');
    });
  });
  
  describe('Type Guards', () => {
    it('should correctly identify AlexandriaError', () => {
      const alexandriaError = new NotFoundError('Test');
      const regularError = new Error('Test');
      
      expect(isAlexandriaError(alexandriaError)).toBe(true);
      expect(isAlexandriaError(regularError)).toBe(false);
    });
    
    it('should correctly identify specific error types', () => {
      const notFoundError = new NotFoundError('Test');
      const authError = new AuthenticationError('Test');
      const authzError = new AuthorizationError('test');
      const validationError = new ValidationError([]);
      
      expect(isNotFoundError(notFoundError)).toBe(true);
      expect(isNotFoundError(authError)).toBe(false);
      
      expect(isAuthenticationError(authError)).toBe(true);
      expect(isAuthenticationError(notFoundError)).toBe(false);
      
      expect(isAuthorizationError(authzError)).toBe(true);
      expect(isAuthorizationError(authError)).toBe(false);
      
      expect(isValidationError(validationError)).toBe(true);
      expect(isValidationError(notFoundError)).toBe(false);
    });
  });
  
  describe('ErrorHandler', () => {
    it('should convert AlexandriaError to standard format', () => {
      const error = new NotFoundError('User', '123');
      const standardError = ErrorHandler.toStandardError(error);
      
      expect(standardError).toBe(error);
    });
    
    it('should convert regular Error to AlexandriaError', () => {
      const error = new Error('Something went wrong');
      const standardError = ErrorHandler.toStandardError(error);
      
      expect(isAlexandriaError(standardError)).toBe(true);
      expect(standardError.message).toBe('Something went wrong');
      expect(standardError.code).toBe('UNKNOWN_ERROR');
    });
    
    it('should convert non-Error to AlexandriaError', () => {
      const error = 'String error';
      const standardError = ErrorHandler.toStandardError(error);
      
      expect(isAlexandriaError(standardError)).toBe(true);
      expect(standardError.message).toBe('String error');
      expect(standardError.code).toBe('UNKNOWN_ERROR');
    });
    
    it('should return correct HTTP status codes', () => {
      expect(ErrorHandler.getStatusCode(new NotFoundError('Test'))).toBe(404);
      expect(ErrorHandler.getStatusCode(new AuthenticationError('Test'))).toBe(401);
      expect(ErrorHandler.getStatusCode(new AuthorizationError('Test'))).toBe(403);
      expect(ErrorHandler.getStatusCode(new ValidationError([]))).toBe(400);
      expect(ErrorHandler.getStatusCode(new ConflictError('Test', 'Test'))).toBe(409);
      expect(ErrorHandler.getStatusCode(new ServiceUnavailableError('Test'))).toBe(503);
      expect(ErrorHandler.getStatusCode(new TimeoutError('Test', 1000))).toBe(504);
      expect(ErrorHandler.getStatusCode(new RateLimitError(100, 'hour'))).toBe(429);
      expect(ErrorHandler.getStatusCode(new ConfigurationError('Test', 'Test'))).toBe(500);
      expect(ErrorHandler.getStatusCode(new PluginError('test', 'test', 'test'))).toBe(500);
    });
    
    it('should return 500 for unknown error codes', () => {
      class CustomError extends AlexandriaError {}
      const customError = new CustomError('Test', 'CUSTOM_CODE');
      expect(ErrorHandler.getStatusCode(customError)).toBe(500);
    });
  });
  
  describe('Error Serialization', () => {
    it('should serialize to JSON correctly', () => {
      const error = new NotFoundError('User', '123', { extra: 'data' });
      const json = error.toJSON();
      
      expect(json).toMatchObject({
        name: 'NotFoundError',
        message: 'User not found: 123',
        code: 'RESOURCE_NOT_FOUND',
        context: {
          resource: 'User',
          id: '123',
          extra: 'data'
        }
      });
      expect(json.timestamp).toBeDefined();
      expect(json.stack).toBeDefined();
    });
  });
});