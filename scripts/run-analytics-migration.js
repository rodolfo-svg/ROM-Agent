#!/usr/bin/env node
/**
 * Script para executar a migracao de analytics
 *
 * Uso: node scripts/run-analytics-migration.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  console.log('='.repeat(60));
  console.log('ROM Agent - Analytics Migration');
  console.log('='.repeat(60));

  // Check DATABASE_URL
  if (!process.env.DATABASE_URL) {
    console.error('ERROR: DATABASE_URL not configured');
    console.log('Please set DATABASE_URL in your .env file');
    process.exit(1);
  }

  // Read migration file
  const migrationPath = path.join(__dirname, '../database/migrations/009_analytics_events.sql');

  if (!fs.existsSync(migrationPath)) {
    console.error('ERROR: Migration file not found at:', migrationPath);
    process.exit(1);
  }

  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
  console.log('Migration file loaded:', migrationPath);
  console.log('SQL length:', migrationSQL.length, 'characters');

  // Connect to database
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : false
  });

  try {
    console.log('\nConnecting to database...');
    const client = await pool.connect();
    console.log('Connected successfully!');

    console.log('\nRunning migration...');
    await client.query(migrationSQL);
    console.log('Migration completed successfully!');

    // Verify tables were created
    console.log('\nVerifying tables...');
    const tablesResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name LIKE 'analytics_%'
      ORDER BY table_name
    `);

    console.log('Analytics tables created:');
    for (const row of tablesResult.rows) {
      console.log('  -', row.table_name);
    }

    // Verify views
    const viewsResult = await client.query(`
      SELECT table_name
      FROM information_schema.views
      WHERE table_schema = 'public'
        AND table_name LIKE 'v_%'
      ORDER BY table_name
    `);

    if (viewsResult.rows.length > 0) {
      console.log('\nAnalytics views created:');
      for (const row of viewsResult.rows) {
        console.log('  -', row.table_name);
      }
    }

    client.release();
    console.log('\n' + '='.repeat(60));
    console.log('Migration successful!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\nERROR during migration:', error.message);
    if (error.detail) {
      console.error('Detail:', error.detail);
    }
    if (error.hint) {
      console.error('Hint:', error.hint);
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration().catch(console.error);
