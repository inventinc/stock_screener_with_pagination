/**
 * Fixed Filter Logic for Stock Screener
 * This script fixes the filter functionality by properly initializing event handlers
 * and ensuring filter state is correctly managed and applied.
 */

// Global variables for filter state
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

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM fully loaded - initializing fixed filter logic");
    
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
    
    // Add loading progress elements if they don't exist
    loadingProgressBar = document.getElementById('loading-progress-bar') || createLoadingProgressBar();
    loadingProgressText = document.getElementById('loading-progress-text') || createLoadingProgressText();

    // Set up event listeners with explicit logging
    setupFilterEventListeners();
    
    // Initialize tooltips
    initializeTooltips();
    
    console.log("Filter initialization complete");
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
 * Set up all filter event listeners with explicit logging
 */
function setupFilterEventListeners() {
    console.log("Setting up filter event listeners");
    
    // Filters toggle
    if (filtersToggle && filtersContent) {
        console.log("Setting up filters toggle");
        filtersToggle.addEventListener('click', function() {
            console.log("Filters toggle clicked");
            filtersContent.classList.toggle('collapsed');
            const toggleIcon = filtersToggle.querySelector('.filters-toggle');
            if (toggleIcon) {
                toggleIcon.classList.toggle('collapsed');
            }
        });
    } else {
        console.warn("Filters toggle elements not found");
    }

    // View switching (Card/Table)
    if (viewButtons && viewButtons.length > 0) {
        console.log(`Setting up ${viewButtons.length} view buttons`);
        viewButtons.forEach((button, index) => {
            button.addEventListener('click', function() {
                const view = this.dataset.view;
                console.log(`View button clicked: ${view}`);
                if (view) {
                    setActiveView(view);
                }
            });
            console.log(`View button ${index+1} handler attached: ${button.dataset.view}`);
        });
    } else {
        console.warn("View buttons not found");
    }

    // Filter buttons
    if (filterButtons && filterButtons.length > 0) {
        console.log(`Setting up ${filterButtons.length} filter buttons`);
        filterButtons.forEach((button, index) => {
            button.addEventListener('click', function() {
                const filter = this.dataset.filter;
                const value = this.dataset.value;
                
                console.log(`Filter button clicked: ${filter}=${value}`);
                
                if (filter && value) {
                    this.classList.toggle('active');
                    
                    // Initialize filter array if it doesn't exist
                    if (!activeFilters[filter]) {
                        activeFilters[filter] = [];
                    }
                    
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
            console.log(`Filter button ${index+1} handler attached: ${button.dataset.filter}=${button.dataset.value}`);
        });
    } else {
        console.warn("Filter buttons not found");
    }

    // Preset buttons
    if (presetButtons && presetButtons.length > 0) {
        console.log(`Setting up ${presetButtons.length} preset buttons`);
        presetButtons.forEach((button, index) => {
            button.addEventListener('click', function() {
                const preset = this.dataset.preset;
                console.log(`Preset button clicked: ${preset}`);
                
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
            console.log(`Preset button ${index+1} handler attached: ${button.dataset.preset}`);
        });
    } else {
        console.warn("Preset buttons not found");
    }

    // Reset filters
    if (resetFiltersBtn) {
        console.log("Setting up reset filters button");
        resetFiltersBtn.addEventListener('click', function() {
            console.log("Reset filters button clicked");
            clearAllFilters();
            applyFiltersAndSearch();
        });
    } else {
        console.warn("Reset filters button not found");
    }

    // Search input with debounce
    if (searchInput) {
        console.log("Setting up search input");
        searchInput.addEventListener('input', function() {
            console.log("Search input changed");
            clearTimeout(window.debounceTimer);
            window.debounceTimer = setTimeout(() => {
                applyFiltersAndSearch();
            }, DEBOUNCE_DELAY);
        });
    } else {
        console.warn("Search input not found");
    }

    // Export CSV
    if (exportCsvBtn) {
        console.log("Setting up export CSV button");
        exportCsvBtn.addEventListener('click', function() {
            console.log("Export CSV button clicked");
            exportToCSV();
        });
    } else {
        console.warn("Export CSV button not found");
    }
    
    console.log("All filter event listeners set up");
}

/**
 * Initialize tooltips
 */
function initializeTooltips() {
    // Create tooltip element if it doesn't exist
    let tooltip = document.getElementById('tooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'tooltip';
        document.body.appendChild(tooltip);
    }
    
    // Add event listeners to elements with title attribute
    const elementsWithTooltips = document.querySelectorAll('[title]');
    elementsWithTooltips.forEach(element => {
        const title = element.getAttribute('title');
        element.removeAttribute('title'); // Remove default browser tooltip
        
        element.addEventListener('mouseenter', function(e) {
            tooltip.textContent = title;
            tooltip.style.display = 'block';
            positionTooltip(e);
        });
        
        element.addEventListener('mousemove', positionTooltip);
        
        element.addEventListener('mouseleave', function() {
            tooltip.style.display = 'none';
        });
    });
    
    function positionTooltip(e) {
        const x = e.clientX + 10;
        const y = e.clientY + 10;
        tooltip.style.left = `${x}px`;
        tooltip.style.top = `${y}px`;
    }
}

/**
 * Set active view (Card/Table)
 * @param {string} view - View type ('card' or 'table')
 */
function setActiveView(view) {
    // Update active button
    viewButtons.forEach(button => {
        if (button.dataset.view === view) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });
    
    // Show/hide containers
    if (view === 'card') {
        stockCardsContainer.style.display = 'grid';
        stockTableContainer.style.display = 'none';
    } else if (view === 'table') {
        stockCardsContainer.style.display = 'none';
        stockTableContainer.style.display = 'block';
    }
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
    // Reset active filters object
    activeFilters = {
        market_cap: [],
        volume: [],
        debt: [],
        valuation: [],
        preset: null
    };
    
    // Remove active class from all filter buttons
    filterButtons.forEach(button => button.classList.remove('active'));
    presetButtons.forEach(button => button.classList.remove('active'));
    
    // Clear search input
    if (searchInput) {
        searchInput.value = '';
    }
}

/**
 * Apply preset filters
 * @param {string} preset - Preset type
 */
function applyPresetFilters(preset) {
    // Clear existing filters first
    filterButtons.forEach(button => button.classList.remove('active'));
    
    // Apply preset-specific filters
    switch (preset) {
        case 'value':
            // Value stocks: Low P/E, Low Debt, Large/Mid Cap
            applyFilterByValues('valuation', ['undervalued']);
            applyFilterByValues('debt', ['low']);
            applyFilterByValues('market_cap', ['large', 'mid']);
            break;
            
        case 'growth':
            // Growth stocks: High P/E, Mid/Small Cap
            applyFilterByValues('valuation', ['overvalued']);
            applyFilterByValues('market_cap', ['mid', 'small']);
            break;
            
        case 'dividend':
            // Dividend stocks: Fair P/E, Large Cap
            applyFilterByValues('valuation', ['fair']);
            applyFilterByValues('market_cap', ['large']);
            break;
            
        case 'quality':
            // Quality stocks: Fair P/E, Low Debt, Large Cap
            applyFilterByValues('valuation', ['fair']);
            applyFilterByValues('debt', ['low']);
            applyFilterByValues('market_cap', ['large']);
            break;
    }
}

/**
 * Apply filter by values
 * @param {string} filter - Filter type
 * @param {Array} values - Filter values
 */
function applyFilterByValues(filter, values) {
    // Update active filters
    activeFilters[filter] = [...values];
    
    // Update UI
    filterButtons.forEach(button => {
        if (button.dataset.filter === filter && values.includes(button.dataset.value)) {
            button.classList.add('active');
        }
    });
}

/**
 * Apply filters and search
 */
function applyFiltersAndSearch() {
    console.log("Applying filters:", JSON.stringify(activeFilters));
    
    // Get all stock elements
    const stockElements = document.querySelectorAll('.stock-card');
    
    if (stockElements.length === 0) {
        console.warn("No stock elements found to filter");
        return;
    }
    
    console.log(`Filtering ${stockElements.length} stock elements`);
    
    // Build filter criteria
    const filters = buildFilterCriteria();
    
    // Count visible stocks
    let visibleCount = 0;
    
    // Apply filters to each stock element
    stockElements.forEach(stockElement => {
        const shouldShow = shouldShowStock(stockElement, filters);
        
        if (shouldShow) {
            stockElement.style.display = '';
            visibleCount++;
        } else {
            stockElement.style.display = 'none';
        }
    });
    
    // Update count display
    if (totalStocksEl) {
        totalStocksEl.textContent = visibleCount;
    }
    
    console.log(`Filter applied: ${visibleCount} stocks visible`);
}

/**
 * Build filter criteria from UI state
 * @returns {Object} Filter criteria
 */
function buildFilterCriteria() {
    const filters = {};
    
    // Add search filter
    if (searchInput && searchInput.value.trim()) {
        filters.search = searchInput.value.trim().toLowerCase();
    }
    
    // Add active filters
    if (activeFilters.market_cap && activeFilters.market_cap.length > 0) {
        filters.marketCap = activeFilters.market_cap;
    }
    
    if (activeFilters.volume && activeFilters.volume.length > 0) {
        filters.volume = activeFilters.volume;
    }
    
    if (activeFilters.debt && activeFilters.debt.length > 0) {
        filters.debt = activeFilters.debt;
    }
    
    if (activeFilters.valuation && activeFilters.valuation.length > 0) {
        filters.valuation = activeFilters.valuation;
    }
    
    return filters;
}

/**
 * Determine if a stock should be shown based on filters
 * @param {HTMLElement} stockElement - Stock element
 * @param {Object} filters - Filter criteria
 * @returns {Boolean} Whether the stock should be shown
 */
function shouldShowStock(stockElement, filters) {
    // If no filters, show all
    if (Object.keys(filters).length === 0) {
        return true;
    }
    
    // Check search filter
    if (filters.search) {
        const symbol = stockElement.querySelector('.stock-symbol')?.textContent || '';
        const name = stockElement.querySelector('.stock-name')?.textContent || '';
        
        if (!symbol.toLowerCase().includes(filters.search) && 
            !name.toLowerCase().includes(filters.search)) {
            return false;
        }
    }
    
    // Check market cap filter
    if (filters.marketCap && filters.marketCap.length > 0) {
        const marketCapText = stockElement.querySelector('.metric:nth-child(2) .metric-value')?.textContent || '';
        const marketCap = parseMarketCap(marketCapText);
        
        let matchesMarketCap = false;
        
        for (const capType of filters.marketCap) {
            if ((capType === 'large' && marketCap >= 10e9) ||
                (capType === 'mid' && marketCap >= 2e9 && marketCap < 10e9) ||
                (capType === 'small' && marketCap >= 300e6 && marketCap < 2e9) ||
                (capType === 'micro' && marketCap < 300e6)) {
                matchesMarketCap = true;
                break;
            }
        }
        
        if (!matchesMarketCap) {
            return false;
        }
    }
    
    // Check P/E ratio filter (valuation)
    if (filters.valuation && filters.valuation.length > 0) {
        const peRatioText = stockElement.querySelector('.metric:nth-child(3) .metric-value')?.textContent || '';
        const peRatio = parseFloat(peRatioText) || 0;
        
        if (peRatio <= 0) {
            // Skip P/E filter for stocks with no P/E ratio
            return true;
        }
        
        let matchesValuation = false;
        
        for (const valType of filters.valuation) {
            if ((valType === 'undervalued' && peRatio < 15) ||
                (valType === 'fair' && peRatio >= 15 && peRatio <= 25) ||
                (valType === 'overvalued' && peRatio > 25)) {
                matchesValuation = true;
                break;
            }
        }
        
        if (!matchesValuation) {
            return false;
        }
    }
    
    // All filters passed
    return true;
}

/**
 * Parse market cap text to number
 * @param {String} marketCapText - Market cap text (e.g. "$10.5B")
 * @returns {Number} Market cap value in dollars
 */
function parseMarketCap(marketCapText) {
    if (!marketCapText || marketCapText === 'N/A') {
        return 0;
    }
    
    // Remove $ and any commas
    const cleanText = marketCapText.replace(/[$,]/g, '');
    
    // Extract number and suffix
    const match = cleanText.match(/^([\d.]+)([KMBT])?$/i);
    
    if (!match) {
        return 0;
    }
    
    const num = parseFloat(match[1]);
    const suffix = match[2]?.toUpperCase() || '';
    
    // Apply multiplier based on suffix
    switch (suffix) {
        case 'T': return num * 1e12;
        case 'B': return num * 1e9;
        case 'M': return num * 1e6;
        case 'K': return num * 1e3;
        default: return num;
    }
}

/**
 * Export filtered stocks to CSV
 */
function exportToCSV() {
    // Get all visible stock elements
    const visibleStocks = Array.from(document.querySelectorAll('.stock-card'))
        .filter(el => el.style.display !== 'none');
    
    if (visibleStocks.length === 0) {
        alert('No stocks to export');
        return;
    }
    
    // Create CSV content
    let csvContent = 'Symbol,Name,Exchange,Price,Market Cap,P/E Ratio,Dividend Yield\n';
    
    visibleStocks.forEach(stock => {
        const symbol = stock.querySelector('.stock-symbol')?.textContent || '';
        const name = stock.querySelector('.stock-name')?.textContent || '';
        const exchange = stock.querySelector('.stock-exchange')?.textContent || '';
        const price = stock.querySelector('.metric:nth-child(1) .metric-value')?.textContent || '';
        const marketCap = stock.querySelector('.metric:nth-child(2) .metric-value')?.textContent || '';
        const peRatio = stock.querySelector('.metric:nth-child(3) .metric-value')?.textContent || '';
        const dividendYield = stock.querySelector('.metric:nth-child(4) .metric-value')?.textContent || '';
        
        // Escape quotes in name
        const escapedName = name.replace(/"/g, '""');
        
        csvContent += `${symbol},"${escapedName}",${exchange},${price},${marketCap},${peRatio},${dividendYield}\n`;
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

// Log that the script has loaded
console.log("Fixed filter script loaded successfully");
