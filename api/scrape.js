import axios from 'axios';
import * as cheerio from 'cheerio';
import sanitizeHtml from 'sanitize-html';

// Vercel serverless function format
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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
      // Check if the page is likely client-side rendered
      const htmlContent = response.data.toLowerCase();
      const isLikelySPA = htmlContent.includes('<script') && 
                         (htmlContent.includes('react') || htmlContent.includes('vue') || htmlContent.includes('angular'));
      
      let errorMsg = `No elements found with selector "${primarySelector}"`;
      if (isLikelySPA) {
        errorMsg += '. This site appears to use client-side rendering (React/Vue/Angular). Axios/Cheerio cannot execute JavaScript. Try using a browser automation tool like Playwright or Puppeteer for JavaScript-heavy sites.';
      } else {
        errorMsg += '. The selector might be incorrect or the page structure has changed.';
      }
      
      throw new Error(errorMsg);
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

    return res.json({
      success: true,
      count: results.length,
      results: results.slice(0, 50), // Limit to 50 results
    });

  } catch (error) {
    console.error('[Scraper] Error:', error);
    return res.status(500).json({
      error: error.message || 'Scraping failed',
    });
  }
}
