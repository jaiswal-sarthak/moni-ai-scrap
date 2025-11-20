const API_URL = window.location.origin;
let supabaseClient = null;
let historyEnabled = true;
let currentResults = [];
let allResults = [];

// Get favicon URL
function getFaviconUrl(url) {
    try {
        const domain = new URL(url).hostname;
        return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
    } catch {
        return `https://www.google.com/s2/favicons?domain=google.com&sz=32`;
    }
}

// Preset configurations
const PRESETS = {
    hackernews: {
        url: 'https://news.ycombinator.com',
        selectors: [
            { field: 'container', selector: '.athing', attribute: '' },
            { field: 'title', selector: '.titleline > a', attribute: '' },
            { field: 'link', selector: '.titleline > a', attribute: 'href' },
            { field: 'score', selector: '.score', attribute: '' }
        ],
        instruction: 'top 30'
    },
    producthunt: {
        url: 'https://www.producthunt.com',
        selectors: [
            { field: 'container', selector: '[data-test^="post-item"]', attribute: '' },
            { field: 'title', selector: '[data-test="post-item-name"]', attribute: '' },
            { field: 'link', selector: 'a', attribute: 'href' },
            { field: 'description', selector: '[data-test="post-item-tagline"]', attribute: '' }
        ],
        instruction: 'top 10'
    },
    reddit: {
        url: 'https://www.reddit.com/r/programming',
        selectors: [
            { field: 'container', selector: '[data-testid="post-container"]', attribute: '' },
            { field: 'title', selector: '[data-testid="post-content"] h3', attribute: '' },
            { field: 'link', selector: 'a[data-testid="outbound-link"]', attribute: 'href' },
            { field: 'score', selector: '[data-testid="vote-arrows"] + div', attribute: '' }
        ],
        instruction: 'top 20'
    }
};

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function loadPreset(presetName) {
    const preset = PRESETS[presetName];
    if (!preset) return;
    
    // Set URL
    document.getElementById('url').value = preset.url;
    
    // Set instruction
    document.getElementById('instruction').value = preset.instruction || '';
    
    // Clear existing selectors
    const container = document.getElementById('selectors-container');
    container.innerHTML = '';
    
    // Add preset selectors - create elements properly to avoid HTML injection issues
    preset.selectors.forEach((sel) => {
        const item = document.createElement('div');
        item.className = 'selector-item';
        
        const fieldInput = document.createElement('input');
        fieldInput.type = 'text';
        fieldInput.placeholder = 'field';
        fieldInput.className = 'field-input';
        fieldInput.value = sel.field || '';
        
        const selectorInput = document.createElement('input');
        selectorInput.type = 'text';
        selectorInput.placeholder = 'selector';
        selectorInput.className = 'selector-input';
        // Ensure selector is properly set
        selectorInput.value = String(sel.selector || '');
        
        const attrInput = document.createElement('input');
        attrInput.type = 'text';
        attrInput.placeholder = 'attribute';
        attrInput.className = 'attr-input';
        attrInput.value = sel.attribute || '';
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'btn-remove';
        removeBtn.textContent = '×';
        removeBtn.title = 'Remove selector';
        removeBtn.onclick = () => removeSelector(removeBtn);
        
        item.appendChild(fieldInput);
        item.appendChild(selectorInput);
        item.appendChild(attrInput);
        item.appendChild(removeBtn);
        
        container.appendChild(item);
    });
    
    showStatus(`✓ Loaded ${presetName} preset`, 'success');
    
    // Smooth scroll to form
    setTimeout(() => {
        document.getElementById('url').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
}

// Parse instruction to get limit
function parseInstruction(instruction) {
    if (!instruction) return null;
    
    const lower = instruction.toLowerCase().trim();
    
    // Match patterns like "top 5", "first 10", "limit 20", "get 15"
    const patterns = [
        /top\s+(\d+)/,
        /first\s+(\d+)/,
        /limit\s+(\d+)/,
        /get\s+(\d+)/,
        /only\s+(\d+)/,
        /^(\d+)$/ // Just a number
    ];
    
    for (const pattern of patterns) {
        const match = lower.match(pattern);
        if (match) {
            return parseInt(match[1], 10);
        }
    }
    
    return null;
}

// Initialize Supabase if available
async function initSupabase() {
    const supabaseUrl = window.location.origin.includes('localhost') 
        ? null // Try to get from env via server check
        : null; // Will check from server
        
    try {
        const response = await fetch(`${API_URL}/api/health`);
        const data = await response.json();
        
        if (data.supabase === 'configured') {
            console.log('✓ Supabase is configured');
            // Try to load Supabase client if URL is available in browser context
            // Note: In production, you'd need to expose the anon key client-side safely
        }
    } catch (error) {
        console.warn('Health check failed:', error);
    }
}

function addSelector() {
    const container = document.getElementById('selectors-container');
    const item = document.createElement('div');
    item.className = 'selector-item';
    item.innerHTML = `
        <input type="text" placeholder="field" class="field-input">
        <input type="text" placeholder="selector" class="selector-input">
        <input type="text" placeholder="attribute (optional)" class="attr-input">
        <button class="btn-remove" onclick="removeSelector(this)" title="Remove selector">×</button>
    `;
    container.appendChild(item);
    item.querySelector('.field-input').focus();
}

function removeSelector(btn) {
    const container = document.getElementById('selectors-container');
    if (container.children.length > 1) {
        const item = btn.parentElement;
        item.style.animation = 'fadeOut 0.3s ease-out';
        setTimeout(() => item.remove(), 300);
    } else {
        showStatus('You need at least one selector!', 'error');
    }
}

// Add fadeOut animation
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeOut {
        from { opacity: 1; transform: translateX(0); }
        to { opacity: 0; transform: translateX(-20px); }
    }
`;
document.head.appendChild(style);

async function runScrape() {
    const url = document.getElementById('url').value.trim();
    const saveToDb = document.getElementById('saveToDb').checked;
    const scrapeBtn = document.getElementById('scrape-btn');
    const statusDiv = document.getElementById('status');
    const resultsDiv = document.getElementById('results');
    const resultsList = document.getElementById('results-list');
    const resultsCount = document.getElementById('results-count');

    if (!url) {
        showStatus('Please enter a URL', 'error');
        return;
    }

    // Validate URL format
    try {
        new URL(url);
    } catch {
        showStatus('Please enter a valid URL', 'error');
        return;
    }

    // Collect selectors
    const selectors = [];
    const selectorItems = document.querySelectorAll('.selector-item');
    
    for (const item of selectorItems) {
        const field = item.querySelector('.field-input').value.trim();
        const selector = item.querySelector('.selector-input').value.trim();
        const attribute = item.querySelector('.attr-input').value.trim();

        if (!field || !selector) {
            showStatus('Please fill in all selector fields', 'error');
            return;
        }

        // Validate CSS selector syntax (basic check)
        if (selector.includes('[') && !selector.match(/\[[^\]]+\]/)) {
            showStatus(`Invalid selector: "${selector}". Attribute selectors must be properly closed (e.g., [data-test="value"])`, 'error');
            return;
        }

        selectors.push({
            field,
            selector,
            ...(attribute && { attribute })
        });
    }

    if (selectors.length === 0) {
        showStatus('Please add at least one selector', 'error');
        return;
    }

    // Disable button and show loading
    scrapeBtn.disabled = true;
    scrapeBtn.innerHTML = '<span class="spinner"></span> Scraping...';
    statusDiv.className = 'status loading';
    statusDiv.textContent = '🔄 Scraping in progress... Please wait.';
    statusDiv.classList.remove('hidden');
    resultsDiv.classList.add('hidden');
    
    // Show progress bar
    const progressBar = document.getElementById('progress-bar');
    const progressFill = document.getElementById('progress-fill');
    progressBar.classList.add('active');
    progressFill.classList.add('animate');
    progressFill.style.width = '0';
    setTimeout(() => {
        progressFill.style.width = '100%';
    }, 50);

    const startTime = Date.now();

    try {
        const response = await fetch(`${API_URL}/api/scrape`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                url,
                selectors,
                saveToDb,
            }),
        });

        const data = await response.json();
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);

        if (!response.ok) {
            throw new Error(data.error || 'Scraping failed');
        }

        // Show success
        showStatus(`✅ Successfully scraped ${data.count} items in ${duration}s!`, 'success');

        // Save to history
        if (historyEnabled) {
            const instruction = document.getElementById('instruction').value.trim();
            saveToHistory({
                url,
                selectors,
                instruction: instruction || null,
                count: data.count,
                timestamp: Date.now(),
                results: data.results
            });
        }

        // Store all results
        allResults = data.results || [];
        
        // Display results
        if (data.results && data.results.length > 0) {
            // Apply instruction limit if specified
            const instruction = document.getElementById('instruction').value.trim();
            const limit = parseInstruction(instruction);
            let displayResults = data.results;
            let displayCount = data.count;
            
            if (limit && limit > 0) {
                displayResults = data.results.slice(0, limit);
                displayCount = displayResults.length;
            }
            
            // Store current display results
            currentResults = displayResults;
            
            renderResults(displayResults, data.count, limit);
            
            // Show statistics
            renderStats(displayResults);
            
            resultsDiv.classList.remove('hidden');
            
            // Show search input
            document.getElementById('results-search').style.display = 'block';
            
            // Show message if results were limited
            if (limit && displayCount < totalCount) {
                showStatus(`ℹ️ Showing top ${displayCount} of ${totalCount} results (limited by instruction)`, 'info');
            }
            
            // Smooth scroll to results
            setTimeout(() => {
                resultsDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
        } else {
            showStatus('⚠️ No results found. Check your selectors.', 'info');
            currentResults = [];
            allResults = [];
        }

    } catch (error) {
        console.error('Scrape error:', error);
        showStatus(`❌ Error: ${error.message}`, 'error');
    } finally {
        scrapeBtn.disabled = false;
        scrapeBtn.innerHTML = '<span>🚀</span> Start Scraping';
        
        // Hide progress bar
        const progressBar = document.getElementById('progress-bar');
        const progressFill = document.getElementById('progress-fill');
        progressFill.classList.remove('animate');
        setTimeout(() => {
            progressBar.classList.remove('active');
            progressFill.style.width = '0';
        }, 300);
    }
}

function showStatus(message, type = 'info') {
    const statusDiv = document.getElementById('status');
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    statusDiv.classList.remove('hidden');
    
    // Auto-hide success messages after 5 seconds
    if (type === 'success') {
        setTimeout(() => {
            statusDiv.classList.add('hidden');
        }, 5000);
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// History Functions
function getHistory() {
    try {
        const history = localStorage.getItem('scraper_history');
        return history ? JSON.parse(history) : [];
    } catch {
        return [];
    }
}

function saveToHistory(data) {
    try {
        const history = getHistory();
        // Add to beginning
        history.unshift(data);
        // Keep only last 50 entries
        const trimmed = history.slice(0, 50);
        localStorage.setItem('scraper_history', JSON.stringify(trimmed));
        renderHistory();
    } catch (error) {
        console.error('Failed to save history:', error);
    }
}

function clearHistory() {
    if (confirm('Are you sure you want to clear all history?')) {
        localStorage.removeItem('scraper_history');
        renderHistory();
        showStatus('History cleared', 'info');
    }
}

function loadFromHistory(item) {
    document.getElementById('url').value = item.url;
    
    // Load instruction if available
    if (item.instruction) {
        document.getElementById('instruction').value = item.instruction;
    } else {
        document.getElementById('instruction').value = '';
    }
    
    // Clear existing selectors
    const container = document.getElementById('selectors-container');
    container.innerHTML = '';
    
    // Add all selectors
    item.selectors.forEach((sel, index) => {
        if (index === 0) {
            // First selector (container)
            container.innerHTML += `
                <div class="selector-item">
                    <input type="text" placeholder="field" value="${sel.field || ''}" class="field-input">
                    <input type="text" placeholder="selector" value="${sel.selector || ''}" class="selector-input">
                    <input type="text" placeholder="attribute" value="${sel.attribute || ''}" class="attr-input">
                    <button class="btn-remove" onclick="removeSelector(this)" title="Remove selector">×</button>
                </div>
            `;
        } else {
            addSelector();
            const items = container.querySelectorAll('.selector-item');
            const newItem = items[items.length - 1];
            newItem.querySelector('.field-input').value = sel.field || '';
            newItem.querySelector('.selector-input').value = sel.selector || '';
            newItem.querySelector('.attr-input').value = sel.attribute || '';
        }
    });
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    showStatus('Configuration loaded from history', 'info');
}

function deleteHistoryItem(index) {
    const history = getHistory();
    history.splice(index, 1);
    localStorage.setItem('scraper_history', JSON.stringify(history));
    renderHistory();
    showStatus('History item deleted', 'info');
}

function loadHistoryItem(index) {
    const history = getHistory();
    if (index >= 0 && index < history.length) {
        loadFromHistory(history[index]);
    }
}

let expandedHistoryIndex = null;

function toggleHistoryExpanded(index) {
    event.stopPropagation();
    const wasExpanded = expandedHistoryIndex === index;
    expandedHistoryIndex = wasExpanded ? null : index;
    renderHistory();
}

function renderHistory() {
    const history = getHistory();
    const historyList = document.getElementById('history-list');
    const historySection = document.getElementById('history-section');
    const historyEmpty = document.getElementById('history-empty');
    
    if (history.length === 0) {
        historyList.innerHTML = '';
        historySection.classList.remove('hidden');
        historyEmpty.classList.remove('hidden');
        return;
    }
    
    historyEmpty.classList.add('hidden');
    historySection.classList.remove('hidden');
    
    historyList.innerHTML = history.map((item, index) => {
        const date = new Date(item.timestamp);
        const timeStr = date.toLocaleString();
        const instructionText = item.instruction ? ` • ${item.instruction}` : '';
        const faviconUrl = getFaviconUrl(item.url);
        const isExpanded = expandedHistoryIndex === index;
        const hasResults = item.results && item.results.length > 0;
        
        let resultsHtml = '';
        if (isExpanded && hasResults) {
            resultsHtml = `
                <div class="history-results-container">
                    <div class="history-results-header">
                        <span class="history-results-title">Results (${item.results.length})</span>
                        <div class="history-results-actions">
                            <button class="btn-secondary small" onclick="exportHistoryResults(${index}, 'json')" title="Export as JSON">
                                💾 JSON
                            </button>
                            <button class="btn-secondary small" onclick="exportHistoryResults(${index}, 'csv')" title="Export as CSV">
                                📊 CSV
                            </button>
                            <button class="btn-secondary small" onclick="copyHistoryResults(${index})" title="Copy all URLs">
                                📋 Copy
                            </button>
                        </div>
                    </div>
                    <div class="history-results-list">
                        ${item.results.slice(0, 20).map((result, resultIndex) => {
                            const resultFaviconUrl = getFaviconUrl(result.url);
                            return `
                                <div class="history-result-item">
                                    <img src="${resultFaviconUrl}" alt="Site icon" class="history-result-favicon" onerror="this.src='https://www.google.com/s2/favicons?domain=google.com&sz=32'">
                                    <div class="history-result-content">
                                        <div class="history-result-title">${escapeHtml(result.title)}</div>
                                        ${result.description ? `<div class="history-result-description">${escapeHtml(result.description)}</div>` : ''}
                                        <a href="${result.url}" target="_blank" rel="noopener" class="history-result-link">${escapeHtml(result.url)}</a>
                                    </div>
                                    <button class="result-action-btn small" onclick="copyToClipboard('${escapeHtml(result.url).replace(/'/g, "\\'")}')" title="Copy URL">
                                        📋
                                    </button>
                                </div>
                            `;
                        }).join('')}
                        ${item.results.length > 20 ? `<div class="history-results-more">... and ${item.results.length - 20} more results</div>` : ''}
                    </div>
                </div>
            `;
        }
        
        return `
            <div class="history-item ${isExpanded ? 'expanded' : ''}" data-index="${index}">
                <div class="history-item-main" onclick="loadHistoryItem(${index})">
                    <div class="history-item-info">
                        <img src="${faviconUrl}" alt="Site icon" class="history-favicon" onerror="this.src='https://www.google.com/s2/favicons?domain=google.com&sz=32'">
                        <div class="history-item-content">
                            <div class="history-item-url">${escapeHtml(item.url)}</div>
                            <div class="history-item-meta">
                                <span class="history-count-badge">${item.count} items</span>
                                ${instructionText ? `<span class="history-instruction-badge">${escapeHtml(item.instruction)}</span>` : ''}
                                <span>• ${timeStr}</span>
                            </div>
                        </div>
                    </div>
                    <div class="history-item-actions" onclick="event.stopPropagation()">
                        ${hasResults ? `
                            <button class="btn-icon expand-btn ${isExpanded ? 'expanded' : ''}" onclick="toggleHistoryExpanded(${index})" title="${isExpanded ? 'Hide' : 'View'} results">
                                <span class="icon-eye">👁</span>
                            </button>
                        ` : ''}
                        <button class="btn-icon" onclick="loadHistoryItem(${index})" title="Load configuration">
                            ↻
                        </button>
                        <button class="btn-icon rerun-btn" onclick="rerunHistoryItem(${index})" title="Re-run scrape">
                            ▶
                        </button>
                        <button class="btn-icon delete" onclick="deleteHistoryItem(${index})" title="Delete">
                            ×
                        </button>
                    </div>
                </div>
                ${resultsHtml}
            </div>
        `;
    }).join('');
}

function rerunHistoryItem(index) {
    event.stopPropagation();
    const history = getHistory();
    if (index >= 0 && index < history.length) {
        const item = history[index];
        loadFromHistory(item);
        // Auto-run after a short delay
        setTimeout(() => {
            runScrape();
        }, 500);
        showStatus('Configuration loaded and scraping...', 'info');
    }
}

function copyHistoryResults(index) {
    event.stopPropagation();
    const history = getHistory();
    if (index >= 0 && index < history.length && history[index].results) {
        const urls = history[index].results.map(r => r.url).join('\n');
        copyToClipboard(urls);
    }
}

function exportHistoryResults(index, format) {
    event.stopPropagation();
    const history = getHistory();
    if (index >= 0 && index < history.length && history[index].results) {
        const results = history[index].results;
        let content, filename, mimeType;
        
        if (format === 'json') {
            content = JSON.stringify(results, null, 2);
            filename = `scraper-history-${index}-${Date.now()}.json`;
            mimeType = 'application/json';
        } else if (format === 'csv') {
            const headers = ['Title', 'Description', 'URL'];
            const rows = results.map(r => [
                `"${(r.title || '').replace(/"/g, '""')}"`,
                `"${(r.description || '').replace(/"/g, '""')}"`,
                `"${(r.url || '').replace(/"/g, '""')}"`
            ]);
            content = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
            filename = `scraper-history-${index}-${Date.now()}.csv`;
            mimeType = 'text/csv';
        }
        
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        
        showCopyFeedback(`Exported as ${format.toUpperCase()}!`);
    }
}

// Render results
function renderResults(results, totalCount, limit) {
    const resultsList = document.getElementById('results-list');
    const resultsCount = document.getElementById('results-count');
    const resultsEmpty = document.getElementById('results-empty');
    
    if (!results || results.length === 0) {
        resultsList.innerHTML = '';
        resultsEmpty.classList.remove('hidden');
        return;
    }
    
    resultsEmpty.classList.add('hidden');
    resultsList.innerHTML = '';
    
    const limitText = limit && results.length < totalCount 
        ? ` (showing ${results.length} of ${totalCount})` 
        : '';
    
    resultsCount.textContent = `(${results.length} items${limitText})`;
    
    results.forEach((result, index) => {
        const faviconUrl = getFaviconUrl(result.url);
        const item = document.createElement('div');
        item.className = 'result-item';
        item.style.animationDelay = `${index * 0.05}s`;
        item.innerHTML = `
            <div class="result-actions">
                <button class="result-action-btn" onclick="copyToClipboard('${escapeHtml(result.url).replace(/'/g, "\\'")}')" title="Copy URL">
                    <span class="btn-icon-text">📋</span>
                </button>
                <button class="result-action-btn" onclick="copyToClipboard('${escapeHtml(result.title + '\n' + result.url).replace(/'/g, "\\'")}')" title="Copy title & URL">
                    <span class="btn-icon-text">📄</span>
                </button>
            </div>
            <div class="result-header">
                <img src="${faviconUrl}" alt="Site icon" class="result-favicon" onerror="this.src='https://www.google.com/s2/favicons?domain=google.com&sz=32'">
                <h3>${escapeHtml(result.title)}</h3>
            </div>
            ${result.description ? `<p>${escapeHtml(result.description)}</p>` : ''}
            <a href="${result.url}" target="_blank" rel="noopener">${result.url}</a>
            ${result.metadata && Object.keys(result.metadata).length > 0 
                ? `<div class="result-meta">${JSON.stringify(result.metadata, null, 2)}</div>` 
                : ''}
        `;
        resultsList.appendChild(item);
    });
}

// Render statistics
function renderStats(results) {
    const statsDiv = document.getElementById('results-stats');
    if (!results || results.length === 0) {
        statsDiv.innerHTML = '';
        return;
    }
    
    const withDescription = results.filter(r => r.description).length;
    const withMetadata = results.filter(r => r.metadata && Object.keys(r.metadata).length > 0).length;
    
    statsDiv.innerHTML = `
        <div class="stat-item">
            <span class="stat-icon">📊</span>
            <span>${results.length} items</span>
        </div>
        <div class="stat-item">
            <span class="stat-icon">📝</span>
            <span>${withDescription} with descriptions</span>
        </div>
        <div class="stat-item">
            <span class="stat-icon">🏷️</span>
            <span>${withMetadata} with metadata</span>
        </div>
    `;
}

// Copy to clipboard
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showCopyFeedback('Copied to clipboard!');
    } catch (err) {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showCopyFeedback('Copied to clipboard!');
    }
}

// Copy all URLs
async function copyAllResults() {
    if (currentResults.length === 0) {
        showStatus('No results to copy', 'error');
        return;
    }
    
    const urls = currentResults.map(r => r.url).join('\n');
    await copyToClipboard(urls);
}

// Show copy feedback
function showCopyFeedback(message) {
    const feedback = document.createElement('div');
    feedback.className = 'copy-feedback';
    feedback.innerHTML = `✅ ${message}`;
    document.body.appendChild(feedback);
    
    setTimeout(() => {
        feedback.style.animation = 'slideInRight 0.3s ease-out reverse';
        setTimeout(() => feedback.remove(), 300);
    }, 2000);
}

// Export results
function exportResultsAs(format) {
    if (currentResults.length === 0) {
        showStatus('No results to export', 'error');
        return;
    }
    
    let content, filename, mimeType;
    
    if (format === 'json') {
        content = JSON.stringify(currentResults, null, 2);
        filename = `scraper-results-${Date.now()}.json`;
        mimeType = 'application/json';
    } else if (format === 'csv') {
        const headers = ['Title', 'Description', 'URL'];
        const rows = currentResults.map(r => [
            `"${(r.title || '').replace(/"/g, '""')}"`,
            `"${(r.description || '').replace(/"/g, '""')}"`,
            `"${(r.url || '').replace(/"/g, '""')}"`
        ]);
        content = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        filename = `scraper-results-${Date.now()}.csv`;
        mimeType = 'text/csv';
    }
    
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    
    showCopyFeedback(`Exported as ${format.toUpperCase()}!`);
}

// Search/filter results
function searchResults(query) {
    if (!query || query.trim() === '') {
        renderResults(currentResults, allResults.length, null);
        renderStats(currentResults);
        document.getElementById('results-empty').classList.add('hidden');
        return;
    }
    
    const lowerQuery = query.toLowerCase();
    const filtered = currentResults.filter(result => {
        return (result.title && result.title.toLowerCase().includes(lowerQuery)) ||
               (result.description && result.description.toLowerCase().includes(lowerQuery)) ||
               (result.url && result.url.toLowerCase().includes(lowerQuery));
    });
    
    if (filtered.length === 0) {
        document.getElementById('results-list').innerHTML = '';
        document.getElementById('results-empty').classList.remove('hidden');
        document.getElementById('results-count').textContent = '(0 items)';
        document.getElementById('results-stats').innerHTML = '';
    } else {
        renderResults(filtered, allResults.length, null);
        renderStats(filtered);
        document.getElementById('results-empty').classList.add('hidden');
    }
}

// Theme toggle
function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    document.getElementById('theme-toggle').querySelector('.theme-icon').textContent = isDark ? '☀️' : '🌙';
}

// Load theme
function loadTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        document.getElementById('theme-toggle').querySelector('.theme-icon').textContent = '☀️';
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initSupabase();
    renderHistory();
    loadTheme();
    
    // Enable Enter key to trigger scrape
    document.getElementById('url').addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            runScrape();
        }
    });
    
    // Enable search
    document.getElementById('results-search').addEventListener('input', (e) => {
        searchResults(e.target.value);
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Escape to clear search
        if (e.key === 'Escape') {
            const searchInput = document.getElementById('results-search');
            if (searchInput && document.activeElement === searchInput) {
                searchInput.value = '';
                searchResults('');
                searchInput.blur();
            }
        }
    });
    
    // Auto-focus on URL input
    document.getElementById('url').focus();
});
