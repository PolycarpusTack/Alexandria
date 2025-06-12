/**
 * API Versioning Middleware and Strategy
 * Provides versioning support for Alexandria Platform APIs
 */

import { Request, Response, NextFunction } from 'express';
import { Logger } from '../utils/logger';
import {
  BaseError,
  formatErrorResponse,
  createErrorContext,
  addRequestId,
  addApiVersion
} from '@alexandria/shared';

/**
 * Configuration for API versioning
 */
export interface VersionConfig {
  version: string;
  deprecated?: boolean;
  deprecationDate?: Date;
  sunsetDate?: Date;
  supportedVersions: string[];
  defaultVersion: string;
}

/**
 * Extended Express Request interface with API version information
 */
export interface APIVersionRequest extends Request {
  apiVersion: string;
  isDeprecated: boolean;
  deprecationInfo?: {
    deprecationDate: Date;
    sunsetDate?: Date;
    message: string;
  };
}

/**
 * Manages API versioning including version detection, deprecation warnings,
 * and response formatting for different API versions
 */
export class APIVersionManager {
  private logger: Logger;
  private versionConfigs: Map<string, VersionConfig> = new Map();

  constructor(logger: Logger) {
    this.logger = logger;
    this.initializeVersions();
  }

  private initializeVersions(): void {
    // Define supported API versions
    const versions: VersionConfig[] = [
      {
        version: 'v1',
        deprecated: false,
        supportedVersions: ['v1', 'v2'],
        defaultVersion: 'v1'
      },
      {
        version: 'v2',
        deprecated: false,
        supportedVersions: ['v1', 'v2'],
        defaultVersion: 'v1'
      }
    ];

    for (const config of versions) {
      this.versionConfigs.set(config.version, config);
    }
  }

  /**
   * Get version from request (header, path, or query parameter)
   */
  private extractVersion(req: Request): string {
    // 1. Check Accept header (e.g., application/vnd.alexandria.v1+json)
    const acceptHeader = req.headers.accept;
    if (acceptHeader) {
      const versionMatch = acceptHeader.match(/vnd\.alexandria\.([^+]+)/);
      if (versionMatch) {
        return versionMatch[1];
      }
    }

    // 2. Check custom version header
    const versionHeader = req.headers['api-version'] as string;
    if (versionHeader) {
      return versionHeader;
    }

    // 3. Check path prefix (e.g., /api/v1/...)
    const pathMatch = req.path.match(/^\/api\/([^\/]+)/);
    if (pathMatch && this.versionConfigs.has(pathMatch[1])) {
      return pathMatch[1];
    }

    // 4. Check query parameter
    const queryVersion = req.query.version as string;
    if (queryVersion && this.versionConfigs.has(queryVersion)) {
      return queryVersion;
    }

    // 5. Default to latest stable version
    return this.getDefaultVersion();
  }

  /**
   * Get default API version
   */
  private getDefaultVersion(): string {
    // Return the highest non-deprecated version
    const nonDeprecatedVersions = Array.from(this.versionConfigs.values())
      .filter((config) => !config.deprecated)
      .map((config) => config.version)
      .sort()
      .reverse();

    return nonDeprecatedVersions[0] || 'v1';
  }

  /**
   * Check if version is supported
   */
  private isSupportedVersion(version: string): boolean {
    return this.versionConfigs.has(version);
  }

  /**
   * Get deprecation information for a version
   */
  private getDeprecationInfo(version: string): VersionConfig['deprecationDate'] extends Date
    ? {
        deprecationDate: Date;
        sunsetDate?: Date;
        message: string;
      }
    : null {
    const config = this.versionConfigs.get(version);
    if (!config || !config.deprecated || !config.deprecationDate) {
      return null;
    }

    const daysUntilSunset = config.sunsetDate
      ? Math.ceil((config.sunsetDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : null;

    return {
      deprecationDate: config.deprecationDate,
      sunsetDate: config.sunsetDate,
      message: config.sunsetDate
        ? `API version ${version} is deprecated and will be sunset in ${daysUntilSunset} days on ${config.sunsetDate.toDateString()}`
        : `API version ${version} is deprecated. Please migrate to the latest version.`
    };
  }

  /**
   * Express middleware for API versioning
   */
  versioningMiddleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      const requestedVersion = this.extractVersion(req);
      const versionedReq = req as APIVersionRequest;

      // Check if version is supported
      if (!this.isSupportedVersion(requestedVersion)) {
        this.logger.warn('Unsupported API version requested', {
          requestedVersion,
          supportedVersions: Array.from(this.versionConfigs.keys()),
          path: req.path,
          userAgent: req.headers['user-agent']
        });

        res.status(400).json({
          error: 'UNSUPPORTED_API_VERSION',
          message: `API version '${requestedVersion}' is not supported`,
          supportedVersions: Array.from(this.versionConfigs.keys()),
          currentVersion: this.getDefaultVersion()
        });
        return;
      }

      // Set version information on request
      versionedReq.apiVersion = requestedVersion;

      // Check for deprecation
      const deprecationInfo = this.getDeprecationInfo(requestedVersion);
      versionedReq.isDeprecated = !!deprecationInfo;
      versionedReq.deprecationInfo = deprecationInfo || undefined;

      // Add version headers to response
      res.set({
        'API-Version': requestedVersion,
        'API-Supported-Versions': Array.from(this.versionConfigs.keys()).join(', '),
        'API-Default-Version': this.getDefaultVersion()
      });

      // Add deprecation headers if applicable
      if (deprecationInfo) {
        res.set({
          Deprecation: deprecationInfo.deprecationDate.toISOString(),
          Sunset: deprecationInfo.sunsetDate?.toISOString() || '',
          Warning: `299 - "${deprecationInfo.message}"`
        });

        this.logger.warn('Deprecated API version accessed', {
          version: requestedVersion,
          deprecationInfo,
          path: req.path,
          userAgent: req.headers['user-agent']
        });
      }

      // Log version usage for analytics
      this.logger.debug('API version accessed', {
        version: requestedVersion,
        path: req.path,
        method: req.method
      });

      next();
    };
  }

  /**
   * Add a new version configuration
   */
  addVersion(config: VersionConfig): void {
    this.versionConfigs.set(config.version, config);
    this.logger.info('API version registered', {
      version: config.version,
      deprecated: config.deprecated
    });
  }

  /**
   * Deprecate a version
   */
  deprecateVersion(version: string, deprecationDate: Date, sunsetDate?: Date): void {
    const config = this.versionConfigs.get(version);
    if (config) {
      config.deprecated = true;
      config.deprecationDate = deprecationDate;
      config.sunsetDate = sunsetDate;
      this.versionConfigs.set(version, config);

      this.logger.info('API version deprecated', {
        version,
        deprecationDate: deprecationDate.toISOString(),
        sunsetDate: sunsetDate?.toISOString()
      });
    }
  }

  /**
   * Get version statistics
   */
  getVersionStats(): { version: string; deprecated: boolean; usage?: number }[] {
    return Array.from(this.versionConfigs.entries()).map(([version, config]) => ({
      version,
      deprecated: config.deprecated || false
    }));
  }
}

/**
 * Version-aware route wrapper that validates API version and adds version info to request
 * @param versions - Array of supported API versions for this route
 * @param handler - Route handler function that receives versioned request
 * @returns Express middleware function
 */
export function versionedRoute(
  versions: string[],
  handler: (req: APIVersionRequest, res: Response, next: NextFunction) => void
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const versionedReq = req as APIVersionRequest;

    if (!versions.includes(versionedReq.apiVersion)) {
      res.status(404).json({
        error: 'VERSION_NOT_SUPPORTED',
        message: `This endpoint does not support API version ${versionedReq.apiVersion}`,
        supportedVersions: versions
      });
      return;
    }

    handler(versionedReq, res, next);
  };
}

/**
 * Helper function to create backward-compatible responses with version-specific transformations
 * @param version - Target API version for the response
 * @param data - Response data to transform
 * @param transforms - Optional version-specific transformation functions
 * @returns Transformed response data for the specified version
 */
export function createVersionedResponse(
  version: string,
  data: any,
  transforms?: { [version: string]: (data: any) => any }
): any {
  if (transforms && transforms[version]) {
    return transforms[version](data);
  }
  return data;
}
