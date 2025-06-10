/**
 * Alfred Session Management Patch
 * 
 * This file adds the missing getSessions and saveSession methods to the DataService
 * to fix the Alfred Dashboard error.
 */

import { DataService } from '../src/core/data/interfaces';
import { PgUserRepository } from '../src/core/data/pg-repositories';
import { PostgresDataService } from '../src/core/data/pg-data-service';
import { AlfredSession } from '../src/plugins/alfred/src/interfaces';

// Create the sessions table in PostgreSQL
async function createSessionsTable() {
  const pgPassword = 'Th1s1s4Work';
  const dbName = 'alexandria';
  const { exec } = require('child_process');
  
  const createTableSQL = `
  CREATE TABLE IF NOT EXISTS alfred_sessions (
    id VARCHAR(64) PRIMARY KEY,
    project_path TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    messages JSONB NOT NULL DEFAULT '[]'::jsonb,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
  );
  `;
  
  return new Promise((resolve, reject) => {
    exec(`set PGPASSWORD=${pgPassword} && "C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe" -h localhost -p 5433 -U postgres -d ${dbName} -c "${createTableSQL}"`, (error, stdout, stderr) => {
      if (error) {
        console.error('Error creating sessions table:', error);
        reject(error);
        return;
      }
      console.log('Sessions table created or already exists');
      resolve(stdout);
    });
  });
}

// Add sessions methods to PostgresDataService prototype
function addSessionMethodsToDataService() {
  // Add getSessions method
  PostgresDataService.prototype.getSessions = async function(): Promise<AlfredSession[]> {
    try {
      const result = await this.query('SELECT * FROM alfred_sessions ORDER BY updated_at DESC');
      
      return result.rows.map(row => ({
        id: row.id,
        projectPath: row.project_path,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        messages: row.messages || [],
        metadata: row.metadata || {}
      }));
    } catch (error) {
      console.error('Failed to get sessions:', error);
      
      // If table doesn't exist, create it and return empty array
      if (error.message.includes('relation "alfred_sessions" does not exist')) {
        await createSessionsTable();
        return [];
      }
      
      throw error;
    }
  };
  
  // Add saveSession method
  PostgresDataService.prototype.saveSession = async function(session: AlfredSession): Promise<void> {
    try {
      const query = `
        INSERT INTO alfred_sessions (id, project_path, created_at, updated_at, messages, metadata)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (id) DO UPDATE
        SET project_path = $2, updated_at = $4, messages = $5, metadata = $6
      `;
      
      await this.query(query, [
        session.id,
        session.projectPath,
        session.createdAt,
        session.updatedAt,
        JSON.stringify(session.messages),
        JSON.stringify(session.metadata)
      ]);
    } catch (error) {
      console.error('Failed to save session:', error);
      
      // If table doesn't exist, create it and try again
      if (error.message.includes('relation "alfred_sessions" does not exist')) {
        await createSessionsTable();
        await this.saveSession(session);
      } else {
        throw error;
      }
    }
  };
  
  // Add deleteSession method
  PostgresDataService.prototype.deleteSession = async function(sessionId: string): Promise<void> {
    try {
      await this.query('DELETE FROM alfred_sessions WHERE id = $1', [sessionId]);
    } catch (error) {
      console.error('Failed to delete session:', error);
      
      // If table doesn't exist, just return
      if (error.message.includes('relation "alfred_sessions" does not exist')) {
        await createSessionsTable();
        return;
      }
      
      throw error;
    }
  };
  
  console.log('Added session methods to PostgresDataService prototype');
}

// Run the patch
(async () => {
  try {
    console.log('Running Alfred Session Management Patch');
    await createSessionsTable();
    addSessionMethodsToDataService();
    console.log('Patch applied successfully');
  } catch (error) {
    console.error('Failed to apply patch:', error);
  }
})();

export {};
