import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import * as cheerio from 'cheerio';
import sanitizeHtml from 'sanitize-html';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from parent directory
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.PORT || process.env.SCRAPER_PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname, { extensions: ['html', 'css', 'js'] }));

// Serve index.html for root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let supabaseClient = null;
if (supabaseUrl && supabaseKey) {
  supabaseClient = createClient(supabaseUrl, supabaseKey);
  console.log('✓ Supabase client initialized');
} else {
  console.warn('⚠ Supabase credentials not found. Results will not be saved to database.');
}

// Scrape endpoint
app.post('/api/scrape', async (req, res) => {
  try {
    const { url, selectors, saveToDb } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    if (!selectors || !Array.isArray(selectors) || selectors.length === 0) {
      return res.status(400).json({ error: 'Selectors array is required' });
    }

    console.log(`[Scraper] Starting scrape for: ${url}`);

    const primarySelector = selectors[0]?.selector || 'body';
    
    // Validate selector syntax
    if (!primarySelector || typeof primarySelector !== 'string') {
      throw new Error('Invalid selector: selector must be a non-empty string');
    }
    
    // Basic validation for attribute selectors
    if (primarySelector.includes('[')) {
      const openBrackets = (primarySelector.match(/\[/g) || []).length;
      const closeBrackets = (primarySelector.match(/\]/g) || []).length;
      if (openBrackets !== closeBrackets) {
        throw new Error(`Invalid selector: "${primarySelector}". Attribute selector brackets don't match.`);
      }
    }

    // Fetch HTML using axios
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
      },
      timeout: 45000,
      maxRedirects: 5,
    });

    // Load HTML into cheerio
    const $ = cheerio.load(response.data);

    const results = [];
    
    // Use try-catch for selector parsing
    let nodes = [];
    try {
      nodes = $(primarySelector).toArray();
    } catch (selectorError) {
      throw new Error(`Invalid CSS selector: "${primarySelector}". ${selectorError.message}`);
    }

    console.log(`[Scraper] Found ${nodes.length} nodes matching "${primarySelector}"`);

    if (nodes.length === 0) {
      throw new Error(`No elements found with selector "${primarySelector}"`);
    }

    for (const node of nodes) {
      const $node = $(node);
      const metadata = {};
      
      // Extract fields using selectors
      for (let i = 1; i < selectors.length; i++) {
        const sel = selectors[i];
        if (!sel.selector) continue;
        
        try {
          const element = $node.find(sel.selector).first();
          if (element.length > 0) {
            const value = sel.attribute 
              ? element.attr(sel.attribute)
              : element.text().trim();
            if (value) {
              metadata[sel.field] = value;
            }
          }
        } catch (selectorError) {
          console.warn(`Error with selector "${sel.selector}": ${selectorError.message}`);
          // Continue with other selectors even if one fails
        }
      }

      const title = metadata.title || metadata.name || $node.text().trim().slice(0, 80) || url;
      const description = metadata.description 
        ? sanitizeHtml(metadata.description).slice(0, 140)
        : sanitizeHtml($node.text()).slice(0, 140);
      
      const link = metadata.link || metadata.url || 
        $node.find('a').first().attr('href') || url;
      
      let resolvedUrl = url;
      try {
        resolvedUrl = link.startsWith('http') ? link : new URL(link, url).toString();
      } catch {
        resolvedUrl = url;
      }

      results.push({
        title,
        description,
        url: resolvedUrl,
        metadata,
      });
    }

    // Save to database if requested and Supabase is configured
    if (saveToDb && supabaseClient) {
      try {
        // You'll need to provide instructionId or handle this differently
        // For now, we'll just log the results count
        console.log(`[Scraper] Would save ${results.length} results to database`);
      } catch (dbError) {
        console.error('[Scraper] Database save error:', dbError);
      }
    }

    res.json({
      success: true,
      count: results.length,
      results: results.slice(0, 50), // Limit to 50 results
    });

  } catch (error) {
    console.error('[Scraper] Error:', error);
    res.status(500).json({
      error: error.message || 'Scraping failed',
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    supabase: supabaseClient ? 'configured' : 'not configured'
  });
});

// For local development
if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`🚀 Standalone Scraper running on http://localhost:${PORT}`);
    console.log(`📁 Serving from: ${__dirname}`);
  });
}

// Export for Vercel serverless
export default app;

