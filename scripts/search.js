#!/usr/bin/env node

import readline from 'readline';
import { config, validate } from '../config.js';
import { initDB, closeDB, search } from '../crawler/db.js';
import { embedText } from '../crawler/embedder.js';

async function runSearch() {
  console.log('🔍 RHW Knowledge Search Query Tool\n');

  // Validate config
  validate();

  // Initialize database
  await initDB();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));

  try {
    while (true) {
      const queryText = await question('\n📝 Enter your search query (or "quit" to exit): ');

      if (queryText.toLowerCase() === 'quit') {
        break;
      }

      if (!queryText.trim()) {
        console.log('⚠ Empty query, please try again');
        continue;
      }

      try {
        console.log('\n⏳ Embedding query...');
        const queryEmbedding = await embedText(queryText);

        console.log('🔎 Searching...\n');
        const results = await search(queryEmbedding, 10);

        if (results.length === 0) {
          console.log('❌ No results found');
          continue;
        }

        console.log(`✓ Found ${results.length} results:\n`);
        results.forEach((result, index) => {
          const similarity = (result.similarity * 100).toFixed(1);
          console.log(`${index + 1}. [${similarity}%] ${result.file_name}`);
          console.log(`   📁 ${result.folder_path}`);
          console.log(`   📄 ${result.file_type} (${(result.file_size / 1024).toFixed(1)} KB)`);
          if (result.text_preview) {
            const preview = result.text_preview.substring(0, 100).replace(/\n/g, ' ');
            console.log(`   📖 "${preview}..."\n`);
          }
        });
      } catch (err) {
        console.error('✗ Search failed:', err.message);
      }
    }

    rl.close();
  } finally {
    await closeDB();
    console.log('\n👋 Goodbye!');
  }
}

runSearch().catch(err => {
  console.error('✗ Uncaught error:', err);
  process.exit(1);
});
