import fs from 'fs/promises';
import path from 'path';
import { config } from '../config.js';

/**
 * Recursively walk directory and collect files
 * Filters by extension and handles permission errors gracefully
 */
export async function walkDirectory(dirPath, options = {}) {
  const {
    includeTypes = [...config.crawler.textExtractTypes, ...config.crawler.filenameOnlyTypes],
    skipTypes = config.crawler.skipTypes,
    progressInterval = config.crawler.progressInterval,
  } = options;

  const files = [];
  let processedCount = 0;

  async function walk(currentPath) {
    try {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);

        if (entry.isDirectory()) {
          // Recurse into subdirectory
          await walk(fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();

          // Skip if extension in skip list
          if (skipTypes.includes(ext)) {
            continue;
          }

          // Only process if in include types
          if (!includeTypes.includes(ext)) {
            continue;
          }

          // Get file stats
          const stats = await fs.stat(fullPath);

          files.push({
            filePath: fullPath,
            fileName: entry.name,
            fileType: ext,
            fileSize: stats.size,
            modifiedAt: stats.mtime,
            folderPath: currentPath,
          });

          processedCount++;

          // Progress logging
          if (processedCount % progressInterval === 0) {
            console.log(`[Crawler] Collected ${processedCount} files...`);
          }
        }
      }
    } catch (err) {
      if (err.code === 'EACCES') {
        console.warn(`⚠ [Crawler] Permission denied: ${currentPath}`);
      } else {
        console.error(`✗ [Crawler] Error walking ${currentPath}:`, err.message);
      }
    }
  }

  await walk(dirPath);
  console.log(`✓ [Crawler] Collected ${files.length} files`);

  return files;
}
