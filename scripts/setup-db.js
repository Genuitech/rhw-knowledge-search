#!/usr/bin/env node

import pg from 'pg';
import { config, validate } from '../config.js';

const { Pool } = pg;

async function setupDB() {
  console.log('🚀 Setting up RHW Knowledge Search database\n');

  // Validate config
  validate();

  const pool = new Pool({
    connectionString: config.database.url,
  });

  try {
    console.log('📦 Creating pgvector extension...');
    await pool.query('CREATE EXTENSION IF NOT EXISTS vector');
    console.log('✓ pgvector extension created\n');

    console.log('📋 Creating files table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS files (
        id            SERIAL PRIMARY KEY,
        file_path     TEXT UNIQUE NOT NULL,
        file_name     TEXT NOT NULL,
        file_type     TEXT NOT NULL,
        file_size     BIGINT,
        modified_at   TIMESTAMPTZ,
        indexed_at    TIMESTAMPTZ DEFAULT NOW(),
        content_hash  TEXT,
        text_preview  TEXT,
        folder_path   TEXT NOT NULL,
        embedding     vector(1536)
      )
    `);
    console.log('✓ files table created\n');

    console.log('🔍 Creating indexes...');
    await pool.query(
      'CREATE INDEX IF NOT EXISTS idx_files_embedding ON files USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)'
    );
    console.log('  ✓ Embedding index (ivfflat)');

    await pool.query('CREATE INDEX IF NOT EXISTS idx_files_path ON files (file_path)');
    console.log('  ✓ Path index');

    await pool.query('CREATE INDEX IF NOT EXISTS idx_files_folder ON files (folder_path)');
    console.log('  ✓ Folder index');

    await pool.query('CREATE INDEX IF NOT EXISTS idx_files_modified ON files (modified_at)');
    console.log('  ✓ Modified time index');

    await pool.query('CREATE INDEX IF NOT EXISTS idx_files_type ON files (file_type)');
    console.log('  ✓ File type index\n');

    console.log('✓ Database setup complete!');
    console.log('\nNext steps:');
    console.log('  1. Set up your .env file with DATABASE_URL and OPENAI_API_KEY');
    console.log('  2. Run: npm run crawl:test (to test with sample files)');
    console.log('  3. Or:  npm run crawl:full (to index P:\\Data)\n');

    await pool.end();
  } catch (err) {
    console.error('✗ Database setup failed:', err.message);
    await pool.end();
    process.exit(1);
  }
}

setupDB().catch(err => {
  console.error('✗ Uncaught error:', err);
  process.exit(1);
});
