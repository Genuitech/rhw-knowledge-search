import pg from 'pg';
import pgvector from 'pgvector/pg';
import { config } from '../config.js';

const { Pool } = pg;

let pool = null;

/**
 * Initialize database connection pool
 */
export async function initDB() {
  pool = new Pool({
    connectionString: config.database.url,
    ...config.database.pool,
  });

  // Register pgvector type
  await pool.query(pgvector.registerType);

  console.log('✓ [DB] Connected to Neon Postgres');
  return pool;
}

/**
 * Close database connection
 */
export async function closeDB() {
  if (pool) {
    await pool.end();
    console.log('✓ [DB] Connection closed');
  }
}

/**
 * Get a file from the database by path
 * Returns { id, content_hash, embedding } or null
 */
export async function getIndexedFile(filePath) {
  const result = await pool.query('SELECT id, content_hash, embedding FROM files WHERE file_path = $1', [filePath]);
  return result.rows[0] || null;
}

/**
 * Insert or update a file in the database
 */
export async function upsertFile({
  filePath,
  fileName,
  fileType,
  fileSize,
  modifiedAt,
  contentHash,
  textPreview,
  folderPath,
  embedding,
}) {
  const query = `
    INSERT INTO files (file_path, file_name, file_type, file_size, modified_at, content_hash, text_preview, folder_path, embedding)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT (file_path) DO UPDATE SET
      file_size = EXCLUDED.file_size,
      modified_at = EXCLUDED.modified_at,
      content_hash = EXCLUDED.content_hash,
      text_preview = EXCLUDED.text_preview,
      embedding = EXCLUDED.embedding,
      indexed_at = NOW()
    RETURNING id
  `;

  const result = await pool.query(query, [
    filePath,
    fileName,
    fileType,
    fileSize,
    modifiedAt,
    contentHash,
    textPreview || null,
    folderPath,
    embedding ? pgvector.toSql(embedding) : null,
  ]);

  return result.rows[0].id;
}

/**
 * Delete a file from the database
 */
export async function deleteFile(filePath) {
  const result = await pool.query('DELETE FROM files WHERE file_path = $1 RETURNING id', [filePath]);
  return result.rows[0]?.id || null;
}

/**
 * Search files by vector similarity
 * Returns top N results ordered by cosine similarity
 */
export async function search(queryEmbedding, limit = 10) {
  const query = `
    SELECT
      id,
      file_path,
      file_name,
      file_type,
      file_size,
      text_preview,
      folder_path,
      (1 - (embedding <=> $1::vector)) AS similarity
    FROM files
    WHERE embedding IS NOT NULL
    ORDER BY similarity DESC
    LIMIT $2
  `;

  const result = await pool.query(query, [pgvector.toSql(queryEmbedding), limit]);
  return result.rows;
}

/**
 * Get statistics about indexed files
 */
export async function getStats() {
  const result = await pool.query(`
    SELECT
      COUNT(*) as total_files,
      COUNT(DISTINCT folder_path) as total_folders,
      SUM(file_size) as total_size,
      COUNT(CASE WHEN embedding IS NOT NULL THEN 1 END) as indexed_with_embedding
    FROM files
  `);
  return result.rows[0];
}
