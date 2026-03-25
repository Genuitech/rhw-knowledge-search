# Setup Guide: RHW Knowledge Search Crawler

## Step 1: Clone the Repository

```bash
git clone https://github.com/Genuitech/rhw-knowledge-search.git
cd rhw-knowledge-search
```

## Step 2: Install Dependencies

```bash
npm install
```

This installs all required packages:
- `pg` — PostgreSQL client
- `pgvector` — Vector support for PostgreSQL
- `pdf-parse` — PDF text extraction
- `mammoth` — DOCX text extraction
- `xlsx` — Excel file reading
- `openai` — OpenAI API client
- `dotenv` — Environment variable management

## Step 3: Set Up Neon Database

1. **Create a Neon account** (free tier available): https://console.neon.tech

2. **Create a new Postgres database** for this project:
   - Name: `rhw-knowledge`
   - Keep defaults for other settings

3. **Copy the connection string**:
   - From Neon dashboard, click "Connection String"
   - Select "Node.js" as the driver (if prompted)
   - Copy the full connection string

4. **Run database setup script**:
   ```bash
   npm run setup-db
   ```

   This creates:
   - `files` table
   - pgvector extension and indexes
   - All necessary constraints

   Expected output:
   ```
   ✓ pgvector extension created
   ✓ files table created
   ✓ Embedding index (ivfflat)
   ✓ Path index
   ✓ Folder index
   ✓ Modified time index
   ✓ File type index

   ✓ Database setup complete!
   ```

## Step 4: Get OpenAI API Key

1. **Create OpenAI account**: https://platform.openai.com
2. **Generate API key**:
   - Go to https://platform.openai.com/api-keys
   - Click "Create new secret key"
   - Copy the key (starts with `sk-`)

## Step 5: Configure Environment

Create `.env.local` file in the project root:

```bash
# Copy the template first (optional)
cp .env.example .env.local

# Then edit it with your values
```

Contents of `.env.local`:

```env
# Your Neon Postgres connection string (from Step 3)
DATABASE_URL=postgresql://user:password@ep-xxxxx.neon.tech/rhw-knowledge?sslmode=require

# Your OpenAI API key (from Step 4)
OPENAI_API_KEY=sk-your-api-key-here

# Path to crawl (Windows path format)
CRAWL_PATH=P:\Data
```

**Important**:
- `.env.local` is automatically in `.gitignore` — never commit it
- Store actual API keys only locally
- On production server, set environment variables via system configuration

## Step 6: Verify Setup with Test Crawl

Test with sample files:

```bash
npm run crawl:test
```

Expected output:
```
🚀 RHW Knowledge Search Crawler

✓ Config validated
✓ [DB] Connected to Neon Postgres
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

## Step 7: Interactive Search

Test vector search:

```bash
npm run search
```

Try queries like:
- "tax filing procedures"
- "client onboarding"
- "quarterly reporting"

You should see results with similarity scores (0-100%).

## Step 8: Index Full P:\Data (Optional)

When ready to index the actual file share:

```bash
npm run crawl:full
```

**Note**: This will take time depending on file count. Monitor the console for progress.

To crawl a custom path:
```bash
node crawler/index.js --path "C:\Your\Path\Here"
```

## Troubleshooting

### `npm install` fails
- Ensure Node.js >=18.0.0 is installed: `node --version`
- On Windows, you may need to run Command Prompt as Administrator
- Clear npm cache: `npm cache clean --force`

### `DATABASE_URL is required`
- Check `.env.local` has `DATABASE_URL` value
- Verify connection string format (should include `sslmode=require`)
- Test connection: `psql "your-connection-string"`

### `OPENAI_API_KEY is required`
- Check `.env.local` has API key
- Verify key format (starts with `sk-`)
- Test API key access on OpenAI dashboard

### Permission denied errors during crawl
- Check user has read access to `P:\Data`
- Some folders may be restricted; crawler logs warnings and continues
- On Azure VM, ensure RDP user has file share access

### Slow embeddings
- OpenAI API rate limiting is normal
- Default: 500ms delay between batches of 100 files
- Adjust in `config.js` if needed (minimum 200ms)

### Files not appearing in database
1. Check PostgreSQL is accessible
2. Verify `npm run setup-db` completed successfully
3. Check file size/permissions aren't preventing extraction
4. Review console logs for specific extraction errors

## Next Steps

1. **Monitor crawl progress**: Check `npm run search` to verify files are indexed
2. **Schedule automatic crawls**: Use Windows Task Scheduler or cron on Linux server
3. **Set up search UI**: (Phase 7 — Next phase)
4. **Archive old deployments**: As needed

## Support

For issues:
1. Check console logs for specific error messages
2. Review SETUP.md and README.md
3. Verify `.env.local` configuration
4. Check database connectivity with psql

---

**Questions?** Contact RHW development team.
