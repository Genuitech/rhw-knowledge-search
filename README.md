# RHW Knowledge Search - Crawler

AI-powered knowledge search crawler for RHW CPAs. Indexes files from P:\Data (1.5 TB) into Neon Postgres with vector embeddings, enabling natural language search across research memos, SOPs, and training materials.

## Architecture Overview

```
Files on P:\Data (or custom path)
        ↓
   File Walker (fs.readdir)
        ↓
  Text Extraction (pdf-parse, mammoth, xlsx, etc.)
        ↓
  Vector Embeddings (OpenAI text-embedding-3-small)
        ↓
  Neon Postgres + pgvector
        ↓
  Cosine Similarity Search (vector similarity)
```

## Features

- **Incremental Indexing**: Detects changed files by SHA-256 hash, only re-indexes modified documents
- **Multi-Format Support**: PDF, DOCX, XLSX, TXT, CSV, MD, and more
- **Filename-Only Indexing**: For file types without text extraction (e.g., QuickBooks .qbw)
- **Concurrent Processing**: 5 files processed in parallel (configurable)
- **Vector Search**: Cosine similarity search with pgvector indices
- **Cost-Efficient**: $0 Neon free tier + ~$5-15 for embeddings on 50K files

## Prerequisites

- **Node.js** >=18.0.0
- **Neon Postgres** account (free tier available) with pgvector extension
- **OpenAI API key** (for text-embedding-3-small model)
- Access to `P:\Data` or equivalent file share

## Quick Start

### 1. Installation

```bash
git clone https://github.com/genuitech/rhw-knowledge-search.git
cd rhw-knowledge-search
npm install
```

### 2. Environment Setup

Create `.env.local` (not committed to git):

```bash
# Copy the template
cp .env.example .env.local

# Edit with your credentials
# - DATABASE_URL: your Neon connection string
# - OPENAI_API_KEY: your OpenAI API key
```

### 3. Database Setup

Create tables and indexes:

```bash
npm run setup-db
```

### 4. Test Crawl

Index sample files in `test-docs/`:

```bash
npm run crawl:test
```

You should see output like:
```
✓ [Crawler] Collected 3 files
📄 Processing 3 files...

✓ [Crawler] INDEXED: sample-memo.txt
✓ [Crawler] INDEXED: sample-sop.txt
✓ [Crawler] INDEXED: sample-data.csv

✓ Crawl complete (2.3s)
  • Indexed: 3
  • Skipped: 0
  • Failed: 0
```

### 5. Search

Run interactive search:

```bash
npm run search
```

Try queries like:
- "tax filing procedures"
- "client onboarding steps"
- "quarterly reporting"

## Project Structure

```
rhw-knowledge-search/
├── crawler/
│   ├── index.js           # Main entry point (CLI)
│   ├── fileWalker.js      # Recursive directory walker
│   ├── textExtractor.js   # Document text extraction
│   ├── embedder.js        # Vector embedding generation
│   └── db.js              # Database operations
├── scripts/
│   ├── setup-db.js        # Database initialization
│   └── search.js          # Interactive search tool
├── test-docs/             # Sample files for testing
├── config.js              # Centralized configuration
├── package.json           # Dependencies
├── .env.example           # Configuration template
├── .gitignore             # Git ignore rules
└── README.md              # This file
```

## Available Commands

```bash
# Test with sample files
npm run crawl:test

# Index full P:\Data directory
npm run crawl:full

# Index a custom path
node crawler/index.js --path "/path/to/files"

# Force re-index everything (ignore hashes)
node crawler/index.js --path "/path/to/files" --full

# Set up database tables and indexes
npm run setup-db

# Interactive search tool
npm run search

# Build (ES modules, no build step needed)
npm start  # Same as: npm run crawl
```

## Database Schema

### `files` Table

```sql
files (
  id            SERIAL PRIMARY KEY,
  file_path     TEXT UNIQUE NOT NULL,    -- Full path
  file_name     TEXT NOT NULL,            -- Filename
  file_type     TEXT NOT NULL,            -- Extension (.pdf, .docx, etc.)
  file_size     BIGINT,                   -- Bytes
  modified_at   TIMESTAMPTZ,              -- File's last modified time
  indexed_at    TIMESTAMPTZ DEFAULT NOW(), -- When indexed
  content_hash  TEXT,                     -- SHA-256 of content
  text_preview  TEXT,                     -- First 500 chars
  folder_path   TEXT NOT NULL,            -- Parent directory
  embedding     vector(1536)              -- OpenAI 1536-dim embedding
)

-- Indexes
CREATE INDEX idx_files_embedding ON files USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_files_path ON files (file_path);
CREATE INDEX idx_files_folder ON files (folder_path);
CREATE INDEX idx_files_modified ON files (modified_at);
CREATE INDEX idx_files_type ON files (file_type);
```

## Supported File Types

### Full Text Extraction
- `.pdf` — PDF documents (pdf-parse)
- `.docx` — Microsoft Word (mammoth)
- `.xlsx`, `.xls` — Excel spreadsheets (xlsx)
- `.txt` — Plain text files
- `.csv` — Comma-separated values
- `.md` — Markdown documents
- `.rtf` — Rich Text Format

### Filename-Only Indexing
- `.qbw`, `.qbb`, `.qbx` — QuickBooks files
- `.bak` — Backup files
- `.zip`, `.rar` — Archives
- `.jpg`, `.png`, `.tif` — Images

### Skipped
- `.lnk` — Shortcuts
- `.ini` — Configuration files
- `.sys`, `.dll`, `.exe` — System files

## Configuration

Edit `config.js` to customize:

```javascript
crawler: {
  path: 'P:\\Data',           // Default crawl path
  concurrency: 5,              // Files processed in parallel
  maxCharsPerFile: 32000,      // Max chars before embedding (8K tokens)
  progressInterval: 1000,      // Log every N files
}

openai: {
  model: 'text-embedding-3-small',
  batchSize: 100,              // Max texts per API call
  rateLimitDelay: 500,         // ms between batches
}
```

## Cost Estimate

| Item | Cost |
|------|------|
| Neon Postgres (free tier) | $0 |
| OpenAI embeddings (50K files) | $5-15 one-time |
| pgvector index storage | Included in Neon |
| **Total MVP** | **$5-15** |

## Deployment

Currently designed for local development on a Windows server (running via Scheduled Task or PowerShell script).

**Future phases will add:**
- Vercel deployment
- Web UI for search results
- Scheduled crawling (daily/weekly)
- Real-time file watching
- Entra SSO authentication

## Troubleshooting

### `DATABASE_URL is required`
- Ensure `.env.local` has `DATABASE_URL` set
- Run `npm run setup-db` first

### `OPENAI_API_KEY is required`
- Add your OpenAI API key to `.env.local`
- Check key format: starts with `sk-`

### `Permission denied` errors
- Some folders may be restricted. The crawler logs warnings and continues.
- Ensure your user has read access to `P:\Data`

### Slow embeddings
- OpenAI API has rate limits. Default 500ms delay between batches.
- Adjust `config.openai.rateLimitDelay` if needed (min 200ms recommended)

### Database connection timeout
- Check network connectivity to Neon
- Verify `DATABASE_URL` is correct
- Try connecting directly: `psql <DATABASE_URL>`

## Development Notes

**Code Style** (matching `rhw-research-data-ingestion`):
- ES modules (`import/export`)
- Plain JavaScript (no TypeScript)
- Console logging with prefixes: `[Crawler]`, `[Extract]`, `[Embed]`, `[DB]`
- Status icons: ✓ (success), ✗ (error), ⚠ (warning)

**Testing**:
1. Always test with `test-docs/` first
2. Verify files appear in database with embeddings
3. Run search queries to confirm similarity works

## Roadmap

**Phase 1-6** (Current MVP):
- ✓ Project setup, database schema
- ✓ File walker, text extraction
- ✓ Embeddings, database operations
- ✓ Main crawler loop, testing

**Phase 7+** (Future):
- Search UI (Next.js on Vercel or Express on server)
- Entra SSO / Microsoft login
- AI-assisted memo writing
- Approval workflows
- Real-time file watching
- Web scraping integration
- Advanced analytics

## Support

For questions, contact the RHW development team or file an issue on GitHub.

---

**Built with**: Node.js, Neon Postgres, pgvector, OpenAI Embeddings, pdf-parse, mammoth, xlsx
