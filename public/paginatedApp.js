/**
 * PaginatedStockApp - Stock Screener Application with Pagination
 * 
 * This script handles the stock data loading, filtering, and display functionality
 * for the Stock Screener application.
 */

// Global variables for filter state and pagination
window.activeFilters = {};
let pagination = {
    page: 1,
    pageSize: 50,
    totalPages: 1,
    totalItems: 0
};

// Initialize pagination controls
const paginationControls = new PaginationControls(
    document.getElementById('pagination-container'),
    handlePageChange
);

// Initialize tooltips
const tooltips = new Tooltip();

/**
 * Toggle filter state and reload data
 * @param {HTMLElement} button - The filter button element
 */
function toggleFilter(button) {
    console.log('toggleFilter called with button:', button);
    
    const filter = button.dataset.filter;
    const value = button.dataset.value;
    
    console.log('Filter:', filter, 'Value:', value);
    
    // Initialize filter array if it doesn't exist
    if (!activeFilters[filter]) {
        activeFilters[filter] = [];
    }
    
    // Toggle filter value
    const index = activeFilters[filter].indexOf(value);
    if (index === -1) {
        // Add filter
        activeFilters[filter].push(value);
        button.classList.add('active');
    } else {
        // Remove filter
        activeFilters[filter].splice(index, 1);
        button.classList.remove('active');
        
        // Remove empty filter arrays
        if (activeFilters[filter].length === 0) {
            delete activeFilters[filter];
        }
    }
    
    console.log('Updated activeFilters:', activeFilters);
    
    // Reload data with current filters
    loadStocksPage(1, pagination.pageSize);
}

/**
 * Toggle preset filter state and reload data
 * @param {HTMLElement} button - The preset button element
 */
function togglePreset(button) {
    console.log('togglePreset called with button:', button);
    
    const preset = button.dataset.preset;
    
    // Clear existing presets
    if (activeFilters.preset) {
        // Remove active class from all preset buttons
        document.querySelectorAll('button[data-preset]').forEach(btn => {
            btn.classList.remove('active');
        });
        delete activeFilters.preset;
    }
    
    // If the clicked button was already active, we just cleared it
    // Otherwise, set the new preset
    if (button.classList.contains('active')) {
        button.classList.remove('active');
    } else {
        activeFilters.preset = [preset];
        button.classList.add('active');
    }
    
    console.log('Updated activeFilters:', activeFilters);
    
    // Reload data with current filters
    loadStocksPage(1, pagination.pageSize);
}

/**
 * Reset all filters and reload data
 */
function resetFilters() {
    console.log('resetFilters called');
    
    // Clear active filters
    activeFilters = {};
    
    // Remove active class from all filter buttons
    document.querySelectorAll('.filter-button').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Reload data with no filters
    loadStocksPage(1, pagination.pageSize);
}

/**
 * Handle page change event from pagination controls
 * @param {number} page - The new page number
 */
function handlePageChange(page) {
    console.log('handlePageChange called with page:', page);
    loadStocksPage(page, pagination.pageSize);
}

/**
 * Convert filter values to backend API parameters
 * @param {Object} filters - The active filters object
 * @returns {Object} - The converted parameters object
 */
function convertFiltersToBackendParams(filters) {
    console.log('Converting filters to backend params:', filters);
    const params = {};
    
    // Process each filter type
    Object.keys(filters).forEach(filter => {
        const values = filters[filter];
        
        switch (filter) {
            case 'market_cap':
                values.forEach(value => {
                    switch (value) {
                        case 'large':
                            params.marketCapMin = 10000000000; // $10B+
                            break;
                        case 'mid':
                            params.marketCapMin = 2000000000;  // $2B
                            params.marketCapMax = 10000000000; // $10B
                            break;
                        case 'small':
                            params.marketCapMin = 300000000;   // $300M
                            params.marketCapMax = 2000000000;  // $2B
                            break;
                        case 'micro':
                            params.marketCapMax = 300000000;   // <$300M
                            break;
                    }
                });
                break;
                
            case 'volume':
                values.forEach(value => {
                    switch (value) {
                        case 'high':
                            // FIX: Corrected volume parameter for high volume
                            params.avgVolumeMin = 5000000; // >5M
                            break;
                        case 'medium':
                            // FIX: Corrected volume parameters for medium volume
                            params.avgVolumeMin = 1000000; // >1M
                            params.avgVolumeMax = 5000000; // <5M
                            break;
                        case 'low':
                            // FIX: Corrected volume parameter for low volume
                            params.avgVolumeMax = 1000000; // <1M
                            break;
                    }
                });
                break;
                
            case 'debt':
                values.forEach(value => {
                    switch (value) {
                        case 'low':
                            // FIX: Corrected debt parameter for low debt
                            params.debtToEquityMax = 0.5; // <0.5
                            break;
                        case 'medium':
                            // FIX: Corrected debt parameters for medium debt
                            params.debtToEquityMin = 0.5; // >0.5
                            params.debtToEquityMax = 1.5; // <1.5
                            break;
                        case 'high':
                            // FIX: Corrected debt parameter for high debt
                            params.debtToEquityMin = 1.5; // >1.5
                            break;
                    }
                });
                break;
                
            case 'valuation':
                values.forEach(value => {
                    switch (value) {
                        case 'undervalued':
                            params.peRatioMax = 15; // P/E <15
                            break;
                        case 'fair':
                            params.peRatioMin = 15;  // P/E >15
                            params.peRatioMax = 25;  // P/E <25
                            break;
                        case 'overvalued':
                            params.peRatioMin = 25; // P/E >25
                            break;
                    }
                });
                break;
                
            case 'preset':
                values.forEach(value => {
                    switch (value) {
                        case 'value':
                            params.peRatioMax = 15;        // P/E <15
                            params.dividendYieldMin = 0.02; // Dividend >2%
                            break;
                        case 'growth':
                            params.revenueGrowthMin = 0.15; // Revenue growth >15%
                            params.epsGrowthMin = 0.15;     // EPS growth >15%
                            break;
                        case 'dividend':
                            params.dividendYieldMin = 0.03; // Dividend >3%
                            params.payoutRatioMax = 0.75;   // Payout ratio <75%
                            break;
                        case 'quality':
                            params.returnOnEquityMin = 0.15; // ROE >15%
                            params.debtToEquityMax = 1.0;    // D/E <1.0
                            break;
                    }
                });
                break;
                
            case 'search':
                if (values.length > 0 && values[0].trim() !== '') {
                    params.search = values[0];
                }
                break;
        }
    });
    
    console.log('Converted params:', params);
    return params;
}

/**
 * Load stocks page with current filters
 * @param {number} page - The page number to load
 * @param {number} pageSize - The number of items per page
 */
function loadStocksPage(page, pageSize) {
    console.log('loadStocksPage called with page:', page, 'pageSize:', pageSize);
    
    // Update pagination state
    pagination.page = page;
    pagination.pageSize = pageSize;
    
    // Create URL parameters
    const params = new URLSearchParams({
        page: page,
        pageSize: pageSize
    });
    
    console.log('Active filters:', activeFilters);
    
    // Add filter parameters
    const filterParams = convertFiltersToBackendParams(activeFilters);
    Object.keys(filterParams).forEach(key => {
        params.append(key, filterParams[key]);
    });
    
    // Build API URL
    const apiUrl = `/api/stocks?${params.toString()}`;
    console.log('API request URL:', apiUrl);
    
    // Fetch stocks from API
    fetch(apiUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('API response:', data);
            
            if (!data || !data.stocks || !Array.isArray(data.stocks)) {
                throw new Error('Invalid API response format');
            }
            
            // Update pagination state
            pagination.totalPages = data.pagination.totalPages;
            pagination.totalItems = data.pagination.totalItems;
            
            // Update pagination controls
            paginationControls.update(pagination.page, pagination.totalPages);
            
            // Update stats display
            updateStatsDisplay(data.stats);
            
            // Render stocks
            const viewMode = document.getElementById('card-view-button').classList.contains('active') ? 'card' : 'table';
            renderStocks(data.stocks, viewMode);
        })
        .catch(error => {
            console.error('Error loading stocks:', error);
            // Show error message to user
            document.getElementById('stock-cards-container').innerHTML = `
                <div class="error-message">
                    <p>Error loading stocks. Please try again later.</p>
                    <p>Details: ${error.message}</p>
                </div>
            `;
        });
}

/**
 * Update stats display with current data
 * @param {Object} stats - The stats object from API
 */
function updateStatsDisplay(stats) {
    document.getElementById('total-stocks').textContent = stats.total.toLocaleString();
    document.getElementById('nyse-stocks').textContent = stats.nyse.toLocaleString();
    document.getElementById('nasdaq-stocks').textContent = stats.nasdaq.toLocaleString();
    
    // Update last updated timestamp
    const lastUpdated = new Date(stats.lastUpdated);
    document.getElementById('last-updated').textContent = `${lastUpdated.toLocaleDateString()}, ${lastUpdated.toLocaleTimeString()}`;
}

/**
 * Switch between card and table view
 * @param {string} viewMode - The view mode ('card' or 'table')
 */
function switchView(viewMode) {
    const cardViewButton = document.getElementById('card-view-button');
    const tableViewButton = document.getElementById('table-view-button');
    
    if (viewMode === 'card') {
        cardViewButton.classList.add('active');
        tableViewButton.classList.remove('active');
    } else {
        tableViewButton.classList.add('active');
        cardViewButton.classList.remove('active');
    }
    
    // Re-render current data in new view
    const stocksContainer = document.getElementById('stock-cards-container');
    if (stocksContainer.dataset.stocks) {
        const stocks = JSON.parse(stocksContainer.dataset.stocks);
        renderStocks(stocks, viewMode);
    }
}

/**
 * Export current stocks data as CSV
 */
function exportCSV() {
    const stocksContainer = document.getElementById('stock-cards-container');
    if (!stocksContainer.dataset.stocks) {
        alert('No data to export');
        return;
    }
    
    const stocks = JSON.parse(stocksContainer.dataset.stocks);
    if (!stocks.length) {
        alert('No data to export');
        return;
    }
    
    // Create CSV header
    const headers = [
        'Symbol', 'Name', 'Exchange', 'Sector', 'Industry',
        'Price', 'Market Cap', 'P/E Ratio', 'Dividend Yield',
        'Volume', 'Debt to Equity', 'ROE', 'EPS Growth'
    ];
    
    // Create CSV rows
    const rows = stocks.map(stock => [
        stock.symbol,
        stock.name,
        stock.exchange,
        stock.sector || 'N/A',
        stock.industry || 'N/A',
        stock.price || 'N/A',
        stock.marketCap || 'N/A',
        stock.peRatio || 'N/A',
        stock.dividendYield || 'N/A',
        stock.volume || 'N/A',
        stock.debtToEquity || 'N/A',
        stock.returnOnEquity || 'N/A',
        stock.epsGrowth || 'N/A'
    ]);
    
    // Combine header and rows
    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
    ].join('\n');
    
    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'stocks.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * Handle search input
 * @param {Event} event - The input event
 */
function handleSearchInput(event) {
    const searchTerm = event.target.value.trim();
    
    // Clear existing search filter
    if (activeFilters.search) {
        delete activeFilters.search;
    }
    
    // Add new search filter if term is not empty
    if (searchTerm !== '') {
        activeFilters.search = [searchTerm];
    }
    
    // Debounce search to avoid too many requests
    clearTimeout(window.searchTimeout);
    window.searchTimeout = setTimeout(() => {
        loadStocksPage(1, pagination.pageSize);
    }, 500);
}

// Initialize event listeners when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('page loaded');
    
    // Initialize filter buttons
    document.querySelectorAll('.filter-button').forEach(button => {
        button.addEventListener('click', () => toggleFilter(button));
    });
    
    // Initialize preset buttons
    document.querySelectorAll('button[data-preset]').forEach(button => {
        button.addEventListener('click', () => togglePreset(button));
    });
    
    // Initialize reset button
    document.querySelector('button[data-action="reset-filters"]').addEventListener('click', resetFilters);
    
    // Initialize view mode buttons
    document.getElementById('card-view-button').addEventListener('click', () => switchView('card'));
    document.getElementById('table-view-button').addEventListener('click', () => switchView('table'));
    
    // Initialize export button
    document.getElementById('export-csv-button').addEventListener('click', exportCSV);
    
    // Initialize search input
    document.getElementById('search-input').addEventListener('input', handleSearchInput);
    
    // Load initial data
    loadStocksPage(1, pagination.pageSize);
});

// Export functions to global scope for accessibility
window.toggleFilter = toggleFilter;
window.togglePreset = togglePreset;
window.resetFilters = resetFilters;
window.loadStocksPage = loadStocksPage;
window.activeFilters = activeFilters;