/**
 * Enhanced app.js with virtual scrolling and progressive loading
 * Optimized to efficiently handle 5,700+ stocks for the Stock Screener application
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

// Constants
const ITEM_HEIGHT = 160; // Height of each stock card in pixels
const DEBOUNCE_DELAY = 300; // Milliseconds to wait before applying search filter
const PERFORMANCE_MONITOR_INTERVAL = 10000; // Check performance every 10 seconds

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM fully loaded - initializing enhanced app with virtual scrolling");
    
    // Get DOM elements
    filtersToggle = document.getElementById('filters-toggle');
    filtersContent = document.getElementById('filters-content');
    viewButtons = document.querySelectorAll('.view-button[data-view]');
    stockCardsContainer = document.getElementById('stock-cards-container');
    stockTableContainer = document.getElementById('stock-table-container');
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

    // Set up event listeners
    setupEventListeners();
    
    // Initialize tooltips
    initializeTooltips();
    
    // Initialize data manager
    initializeDataManager();
    
    // Set up performance monitoring
    setupPerformanceMonitoring();
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
    
    // Add window resize handler
    window.addEventListener('resize', function() {
        if (virtualScroller) {
            virtualScroller.refresh();
        }
    });
}

/**
 * Initialize the data manager
 */
function initializeDataManager() {
    // Create data manager instance
    stockDataManager = new EnhancedDataManager({
        apiEndpoint: '/api/stocks',
        batchSize: 1000,
        useCache: true,
        excludeETFs: true,
        maxConcurrentRequests: 3,
        progressCallback: updateLoadingProgress,
        completeCallback: onDataLoadComplete
    });
    
    // Start loading data
    stockDataManager.loadAllStocks();
    
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
            ? `Loaded ${loaded} stocks from cache (${progress.toFixed(0)}%)`
            : `Loading stocks: ${loaded} of ${total} (${progress.toFixed(0)}%)`;
    }
    
    // Update header stats
    updateHeaderStats(loaded, total);
    
    // If we have some data already, start rendering
    if (loaded > 0 && !virtualScroller) {
        initializeVirtualScroller();
    }
    
    // If data is from cache, we can hide the loading indicators
    if (fromCache) {
        updateLoadingState(false);
    }
}

/**
 * Handle data load completion
 * @param {Array} stocks - All loaded stocks
 */
function onDataLoadComplete(stocks) {
    console.log(`Data loading complete: ${stocks.length} stocks loaded`);
    
    // Update header stats
    updateHeaderStats(stocks.length, stocks.length);
    
    // Hide loading indicators
    updateLoadingState(false);
    
    // Initialize or update virtual scroller
    if (!virtualScroller) {
        initializeVirtualScroller();
    } else {
        // Update with all stocks
        applyFiltersAndSearch();
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
    } else {
        // Hide loading indicators
        if (loadingProgressBar) loadingProgressBar.style.display = 'none';
        if (loadingProgressText) loadingProgressText.style.display = 'none';
        
        // Remove loading class from container
        if (stockCardsContainer) stockCardsContainer.classList.remove('loading');
    }
}

/**
 * Initialize the virtual scroller
 */
function initializeVirtualScroller() {
    if (!stockCardsContainer) return;
    
    // Clear existing content
    stockCardsContainer.innerHTML = '';
    
    // Create virtual scroller instance
    virtualScroller = new EnhancedVirtualScroller({
        container: stockCardsContainer,
        itemHeight: ITEM_HEIGHT,
        bufferSize: 10,
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
    container.className = 'stock-card';
    
    // Check for data completeness
    const hasCompleteData = (stock.market_cap || stock.marketCap) > 0 && 
                           (stock.price || (stock.last_trade && stock.last_trade.p)) > 0;
    
    if (!hasCompleteData) {
        container.classList.add('incomplete-data');
    }
    
    container.innerHTML = `
        <div class="stock-header">
            <div class="stock-symbol">${stock.ticker || stock.symbol || 'N/A'}</div>
            <div class="stock-exchange">${stock.primary_exchange || stock.exchange || 'N/A'}</div>
        </div>
        <div class="stock-name">${stock.name || 'N/A'}</div>
        <div class="stock-metrics">
            <div class="metric"><span class="metric-label">Price</span><span class="metric-value">$${(stock.price || (stock.last_trade && stock.last_trade.p) || 0).toFixed(2)}</span></div>
            <div class="metric"><span class="metric-label">Market Cap</span><span class="metric-value">${formatMarketCap(stock.market_cap || stock.marketCap)}</span></div>
            <div class="metric"><span class="metric-label">P/E Ratio</span><span class="metric-value">${(stock.pe_ratio || stock.peRatio || 0).toFixed(2)}</span></div>
            <div class="metric"><span class="metric-label">Dividend Yield</span><span class="metric-value">${((stock.dividend_yield || stock.dividendYield || 0) * 100).toFixed(2)}%</span></div>
            <div class="metric"><span class="metric-label">52W High</span><span class="metric-value">$${(stock.year_high || stock.yearHigh || 0).toFixed(2)}</span></div>
            <div class="metric"><span class="metric-label">Score</span><span class="metric-value score ${getScoreClass(stock.custom_score || stock.score || 0)}">${(stock.custom_score || stock.score || 0).toFixed(2)}</span></div>
        </div>
    `;
}

/**
 * Update header stats
 * @param {Number} totalCount - Total number of stocks
 * @param {Number} maxCount - Maximum number of stocks
 */
function updateHeaderStats(totalCount, maxCount) {
    if (!stockDataManager) return;
    
    const stocks = stockDataManager.getAllStocks();
    
    if (totalStocksEl) totalStocksEl.textContent = totalCount;
    
    // Count NYSE and NASDAQ stocks
    const nyseCount = stocks.filter(s => {
        const exchange = (s.primary_exchange || s.exchange || '').toUpperCase();
        return exchange.includes('NYSE') || exchange.includes('XNYS');
    }).length;
    
    const nasdaqCount = stocks.filter(s => {
        const exchange = (s.primary_exchange || s.exchange || '').toUpperCase();
        return exchange.includes('NASDAQ') || exchange.includes('XNAS');
    }).length;
    
    if (nyseStocksEl) nyseStocksEl.textContent = nyseCount;
    if (nasdaqStocksEl) nasdaqStocksEl.textContent = nasdaqCount;
    if (lastUpdatedEl) lastUpdatedEl.textContent = new Date().toLocaleTimeString();
}

/**
 * Apply filters and search
 */
function applyFiltersAndSearch() {
    if (!stockDataManager || !virtualScroller) return;
    
    // Build filter criteria
    const filters = buildFilterCriteria();
    
    // Get filtered stocks
    const startTime = performance.now();
    const filteredStocks = stockDataManager.getFilteredStocks(filters);
    const filterTime = performance.now() - startTime;
    
    console.log(`Filtering completed in ${filterTime.toFixed(2)}ms, found ${filteredStocks.length} stocks`);
    
    // Update virtual scroller
    virtualScroller.setItems(filteredStocks);
    
    // Update count display
    if (totalStocksEl) {
        totalStocksEl.textContent = filteredStocks.length;
    }
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
    } else if (view === 'table') {
        if (stockCardsContainer) stockCardsContainer.style.display = 'none';
        if (stockTableContainer) stockTableContainer.style.display = 'block';
        
        // TODO: Implement table view with virtual scrolling
    }
}

/**
 * Format market cap for display
 * @param {Number} marketCap - Market cap value
 * @returns {String} Formatted market cap
 */
function formatMarketCap(marketCap) {
    if (!marketCap) return 'N/A';
    
    if (marketCap >= 1e12) {
        return `$${(marketCap / 1e12).toFixed(2)}T`;
    } else if (marketCap >= 1e9) {
        return `$${(marketCap / 1e9).toFixed(2)}B`;
    } else if (marketCap >= 1e6) {
        return `$${(marketCap / 1e6).toFixed(2)}M`;
    } else {
        return `$${marketCap.toFixed(2)}`;
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
    let csvContent = 'Symbol,Name,Exchange,Price,Market Cap,P/E Ratio,Dividend Yield,52W High,Score\n';
    
    filteredStocks.forEach(stock => {
        const row = [
            stock.ticker || stock.symbol || '',
            `"${(stock.name || '').replace(/"/g, '""')}"`,
            stock.primary_exchange || stock.exchange || '',
            (stock.price || (stock.last_trade && stock.last_trade.p) || 0).toFixed(2),
            formatMarketCap(stock.market_cap || stock.marketCap).replace('$', ''),
            (stock.pe_ratio || stock.peRatio || 0).toFixed(2),
            ((stock.dividend_yield || stock.dividendYield || 0) * 100).toFixed(2),
            (stock.year_high || stock.yearHigh || 0).toFixed(2),
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

/**
 * Set up performance monitoring
 */
function setupPerformanceMonitoring() {
    // Monitor memory usage and performance periodically
    setInterval(() => {
        if (stockDataManager && virtualScroller) {
            const dataMetrics = stockDataManager.getPerformanceMetrics();
            const scrollerMetrics = virtualScroller.getPerformanceMetrics();
            
            console.log('Performance metrics:', {
                data: dataMetrics,
                scroller: scrollerMetrics,
                memory: window.performance && window.performance.memory ? {
                    usedJSHeapSize: Math.round(window.performance.memory.usedJSHeapSize / (1024 * 1024)) + 'MB',
                    totalJSHeapSize: Math.round(window.performance.memory.totalJSHeapSize / (1024 * 1024)) + 'MB'
                } : 'Not available'
            });
        }
    }, PERFORMANCE_MONITOR_INTERVAL);
}
