/**
 * Enhanced app.js with virtual scrolling and progressive loading
 * Designed to efficiently handle 5,700+ stocks for the Stock Screener application
 */

// Global variables
let stockDataManager;
let virtualScroller;
let debounceTimer;

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
        filtersToggle.onclick = function() {
            filtersContent.classList.toggle('collapsed');
            const toggleIcon = filtersToggle.querySelector('.filters-toggle');
            if (toggleIcon) {
                toggleIcon.classList.toggle('collapsed');
            }
        };
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
}

/**
 * Initialize the data manager
 */
function initializeDataManager() {
    // Create data manager instance
    stockDataManager = new DataManager({
        apiEndpoint: '/api/stocks',
        batchSize: 500,
        useCache: true,
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
    container.className = 'stock-card';
    container.innerHTML = `
        <div class="stock-header">
            <div class="stock-symbol">${stock.ticker || stock.symbol || 'N/A'}</div>
            <div class="stock-exchange">${stock.primary_exchange || stock.exchange || 'N/A'}</div>
        </div>
        <div class="stock-name">${stock.name || 'N/A'}</div>
        <div class="stock-metrics">
            <div class="metric"><span class="metric-label">Price</span><span class="metric-value">$${(stock.price || stock.last_trade?.p || 0).toFixed(2)}</span></div>
            <div class="metric"><span class="metric-label">Market Cap</span><span class="metric-value">${formatMarketCap(stock.market_cap || stock.marketCap)}</span></div>
            <div class="metric"><span class="metric-label">P/E Ratio</span><span class="metric-value">${(stock.pe_ratio || 0).toFixed(2)}</span></div>
            <div class="metric"><span class="metric-label">Dividend Yield</span><span class="metric-value">${((stock.dividend_yield || 0) * 100).toFixed(2)}%</span></div>
            <div class="metric"><span class="metric-label">52W High</span><span class="metric-value">$${(stock.year_high || 0).toFixed(2)}</span></div>
            <div class="metric"><span class="metric-label">Score</span><span class="metric-value score ${getScoreClass(stock.custom_score || 0)} ">${(stock.custom_score || 0).toFixed(2)}</span></div>
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
    const filteredStocks = stockDataManager.getFilteredStocks(filters);
    
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
    
    return filters;
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
            (stock.price || stock.last_trade?.p || 0).toFixed(2),
            stock.market_cap || stock.marketCap || 0,
            (stock.pe_ratio || 0).toFixed(2),
            ((stock.dividend_yield || 0) * 100).toFixed(2),
            (stock.year_high || 0).toFixed(2),
            (stock.custom_score || 0).toFixed(2)
        ];
        
        csvContent += row.join(',') + '\n';
    });
    
    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `stock_screener_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Active filters state
let activeFilters = {
    preset: null,
    market_cap: [],
    volume: [],
    debt: [],
    valuation: []
};

/**
 * Apply preset filters
 * @param {String} preset - Preset name
 */
function applyPresetFilters(preset) {
    // Clear existing filters
    activeFilters.market_cap = [];
    activeFilters.volume = [];
    activeFilters.debt = [];
    activeFilters.valuation = [];
    
    // Reset UI
    filterButtons.forEach(button => button.classList.remove('active'));
    
    // Apply preset-specific filters
    switch(preset) {
        case 'value':
            // Value stocks: Low P/E, Low Debt, Large Cap
            activateFilter('valuation', 'cheap');
            activateFilter('debt', 'low');
            activateFilter('market_cap', 'large');
            break;
        case 'growth':
            // Growth stocks: High P/E, Mid-Small Cap
            activateFilter('valuation', 'premium');
            activateFilter('market_cap', 'mid');
            activateFilter('market_cap', 'small');
            break;
        case 'dividend':
            // Dividend stocks: Large Cap, Low Debt
            activateFilter('market_cap', 'large');
            activateFilter('debt', 'low');
            break;
        case 'quality':
            // Quality stocks: Fair P/E, Low Debt, High Volume
            activateFilter('valuation', 'fair');
            activateFilter('debt', 'low');
            activateFilter('volume', 'high');
            break;
    }
}

/**
 * Activate a specific filter in the UI
 * @param {String} filterType - Filter type
 * @param {String} value - Filter value
 */
function activateFilter(filterType, value) {
    filterButtons.forEach(button => {
        if (button.dataset.filter === filterType && button.dataset.value === value) {
            button.classList.add('active');
            if (!activeFilters[filterType].includes(value)) {
                activeFilters[filterType].push(value);
            }
        }
    });
}

/**
 * Clear preset selection
 */
function clearPresetSelection() {
    activeFilters.preset = null;
    presetButtons.forEach(button => button.classList.remove('active'));
}

/**
 * Clear all filters
 */
function clearAllFilters() {
    activeFilters = {
        preset: null,
        market_cap: [],
        volume: [],
        debt: [],
        valuation: []
    };
    
    // Reset UI
    filterButtons.forEach(button => button.classList.remove('active'));
    presetButtons.forEach(button => button.classList.remove('active'));
    
    if (searchInput) searchInput.value = '';
}

/**
 * Set active view (Card/Table)
 * @param {String} view - View type ('card' or 'table')
 */
function setActiveView(view) {
    // Update UI
    viewButtons.forEach(button => {
        if (button.dataset.view === view) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });
    
    // Show/hide containers
    if (view === 'card') {
        if (stockCardsContainer) stockCardsContainer.style.display = 'block';
        if (stockTableContainer) stockTableContainer.style.display = 'none';
    } else {
        if (stockCardsContainer) stockCardsContainer.style.display = 'none';
        if (stockTableContainer) stockTableContainer.style.display = 'block';
        
        // Render table view
        renderTableView();
    }
}

/**
 * Render table view
 */
function renderTableView() {
    if (!stockDataManager || !stockTableContainer) return;
    
    // Build filter criteria
    const filters = buildFilterCriteria();
    
    // Get filtered stocks
    const filteredStocks = stockDataManager.getFilteredStocks(filters);
    
    // Create table if it doesn't exist
    let stockTable = stockTableContainer.querySelector('table');
    if (!stockTable) {
        stockTable = document.createElement('table');
        stockTable.className = 'stock-table';
        stockTable.innerHTML = `
            <thead>
                <tr>
                    <th>Symbol</th>
                    <th>Name</th>
                    <th>Exchange</th>
                    <th>Price</th>
                    <th>Market Cap</th>
                    <th>P/E Ratio</th>
                    <th>Dividend Yield</th>
                    <th>Score</th>
                </tr>
            </thead>
            <tbody id="stock-table-body"></tbody>
        `;
        stockTableContainer.appendChild(stockTable);
    }
    
    // Get table body
    const stockTableBody = document.getElementById('stock-table-body');
    if (!stockTableBody) return;
    
    // Clear existing content
    stockTableBody.innerHTML = '';
    
    // Show message if no stocks
    if (filteredStocks.length === 0) {
        stockTableBody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 20px;">No stocks match your criteria</td></tr>';
        return;
    }
    
    // Render first 100 stocks (pagination for table view)
    const stocksToRender = filteredStocks.slice(0, 100);
    
    stocksToRender.forEach(stock => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${stock.ticker || stock.symbol || 'N/A'}</td>
            <td>${stock.name || 'N/A'}</td>
            <td>${stock.primary_exchange || stock.exchange || 'N/A'}</td>
            <td>$${(stock.price || stock.last_trade?.p || 0).toFixed(2)}</td>
            <td>${formatMarketCap(stock.market_cap || stock.marketCap)}</td>
            <td>${(stock.pe_ratio || 0).toFixed(2)}</td>
            <td>${((stock.dividend_yield || 0) * 100).toFixed(2)}%</td>
            <td class="score ${getScoreClass(stock.custom_score || 0)}">${(stock.custom_score || 0).toFixed(2)}</td>
        `;
        stockTableBody.appendChild(row);
    });
    
    // Add pagination message if needed
    if (filteredStocks.length > 100) {
        const paginationRow = document.createElement('tr');
        paginationRow.innerHTML = `
            <td colspan="8" style="text-align: center; padding: 10px; font-style: italic;">
                Showing 100 of ${filteredStocks.length} stocks. Export to CSV to see all results.
            </td>
        `;
        stockTableBody.appendChild(paginationRow);
    }
}

// Add CSS for loading indicators
const style = document.createElement('style');
style.textContent = `
    .loading-progress-bar {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 4px;
        background: #f0f0f0;
        z-index: 1000;
    }
    
    .loading-progress-bar .progress-inner {
        height: 100%;
        background: #0066ff;
        width: 0;
        transition: width 0.3s ease;
    }
    
    .loading-progress-text {
        position: fixed;
        top: 10px;
        right: 10px;
        background: rgba(0, 0, 0, 0.7);
        color: white;
        padding: 5px 10px;
        border-radius: 4px;
        font-size: 12px;
        z-index: 1000;
    }
    
    .stock-card {
        transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    
    .stock-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
    }
`;
document.head.appendChild(style);
