"use strict";
/**
 * Collection Adapter for PostgreSQL Data Service
 *
 * This adapter provides a collection-based API on top of the PostgreSQL data service,
 * allowing plugins to use a simpler collection interface instead of direct SQL.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostgresCollectionAdapter = void 0;
/**
 * PostgreSQL implementation of the CollectionDataService
 */
class PostgresCollectionAdapter {
    constructor(pgService, logger) {
        this.pgService = pgService;
        this.logger = logger;
    }
    /**
     * Create a collection (table) if it doesn't exist
     */
    async createCollectionIfNotExists(collectionName) {
        const sql = `
      CREATE TABLE IF NOT EXISTS "${collectionName}" (
        id VARCHAR(36) PRIMARY KEY,
        data JSONB NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;
        try {
            await this.pgService.query(sql);
            // Create update trigger
            const triggerSql = `
        CREATE OR REPLACE FUNCTION update_${collectionName}_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        DROP TRIGGER IF EXISTS ${collectionName}_updated_at_trigger ON "${collectionName}";
        
        CREATE TRIGGER ${collectionName}_updated_at_trigger
          BEFORE UPDATE ON "${collectionName}"
          FOR EACH ROW
          EXECUTE FUNCTION update_${collectionName}_updated_at();
      `;
            await this.pgService.query(triggerSql);
            this.logger.info(`Collection ${collectionName} created or already exists`);
        }
        catch (error) {
            this.logger.error(`Failed to create collection ${collectionName}`, { error });
            throw error;
        }
    }
    /**
     * Create an index on a field in the collection
     */
    async createIndex(collectionName, field) {
        // Create GIN index for JSONB field
        const sql = `
      CREATE INDEX IF NOT EXISTS idx_${collectionName}_${field} 
      ON "${collectionName}" ((data->>'${field}'))
    `;
        try {
            await this.pgService.query(sql);
            this.logger.info(`Index created on ${collectionName}.${field}`);
        }
        catch (error) {
            this.logger.error(`Failed to create index on ${collectionName}.${field}`, { error });
            throw error;
        }
    }
    /**
     * Insert or update a document in the collection
     */
    async upsert(collectionName, id, data) {
        const sql = `
      INSERT INTO "${collectionName}" (id, data)
      VALUES ($1, $2)
      ON CONFLICT (id) DO UPDATE
      SET data = $2,
          updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
        try {
            const result = await this.pgService.query(sql, [id, JSON.stringify(data)]);
            const row = result.rows[0];
            return {
                id: row.id,
                ...row.data,
                _createdAt: row.created_at,
                _updatedAt: row.updated_at
            };
        }
        catch (error) {
            this.logger.error(`Failed to upsert document in ${collectionName}`, { error, id });
            throw error;
        }
    }
    /**
     * Find a document by ID
     */
    async findById(collectionName, id) {
        const sql = `SELECT * FROM "${collectionName}" WHERE id = $1`;
        try {
            const result = await this.pgService.query(sql, [id]);
            if (result.rows.length === 0) {
                return null;
            }
            const row = result.rows[0];
            return {
                id: row.id,
                ...row.data,
                _createdAt: row.created_at,
                _updatedAt: row.updated_at
            };
        }
        catch (error) {
            this.logger.error(`Failed to find document by ID in ${collectionName}`, { error, id });
            throw error;
        }
    }
    /**
     * Find documents matching a filter
     */
    async find(collectionName, filter) {
        let sql = `SELECT * FROM "${collectionName}"`;
        const params = [];
        const conditions = [];
        // Handle special filter for date comparisons
        const specialFilters = [];
        Object.entries(filter).forEach(([key, value], index) => {
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                // Handle special operators like $lt, $gt, etc.
                if (value.$lt) {
                    specialFilters.push(`(data->>'${key}')::timestamp < $${params.length + 1}`);
                    params.push(value.$lt);
                }
                else if (value.$gt) {
                    specialFilters.push(`(data->>'${key}')::timestamp > $${params.length + 1}`);
                    params.push(value.$gt);
                }
            }
            else if (key === 'id') {
                conditions.push(`id = $${params.length + 1}`);
                params.push(value);
            }
            else {
                conditions.push(`data->>'${key}' = $${params.length + 1}`);
                params.push(value);
            }
        });
        const allConditions = [...conditions, ...specialFilters];
        if (allConditions.length > 0) {
            sql += ` WHERE ${allConditions.join(' AND ')}`;
        }
        sql += ' ORDER BY created_at DESC';
        try {
            const result = await this.pgService.query(sql, params);
            return result.rows.map(row => ({
                id: row.id,
                ...row.data,
                _createdAt: row.created_at,
                _updatedAt: row.updated_at
            }));
        }
        catch (error) {
            this.logger.error(`Failed to find documents in ${collectionName}`, { error, filter });
            throw error;
        }
    }
    /**
     * Find a single document matching a filter
     */
    async findOne(collectionName, filter) {
        const results = await this.find(collectionName, filter);
        return results.length > 0 ? results[0] : null;
    }
    /**
     * Delete documents matching a filter
     */
    async delete(collectionName, filter) {
        let sql = `DELETE FROM "${collectionName}"`;
        const params = [];
        const conditions = [];
        Object.entries(filter).forEach(([key, value], index) => {
            if (key === 'id') {
                conditions.push(`id = $${index + 1}`);
            }
            else {
                conditions.push(`data->>'${key}' = $${index + 1}`);
            }
            params.push(value);
        });
        if (conditions.length > 0) {
            sql += ` WHERE ${conditions.join(' AND ')}`;
        }
        try {
            const result = await this.pgService.query(sql, params);
            return result.rowCount > 0;
        }
        catch (error) {
            this.logger.error(`Failed to delete documents from ${collectionName}`, { error, filter });
            throw error;
        }
    }
    /**
     * Delete many documents matching a filter
     */
    async deleteMany(collectionName, filter) {
        let sql = `DELETE FROM "${collectionName}"`;
        const params = [];
        const conditions = [];
        Object.entries(filter).forEach(([key, value], index) => {
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                // Handle special operators
                if (value.$lt) {
                    conditions.push(`(data->>'${key}')::timestamp < $${params.length + 1}`);
                    params.push(value.$lt);
                }
            }
            else if (key === 'id') {
                conditions.push(`id = $${index + 1}`);
                params.push(value);
            }
            else {
                conditions.push(`data->>'${key}' = $${index + 1}`);
                params.push(value);
            }
        });
        if (conditions.length > 0) {
            sql += ` WHERE ${conditions.join(' AND ')}`;
        }
        try {
            const result = await this.pgService.query(sql, params);
            return { deletedCount: result.rowCount };
        }
        catch (error) {
            this.logger.error(`Failed to delete many documents from ${collectionName}`, { error, filter });
            throw error;
        }
    }
}
exports.PostgresCollectionAdapter = PostgresCollectionAdapter;
