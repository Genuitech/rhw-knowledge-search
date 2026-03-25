#!/usr/bin/env node

import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { config, validate } from '../config.js';
import { walkDirectory } from './fileWalker.js';
import { extractText } from './textExtractor.js';
import { embedBatch } from './embedder.js';
import { initDB, closeDB, getIndexedFile, upsertFile, deleteFile } from './db.js';

/**
 * Compute SHA-256 hash of file content
 */
async function computeFileHash(filePath) {
  const content = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Process a single file: extract text, generate embedding, upsert to DB
 */
async function processFile(file, pool) {
  const { filePath, fileName, fileType, fileSize, modifiedAt, folderPath } = file;

  try {
    // Compute content hash
    const contentHash = await computeFileHash(filePath);

    // Check if already indexed with same hash
    const indexed = await getIndexedFile(filePath);
    if (indexed && indexed.content_hash === contentHash) {
      return { status: 'skipped', reason: 'unchanged', filePath };
    }

    // Extract text
    const extracted = await extractText(filePath, fileType);
    const text = extracted?.text || null;

    // Create text preview (first 500 chars)
    const textPreview = text ? text.substring(0, 500) : `${fileName} (${fileType})`;

    // Generate embedding
    let embedding = null;
    if (text) {
      const result = await embedBatch([{ text, fileName, folderPath }]);
      embedding = result[0]?.embedding || null;
    } else if (fileType.toLowerCase() === '.qbw' || fileType.toLowerCase() === '.qbb') {
      // For QuickBooks files, embed filename + folder
      const result = await embedBatch([{ text: '', fileName, folderPath }]);
      embedding = result[0]?.embedding || null;
    }

    // Upsert to database
    const id = await upsertFile({
      filePath,
      fileName,
      fileType,
      fileSize,
      modifiedAt,
      contentHash,
      textPreview,
      folderPath,
      embedding,
    });

    return { status: 'indexed', id, filePath };
  } catch (err) {
    console.error(`✗ [Crawler] Error processing ${filePath}:`, err.message);
    return { status: 'failed', reason: err.message, filePath };
  }
}

/**
 * Process files concurrently with limited concurrency
 */
async function processConcurrently(files, concurrency = config.crawler.concurrency) {
  const results = [];
  const queue = [...files];
  const active = [];

  async function processNextFile() {
    if (queue.length === 0) return;

    const file = queue.shift();
    try {
      const result = await processFile(file);
      results.push(result);
      console.log(`✓ [Crawler] ${result.status.toUpperCase()}: ${path.basename(file.filePath)}`);
    } catch (err) {
      console.error(`✗ [Crawler] Error:`, err.message);
      results.push({ status: 'failed', reason: err.message, filePath: file.filePath });
    }

    // Keep filling the queue
    if (queue.length > 0) {
      active.push(processNextFile());
    }
  }

  // Start initial batch
  for (let i = 0; i < Math.min(concurrency, files.length); i++) {
    active.push(processNextFile());
  }

  // Wait for all to complete
  await Promise.all(active);

  return results;
}

/**
 * Main crawler entry point
 */
async function main() {
  console.log('🚀 RHW Knowledge Search Crawler\n');

  // Validate config
  validate();

  // Parse CLI arguments
  const args = process.argv.slice(2);
  let crawlPath = config.crawler.path;
  let fullRecrawl = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--path' && args[i + 1]) {
      crawlPath = args[++i];
    } else if (args[i] === '--full') {
      fullRecrawl = true;
    }
  }

  console.log(`📁 Crawl path: ${crawlPath}`);
  if (fullRecrawl) console.log('🔄 Full recrawl mode (ignoring content hashes)\n');

  // Initialize database
  const pool = await initDB();

  try {
    // Walk directory and collect files
    const startTime = Date.now();
    const files = await walkDirectory(crawlPath);

    if (files.length === 0) {
      console.log('⚠ No files found to index');
      await closeDB();
      process.exit(0);
    }

    // Process files concurrently
    console.log(`\n📄 Processing ${files.length} files...\n`);
    const results = await processConcurrently(files);

    // Summarize results
    const indexed = results.filter(r => r.status === 'indexed').length;
    const skipped = results.filter(r => r.status === 'skipped').length;
    const failed = results.filter(r => r.status === 'failed').length;

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n✓ Crawl complete (${elapsed}s)`);
    console.log(`  • Indexed: ${indexed}`);
    console.log(`  • Skipped: ${skipped}`);
    console.log(`  • Failed: ${failed}`);

    await closeDB();
  } catch (err) {
    console.error('✗ [Crawler] Fatal error:', err.message);
    await closeDB();
    process.exit(1);
  }
}

main().catch(err => {
  console.error('✗ [Crawler] Uncaught error:', err);
  process.exit(1);
});
