const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function fixMigration() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'alexandria',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres'
  });

  try {
    console.log('Connecting to database...');
    await client.connect();
    
    // Check if migration table exists
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'migrations'
      );
    `);
    
    if (tableExists.rows[0].exists) {
      // Check if the failed migration is recorded
      const migrationCheck = await client.query(
        "SELECT * FROM migrations WHERE id = '1735561800000_alfred_sessions_schema'"
      );
      
      if (migrationCheck.rows.length > 0) {
        console.log('Removing failed migration record...');
        await client.query(
          "DELETE FROM migrations WHERE id = '1735561800000_alfred_sessions_schema'"
        );
        console.log('✅ Failed migration record removed');
      }
      
      // Check if alfred tables exist and drop them if needed
      const alfredSessionsExists = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'alfred_sessions'
        );
      `);
      
      if (alfredSessionsExists.rows[0].exists) {
        console.log('Dropping existing alfred_sessions table...');
        await client.query('DROP TABLE IF EXISTS alfred_sessions CASCADE');
        console.log('✅ alfred_sessions table dropped');
      }
      
      const alfredTemplatesExists = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'alfred_templates'
        );
      `);
      
      if (alfredTemplatesExists.rows[0].exists) {
        console.log('Dropping existing alfred_templates table...');
        await client.query('DROP TABLE IF EXISTS alfred_templates CASCADE');
        console.log('✅ alfred_templates table dropped');
      }
      
      // Drop any existing trigger functions
      console.log('Dropping trigger functions if they exist...');
      await client.query('DROP FUNCTION IF EXISTS update_alfred_sessions_updated_at() CASCADE');
      await client.query('DROP FUNCTION IF EXISTS update_alfred_templates_updated_at() CASCADE');
      console.log('✅ Trigger functions cleaned up');
    }
    
    console.log('\n✅ Database cleaned up successfully!');
    console.log('\nThe migration should now run successfully when you start the server.');
    console.log('Run: pnpm dev');
    
  } catch (error) {
    console.error('Error:', error.message);
    console.log('\nIf the database connection failed, make sure PostgreSQL is running.');
  } finally {
    await client.end();
  }
}

fixMigration();