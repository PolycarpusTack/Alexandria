import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMnemosyneSchema1700000000001 implements MigrationInterface {
    name = 'CreateMnemosyneSchema1700000000001';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create schema
        await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS mnemosyne`);
        
        // Enable UUID extension
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
        
        // Create ENUM types
        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE mnemosyne.node_type AS ENUM ('document', 'note', 'task', 'event', 'reference');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);
        
        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE mnemosyne.connection_type AS ENUM ('related', 'parent', 'reference', 'prerequisite', 'follow_up');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);
        
        // Create nodes table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS mnemosyne.nodes (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                title VARCHAR(500) NOT NULL,
                content TEXT DEFAULT '',
                type mnemosyne.node_type NOT NULL DEFAULT 'document',
                parent_id UUID REFERENCES mnemosyne.nodes(id) ON DELETE SET NULL,
                metadata JSONB NOT NULL DEFAULT '{"tags": [], "author": null, "version": 1}'::JSONB,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                deleted_at TIMESTAMPTZ,
                search_vector tsvector GENERATED ALWAYS AS (
                    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
                    setweight(to_tsvector('english', coalesce(content, '')), 'B')
                ) STORED
            )
        `);
        
        // Create connections table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS mnemosyne.connections (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                source_id UUID NOT NULL REFERENCES mnemosyne.nodes(id) ON DELETE CASCADE,
                target_id UUID NOT NULL REFERENCES mnemosyne.nodes(id) ON DELETE CASCADE,
                type mnemosyne.connection_type NOT NULL DEFAULT 'related',
                metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                CONSTRAINT unique_connection UNIQUE (source_id, target_id),
                CONSTRAINT no_self_connection CHECK (source_id != target_id)
            )
        `);
        
        // Create templates table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS mnemosyne.templates (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                name VARCHAR(255) NOT NULL,
                description TEXT,
                content TEXT NOT NULL,
                fields JSONB NOT NULL DEFAULT '[]'::JSONB,
                category VARCHAR(100) NOT NULL DEFAULT 'General',
                icon VARCHAR(50),
                created_by VARCHAR(255),
                usage_count INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);
        
        // Create indexes
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_nodes_parent ON mnemosyne.nodes(parent_id) WHERE deleted_at IS NULL`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_nodes_type ON mnemosyne.nodes(type) WHERE deleted_at IS NULL`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_nodes_created ON mnemosyne.nodes(created_at) WHERE deleted_at IS NULL`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_nodes_updated ON mnemosyne.nodes(updated_at) WHERE deleted_at IS NULL`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_nodes_search ON mnemosyne.nodes USING GIN(search_vector)`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_nodes_metadata_tags ON mnemosyne.nodes USING GIN((metadata->'tags'))`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_connections_source ON mnemosyne.connections(source_id)`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_connections_target ON mnemosyne.connections(target_id)`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_connections_type ON mnemosyne.connections(type)`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_templates_category ON mnemosyne.templates(category)`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_templates_usage ON mnemosyne.templates(usage_count DESC)`);
        
        // Create update trigger for updated_at
        await queryRunner.query(`
            CREATE OR REPLACE FUNCTION mnemosyne.update_updated_at_column()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = NOW();
                RETURN NEW;
            END;
            $$ language 'plpgsql';
        `);
        
        await queryRunner.query(`
            CREATE TRIGGER update_nodes_updated_at 
            BEFORE UPDATE ON mnemosyne.nodes
            FOR EACH ROW 
            EXECUTE FUNCTION mnemosyne.update_updated_at_column();
        `);
        
        await queryRunner.query(`
            CREATE TRIGGER update_templates_updated_at 
            BEFORE UPDATE ON mnemosyne.templates
            FOR EACH ROW 
            EXECUTE FUNCTION mnemosyne.update_updated_at_column();
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop triggers
        await queryRunner.query(`DROP TRIGGER IF EXISTS update_nodes_updated_at ON mnemosyne.nodes`);
        await queryRunner.query(`DROP TRIGGER IF EXISTS update_templates_updated_at ON mnemosyne.templates`);
        
        // Drop function
        await queryRunner.query(`DROP FUNCTION IF EXISTS mnemosyne.update_updated_at_column()`);
        
        // Drop indexes
        await queryRunner.query(`DROP INDEX IF EXISTS mnemosyne.idx_nodes_parent`);
        await queryRunner.query(`DROP INDEX IF EXISTS mnemosyne.idx_nodes_type`);
        await queryRunner.query(`DROP INDEX IF EXISTS mnemosyne.idx_nodes_created`);
        await queryRunner.query(`DROP INDEX IF EXISTS mnemosyne.idx_nodes_updated`);
        await queryRunner.query(`DROP INDEX IF EXISTS mnemosyne.idx_nodes_search`);
        await queryRunner.query(`DROP INDEX IF EXISTS mnemosyne.idx_nodes_metadata_tags`);
        await queryRunner.query(`DROP INDEX IF EXISTS mnemosyne.idx_connections_source`);
        await queryRunner.query(`DROP INDEX IF EXISTS mnemosyne.idx_connections_target`);
        await queryRunner.query(`DROP INDEX IF EXISTS mnemosyne.idx_connections_type`);
        await queryRunner.query(`DROP INDEX IF EXISTS mnemosyne.idx_templates_category`);
        await queryRunner.query(`DROP INDEX IF EXISTS mnemosyne.idx_templates_usage`);
        
        // Drop tables
        await queryRunner.query(`DROP TABLE IF EXISTS mnemosyne.templates`);
        await queryRunner.query(`DROP TABLE IF EXISTS mnemosyne.connections`);
        await queryRunner.query(`DROP TABLE IF EXISTS mnemosyne.nodes`);
        
        // Drop types
        await queryRunner.query(`DROP TYPE IF EXISTS mnemosyne.connection_type`);
        await queryRunner.query(`DROP TYPE IF EXISTS mnemosyne.node_type`);
        
        // Drop schema
        await queryRunner.query(`DROP SCHEMA IF EXISTS mnemosyne CASCADE`);
    }
}