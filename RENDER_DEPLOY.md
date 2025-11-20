# Render Deployment Guide

## Render Web Service Configuration

Use these exact settings in Render dashboard:

### Basic Settings:

1. **Name**: `moni-ai-scrap` ✅ (already set)

2. **Service Type**: **Web Service** ✅ (correct)

3. **Language**: **Node** ✅ (correct)

4. **Branch**: **main** ✅ (correct)

5. **Region**: **Singapore** (or your preferred region) ✅

### Build & Start Commands:

6. **Build Command**: 
   ```
   npm install && npx playwright install chromium
   ```
   - This installs dependencies AND Playwright browser
   - Required for scraping functionality

7. **Start Command**: 
   ```
   npm start
   ```
   - This runs `node server.js`
   - ✅ (already correct)

### Root Directory:

8. **Root Directory**: 
   - Leave **EMPTY** if deploying from the repo root
   - Or set to: `standalone-scraper` if deploying the whole monorepo

### Instance Type:

9. **Instance Type**: **Free** (for testing) or **Starter ($7/month)** for production
   - Free tier has 512MB RAM (may be tight for Playwright)
   - Recommended: **Starter** for better performance

### Environment Variables:

Click **"Add Environment Variable"** and add:

```
NEXT_PUBLIC_SUPABASE_URL = your-supabase-project-url
SUPABASE_SERVICE_ROLE_KEY = your-service-role-key
```

(Optional):
```
SCRAPER_PORT = 10000
```
(Render uses port from `PORT` env var, but server.js defaults to 3001 if not set)

### Health Check:

10. **Health Check Path**: `/api/health`
    - Helps Render monitor service health
    - Optional but recommended

### Important Notes:

⚠️ **Playwright on Render Free Tier**:
- Free instances spin down after inactivity (15 min)
- May take 30-60 seconds to wake up
- 512MB RAM may be tight - consider Starter plan

✅ **Port Configuration**:
- Render automatically sets `PORT` environment variable
- Server.js will use `process.env.PORT` or default to 3001
- Update server.js to use Render's PORT if needed

### After Deployment:

Your service will be available at:
- `https://moni-ai-scrap.onrender.com` (or your custom domain)

API Endpoints:
- `POST https://moni-ai-scrap.onrender.com/api/scrape`
- `GET https://moni-ai-scrap.onrender.com/api/health`

Frontend:
- `https://moni-ai-scrap.onrender.com` (serves index.html)

