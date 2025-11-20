import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { chromium } from 'playwright';
import { parse } from 'node-html-parser';
import sanitizeHtml from 'sanitize-html';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

export default async function handler(req, res) {
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

    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      
      const primarySelector = selectors[0]?.selector || 'body';
      
      // Basic validation for attribute selectors
      if (primarySelector.includes('[')) {
        const openBrackets = (primarySelector.match(/\[/g) || []).length;
        const closeBrackets = (primarySelector.match(/\]/g) || []).length;
        if (openBrackets !== closeBrackets) {
          throw new Error(`Invalid selector: "${primarySelector}". Attribute selector brackets don't match.`);
        }
      }
      
      try {
        await page.waitForSelector(primarySelector, { timeout: 10000 });
      } catch (e) {
        console.warn(`Primary selector "${primarySelector}" not found after timeout`);
      }

      const content = await page.content();
      const root = parse(content);

      const results = [];
      
      let nodes = [];
      try {
        nodes = root.querySelectorAll(primarySelector);
      } catch (selectorError) {
        throw new Error(`Invalid CSS selector: "${primarySelector}". ${selectorError.message}`);
      }

      console.log(`[Scraper] Found ${nodes.length} nodes matching "${primarySelector}"`);

      if (nodes.length === 0) {
        throw new Error(`No elements found with selector "${primarySelector}"`);
      }

      for (const node of nodes) {
        const metadata = {};
        
        for (let i = 1; i < selectors.length; i++) {
          const sel = selectors[i];
          if (!sel.selector) continue;
          
          try {
            const element = node.querySelector(sel.selector);
            if (element) {
              const value = sel.attribute 
                ? element.getAttribute(sel.attribute)
                : element.text.trim();
              if (value) {
                metadata[sel.field] = value;
              }
            }
          } catch (selectorError) {
            console.warn(`Error with selector "${sel.selector}": ${selectorError.message}`);
          }
        }

        const title = metadata.title || metadata.name || node.text.trim().slice(0, 80) || url;
        const description = metadata.description 
          ? sanitizeHtml(metadata.description).slice(0, 140)
          : sanitizeHtml(node.text).slice(0, 140);
        
        const link = metadata.link || metadata.url || 
          node.querySelector('a')?.getAttribute('href') || url;
        
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

      await browser.close();

      return res.json({
        success: true,
        count: results.length,
        results: results.slice(0, 50),
      });

    } catch (error) {
      await browser.close();
      throw error;
    }

  } catch (error) {
    console.error('[Scraper] Error:', error);
    return res.status(500).json({
      error: error.message || 'Scraping failed',
    });
  }
}

