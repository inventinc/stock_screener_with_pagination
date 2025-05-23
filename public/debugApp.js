/**
 * Debug version of the application with console logging
 * This version adds extensive logging to identify where data loading is failing
 */
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM fully loaded - initializing application');
    
    // Initialize components with debug logging
    console.log('Creating EnhancedDataManager instance');
    const dataManager = new EnhancedDataManager({
        apiEndpoint: '/api/stocks',
        advancedApiEndpoint: '/api/advancedFilters',
        batchSize: 75, // Load 75 stocks per batch
        progressCallback: updateLoadingProgress,
        completeCallback: handleLoadingComplete,
        batchLoadedCallback: handleBatchLoaded
    });
    
    console.log('Creating AdvancedStockCard instance');
    const stockCard = new AdvancedStockCard();
    let currentView = 'card';
    let currentFilters = {};
    
    // Initialize event listeners
    console.log('Initializing event listeners');
    initEventListeners();
    
    // Load global stats
    console.log('Loading global stats');
    loadGlobalStats();
    
    // Start loading stocks with explicit error handling
    console.log('Starting to load first batch of stocks');
    try {
        dataManager.loadNextBatch().catch(error => {
            console.error('Error loading first batch:', error);
        });
    } catch (error) {
        console.error('Exception during loadNextBatch call:', error);
    }
    
    // Initialize tooltip
    console.log('Initializing tooltip');
    initTooltip();
    
    /**
     * Initialize event listeners
     */
    function initEventListeners() {
        console.log('Setting up event listeners');
        
        // View buttons
        const viewButtons = document.querySelectorAll('.view-button');
        
        viewButtons.forEach(button => {
            button.addEventListener('click', function() {
                const view = this.getAttribute('data-view');
                console.log(`View button clicked: ${view}`);
                
                // Update active button
                viewButtons.forEach(btn => btn.classList.remove('active'));
                this.classList.add('active');
                
                // Update view
                updateView(view);
            });
        });
        
        // Filter buttons
        const filterButtons = document.querySelectorAll('.filter-button');
        
        filterButtons.forEach(button => {
            button.addEventListener('click', function() {
                const filter = this.getAttribute('data-filter');
                const value = this.getAttribute('data-value');
                console.log(`Filter button clicked: ${filter}=${value}`);
                
                // Toggle active state
                this.classList.toggle('active');
                
                // Update filters
                updateFilters(filter, value, this.classList.contains('active'));
            });
        });
        
        // Preset buttons
        const presetButtons = document.querySelectorAll('.preset-button');
        
        presetButtons.forEach(button => {
            button.addEventListener('click', function() {
                const preset = this.getAttribute('data-preset');
                console.log(`Preset button clicked: ${preset}`);
                
                // Toggle active state
                const wasActive = this.classList.contains('active');
                
                // Reset all preset buttons
                presetButtons.forEach(btn => btn.classList.remove('active'));
                
                // If button wasn't active, make it active
                if (!wasActive) {
                    this.classList.add('active');
                }
                
                // Update filters
                updatePresetFilter(preset, !wasActive);
            });
        });
        
        // Reset filters button
        const resetFiltersBtn = document.getElementById('reset-filters-btn');
        
        if (resetFiltersBtn) {
            resetFiltersBtn.addEventListener('click', function() {
                console.log('Reset filters button clicked');
                resetFilters();
            });
        }
        
        // Search input
        const searchInput = document.getElementById('search-input');
        
        if (searchInput) {
            searchInput.addEventListener('input', debounce(function() {
                console.log(`Search input changed: ${this.value}`);
                updateSearchFilter(this.value);
            }, 300));
        }
        
        // Load more button
        const loadMoreBtn = document.getElementById('load-more-btn');
        
        if (loadMoreBtn) {
            loadMoreBtn.addEventListener('click', function() {
                console.log('Load more button clicked');
                loadMoreStocks();
            });
        }
    }
    
    /**
     * Initialize tooltip
     */
    function initTooltip() {
        // Create tooltip element if it doesn't exist
        if (!document.getElementById('tooltip')) {
            const tooltip = document.createElement('div');
            tooltip.id = 'tooltip';
            document.body.appendChild(tooltip);
            console.log('Tooltip element created');
        }
    }
    
    /**
     * Load more stocks
     */
    function loadMoreStocks() {
        console.log('Loading more stocks');
        try {
            dataManager.loadNextBatch().catch(error => {
                console.error('Error loading next batch:', error);
            });
        } catch (error) {
            console.error('Exception during loadMoreStocks:', error);
        }
    }
    
    /**
     * Update loading progress
     * @param {Number} loaded - Number of loaded stocks
     * @param {Number} total - Total number of stocks
     * @param {Boolean} fromCache - Whether stocks were loaded from cache
     */
    function updateLoadingProgress(loaded, total, fromCache = false) {
        console.log(`Loading progress: ${loaded}/${total} stocks${fromCache ? ' (from cache)' : ''}`);
        
        // Update stats
        document.getElementById('total-stocks').textContent = loaded;
        
        // Update last updated
        const now = new Date();
        document.getElementById('last-updated').textContent = now.toLocaleTimeString();
        
        // Update API status
        document.getElementById('api-status-indicator').className = 'api-status-indicator connected';
        document.getElementById('api-status-text').textContent = 'connected';
    }
    
    /**
     * Handle batch loaded
     * @param {Array} stocks - Loaded stocks
     * @param {Boolean} fromCache - Whether stocks were loaded from cache
     */
    function handleBatchLoaded(stocks, fromCache = false) {
        console.log(`Batch loaded: ${stocks ? stocks.length : 0} stocks${fromCache ? ' (from cache)' : ''}`);
        
        if (!stocks || stocks.length === 0) {
            console.warn('No stocks in batch');
            return;
        }
        
        console.log('First stock in batch:', stocks[0]);
        
        // Update exchange counts
        updateExchangeCounts(stocks);
        
        // Render stocks
        renderStocks(stocks);
    }
    
    /**
     * Handle loading complete
     * @param {Array} stocks - All loaded stocks
     */
    function handleLoadingComplete(stocks) {
        console.log(`Loading complete, ${stocks ? stocks.length : 0} stocks loaded`);
    }
    
    /**
     * Update exchange counts
     * @param {Array} stocks - Stocks to count
     */
    function updateExchangeCounts(stocks) {
        let nyseCount = 0;
        let nasdaqCount = 0;
        
        stocks.forEach(stock => {
            const exchange = (stock.exchange || stock.primary_exchange || '').toUpperCase();
            
            if (exchange.includes('NYSE') || exchange.includes('XNYS')) {
                nyseCount++;
            } else if (exchange.includes('NASDAQ') || exchange.includes('XNAS')) {
                nasdaqCount++;
            }
        });
        
        console.log(`Exchange counts: NYSE=${nyseCount}, NASDAQ=${nasdaqCount}`);
        
        document.getElementById('nyse-stocks').textContent = nyseCount;
        document.getElementById('nasdaq-stocks').textContent = nasdaqCount;
    }
    
    /**
     * Load global stats from API
     */
    async function loadGlobalStats() {
        console.log('Loading global stats from API');
        try {
            const response = await fetch('/api/globalStats?excludeETFs=true');
            const data = await response.json();
            
            console.log('Global stats loaded:', data);
            
            // Update stats
            document.getElementById('total-stocks').textContent = data.total;
            document.getElementById('nyse-stocks').textContent = data.nyse;
            document.getElementById('nasdaq-stocks').textContent = data.nasdaq;
            
            // Update last updated
            const lastUpdated = new Date(data.lastUpdated);
            document.getElementById('last-updated').textContent = lastUpdated.toLocaleTimeString();
            
            // Update API status
            document.getElementById('api-status-indicator').className = 'api-status-indicator connected';
            document.getElementById('api-status-text').textContent = 'connected';
        } catch (error) {
            console.error('Error loading global stats:', error);
            
            // Update API status
            document.getElementById('api-status-indicator').className = 'api-status-indicator disconnected';
            document.getElementById('api-status-text').textContent = 'disconnected';
        }
    }
    
    /**
     * Render stocks
     * @param {Array} stocks - Stocks to render
     */
    function renderStocks(stocks) {
        console.log(`Rendering ${stocks ? stocks.length : 0} stocks`);
        
        if (!stocks || stocks.length === 0) {
            console.warn('No stocks to render');
            return;
        }
        
        // Apply filters
        const filteredStocks = dataManager.getFilteredStocks(currentFilters);
        console.log(`Filtered stocks: ${filteredStocks.length}`);
        
        // Render based on current view
        if (currentView === 'card') {
            renderCardView(filteredStocks);
        } else if (currentView === 'table') {
            renderTableView(filteredStocks);
        }
    }
    
    /**
     * Render card view
     * @param {Array} stocks - Stocks to render
     */
    function renderCardView(stocks) {
        console.log(`Rendering card view with ${stocks.length} stocks`);
        
        const container = document.getElementById('stock-cards-container');
        
        if (!container) {
            console.error('Stock cards container not found');
            return;
        }
        
        // Clear loading message
        const loadingMessage = container.querySelector('.loading-message');
        if (loadingMessage) {
            container.removeChild(loadingMessage);
        }
        
        // Clear existing cards
        container.innerHTML = '';
        
        // Render cards
        stocks.forEach((stock, index) => {
            try {
                console.log(`Generating card for stock ${index}: ${stock.symbol}`);
                const cardHTML = stockCard.generateCardHTML(stock);
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = cardHTML;
                container.appendChild(tempDiv.firstElementChild);
            } catch (error) {
                console.error(`Error generating card for stock ${stock.symbol}:`, error);
            }
        });
        
        // Show no results message if no stocks
        if (stocks.length === 0) {
            console.log('No stocks to display, showing empty message');
            const noResults = document.createElement('div');
            noResults.className = 'no-results';
            noResults.style.gridColumn = '1 / -1';
            noResults.style.textAlign = 'center';
            noResults.style.padding = '40px';
            noResults.textContent = 'No stocks match your filters';
            container.appendChild(noResults);
        }
    }
    
    /**
     * Render table view
     * @param {Array} stocks - Stocks to render
     */
    function renderTableView(stocks) {
        console.log(`Rendering table view with ${stocks.length} stocks`);
        
        const container = document.getElementById('stock-table-container');
        const tableBody = document.getElementById('stock-table-body');
        
        if (!container || !tableBody) {
            console.error('Stock table container or body not found');
            return;
        }
        
        // Show table container
        container.style.display = 'block';
        
        // Clear existing rows
        tableBody.innerHTML = '';
        
        // Render rows
        stocks.forEach((stock, index) => {
            try {
                console.log(`Generating table row for stock ${index}: ${stock.symbol}`);
                const rowHTML = stockCard.generateTableRowHTML(stock);
                tableBody.insertAdjacentHTML('beforeend', rowHTML);
            } catch (error) {
                console.error(`Error generating table row for stock ${stock.symbol}:`, error);
            }
        });
        
        // Show no results message if no stocks
        if (stocks.length === 0) {
            console.log('No stocks to display in table, showing empty message');
            const noResults = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = 12;
            cell.style.textAlign = 'center';
            cell.style.padding = '20px';
            cell.textContent = 'No stocks match your filters';
            noResults.appendChild(cell);
            tableBody.appendChild(noResults);
        }
    }
    
    /**
     * Update view
     * @param {String} view - View to show ('card' or 'table')
     */
    function updateView(view) {
        console.log(`Updating view to: ${view}`);
        currentView = view;
        
        const cardContainer = document.getElementById('stock-cards-container');
        const tableContainer = document.getElementById('stock-table-container');
        
        if (!cardContainer || !tableContainer) {
            console.error('Card or table container not found');
            return;
        }
        
        if (view === 'card') {
            cardContainer.style.display = 'grid';
            tableContainer.style.display = 'none';
        } else if (view === 'table') {
            cardContainer.style.display = 'none';
            tableContainer.style.display = 'block';
        }
        
        // Re-render stocks
        const allStocks = dataManager.getAllStocks();
        console.log(`Re-rendering ${allStocks ? allStocks.length : 0} stocks for view change`);
        renderStocks(allStocks);
    }
    
    /**
     * Update filters
     * @param {String} filter - Filter type
     * @param {String} value - Filter value
     * @param {Boolean} active - Whether filter is active
     */
    function updateFilters(filter, value, active) {
        console.log(`Updating filter: ${filter}=${value}, active=${active}`);
        
        // Initialize filter array if it doesn't exist
        if (!currentFilters[filter]) {
            currentFilters[filter] = [];
        }
        
        if (active) {
            // Add filter value if not already present
            if (!currentFilters[filter].includes(value)) {
                currentFilters[filter].push(value);
            }
        } else {
            // Remove filter value
            currentFilters[filter] = currentFilters[filter].filter(v => v !== value);
            
            // Remove empty filter arrays
            if (currentFilters[filter].length === 0) {
                delete currentFilters[filter];
            }
        }
        
        console.log('Current filters:', currentFilters);
        
        // Re-render stocks
        renderStocks(dataManager.getAllStocks());
    }
    
    /**
     * Update preset filter
     * @param {String} preset - Preset name
     * @param {Boolean} active - Whether preset is active
     */
    function updatePresetFilter(preset, active) {
        console.log(`Updating preset filter: ${preset}, active=${active}`);
        
        // Clear existing filters
        currentFilters = {};
        
        // Apply preset filters if active
        if (active) {
            if (preset === 'value') {
                currentFilters.preset = ['value'];
            } else if (preset === 'growth') {
                currentFilters.preset = ['growth'];
            } else if (preset === 'dividend') {
                currentFilters.preset = ['dividend'];
            } else if (preset === 'quality') {
                currentFilters.preset = ['quality'];
            }
        }
        
        console.log('Current filters after preset:', currentFilters);
        
        // Reset filter buttons
        const filterButtons = document.querySelectorAll('.filter-button');
        filterButtons.forEach(button => button.classList.remove('active'));
        
        // Re-render stocks
        renderStocks(dataManager.getAllStocks());
    }
    
    /**
     * Update search filter
     * @param {String} query - Search query
     */
    function updateSearchFilter(query) {
        console.log(`Updating search filter: "${query}"`);
        
        if (query && query.trim() !== '') {
            currentFilters.search = query.trim();
        } else {
            delete currentFilters.search;
        }
        
        console.log('Current filters after search:', currentFilters);
        
        // Re-render stocks
        renderStocks(dataManager.getAllStocks());
    }
    
    /**
     * Reset filters
     */
    function resetFilters() {
        console.log('Resetting all filters');
        
        // Clear filters
        currentFilters = {};
        
        // Reset filter buttons
        const filterButtons = document.querySelectorAll('.filter-button');
        filterButtons.forEach(button => button.classList.remove('active'));
        
        // Reset preset buttons
        const presetButtons = document.querySelectorAll('.preset-button');
        presetButtons.forEach(button => button.classList.remove('active'));
        
        // Reset search input
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.value = '';
        }
        
        // Re-render stocks
        renderStocks(dataManager.getAllStocks());
    }
    
    /**
     * Export stocks to CSV
     */
    function exportCSV() {
        console.log('Exporting stocks to CSV');
        
        // Get filtered stocks
        const stocks = dataManager.getFilteredStocks(currentFilters);
        
        if (!stocks || stocks.length === 0) {
            console.warn('No stocks to export');
            alert('No stocks to export');
            return;
        }
        
        // Get headers from first stock
        const headers = [
            'Symbol',
            'Name',
            'Exchange',
            'Price',
            'Market Cap',
            'P/E Ratio',
            'Dividend Yield',
            'Score'
        ];
        
        // Create CSV content
        let csvContent = headers.join(',') + '\n';
        
        stocks.forEach(stock => {
            const row = [
                `"${stock.symbol}"`,
                `"${stock.name}"`,
                `"${stock.exchange}"`,
                stock.price,
                stock.market_cap,
                stock.pe_ratio,
                stock.dividend_yield,
                stock.score
            ];
            
            csvContent += row.join(',') + '\n';
        });
        
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
     * Debounce function
     * @param {Function} func - Function to debounce
     * @param {Number} wait - Wait time in milliseconds
     * @returns {Function} Debounced function
     */
    function debounce(func, wait) {
        let timeout;
        return function() {
            const context = this;
            const args = arguments;
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                func.apply(context, args);
            }, wait);
        };
    }
});
