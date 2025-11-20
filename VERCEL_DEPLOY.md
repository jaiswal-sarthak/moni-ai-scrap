# Vercel Deployment Guide

## Configuration Settings

When deploying on Vercel, use these settings:

### Project Settings:

1. **Root Directory**: `./` (leave as is - the repo IS the standalone-scraper)

2. **Framework Preset**: Select **"Other"** (NOT Express, since we use a custom setup)

3. **Build Command**: Leave **empty** or use:
   ```
   npm install
   ```
   (The vercel.json handles the Playwright installation)

4. **Output Directory**: Leave as **N/A** (this is a serverless function, not static output)

5. **Install Command**: `npm install` (this is correct)

### Environment Variables

Add these in Vercel Project Settings → Environment Variables:

**Required:**
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase key

**Optional:**
- `SCRAPER_PORT` - Leave empty (Vercel handles ports automatically)

### Important Notes:

⚠️ **Playwright on Vercel**: 
- Playwright browsers are automatically installed via `postinstall` script
- The build may take longer due to Chromium installation
- If build fails, you may need to use Vercel's `@vercel/node` runtime with proper configuration

⚠️ **Function Timeout**:
- Set to 60 seconds in vercel.json (maximum for Hobby plan)
- For longer scrapes, consider Vercel Pro plan (up to 300s)

### After Deployment:

1. Your app will be available at: `https://your-project.vercel.app`
2. The API endpoints will be:
   - `https://your-project.vercel.app/api/scrape`
   - `https://your-project.vercel.app/api/health`
3. The frontend will be served at the root: `https://your-project.vercel.app`

### Troubleshooting:

- **Build fails with Playwright**: Ensure `postinstall` script in package.json runs correctly
- **Function timeout**: Increase `maxDuration` in vercel.json or upgrade plan
- **CORS errors**: Already handled in server.js with CORS middleware

