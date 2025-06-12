import { QueryResult } from 'pg';

export interface DatabaseConnection {
  query(text: string, params?: any[]): Promise<QueryResult>;
  transaction<T>(callback: (client: DatabaseConnection) => Promise<T>): Promise<T>;
}

export interface PaginationOptions {
  limit?: number;
  offset?: number;
}

export interface SortOptions {
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface BaseEntity {
  id: string;
  created_at: Date;
  updated_at: Date;
}

export abstract class BaseRepository<T extends BaseEntity> {
  protected tableName: string;
  protected db: DatabaseConnection;

  constructor(tableName: string, db: DatabaseConnection) {
    this.tableName = tableName;
    this.db = db;
  }

  async findById(id: string): Promise<T | null> {
    const query = `SELECT * FROM ${this.tableName} WHERE id = $1`;
    const result = await this.db.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapRowToEntity(result.rows[0]);
  }

  async findAll(options: PaginationOptions & SortOptions = {}): Promise<T[]> {
    const { limit = 50, offset = 0, sortBy = 'created_at', sortOrder = 'DESC' } = options;
    
    const query = `
      SELECT * FROM ${this.tableName} 
      ORDER BY ${sortBy} ${sortOrder}
      LIMIT $1 OFFSET $2
    `;
    
    const result = await this.db.query(query, [limit, offset]);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async count(whereClause?: string, params?: any[]): Promise<number> {
    let query = `SELECT COUNT(*) as count FROM ${this.tableName}`;
    
    if (whereClause) {
      query += ` WHERE ${whereClause}`;
    }
    
    const result = await this.db.query(query, params);
    return parseInt(result.rows[0].count);
  }

  async create(data: Omit<T, 'id' | 'created_at' | 'updated_at'>): Promise<T> {
    const fields = Object.keys(data);
    const values = Object.values(data);
    const placeholders = values.map((_, index) => `$${index + 1}`);

    const query = `
      INSERT INTO ${this.tableName} (${fields.join(', ')})
      VALUES (${placeholders.join(', ')})
      RETURNING *
    `;

    const result = await this.db.query(query, values);
    return this.mapRowToEntity(result.rows[0]);
  }

  async update(id: string, data: Partial<Omit<T, 'id' | 'created_at'>>): Promise<T | null> {
    const fields = Object.keys(data);
    const values = Object.values(data);
    
    if (fields.length === 0) {
      return this.findById(id);
    }

    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');

    const query = `
      UPDATE ${this.tableName} 
      SET ${setClause}
      WHERE id = $1
      RETURNING *
    `;

    const result = await this.db.query(query, [id, ...values]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapRowToEntity(result.rows[0]);
  }

  async delete(id: string): Promise<boolean> {
    const query = `DELETE FROM ${this.tableName} WHERE id = $1`;
    const result = await this.db.query(query, [id]);
    return result.rowCount > 0;
  }

  async findWhere(
    whereClause: string, 
    params: any[], 
    options: PaginationOptions & SortOptions = {}
  ): Promise<T[]> {
    const { limit = 50, offset = 0, sortBy = 'created_at', sortOrder = 'DESC' } = options;
    
    const query = `
      SELECT * FROM ${this.tableName} 
      WHERE ${whereClause}
      ORDER BY ${sortBy} ${sortOrder}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    
    const result = await this.db.query(query, [...params, limit, offset]);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findOneWhere(whereClause: string, params: any[]): Promise<T | null> {
    const query = `SELECT * FROM ${this.tableName} WHERE ${whereClause} LIMIT 1`;
    const result = await this.db.query(query, params);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapRowToEntity(result.rows[0]);
  }

  async exists(whereClause: string, params: any[]): Promise<boolean> {
    const query = `SELECT 1 FROM ${this.tableName} WHERE ${whereClause} LIMIT 1`;
    const result = await this.db.query(query, params);
    return result.rows.length > 0;
  }

  async bulkCreate(items: Array<Omit<T, 'id' | 'created_at' | 'updated_at'>>): Promise<T[]> {
    if (items.length === 0) {
      return [];
    }

    const fields = Object.keys(items[0]);
    const valueRows = items.map((item, itemIndex) => {
      const itemValues = Object.values(item);
      const placeholders = itemValues.map((_, valueIndex) => 
        `$${itemIndex * fields.length + valueIndex + 1}`
      );
      return `(${placeholders.join(', ')})`;
    });

    const allValues = items.flatMap(item => Object.values(item));

    const query = `
      INSERT INTO ${this.tableName} (${fields.join(', ')})
      VALUES ${valueRows.join(', ')}
      RETURNING *
    `;

    const result = await this.db.query(query, allValues);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async bulkUpdate(updates: Array<{ id: string; data: Partial<Omit<T, 'id' | 'created_at'>> }>): Promise<T[]> {
    const results: T[] = [];
    
    // Execute updates in transaction
    return await this.db.transaction(async (client) => {
      for (const { id, data } of updates) {
        const updated = await this.update(id, data);
        if (updated) {
          results.push(updated);
        }
      }
      return results;
    });
  }

  async bulkDelete(ids: string[]): Promise<number> {
    if (ids.length === 0) {
      return 0;
    }

    const placeholders = ids.map((_, index) => `$${index + 1}`).join(', ');
    const query = `DELETE FROM ${this.tableName} WHERE id IN (${placeholders})`;
    
    const result = await this.db.query(query, ids);
    return result.rowCount;
  }

  // Protected method to be implemented by subclasses
  protected abstract mapRowToEntity(row: any): T;

  // Helper method for building complex WHERE clauses
  protected buildWhereClause(filters: Record<string, any>): { clause: string; params: any[] } {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    for (const [field, value] of Object.entries(filters)) {
      if (value === undefined || value === null) {
        continue;
      }

      if (Array.isArray(value)) {
        if (value.length > 0) {
          const placeholders = value.map(() => `$${paramIndex++}`).join(', ');
          conditions.push(`${field} = ANY(ARRAY[${placeholders}])`);
          params.push(...value);
        }
      } else if (typeof value === 'object' && value.operator) {
        // Support for complex conditions like { operator: 'ILIKE', value: '%search%' }
        conditions.push(`${field} ${value.operator} $${paramIndex++}`);
        params.push(value.value);
      } else {
        conditions.push(`${field} = $${paramIndex++}`);
        params.push(value);
      }
    }

    return {
      clause: conditions.length > 0 ? conditions.join(' AND ') : '1=1',
      params
    };
  }

  // Helper method for full-text search
  protected buildFullTextSearch(searchTerm: string, fields: string[]): { clause: string; params: any[] } {
    if (!searchTerm || fields.length === 0) {
      return { clause: '1=1', params: [] };
    }

    // Create a combined search vector from multiple fields
    const searchVector = fields.map(field => `to_tsvector('english', COALESCE(${field}, ''))`).join(' || ');
    const query = `(${searchVector}) @@ plainto_tsquery('english', $1)`;

    return {
      clause: query,
      params: [searchTerm]
    };
  }
}