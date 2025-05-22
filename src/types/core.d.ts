/**
 * Type declarations for core modules with deep relative paths
 */

// Handle deep relative imports for core security
declare module '../../../../core/security/interfaces' {
  // Re-export from the actual module
  export * from '@core/security/interfaces';
}

// Handle deep relative imports for core data
declare module '../../../../core/data/interfaces' {
  // Re-export from the actual module
  export * from '@core/data/interfaces';
}

// Handle different depth paths
declare module '../../../core/security/interfaces' {
  export * from '@core/security/interfaces';
}

declare module '../../../core/data/interfaces' {
  export * from '@core/data/interfaces';
}