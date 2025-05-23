/**
 * Direct Filter Solution for Stock Screener
 * 
 * This script directly modifies the DOM to add filter functionality
 * by attaching event listeners to filter buttons and making API calls.
 */
(function() {
    console.log('Direct Filter Solution: Initializing');
    
    // Store active filters
    const activeFilters = {};
    
    // Store current page data
    let currentPage = 1;
    let pageSize = 50;
    let totalPages = 1;
    
    // Initialize when DOM is loaded
    document.addEventListener('DOMContentLoaded', initialize);
    
    // If DOM is already loaded, initialize immediately
    if (document.readyState === 'interactive' || document.readyState === 'complete') {
        initialize();
    }
    
    /**
     * Initialize the filter system
     */
    function initialize() {
        console.log('Direct Filter Solution: Setting up filter system');
        
        // Set up filter buttons
        setupFilterButtons();
        
        // Set up search input
        setupSearchInput();
        
        // Set up view toggle buttons
        setupViewToggle();
        
        // Load initial data
        loadStocksPage(1);
    }
    
    /**
     * Set up filter buttons
     */
    function setupFilterButtons() {
        // Market cap filters
        document.querySelectorAll('button[data-filter="market_cap"]').forEach(button => {
            button.addEventListener('click', function() {
                toggleFilter(this, 'market_cap');
            });
        });
        
        // Volume filters
        document.querySelectorAll('button[data-filter="volume"]').forEach(button => {
            button.addEventListener('click', function() {
                toggleFilter(this, 'volume');
            });
        });
        
        // Debt filters
        document.querySelectorAll('button[data-filter="debt"]').forEach(button => {
            button.addEventListener('click', function() {
                toggleFilter(this, 'debt');
            });
        });
        
        // Valuation filters
        document.querySelectorAll('button[data-filter="valuation"]').forEach(button => {
            button.addEventListener('click', function() {
                toggleFilter(this, 'valuation');
            });
        });
        
        // Preset buttons
        document.querySelectorAll('button[data-preset]').forEach(button => {
            button.addEventListener('click', function() {
                togglePreset(this);
            });
        });
        
        // Reset button
        const resetButton = document.querySelector('button:contains("Reset Filters")');
        if (resetButton) {
            resetButton.addEventListener('click', resetFilters);
        }
    }
    
    /**
     * Toggle filter state
     * @param {HTMLElement} button - The clicked button
     * @param {String} filterType - Type of filter
     */
    function toggleFilter(button, filterType) {
        // Toggle active class
        button.classList.toggle('active');
        const isActive = button.classList.contains('active');
        
        // Get filter value
        const value = button.dataset.value;
        
        // Update active filters
        if (!activeFilters[filterType]) {
            activeFilters[filterType] = [];
        }
        
        if (isActive) {
            // Add filter value
            if (!activeFilters[filterType].includes(value)) {
                activeFilters[filterType].push(value);
            }
        } else {
            // Remove filter value
            const index = activeFilters[filterType].indexOf(value);
            if (index !== -1) {
                activeFilters[filterType].splice(index, 1);
            }
            
            // Remove empty filter
            if (activeFilters[filterType].length === 0) {
                delete activeFilters[filterType];
            }
        }
        
        console.log(`Direct Filter Solution: Applied ${filterType} filter:`, activeFilters[filterType]);
        
        // Reload data with filters
        loadStocksPage(1);
    }
    
    /**
     * Toggle preset filter
     * @param {HTMLElement} button - The clicked button
     */
    function togglePreset(button) {
        // Toggle active class
        button.classList.toggle('active');
        const isActive = button.classList.contains('active');
        
        // Get preset value
        const preset = button.dataset.preset;
        
        // Update active filters
        if (isActive) {
            // Add preset
            activeFilters.preset = preset;
            
            // Deactivate other presets
            document.querySelectorAll('button[data-preset]').forEach(btn => {
                if (btn !== button) {
                    btn.classList.remove('active');
                }
            });
        } else {
            // Remove preset
            delete activeFilters.preset;
        }
        
        console.log(`Direct Filter Solution: Applied preset filter:`, preset);
        
        // Reload data with filters
        loadStocksPage(1);
    }
    
    /**
     * Reset all filters
     */
    function resetFilters() {
        // Clear all active classes
        document.querySelectorAll('.filter-button, button[data-filter], button[data-preset]').forEach(button => {
            button.classList.remove('active');
        });
        
        // Clear search input
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.value = '';
        }
        
        // Clear active filters
        Object.keys(activeFilters).forEach(key => {
            delete activeFilters[key];
        });
        
        console.log('Direct Filter Solution: Reset all filters');
        
        // Reload data without filters
        loadStocksPage(1);
    }
    
    /**
     * Set up search input
     */
    function setupSearchInput() {
        const searchInput = document.getElementById('search-input');
        if (!searchInput) return;
        
        // Use debounce to avoid too many requests
        let debounceTimeout;
        
        searchInput.addEventListener('input', function() {
            clearTimeout(debounceTimeout);
            
            debounceTimeout = setTimeout(() => {
                const searchValue = searchInput.value.trim();
                
                // Update search filter
                if (searchValue) {
                    activeFilters.search = searchValue;
                } else {
                    delete activeFilters.search;
                }
                
                console.log(`Direct Filter Solution: Applied search filter:`, searchValue);
                
                // Reload data with filters
                loadStocksPage(1);
            }, 500);
        });
    }
    
    /**
     * Set up view toggle buttons
     */
    function setupViewToggle() {
        const cardsButton = document.querySelector('button:contains("Cards")');
        const tableButton = document.querySelector('button:contains("Table")');
        
        if (cardsButton) {
            cardsButton.addEventListener('click', function() {
                setActiveView('cards');
            });
        }
        
        if (tableButton) {
            tableButton.addEventListener('click', function() {
                setActiveView('table');
            });
        }
    }
    
    /**
     * Set active view
     * @param {String} view - View type ('cards' or 'table')
     */
    function setActiveView(view) {
        // Update active view
        const activeView = view;
        
        // Update button states
        document.querySelector('button:contains("Cards")').classList.toggle('active', view === 'cards');
        document.querySelector('button:contains("Table")').classList.toggle('active', view === 'table');
        
        // Update view container
        const stocksContainer = document.getElementById('stocks-container');
        if (stocksContainer) {
            stocksContainer.className = `stocks-container ${view}-view`;
        }
        
        console.log(`Direct Filter Solution: Set view to ${view}`);
    }
    
    /**
     * Load stocks page with filters
     * @param {Number} page - Page number to load
     */
    function loadStocksPage(page) {
        console.log(`Direct Filter Solution: Loading page ${page} with filters:`, activeFilters);
        
        // Update current page
        currentPage = page;
        
        // Show loading state
        showLoading(true);
        
        // Build API URL with filters
        const apiUrl = buildApiUrl(page);
        
        // Fetch data from API
        fetch(apiUrl)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                // Update pagination
                updatePagination(data.pagination);
                
                // Render stocks
                renderStocks(data.stocks);
                
                // Hide loading state
                showLoading(false);
            })
            .catch(error => {
                console.error('Error loading stocks:', error);
                showLoading(false);
            });
    }
    
    /**
     * Build API URL with filters
     * @param {Number} page - Page number to load
     * @returns {String} API URL with query parameters
     */
    function buildApiUrl(page) {
        // Start with base URL
        const baseUrl = '/api/stocks';
        
        // Build query parameters
        const params = new URLSearchParams();
        
        // Add pagination parameters
        params.append('page', page);
        params.append('pageSize', pageSize);
        
        // Add filter parameters
        if (activeFilters.market_cap && activeFilters.market_cap.length) {
            activeFilters.market_cap.forEach(value => {
                params.append('market_cap', value);
            });
        }
        
        if (activeFilters.volume && activeFilters.volume.length) {
            activeFilters.volume.forEach(value => {
                params.append('volume', value);
            });
        }
        
        if (activeFilters.debt && activeFilters.debt.length) {
            activeFilters.debt.forEach(value => {
                params.append('debt', value);
            });
        }
        
        if (activeFilters.valuation && activeFilters.valuation.length) {
            activeFilters.valuation.forEach(value => {
                params.append('valuation', value);
            });
        }
        
        if (activeFilters.preset) {
            params.append('preset', activeFilters.preset);
        }
        
        if (activeFilters.search) {
            params.append('search', activeFilters.search);
        }
        
        // Build full URL
        return `${baseUrl}?${params.toString()}`;
    }
    
    /**
     * Show or hide loading state
     * @param {Boolean} isLoading - Whether loading is in progress
     */
    function showLoading(isLoading) {
        const loadingIndicator = document.getElementById('loading-indicator');
        if (loadingIndicator) {
            loadingIndicator.style.display = isLoading ? 'block' : 'none';
        }
        
        const stocksContainer = document.getElementById('stocks-container');
        if (stocksContainer) {
            stocksContainer.classList.toggle('loading', isLoading);
        }
    }
    
    /**
     * Update pagination controls
     * @param {Object} pagination - Pagination data
     */
    function updatePagination(pagination) {
        // Update pagination state
        currentPage = pagination.page || 1;
        totalPages = pagination.pages || 1;
        
        // Update pagination controls if they exist
        const paginationContainer = document.getElementById('pagination-container');
        if (paginationContainer && window.StockPagination) {
            // Clear existing pagination
            paginationContainer.innerHTML = '';
            
            // Create new pagination
            const paginationElement = window.StockPagination.createPagination({
                currentPage: currentPage,
                totalPages: totalPages,
                onPageChange: (page) => loadStocksPage(page),
                showPageSizeSelector: true,
                pageSize: pageSize,
                onPageSizeChange: (size) => {
                    pageSize = size;
                    loadStocksPage(1);
                }
            });
            
            // Add to container
            paginationContainer.appendChild(paginationElement);
        }
    }
    
    /**
     * Render stocks to the page
     * @param {Array} stocks - Array of stock objects
     */
    function renderStocks(stocks) {
        const stocksContainer = document.getElementById('stocks-container');
        if (!stocksContainer) return;
        
        // Clear existing stocks
        stocksContainer.innerHTML = '';
        
        if (!stocks || !stocks.length) {
            // Show no results message
            const noResults = document.createElement('div');
            noResults.className = 'no-results';
            noResults.textContent = 'No stocks found matching your criteria.';
            stocksContainer.appendChild(noResults);
            return;
        }
        
        // Determine current view
        const isCardView = stocksContainer.classList.contains('cards-view');
        
        // Render each stock
        stocks.forEach(stock => {
            const stockElement = isCardView ? 
                createStockCard(stock) : 
                createStockTableRow(stock);
            
            stocksContainer.appendChild(stockElement);
        });
    }
    
    /**
     * Create a stock card element
     * @param {Object} stock - Stock data
     * @returns {HTMLElement} Stock card element
     */
    function createStockCard(stock) {
        const card = document.createElement('div');
        card.className = 'stock-card';
        
        // Format market cap
        const marketCap = formatMarketCap(stock.marketCap);
        
        // Create card content
        card.innerHTML = `
            <div class="stock-symbol">${stock.symbol}</div>
            <div class="stock-exchange">${stock.exchange}</div>
            <div class="stock-name">${stock.name}</div>
            <div class="stock-details">
                <div class="stock-detail">
                    <span class="detail-label">Price</span>
                    <span class="detail-value">$${stock.price.toFixed(2)}</span>
                </div>
                <div class="stock-detail">
                    <span class="detail-label">Market Cap</span>
                    <span class="detail-value">${marketCap}</span>
                </div>
                <div class="stock-detail">
                    <span class="detail-label">P/E Ratio</span>
                    <span class="detail-value">${stock.pe ? stock.pe.toFixed(2) : 'N/A'}</span>
                </div>
                <div class="stock-detail">
                    <span class="detail-label">Dividend Yield</span>
                    <span class="detail-value">${stock.dividendYield ? (stock.dividendYield * 100).toFixed(2) + '%' : 'N/A'}</span>
                </div>
            </div>
        `;
        
        return card;
    }
    
    /**
     * Create a stock table row element
     * @param {Object} stock - Stock data
     * @returns {HTMLElement} Stock table row element
     */
    function createStockTableRow(stock) {
        const row = document.createElement('tr');
        row.className = 'stock-row';
        
        // Format market cap
        const marketCap = formatMarketCap(stock.marketCap);
        
        // Create row content
        row.innerHTML = `
            <td class="stock-symbol">${stock.symbol}</td>
            <td class="stock-name">${stock.name}</td>
            <td class="stock-exchange">${stock.exchange}</td>
            <td class="stock-price">$${stock.price.toFixed(2)}</td>
            <td class="stock-market-cap">${marketCap}</td>
            <td class="stock-pe">${stock.pe ? stock.pe.toFixed(2) : 'N/A'}</td>
            <td class="stock-dividend">${stock.dividendYield ? (stock.dividendYield * 100).toFixed(2) + '%' : 'N/A'}</td>
        `;
        
        return row;
    }
    
    /**
     * Format market cap value
     * @param {Number} marketCap - Market cap value
     * @returns {String} Formatted market cap
     */
    function formatMarketCap(marketCap) {
        if (!marketCap) return 'N/A';
        
        if (marketCap >= 1e12) {
            return '$' + (marketCap / 1e12).toFixed(2) + 'T';
        } else if (marketCap >= 1e9) {
            return '$' + (marketCap / 1e9).toFixed(2) + 'B';
        } else if (marketCap >= 1e6) {
            return '$' + (marketCap / 1e6).toFixed(2) + 'M';
        } else {
            return '$' + marketCap.toFixed(2);
        }
    }
    
    // Add a helper method for button selection by text content
    if (!document.querySelector.prototype.contains) {
        // Extend the querySelector method to support :contains
        const originalQuerySelector = document.querySelector;
        document.querySelector = function(selector) {
            if (selector.includes(':contains(')) {
                const match = selector.match(/:contains\("([^"]+)"\)/);
                if (match) {
                    const text = match[1];
                    const baseSelector = selector.replace(/:contains\("([^"]+)"\)/, '');
                    
                    const elements = document.querySelectorAll(baseSelector);
                    for (let i = 0; i < elements.length; i++) {
                        if (elements[i].textContent.includes(text)) {
                            return elements[i];
                        }
                    }
                    return null;
                }
            }
            return originalQuerySelector.call(this, selector);
        };
    }
})();
