import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env.local first (overrides), then .env
dotenv.config({ path: path.join(__dirname, '.env.local') });
dotenv.config({ path: path.join(__dirname, '.env') });

const config = {
  database: {
    url: process.env.DATABASE_URL,
    pool: {
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    },
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: 'text-embedding-3-small',
    batchSize: 100,
    rateLimitDelay: 500, // ms between batches
  },
  crawler: {
    path: process.env.CRAWL_PATH || 'P:\\Data',
    concurrency: 5,
    // File types to extract full text from
    textExtractTypes: ['.pdf', '.docx', '.doc', '.xlsx', '.xls', '.txt', '.csv', '.md', '.rtf', '.msg', '.eml'],
    // File types to index by filename only (no text extraction)
    filenameOnlyTypes: ['.qbw', '.qbb', '.qbx', '.bak', '.zip', '.rar', '.tmp', '.jpg', '.png', '.tif', '.bmp', '.ult'],
    // File types to skip entirely
    skipTypes: ['.lnk', '.ini', '.sys', '.dll', '.exe'],
    // Max characters to extract before embedding
    maxCharsPerFile: 32000, // ~8000 tokens
    // Progress logging interval
    progressInterval: 1000,
  },
  env: process.env.NODE_ENV || 'development',
};

// Validation
function validate() {
  const errors = [];

  if (!config.database.url) {
    errors.push('[Config] DATABASE_URL is required');
  }
  if (!config.openai.apiKey) {
    errors.push('[Config] OPENAI_API_KEY is required');
  }

  if (errors.length > 0) {
    errors.forEach(err => console.error('❌', err));
    process.exit(1);
  }

  console.log('✓ Config validated');
}

export { config, validate };
