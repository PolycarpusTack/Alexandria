/**
 * Type declarations for utility modules with deep relative paths
 */

// Handle deep relative imports for Logger
declare module '../../../../utils/logger' {
  // Re-export from the actual logger module
  export * from '@utils/logger';
}

// Handle different depth paths
declare module '../../../utils/logger' {
  export * from '@utils/logger';
}

// Handle even deeper paths for repositories
declare module '../../../../../utils/logger' {
  export * from '@utils/logger';
}