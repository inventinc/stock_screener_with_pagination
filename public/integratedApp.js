/**
 * Integrated application with advanced filters and optimized batch loading
 * Preserves original UI while adding advanced filtering capabilities
 */
document.addEventListener('DOMContentLoaded', function() {
    // Initialize components
    const dataManager = new EnhancedDataManager({
        apiEndpoint: '/api/stocks',
        advancedApiEndpoint: '/api/advancedFilters',
        batchSize: 75, // Load 75 stocks per batch
        progressCallback: updateLoadingProgress,
        completeCallback: handleLoadingComplete,
        batchLoadedCallback: handleBatchLoaded
    });
    
    const stockCard = new AdvancedStockCard();
    let currentView = 'card';
    let currentFilters = {};
    let isAdvancedFiltersVisible = false;
    
    // Create advanced filters container
    const advancedFiltersContainer = document.createElement('div');
    advancedFiltersContainer.id = 'advanced-filters-container';
    advancedFiltersContainer.style.display = 'none';
    
    // Insert advanced filters container after regular filters
    const filtersSection = document.querySelector('.filters-section');
    filtersSection.parentNode.insertBefore(advancedFiltersContainer, filtersSection.nextSibling);
    
    // Initialize advanced filters
    const advancedFilters = new AdvancedFilters({
        container: advancedFiltersContainer,
        onFilterChange: handleAdvancedFilterChange
    });
    
    // Add advanced filters toggle button
    const filtersHeader = document.querySelector('.filters-header');
    const advancedFiltersToggle = document.createElement('button');
    advancedFiltersToggle.id = 'advanced-filters-toggle';
    advancedFiltersToggle.textContent = 'Advanced Filters';
    advancedFiltersToggle.className = 'advanced-filters-toggle';
    advancedFiltersToggle.style.marginLeft = 'auto';
    advancedFiltersToggle.style.marginRight = '10px';
    advancedFiltersToggle.style.padding = '5px 10px';
    advancedFiltersToggle.style.backgroundColor = '#f0f0f0';
    advancedFiltersToggle.style.border = '1px solid #ccc';
    advancedFiltersToggle.style.borderRadius = '4px';
    advancedFiltersToggle.style.cursor = 'pointer';
    
    // Insert advanced filters toggle before the existing toggle
    filtersHeader.insertBefore(advancedFiltersToggle, document.querySelector('.filters-toggle'));
    
    // Add event listener for advanced filters toggle
    advancedFiltersToggle.addEventListener('click', function() {
        isAdvancedFiltersVisible = !isAdvancedFiltersVisible;
        advancedFiltersContainer.style.display = isAdvancedFiltersVisible ? 'block' : 'none';
        advancedFiltersToggle.textContent = isAdvancedFiltersVisible ? 'Basic Filters' : 'Advanced Filters';
    });
    
    // Initialize event listeners
    initEventListeners();
    
    // Load global stats
    loadGlobalStats();
    
    // Start loading stocks
    dataManager.loadNextBatch();
    
    // Initialize tooltip
    initTooltip();
    
    /**
     * Initialize event listeners
     */
    function initEventListeners() {
        // Filters toggle
        const filtersToggle = document.getElementById('filters-toggle');
        const filtersContent = document.getElementById('filters-content');
        
        if (filtersToggle && filtersContent) {
            filtersToggle.addEventListener('click', function() {
                const filtersToggleIcon = filtersToggle.querySelector('.filters-toggle');
                filtersContent.classList.toggle('collapsed');
                
                if (filtersToggleIcon) {
                    filtersToggleIcon.classList.toggle('collapsed');
                }
            });
        }
        
        // View buttons
        const viewButtons = document.querySelectorAll('.view-button');
        
        viewButtons.forEach(button => {
            button.addEventListener('click', function() {
                const view = this.getAttribute('data-view');
                
                // Update active button
                viewButtons.forEach(btn => btn.classList.remove('active'));
                this.classList.add('active');
                
                // Update view
                updateView(view);
            });
        });
        
        // Export CSV button
        const exportCsvBtn = document.getElementById('export-csv-btn');
        
        if (exportCsvBtn) {
            exportCsvBtn.addEventListener('click', exportCSV);
        }
        
        // Filter buttons
        const filterButtons = document.querySelectorAll('.filter-button');
        
        filterButtons.forEach(button => {
            button.addEventListener('click', function() {
                const filter = this.getAttribute('data-filter');
                const value = this.getAttribute('data-value');
                
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
            resetFiltersBtn.addEventListener('click', resetFilters);
        }
        
        // Search input
        const searchInput = document.getElementById('search-input');
        
        if (searchInput) {
            searchInput.addEventListener('input', debounce(function() {
                updateSearchFilter(this.value);
            }, 300));
        }
        
        // Info icons for tooltips
        const infoIcons = document.querySelectorAll('.info-icon');
        
        infoIcons.forEach(icon => {
            icon.addEventListener('mouseenter', function(e) {
                const tooltip = document.getElementById('tooltip');
                if (tooltip) {
                    tooltip.textContent = this.getAttribute('title');
                    tooltip.style.display = 'block';
                    tooltip.style.left = e.pageX + 10 + 'px';
                    tooltip.style.top = e.pageY + 10 + 'px';
                }
            });
            
            icon.addEventListener('mouseleave', function() {
                const tooltip = document.getElementById('tooltip');
                if (tooltip) {
                    tooltip.style.display = 'none';
                }
            });
        });
        
        // Load more button
        window.addEventListener('scroll', debounce(function() {
            if (isNearBottom()) {
                loadMoreStocks();
            }
        }, 200));
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
        }
    }
    
    /**
     * Check if user has scrolled near the bottom of the page
     * @returns {Boolean} Whether user is near bottom
     */
    function isNearBottom() {
        return window.innerHeight + window.scrollY >= document.body.offsetHeight - 500;
    }
    
    /**
     * Load more stocks
     */
    function loadMoreStocks() {
        // If using advanced filters, load more filtered results
        if (Object.keys(advancedFilters.getFilters()).length > 0) {
            dataManager.loadMoreFilteredResults().then(stocks => {
                renderStocks(stocks);
            });
        } else {
            // Otherwise load next batch
            dataManager.loadNextBatch();
        }
    }
    
    /**
     * Update loading progress
     * @param {Number} loaded - Number of loaded stocks
     * @param {Number} total - Total number of stocks
     * @param {Boolean} fromCache - Whether stocks were loaded from cache
     */
    function updateLoadingProgress(loaded, total, fromCache = false) {
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
        console.log(`Loading complete, ${stocks.length} stocks loaded`);
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
        
        document.getElementById('nyse-stocks').textContent = nyseCount;
        document.getElementById('nasdaq-stocks').textContent = nasdaqCount;
    }
    
    /**
     * Load global stats from API
     */
    async function loadGlobalStats() {
        try {
            const response = await fetch('/api/globalStats?excludeETFs=true');
            const data = await response.json();
            
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
        // Apply filters
        const filteredStocks = dataManager.getFilteredStocks(currentFilters);
        
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
        const container = document.getElementById('stock-cards-container');
        
        // Clear loading message
        const loadingMessage = container.querySelector('.loading-message');
        if (loadingMessage) {
            container.removeChild(loadingMessage);
        }
        
        // Clear existing cards
        container.innerHTML = '';
        
        // Render cards
        stocks.forEach(stock => {
            const cardHTML = stockCard.generateCardHTML(stock);
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = cardHTML;
            container.appendChild(tempDiv.firstElementChild);
        });
        
        // Show no results message if no stocks
        if (stocks.length === 0) {
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
        const container = document.getElementById('stock-table-container');
        const tableBody = document.getElementById('stock-table-body');
        
        // Show table container
        container.style.display = 'block';
        
        // Clear existing rows
        tableBody.innerHTML = '';
        
        // Render rows
        stocks.forEach(stock => {
            const rowHTML = stockCard.generateTableRowHTML(stock);
            tableBody.insertAdjacentHTML('beforeend', rowHTML);
        });
        
        // Show no results message if no stocks
        if (stocks.length === 0) {
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
        currentView = view;
        
        const cardContainer = document.getElementById('stock-cards-container');
        const tableContainer = document.getElementById('stock-table-container');
        
        if (view === 'card') {
            cardContainer.style.display = 'grid';
            tableContainer.style.display = 'none';
        } else if (view === 'table') {
            cardContainer.style.display = 'none';
            tableContainer.style.display = 'block';
        }
        
        // Re-render stocks
        renderStocks(dataManager.getAllStocks());
    }
    
    /**
     * Update filters
     * @param {String} filter - Filter type
     * @param {String} value - Filter value
     * @param {Boolean} active - Whether filter is active
     */
    function updateFilters(filter, value, active) {
        // Initialize filter array if it doesn't exist
        if (!currentFilters[filter]) {
            currentFilters[filter] = [];
        }
        
        if (active) {
            // Add filter value
            if (!currentFilters[filter].includes(value)) {
                currentFilters[filter].push(value);
            }
        } else {
            // Remove filter value
            currentFilters[filter] = currentFilters[filter].filter(v => v !== value);
            
            // Remove empty filter
            if (currentFilters[filter].length === 0) {
                delete currentFilters[filter];
            }
        }
        
        // Re-render stocks
        renderStocks(dataManager.getAllStocks());
    }
    
    /**
     * Update preset filter
     * @param {String} preset - Preset value
     * @param {Boolean} active - Whether preset is active
     */
    function updatePresetFilter(preset, active) {
        if (active) {
            // Set preset filter
            currentFilters.preset = preset;
        } else {
            // Remove preset filter
            delete currentFilters.preset;
        }
        
        // Re-render stocks
        renderStocks(dataManager.getAllStocks());
    }
    
    /**
     * Update search filter
     * @param {String} query - Search query
     */
    function updateSearchFilter(query) {
        if (query && query.trim() !== '') {
            // Set search filter
            currentFilters.search = query.trim();
        } else {
            // Remove search filter
            delete currentFilters.search;
        }
        
        // Re-render stocks
        renderStocks(dataManager.getAllStocks());
    }
    
    /**
     * Reset filters
     */
    function resetFilters() {
        // Clear filters
        currentFilters = {};
        
        // Reset filter buttons
        document.querySelectorAll('.filter-button').forEach(button => {
            button.classList.remove('active');
        });
        
        // Reset preset buttons
        document.querySelectorAll('.preset-button').forEach(button => {
            button.classList.remove('active');
        });
        
        // Reset search input
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.value = '';
        }
        
        // Re-render stocks
        renderStocks(dataManager.getAllStocks());
    }
    
    /**
     * Handle advanced filter change
     * @param {Object} filters - Advanced filter values
     */
    function handleAdvancedFilterChange(filters) {
        // Apply advanced filters
        dataManager.applyAdvancedFilters(filters).then(stocks => {
            // Render filtered stocks
            renderStocks(stocks);
        });
    }
    
    /**
     * Export stocks to CSV
     */
    function exportCSV() {
        // Get filtered stocks
        const stocks = dataManager.getFilteredStocks(currentFilters);
        
        // Create CSV content
        let csv = 'Symbol,Name,Exchange,Price,Market Cap,P/E Ratio,Dividend Yield,Debt/EBITDA,ROTCE,Score\n';
        
        stocks.forEach(stock => {
            csv += [
                stock.symbol || stock.ticker || '',
                `"${(stock.name || '').replace(/"/g, '""')}"`,
                stock.exchange || stock.primary_exchange || '',
                stock.price || (stock.last_trade && stock.last_trade.p) || 0,
                stock.market_cap || stock.marketCap || 0,
                stock.pe_ratio || stock.peRatio || 0,
                stock.dividend_yield || stock.dividendYield || 0,
                stock.financials?.debt_to_ebitda || 0,
                stock.financials?.rotce || 0,
                stock.score || 0
            ].join(',') + '\n';
        });
        
        // Create download link
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
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
            timeout = setTimeout(() => func.apply(context, args), wait);
        };
    }
});
