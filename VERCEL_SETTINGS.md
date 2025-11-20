# Vercel Deployment Settings

## Use These Settings in Vercel Dashboard:

### Project Configuration:

1. **Root Directory**: `./` 
   - Leave as default (the entire repo is the project)

2. **Framework Preset**: **Other** or **Node.js**
   - Do NOT select "Express"
   - Select "Other" from the dropdown

3. **Build Command**: **Leave EMPTY**
   - Or use: `npm install`
   - Vercel will auto-detect from package.json

4. **Output Directory**: **Leave as N/A**
   - This is a serverless function, not static output

5. **Install Command**: `npm install`
   - This is correct

### Environment Variables:

Go to **Settings → Environment Variables** and add:

```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

(Optional: Use `NEXT_PUBLIC_SUPABASE_ANON_KEY` instead)

### Important Notes:

✅ **Playwright Installation**: 
- Automatically handled by `postinstall` script in package.json
- Chromium will be installed during build

⚠️ **Function Timeout**: 
- Set to 60 seconds (Hobby plan max)
- Increase if you need longer scrapes

✅ **Static Files**: 
- HTML, CSS, JS files are automatically served
- No special configuration needed

### After Deployment:

Your app will be live at: `https://moni-ai-scrap.vercel.app`

API Endpoints:
- `POST https://moni-ai-scrap.vercel.app/api/scrape`
- `GET https://moni-ai-scrap.vercel.app/api/health`

Frontend:
- `https://moni-ai-scrap.vercel.app` (serves index.html)

