import { MnemosyneContext } from '../types/MnemosyneContext';
import { MnemosyneError } from '../errors/MnemosyneErrors';

/**
 * Mnemosyne-specific permissions
 */
export enum MnemosynePermissions {
  // Knowledge node permissions
  NODE_CREATE = 'mnemosyne:node:create',
  NODE_READ = 'mnemosyne:node:read',
  NODE_UPDATE = 'mnemosyne:node:update',
  NODE_DELETE = 'mnemosyne:node:delete',
  NODE_PUBLISH = 'mnemosyne:node:publish',

  // Relationship permissions
  RELATIONSHIP_CREATE = 'mnemosyne:relationship:create',
  RELATIONSHIP_READ = 'mnemosyne:relationship:read',
  RELATIONSHIP_UPDATE = 'mnemosyne:relationship:update',
  RELATIONSHIP_DELETE = 'mnemosyne:relationship:delete',

  // Graph permissions
  GRAPH_READ = 'mnemosyne:graph:read',
  GRAPH_ANALYZE = 'mnemosyne:graph:analyze',
  GRAPH_EXPORT = 'mnemosyne:graph:export',

  // Search permissions
  SEARCH_BASIC = 'mnemosyne:search:basic',
  SEARCH_ADVANCED = 'mnemosyne:search:advanced',
  SEARCH_SEMANTIC = 'mnemosyne:search:semantic',

  // Template permissions
  TEMPLATE_CREATE = 'mnemosyne:template:create',
  TEMPLATE_READ = 'mnemosyne:template:read',
  TEMPLATE_UPDATE = 'mnemosyne:template:update',
  TEMPLATE_DELETE = 'mnemosyne:template:delete',
  TEMPLATE_APPLY = 'mnemosyne:template:apply',

  // Import/Export permissions
  IMPORT_DATA = 'mnemosyne:import:data',
  EXPORT_DATA = 'mnemosyne:export:data',

  // Administrative permissions
  ADMIN_USERS = 'mnemosyne:admin:users',
  ADMIN_SYSTEM = 'mnemosyne:admin:system',
  ADMIN_ANALYTICS = 'mnemosyne:admin:analytics'
}

/**
 * Resource context for permission checking
 */
export interface ResourceContext {
  nodeId?: string;
  relationshipId?: string;
  templateId?: string;
  ownerId?: string;
  isPublic?: boolean;
  resourceType?: string;
}

/**
 * Authorization service for Mnemosyne plugin
 */
export class AuthorizationService {
  private context: MnemosyneContext;

  constructor(context: MnemosyneContext) {
    this.context = context;
  }

  /**
   * Check if the current user has a specific permission
   */
  hasPermission(permission: MnemosynePermissions, resourceContext?: ResourceContext): boolean {
    try {
      // Check basic permission with Alexandria security service
      const hasBasicPermission = this.context.permissions.hasPermission(permission, resourceContext);
      
      if (!hasBasicPermission) {
        return false;
      }

      // Additional resource-specific checks
      if (resourceContext) {
        return this.checkResourcePermission(permission, resourceContext);
      }

      return true;
    } catch (error) {
      this.context.logger.error('Permission check failed', { permission, resourceContext, error });
      return false;
    }
  }

  /**
   * Check multiple permissions at once
   */
  hasPermissions(permissions: MnemosynePermissions[], resourceContext?: ResourceContext): boolean {
    return permissions.every(permission => this.hasPermission(permission, resourceContext));
  }

  /**
   * Require a permission or throw an error
   */
  requirePermission(permission: MnemosynePermissions, resourceContext?: ResourceContext): void {
    if (!this.hasPermission(permission, resourceContext)) {
      throw new MnemosyneError(
        'PERMISSION_DENIED',
        `Permission ${permission} is required`,
        { permission, resourceContext }
      );
    }
  }

  /**
   * Require multiple permissions or throw an error
   */
  requirePermissions(permissions: MnemosynePermissions[], resourceContext?: ResourceContext): void {
    const missingPermissions = permissions.filter(
      permission => !this.hasPermission(permission, resourceContext)
    );

    if (missingPermissions.length > 0) {
      throw new MnemosyneError(
        'PERMISSION_DENIED',
        `Permissions required: ${missingPermissions.join(', ')}`,
        { missingPermissions, resourceContext }
      );
    }
  }

  /**
   * Check if user can access a specific knowledge node
   */
  canAccessNode(nodeId: string, permission: MnemosynePermissions): Promise<boolean> {
    return this.checkNodeAccess(nodeId, permission);
  }

  /**
   * Check if user can access a specific relationship
   */
  canAccessRelationship(relationshipId: string, permission: MnemosynePermissions): Promise<boolean> {
    return this.checkRelationshipAccess(relationshipId, permission);
  }

  /**
   * Check if user can access a specific template
   */
  canAccessTemplate(templateId: string, permission: MnemosynePermissions): Promise<boolean> {
    return this.checkTemplateAccess(templateId, permission);
  }

  /**
   * Get user permissions for Mnemosyne
   */
  getUserPermissions(): MnemosynePermissions[] {
    const allPermissions = Object.values(MnemosynePermissions);
    return allPermissions.filter(permission => this.hasPermission(permission));
  }

  /**
   * Create a permission context for a resource
   */
  createResourceContext(resourceType: string, resourceId: string, ownerId?: string, isPublic = false): ResourceContext {
    const context: ResourceContext = {
      resourceType,
      ownerId,
      isPublic
    };

    // Set specific ID based on resource type
    switch (resourceType) {
      case 'node':
        context.nodeId = resourceId;
        break;
      case 'relationship':
        context.relationshipId = resourceId;
        break;
      case 'template':
        context.templateId = resourceId;
        break;
    }

    return context;
  }

  /**
   * Check resource-specific permissions
   */
  private checkResourcePermission(permission: MnemosynePermissions, resourceContext: ResourceContext): boolean {
    // If resource is public and permission is read-only, allow access
    if (resourceContext.isPublic && this.isReadOnlyPermission(permission)) {
      return true;
    }

    // If user owns the resource, allow most operations
    if (resourceContext.ownerId && this.isResourceOwner(resourceContext.ownerId)) {
      return this.canOwnerPerformAction(permission);
    }

    // Check specific resource type permissions
    switch (resourceContext.resourceType) {
      case 'node':
        return this.checkNodePermission(permission, resourceContext);
      case 'relationship':
        return this.checkRelationshipPermission(permission, resourceContext);
      case 'template':
        return this.checkTemplatePermission(permission, resourceContext);
      default:
        return false;
    }
  }

  /**
   * Check if permission is read-only
   */
  private isReadOnlyPermission(permission: MnemosynePermissions): boolean {
    return [
      MnemosynePermissions.NODE_READ,
      MnemosynePermissions.RELATIONSHIP_READ,
      MnemosynePermissions.GRAPH_READ,
      MnemosynePermissions.TEMPLATE_READ,
      MnemosynePermissions.SEARCH_BASIC,
      MnemosynePermissions.SEARCH_ADVANCED,
      MnemosynePermissions.SEARCH_SEMANTIC
    ].includes(permission);
  }

  /**
   * Check if current user is the resource owner
   */
  private isResourceOwner(ownerId: string): boolean {
    // This would be implemented with actual user context
    // For now, return false as placeholder
    return false;
  }

  /**
   * Check if owner can perform the action
   */
  private canOwnerPerformAction(permission: MnemosynePermissions): boolean {
    // Owners can perform most actions except admin operations
    return ![
      MnemosynePermissions.ADMIN_USERS,
      MnemosynePermissions.ADMIN_SYSTEM,
      MnemosynePermissions.ADMIN_ANALYTICS
    ].includes(permission);
  }

  /**
   * Check node-specific permissions
   */
  private checkNodePermission(permission: MnemosynePermissions, resourceContext: ResourceContext): boolean {
    // Implement node-specific permission logic
    return true; // Placeholder
  }

  /**
   * Check relationship-specific permissions
   */
  private checkRelationshipPermission(permission: MnemosynePermissions, resourceContext: ResourceContext): boolean {
    // Implement relationship-specific permission logic
    return true; // Placeholder
  }

  /**
   * Check template-specific permissions
   */
  private checkTemplatePermission(permission: MnemosynePermissions, resourceContext: ResourceContext): boolean {
    // Implement template-specific permission logic
    return true; // Placeholder
  }

  /**
   * Check node access from database
   */
  private async checkNodeAccess(nodeId: string, permission: MnemosynePermissions): Promise<boolean> {
    try {
      const nodeData = await this.context.dataService.query(
        'SELECT created_by, metadata FROM mnemosyne_nodes WHERE id = $1',
        [nodeId]
      );

      if (!nodeData || nodeData.length === 0) {
        return false;
      }

      const node = nodeData[0] as any;
      const resourceContext = this.createResourceContext('node', nodeId, node.created_by, node.metadata?.isPublic);
      
      return this.checkResourcePermission(permission, resourceContext);
    } catch (error) {
      this.context.logger.error('Failed to check node access', { nodeId, permission, error });
      return false;
    }
  }

  /**
   * Check relationship access from database
   */
  private async checkRelationshipAccess(relationshipId: string, permission: MnemosynePermissions): Promise<boolean> {
    try {
      const relationshipData = await this.context.dataService.query(
        'SELECT created_by, metadata FROM mnemosyne_relationships WHERE id = $1',
        [relationshipId]
      );

      if (!relationshipData || relationshipData.length === 0) {
        return false;
      }

      const relationship = relationshipData[0] as any;
      const resourceContext = this.createResourceContext('relationship', relationshipId, relationship.created_by);
      
      return this.checkResourcePermission(permission, resourceContext);
    } catch (error) {
      this.context.logger.error('Failed to check relationship access', { relationshipId, permission, error });
      return false;
    }
  }

  /**
   * Check template access from database
   */
  private async checkTemplateAccess(templateId: string, permission: MnemosynePermissions): Promise<boolean> {
    try {
      const templateData = await this.context.dataService.query(
        'SELECT created_by, is_public FROM mnemosyne_templates WHERE id = $1',
        [templateId]
      );

      if (!templateData || templateData.length === 0) {
        return false;
      }

      const template = templateData[0] as any;
      const resourceContext = this.createResourceContext('template', templateId, template.created_by, template.is_public);
      
      return this.checkResourcePermission(permission, resourceContext);
    } catch (error) {
      this.context.logger.error('Failed to check template access', { templateId, permission, error });
      return false;
    }
  }
}