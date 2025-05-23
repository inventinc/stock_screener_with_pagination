/**
 * Reverted app.js with optimized batch loading (50-75 stocks at a time)
 * Preserves original UI while improving performance
 */

// Global variables
let stockDataManager;
let virtualScroller;
let debounceTimer;
let activeFilters = {
  market_cap: [],
  volume: [],
  debt: [],
  valuation: [],
  preset: null
};

// DOM Elements
let filtersToggle;
let filtersContent;
let viewButtons;
let stockCardsContainer;
let stockTableContainer;
let stockTableBody;
let filterButtons;
let presetButtons;
let resetFiltersBtn;
let searchInput;
let exportCsvBtn;
let apiStatusIndicator;
let apiStatusText;
let totalStocksEl;
let nyseStocksEl;
let nasdaqStocksEl;
let lastUpdatedEl;
let loadingProgressBar;
let loadingProgressText;
let loadMoreBtn;

// Constants
const ITEM_HEIGHT = 160; // Height of each stock card in pixels
const DEBOUNCE_DELAY = 300; // Milliseconds to wait before applying search filter
const BATCH_SIZE = 75; // Smaller batch size for better user experience

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM fully loaded - initializing app with optimized batch loading");
    
    // Get DOM elements
    filtersToggle = document.getElementById('filters-toggle');
    filtersContent = document.getElementById('filters-content');
    viewButtons = document.querySelectorAll('.view-button[data-view]');
    stockCardsContainer = document.getElementById('stock-cards-container');
    stockTableContainer = document.getElementById('stock-table-container');
    stockTableBody = document.getElementById('stock-table-body');
    filterButtons = document.querySelectorAll('.filter-button');
    presetButtons = document.querySelectorAll('.preset-button');
    resetFiltersBtn = document.getElementById('reset-filters-btn');
    searchInput = document.getElementById('search-input');
    exportCsvBtn = document.getElementById('export-csv-btn');
    
    apiStatusIndicator = document.getElementById('api-status-indicator');
    apiStatusText = document.getElementById('api-status-text');
    totalStocksEl = document.getElementById('total-stocks');
    nyseStocksEl = document.getElementById('nyse-stocks');
    nasdaqStocksEl = document.getElementById('nasdaq-stocks');
    lastUpdatedEl = document.getElementById('last-updated');
    
    // Add loading progress elements
    loadingProgressBar = document.getElementById('loading-progress-bar') || createLoadingProgressBar();
    loadingProgressText = document.getElementById('loading-progress-text') || createLoadingProgressText();
    
    // Add load more button
    loadMoreBtn = document.getElementById('load-more-btn') || createLoadMoreButton();

    // Set up event listeners
    setupEventListeners();
    
    // Initialize tooltips
    initializeTooltips();
    
    // Fetch global stats immediately
    fetchGlobalStats();
    
    // Initialize data manager
    initializeDataManager();
});

/**
 * Create loading progress bar if it doesn't exist
 * @returns {HTMLElement} The loading progress bar element
 */
function createLoadingProgressBar() {
    const progressBar = document.createElement('div');
    progressBar.id = 'loading-progress-bar';
    progressBar.className = 'loading-progress-bar';
    progressBar.innerHTML = '<div class="progress-inner"></div>';
    document.body.appendChild(progressBar);
    return progressBar;
}

/**
 * Create loading progress text if it doesn't exist
 * @returns {HTMLElement} The loading progress text element
 */
function createLoadingProgressText() {
    const progressText = document.createElement('div');
    progressText.id = 'loading-progress-text';
    progressText.className = 'loading-progress-text';
    document.body.appendChild(progressText);
    return progressText;
}

/**
 * Create load more button if it doesn't exist
 * @returns {HTMLElement} The load more button element
 */
function createLoadMoreButton() {
    const button = document.createElement('button');
    button.id = 'load-more-btn';
    button.className = 'load-more-btn';
    button.textContent = 'Load More Stocks';
    button.style.display = 'block';
    button.style.margin = '20px auto';
    button.style.padding = '10px 20px';
    button.style.backgroundColor = '#0066ff';
    button.style.color = 'white';
    button.style.border = 'none';
    button.style.borderRadius = '4px';
    button.style.cursor = 'pointer';
    button.style.fontSize = '16px';
    
    // Add click event
    button.addEventListener('click', loadMoreStocks);
    
    // Append to container
    if (stockCardsContainer) {
        stockCardsContainer.parentNode.insertBefore(button, stockCardsContainer.nextSibling);
    } else {
        document.body.appendChild(button);
    }
    
    return button;
}

/**
 * Set up all event listeners
 */
function setupEventListeners() {
    // Filters toggle
    if (filtersToggle && filtersContent) {
        filtersToggle.addEventListener('click', function() {
            filtersContent.classList.toggle('collapsed');
            const toggleIcon = filtersToggle.querySelector('.filters-toggle');
            if (toggleIcon) {
                toggleIcon.classList.toggle('collapsed');
            }
        });
    }

    // View switching (Card/Table)
    if (viewButtons) {
        viewButtons.forEach(button => {
            button.addEventListener('click', function() {
                const view = this.dataset.view;
                if (view) {
                    setActiveView(view);
                }
            });
        });
    }

    // Filter buttons
    if (filterButtons) {
        filterButtons.forEach(button => {
            button.addEventListener('click', function() {
                const filter = this.dataset.filter;
                const value = this.dataset.value;
                
                if (filter && value) {
                    this.classList.toggle('active');
                    
                    // Update active filters
                    if (this.classList.contains('active')) {
                        if (!activeFilters[filter].includes(value)) {
                            activeFilters[filter].push(value);
                        }
                    } else {
                        activeFilters[filter] = activeFilters[filter].filter(v => v !== value);
                    }
                    
                    // Clear preset when manual filter is selected
                    clearPresetSelection();
                    
                    // Apply filters
                    applyFiltersAndSearch();
                }
            });
        });
    }

    // Preset buttons
    if (presetButtons) {
        presetButtons.forEach(button => {
            button.addEventListener('click', function() {
                const preset = this.dataset.preset;
                
                // Clear all active filters first
                clearAllFilters();
                
                // Set this preset as active
                presetButtons.forEach(btn => btn.classList.remove('active'));
                this.classList.add('active');
                
                // Set the active preset
                activeFilters.preset = preset;
                
                // Apply preset filters
                applyPresetFilters(preset);
                
                // Apply filters
                applyFiltersAndSearch();
            });
        });
    }

    // Reset filters
    if (resetFiltersBtn) {
        resetFiltersBtn.addEventListener('click', function() {
            clearAllFilters();
            applyFiltersAndSearch();
        });
    }

    // Search input with debounce
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                applyFiltersAndSearch();
            }, DEBOUNCE_DELAY);
        });
    }

    // Export CSV
    if (exportCsvBtn) {
        exportCsvBtn.addEventListener('click', function() {
            exportToCSV();
        });
    }
    
    // Load more button
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', loadMoreStocks);
    }
}

/**
 * Fetch global stats from the server
 */
async function fetchGlobalStats() {
    try {
        const response = await fetch('/api/globalStats?excludeETFs=true');
        const data = await response.json();
        
        // Update header stats with global data
        updateHeaderStatsFromGlobal(data);
        
        console.log('Global stats fetched:', data);
    } catch (error) {
        console.error('Error fetching global stats:', error);
    }
}

/**
 * Initialize the data manager
 */
function initializeDataManager() {
    // Create data manager instance
    stockDataManager = new DataManager({
        apiEndpoint: '/api/stocks',
        batchSize: BATCH_SIZE,
        useCache: true,
        progressCallback: updateLoadingProgress,
        completeCallback: onDataLoadComplete,
        batchLoadedCallback: onBatchLoaded
    });
    
    // Start loading first batch
    stockDataManager.loadNextBatch();
    
    // Show loading state
    updateLoadingState(true);
}

/**
 * Update loading progress UI
 * @param {Number} loaded - Number of stocks loaded
 * @param {Number} total - Total number of stocks to load
 * @param {Boolean} fromCache - Whether data was loaded from cache
 */
function updateLoadingProgress(loaded, total, fromCache = false) {
    const progress = total > 0 ? (loaded / total) * 100 : 0;
    
    // Update progress bar
    if (loadingProgressBar) {
        const progressInner = loadingProgressBar.querySelector('.progress-inner');
        if (progressInner) {
            progressInner.style.width = `${progress}%`;
        }
    }
    
    // Update progress text
    if (loadingProgressText) {
        loadingProgressText.textContent = fromCache 
            ? `Loaded ${formatNumber(loaded)} of ${formatNumber(total)} stocks from cache (${progress.toFixed(0)}%)`
            : `Loading stocks: ${formatNumber(loaded)} of ${formatNumber(total)} (${progress.toFixed(0)}%)`;
    }
    
    // If we have some data already, start rendering
    if (loaded > 0 && !virtualScroller) {
        initializeVirtualScroller();
    }
}

/**
 * Handle batch loaded event
 * @param {Array} stocks - All loaded stocks so far
 * @param {Boolean} fromCache - Whether data was loaded from cache
 */
function onBatchLoaded(stocks, fromCache = false) {
    console.log(`Batch loaded: ${stocks.length} stocks${fromCache ? ' from cache' : ''}`);
    
    // Update virtual scroller
    if (virtualScroller) {
        // Apply filters to get filtered stocks
        applyFiltersAndSearch();
    } else if (stocks.length > 0) {
        // Initialize virtual scroller with first batch
        initializeVirtualScroller();
    }
    
    // Update loading state
    updateLoadingState(false);
    
    // Update connection status
    if (apiStatusIndicator) {
        apiStatusIndicator.classList.remove('disconnected');
        apiStatusIndicator.classList.add('connected');
    }
    if (apiStatusText) {
        apiStatusText.textContent = 'connected';
    }
    
    // Show load more button if there's more data
    updateLoadMoreButton();
}

/**
 * Handle data load completion
 * @param {Array} stocks - All loaded stocks
 */
function onDataLoadComplete(stocks) {
    console.log(`Data loading complete: ${stocks.length} stocks loaded`);
    
    // Hide loading indicators
    updateLoadingState(false);
    
    // Hide load more button
    if (loadMoreBtn) {
        loadMoreBtn.style.display = 'none';
    }
    
    // Update connection status
    if (apiStatusIndicator) {
        apiStatusIndicator.classList.remove('disconnected');
        apiStatusIndicator.classList.add('connected');
    }
    if (apiStatusText) {
        apiStatusText.textContent = 'connected';
    }
}

/**
 * Update loading state UI
 * @param {Boolean} isLoading - Whether data is loading
 */
function updateLoadingState(isLoading) {
    if (isLoading) {
        // Show loading indicators
        if (loadingProgressBar) loadingProgressBar.style.display = 'block';
        if (loadingProgressText) loadingProgressText.style.display = 'block';
        
        // Add loading class to container
        if (stockCardsContainer) stockCardsContainer.classList.add('loading');
        
        // Disable load more button
        if (loadMoreBtn) {
            loadMoreBtn.disabled = true;
            loadMoreBtn.textContent = 'Loading...';
        }
    } else {
        // Hide loading indicators
        if (loadingProgressBar) loadingProgressBar.style.display = 'none';
        if (loadingProgressText) loadingProgressText.style.display = 'none';
        
        // Remove loading class from container
        if (stockCardsContainer) stockCardsContainer.classList.remove('loading');
        
        // Enable load more button
        if (loadMoreBtn) {
            loadMoreBtn.disabled = false;
            loadMoreBtn.textContent = 'Load More Stocks';
        }
    }
}

/**
 * Update load more button visibility
 */
function updateLoadMoreButton() {
    if (!loadMoreBtn || !stockDataManager) return;
    
    const status = stockDataManager.getLoadingStatus();
    
    if (status.hasMoreData) {
        loadMoreBtn.style.display = 'block';
    } else {
        loadMoreBtn.style.display = 'none';
    }
}

/**
 * Load more stocks
 */
function loadMoreStocks() {
    if (!stockDataManager) return;
    
    // Show loading state
    updateLoadingState(true);
    
    // Load next batch
    stockDataManager.loadNextBatch().then(success => {
        // Update loading state
        updateLoadingState(false);
        
        // Update load more button
        updateLoadMoreButton();
    });
}

/**
 * Initialize the virtual scroller
 */
function initializeVirtualScroller() {
    if (!stockCardsContainer) return;
    
    // Clear existing content
    stockCardsContainer.innerHTML = '';
    
    // Create virtual scroller instance
    virtualScroller = new VirtualScroller({
        container: stockCardsContainer,
        itemHeight: ITEM_HEIGHT,
        bufferSize: 5,
        renderItem: renderStockCard
    });
    
    // Apply initial filters
    applyFiltersAndSearch();
}

/**
 * Render a stock card
 * @param {Object} stock - Stock data
 * @param {HTMLElement} container - Container element
 */
function renderStockCard(stock, container) {
    // Check for data completeness
    const hasCompleteData = (stock.market_cap || stock.marketCap) > 0 && 
                           (stock.price || (stock.last_trade && stock.last_trade.p)) > 0;
    
    container.className = 'stock-card';
    if (!hasCompleteData) {
        container.classList.add('incomplete-data');
    }
    
    // Get price and calculate change
    const price = stock.price || (stock.last_trade && stock.last_trade.p) || 0;
    const prevClose = stock.prevClose || (stock.prev_close) || price;
    const priceChange = price - prevClose;
    const priceChangePercent = prevClose > 0 ? (priceChange / prevClose) * 100 : 0;
    
    container.innerHTML = `
        <div class="stock-header">
            <div class="stock-symbol">${stock.ticker || stock.symbol || 'N/A'}</div>
            <div class="stock-exchange">${stock.primary_exchange || stock.exchange || 'N/A'}</div>
        </div>
        <div class="stock-name">${stock.name || 'N/A'}</div>
        <div class="stock-metrics">
            <div class="metric"><span class="metric-label">Price</span><span class="metric-value">${formatCurrency(price)}</span></div>
            <div class="metric"><span class="metric-label">Change</span><span class="metric-value ${priceChange >= 0 ? 'positive' : 'negative'}">${formatCurrency(priceChange)} (${formatPercent(priceChangePercent)})</span></div>
            <div class="metric"><span class="metric-label">Market Cap</span><span class="metric-value">${formatMarketCap(stock.market_cap || stock.marketCap)}</span></div>
            <div class="metric"><span class="metric-label">P/E Ratio</span><span class="metric-value">${formatNumber(stock.pe_ratio || stock.peRatio || 0)}</span></div>
            <div class="metric"><span class="metric-label">Dividend Yield</span><span class="metric-value">${formatPercent((stock.dividend_yield || stock.dividendYield || 0) * 100)}</span></div>
            <div class="metric"><span class="metric-label">52W High</span><span class="metric-value">${formatCurrency(stock.year_high || stock.yearHigh || 0)}</span></div>
            <div class="metric"><span class="metric-label">Score</span><span class="metric-value score ${getScoreClass(stock.custom_score || stock.score || 0)}">${formatNumber(stock.custom_score || stock.score || 0)}</span></div>
        </div>
    `;
}

/**
 * Update header stats from global data
 * @param {Object} data - Global stats data
 */
function updateHeaderStatsFromGlobal(data) {
    if (totalStocksEl) totalStocksEl.textContent = formatNumber(data.total || 0);
    if (nyseStocksEl) nyseStocksEl.textContent = formatNumber(data.nyse || 0);
    if (nasdaqStocksEl) nasdaqStocksEl.textContent = formatNumber(data.nasdaq || 0);
    if (lastUpdatedEl) {
        const lastUpdated = data.lastUpdated ? new Date(data.lastUpdated).toLocaleTimeString() : new Date().toLocaleTimeString();
        lastUpdatedEl.textContent = lastUpdated;
    }
}

/**
 * Apply filters and search
 */
function applyFiltersAndSearch() {
    if (!stockDataManager || !virtualScroller) return;
    
    // Build filter criteria
    const filters = buildFilterCriteria();
    
    // Get filtered stocks
    const filteredStocks = stockDataManager.getFilteredStocks(filters);
    
    // Update virtual scroller
    virtualScroller.setItems(filteredStocks);
    
    // Update table view if active
    updateTableView(filteredStocks);
}

/**
 * Update table view with filtered stocks
 * @param {Array} stocks - Filtered stocks to display
 */
function updateTableView(stocks) {
    if (!stockTableBody) return;
    
    // Clear existing rows
    stockTableBody.innerHTML = '';
    
    // Add rows for each stock
    stocks.forEach(stock => {
        const row = document.createElement('tr');
        
        // Get price and calculate change
        const price = stock.price || (stock.last_trade && stock.last_trade.p) || 0;
        const prevClose = stock.prevClose || (stock.prev_close) || price;
        const priceChange = price - prevClose;
        const priceChangePercent = prevClose > 0 ? (priceChange / prevClose) * 100 : 0;
        
        row.innerHTML = `
            <td>${stock.ticker || stock.symbol || 'N/A'}</td>
            <td>${stock.name || 'N/A'}</td>
            <td>${stock.primary_exchange || stock.exchange || 'N/A'}</td>
            <td>${formatCurrency(price)}</td>
            <td class="${priceChange >= 0 ? 'positive' : 'negative'}">${formatCurrency(priceChange)} (${formatPercent(priceChangePercent)})</td>
            <td>${formatMarketCap(stock.market_cap || stock.marketCap)}</td>
            <td>${formatNumber(stock.pe_ratio || stock.peRatio || 0)}</td>
            <td>${formatPercent((stock.dividend_yield || stock.dividendYield || 0) * 100)}</td>
            <td><span class="score ${getScoreClass(stock.custom_score || stock.score || 0)}">${formatNumber(stock.custom_score || stock.score || 0)}</span></td>
        `;
        
        stockTableBody.appendChild(row);
    });
}

/**
 * Build filter criteria from UI state
 * @returns {Object} Filter criteria
 */
function buildFilterCriteria() {
    const filters = {};
    
    // Add search filter
    if (searchInput && searchInput.value.trim()) {
        filters.search = searchInput.value.trim();
    }
    
    // Add active filters
    if (activeFilters.market_cap.length > 0) {
        filters.marketCap = activeFilters.market_cap;
    }
    
    if (activeFilters.volume.length > 0) {
        filters.volume = activeFilters.volume;
    }
    
    if (activeFilters.debt.length > 0) {
        filters.debt = activeFilters.debt;
    }
    
    if (activeFilters.valuation.length > 0) {
        filters.valuation = activeFilters.valuation;
    }
    
    // Add preset filter
    if (activeFilters.preset) {
        filters.preset = activeFilters.preset;
    }
    
    return filters;
}

/**
 * Clear all active filters
 */
function clearAllFilters() {
    // Reset active filters object
    activeFilters = {
        market_cap: [],
        volume: [],
        debt: [],
        valuation: [],
        preset: null
    };
    
    // Reset UI
    if (filterButtons) {
        filterButtons.forEach(button => {
            button.classList.remove('active');
        });
    }
    
    if (presetButtons) {
        presetButtons.forEach(button => {
            button.classList.remove('active');
        });
    }
    
    if (searchInput) {
        searchInput.value = '';
    }
}

/**
 * Clear preset selection
 */
function clearPresetSelection() {
    activeFilters.preset = null;
    
    if (presetButtons) {
        presetButtons.forEach(button => {
            button.classList.remove('active');
        });
    }
}

/**
 * Apply preset filters
 * @param {String} preset - Preset name
 */
function applyPresetFilters(preset) {
    // This function is just for UI updates
    // The actual filtering logic is in the DataManager
}

/**
 * Set active view (Card/Table)
 * @param {String} view - View name
 */
function setActiveView(view) {
    // Update active button
    if (viewButtons) {
        viewButtons.forEach(button => {
            if (button.dataset.view === view) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });
    }
    
    // Show/hide containers
    if (view === 'card') {
        if (stockCardsContainer) stockCardsContainer.style.display = 'grid';
        if (stockTableContainer) stockTableContainer.style.display = 'none';
        if (loadMoreBtn) loadMoreBtn.style.display = stockDataManager && stockDataManager.getLoadingStatus().hasMoreData ? 'block' : 'none';
    } else if (view === 'table') {
        if (stockCardsContainer) stockCardsContainer.style.display = 'none';
        if (stockTableContainer) stockTableContainer.style.display = 'block';
        if (loadMoreBtn) loadMoreBtn.style.display = 'none';
        
        // Update table view with current filtered stocks
        if (stockDataManager) {
            const filters = buildFilterCriteria();
            const filteredStocks = stockDataManager.getFilteredStocks(filters);
            updateTableView(filteredStocks);
        }
    }
}

/**
 * Format number for display
 * @param {Number} value - Number to format
 * @returns {String} Formatted number
 */
function formatNumber(value) {
    if (value === undefined || value === null || isNaN(value)) return 'N/A';
    
    return value.toLocaleString(undefined, { 
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    });
}

/**
 * Format currency for display
 * @param {Number} value - Currency value
 * @returns {String} Formatted currency
 */
function formatCurrency(value) {
    if (value === undefined || value === null || isNaN(value)) return 'N/A';
    
    return value.toLocaleString(undefined, { 
        style: 'currency', 
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

/**
 * Format percent for display
 * @param {Number} value - Percent value
 * @returns {String} Formatted percent
 */
function formatPercent(value) {
    if (value === undefined || value === null || isNaN(value)) return 'N/A';
    
    return value.toLocaleString(undefined, { 
        style: 'percent',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

/**
 * Format market cap for display
 * @param {Number} marketCap - Market cap value
 * @returns {String} Formatted market cap
 */
function formatMarketCap(marketCap) {
    if (!marketCap || isNaN(marketCap)) return 'N/A';
    
    if (marketCap >= 1e12) {
        return `$${(marketCap / 1e12).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}T`;
    } else if (marketCap >= 1e9) {
        return `$${(marketCap / 1e9).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}B`;
    } else if (marketCap >= 1e6) {
        return `$${(marketCap / 1e6).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}M`;
    } else {
        return `$${marketCap.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    }
}

/**
 * Get CSS class for score
 * @param {Number} score - Score value
 * @returns {String} CSS class
 */
function getScoreClass(score) {
    if (score >= 80) return 'excellent';
    if (score >= 60) return 'good';
    if (score >= 40) return 'average';
    if (score >= 20) return 'below-average';
    return 'poor';
}

/**
 * Export filtered stocks to CSV
 */
function exportToCSV() {
    if (!stockDataManager) return;
    
    // Build filter criteria
    const filters = buildFilterCriteria();
    
    // Get filtered stocks
    const filteredStocks = stockDataManager.getFilteredStocks(filters);
    
    if (filteredStocks.length === 0) {
        alert('No stocks to export');
        return;
    }
    
    // Create CSV content
    let csvContent = 'Symbol,Name,Exchange,Price,Price Change,Market Cap,P/E Ratio,Dividend Yield,Score\n';
    
    filteredStocks.forEach(stock => {
        // Get price and calculate change
        const price = stock.price || (stock.last_trade && stock.last_trade.p) || 0;
        const prevClose = stock.prevClose || (stock.prev_close) || price;
        const priceChange = price - prevClose;
        const priceChangePercent = prevClose > 0 ? (priceChange / prevClose) * 100 : 0;
        
        const row = [
            stock.ticker || stock.symbol || '',
            `"${(stock.name || '').replace(/"/g, '""')}"`,
            stock.primary_exchange || stock.exchange || '',
            price.toFixed(2),
            `${priceChange.toFixed(2)} (${priceChangePercent.toFixed(2)}%)`,
            (stock.market_cap || stock.marketCap || 0).toString(),
            (stock.pe_ratio || stock.peRatio || 0).toFixed(2),
            ((stock.dividend_yield || stock.dividendYield || 0) * 100).toFixed(2) + '%',
            (stock.custom_score || stock.score || 0).toFixed(2)
        ];
        
        csvContent += row.join(',') + '\n';
    });
    
    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'stock_screener_export.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * Initialize tooltips
 */
function initializeTooltips() {
    const tooltipElements = document.querySelectorAll('[title]');
    
    tooltipElements.forEach(element => {
        const tooltipText = element.getAttribute('title');
        element.removeAttribute('title');
        
        element.addEventListener('mouseenter', function(e) {
            showTooltip(e, tooltipText);
        });
        
        element.addEventListener('mouseleave', function() {
            hideTooltip();
        });
    });
}

/**
 * Show tooltip
 * @param {Event} e - Mouse event
 * @param {String} text - Tooltip text
 */
function showTooltip(e, text) {
    let tooltip = document.getElementById('tooltip');
    
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'tooltip';
        document.body.appendChild(tooltip);
    }
    
    tooltip.textContent = text;
    tooltip.style.display = 'block';
    
    const x = e.clientX + 10;
    const y = e.clientY + 10;
    
    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
}

/**
 * Hide tooltip
 */
function hideTooltip() {
    const tooltip = document.getElementById('tooltip');
    if (tooltip) {
        tooltip.style.display = 'none';
    }
}
