# Standalone Web Scraper

A simple, standalone web scraper built with HTML, CSS, JavaScript, and Node.js.

## Features

- 🚀 Simple web interface
- 🕷️ Scrapes websites using Playwright
- 💾 Optional Supabase integration
- 🎨 Clean, modern UI
- 📦 Zero framework dependencies (just plain HTML/CSS/JS)

## Setup

1. **Install dependencies:**
   ```bash
   cd standalone-scraper
   npm install
   ```

2. **Configure environment:**
   
   The scraper will automatically look for `.env` or `.env.local` in the parent directory. Make sure you have:
   
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your-project-url
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   # OR
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

   Or create a `.env` file in this folder.

3. **Start the server:**
   ```bash
   npm start
   ```

   Or for development with auto-reload:
   ```bash
   npm run dev
   ```

4. **Open your browser:**
   
   Navigate to `http://localhost:3001`

## Usage

1. Enter a target URL (e.g., `https://news.ycombinator.com`)
2. Configure selectors:
   - **First selector** should be the container (repeating element)
   - **Additional selectors** extract data from each container
3. Click "Start Scraping"
4. View results in the interface

## Example Selectors

For HackerNews:
- Container: `.athing`
- Title: `.titleline > a` (field: title)
- Link: `.titleline > a` (field: link, attribute: href)

## API

### POST `/api/scrape`

Scrape a website.

**Request:**
```json
{
  "url": "https://example.com",
  "selectors": [
    { "field": "container", "selector": ".item" },
    { "field": "title", "selector": ".title" },
    { "field": "link", "selector": "a", "attribute": "href" }
  ],
  "saveToDb": false
}
```

**Response:**
```json
{
  "success": true,
  "count": 10,
  "results": [
    {
      "title": "Item title",
      "description": "Item description",
      "url": "https://example.com/item",
      "metadata": {}
    }
  ]
}
```

### GET `/api/health`

Check server health and configuration.

## Deployment

This scraper can be deployed to any Node.js hosting platform:

- **Vercel:** Create `vercel.json` and deploy
- **Railway:** Connect your repo
- **Render:** Create a web service
- **Heroku:** Use Procfile

### Vercel Deployment

Create `vercel.json`:
```json
{
  "version": 2,
  "builds": [
    {
      "src": "server.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "server.js"
    }
  ]
}
```

## Environment Variables

- `SCRAPER_PORT` - Port to run server on (default: 3001)
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (for saving results)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key (alternative)

## Notes

- The scraper uses Playwright, so it requires a server environment
- Browser-based scraping (client-side) won't work due to CORS restrictions
- Supabase integration is optional - results can be viewed without it

