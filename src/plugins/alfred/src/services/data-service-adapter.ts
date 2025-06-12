/**
 * Data Service Adapter for Alfred Plugin
 *
 * This adapter provides the CollectionDataService interface that Alfred's
 * repositories expect, wrapping the Alexandria DataService.
 */

import { DataService } from '../../../../core/data/interfaces';
import { PostgresDataService } from '../../../../core/data/pg-data-service';
import {
  PostgresCollectionAdapter,
  CollectionDataService
} from '../../../../core/data/collection-adapter';
import { Logger } from '../../../../utils/logger';

/**
 * Creates a CollectionDataService instance for Alfred
 */
export class AlfredDataServiceAdapter {
  private static instance: CollectionDataService | null = null;

  /**
   * Get or create the CollectionDataService instance
   */
  static async getInstance(
    dataService: DataService,
    logger: Logger
  ): Promise<CollectionDataService> {
    if (!this.instance) {
      // Check if the data service is PostgreSQL-based
      if (dataService instanceof PostgresDataService || 'query' in dataService) {
        this.instance = new PostgresCollectionAdapter(dataService as PostgresDataService, logger);

        // Initialize Alfred-specific collections
        await this.initializeCollections(this.instance);
      } else {
        // For other data services, we would need different adapters
        throw new Error('Unsupported data service type for Alfred plugin');
      }
    }

    return this.instance;
  }

  /**
   * Initialize Alfred-specific collections
   */
  private static async initializeCollections(
    collectionService: CollectionDataService
  ): Promise<void> {
    // Create collections for Alfred
    await collectionService.createCollectionIfNotExists('alfred_sessions');
    await collectionService.createCollectionIfNotExists('alfred_templates');

    // Create indexes for efficient queries
    await collectionService.createIndex('alfred_sessions', 'projectId');
    await collectionService.createIndex('alfred_sessions', 'userId');
    await collectionService.createIndex('alfred_sessions', 'updatedAt');

    await collectionService.createIndex('alfred_templates', 'category');
    await collectionService.createIndex('alfred_templates', 'language');
    await collectionService.createIndex('alfred_templates', 'userId');
  }
}
