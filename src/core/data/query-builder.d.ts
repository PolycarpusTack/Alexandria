/**
 * Safe SQL Query Builder to prevent SQL injection
 */
export interface QueryOptions {
    select?: string[];
    where?: Record<string, any>;
    orderBy?: string;
    orderDirection?: 'ASC' | 'DESC';
    limit?: number;
    offset?: number;
}
export declare class QueryBuilder {
    private tableName;
    private selectColumns;
    private whereConditions;
    private orderByColumn?;
    private orderDirection;
    private limitValue?;
    private offsetValue?;
    private params;
    private static ALLOWED_TABLES;
    private static ALLOWED_COLUMNS;
    constructor(tableName: string);
    select(columns: string[]): QueryBuilder;
    where(column: string, value: any, operator?: string): QueryBuilder;
    orderBy(column: string, direction?: 'ASC' | 'DESC'): QueryBuilder;
    limit(value: number): QueryBuilder;
    offset(value: number): QueryBuilder;
    build(): {
        sql: string;
        params: any[];
    };
    static buildInsert(tableName: string, data: Record<string, any>): {
        sql: string;
        params: any[];
    };
    static buildUpdate(tableName: string, id: string, data: Record<string, any>): {
        sql: string;
        params: any[];
    };
    static buildDelete(tableName: string, id: string): {
        sql: string;
        params: any[];
    };
}
