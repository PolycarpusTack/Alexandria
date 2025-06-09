/**
 * Migration script to update existing roles and plugins with new permissions
 * Run this after deploying the enhanced authorization service
 */

import { DataService } from '../core/data/interfaces';
import { RbacAuthorizationService } from '../core/security/authorization-service';
import { Logger } from '../utils/logger';
import { ROLE_PERMISSIONS } from '../core/security/permissions';

export class PermissionMigration {
  private logger: Logger;
  private dataService: DataService;
  private authService: RbacAuthorizationService;

  constructor(
    logger: Logger, 
    dataService: DataService,
    authService: RbacAuthorizationService
  ) {
    this.logger = logger;
    this.dataService = dataService;
    this.authService = authService;
  }

  /**
   * Run the migration
   */
  async run(): Promise<void> {
    this.logger.info('Starting permission migration', {
      component: 'PermissionMigration'
    });

    try {
      // Update roles
      await this.updateRoles();      
      // Update plugin permissions
      await this.updatePluginPermissions();
      
      // Verify migration
      await this.verifyMigration();
      
      this.logger.info('Permission migration completed successfully', {
        component: 'PermissionMigration'
      });
    } catch (error) {
      this.logger.error('Permission migration failed', {
        component: 'PermissionMigration',
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Update roles with new permissions
   */
  private async updateRoles(): Promise<void> {
    this.logger.info('Updating roles with enhanced permissions', {
      component: 'PermissionMigration'
    });

    for (const [role, permissions] of Object.entries(ROLE_PERMISSIONS)) {
      try {
        await this.authService.setPermissionsForRole(role, permissions);
        
        this.logger.info(`Updated role: ${role}`, {          component: 'PermissionMigration',
          permissionCount: permissions.length
        });
      } catch (error) {
        this.logger.error(`Failed to update role: ${role}`, {
          component: 'PermissionMigration',
          error: error.message
        });
      }
    }
  }

  /**
   * Update plugin permissions in the database
   */
  private async updatePluginPermissions(): Promise<void> {
    this.logger.info('Updating plugin permissions', {
      component: 'PermissionMigration'
    });

    // Map old permissions to new ones
    const permissionMapping: Record<string, string[]> = {
      'event:emit': ['event:publish'],
      'network:http': ['network:access'],
      // Add more mappings as needed
    };

    try {
      // Get all plugins from database
      const plugins = await this.dataService.query({
        table: 'plugins',
        conditions: {}
      });      
      for (const plugin of plugins) {
        let updated = false;
        const newPermissions = [...(plugin.permissions || [])];
        
        // Add new permissions based on mapping
        for (const [oldPerm, newPerms] of Object.entries(permissionMapping)) {
          if (plugin.permissions?.includes(oldPerm)) {
            for (const newPerm of newPerms) {
              if (!newPermissions.includes(newPerm)) {
                newPermissions.push(newPerm);
                updated = true;
              }
            }
          }
        }
        
        // Update plugin if permissions changed
        if (updated) {
          await this.dataService.update({
            table: 'plugins',
            data: { permissions: newPermissions },
            conditions: { id: plugin.id }
          });
          
          this.logger.info(`Updated plugin permissions: ${plugin.id}`, {
            component: 'PermissionMigration',
            oldCount: plugin.permissions.length,
            newCount: newPermissions.length
          });
        }
      }
    } catch (error) {      this.logger.error('Failed to update plugin permissions', {
        component: 'PermissionMigration',
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Verify the migration was successful
   */
  private async verifyMigration(): Promise<void> {
    this.logger.info('Verifying permission migration', {
      component: 'PermissionMigration'
    });

    // Check that all roles have the expected permissions
    const roles = await this.authService.getAllRoles();
    
    for (const { role, permissions } of roles) {
      const expected = ROLE_PERMISSIONS[role as keyof typeof ROLE_PERMISSIONS];
      
      if (expected && expected.length !== permissions.length) {
        this.logger.warn(`Role ${role} permission count mismatch`, {
          component: 'PermissionMigration',
          expected: expected.length,
          actual: permissions.length
        });
      }
    }
    
    // Validate all permissions are recognized
    const allPermissions = await this.authService.getAllPermissions();
    const validation = this.authService.validatePermissions(allPermissions);    
    if (validation.invalid.length > 0) {
      this.logger.error('Invalid permissions found after migration', {
        component: 'PermissionMigration',
        invalidPermissions: validation.invalid
      });
      throw new Error('Migration resulted in invalid permissions');
    }
    
    this.logger.info('Migration verification complete', {
      component: 'PermissionMigration',
      totalPermissions: allPermissions.length,
      rolesUpdated: roles.length
    });
  }
}

/**
 * Run the migration
 */
export async function runPermissionMigration(
  logger: Logger,
  dataService: DataService,
  authService: RbacAuthorizationService
): Promise<void> {
  const migration = new PermissionMigration(logger, dataService, authService);
  await migration.run();
}