/**
 * PaginatedStockApp - Stock screener application with pagination and adaptive card view
 * FINAL FIX VERSION - Combines pagination fix with direct DOM rendering
 * 
 * Features:
 * - Classic pagination with modern UX
 * - Adaptive card heights for mobile
 * - Responsive design for all devices
 * - Fixed filter functionality with proper parameter mapping
 * - Fixed pagination initialization and updates
 * - Direct DOM rendering for reliable stock display
 * - Added ROTCE (Return on Tangible Common Equity) filter
 */
document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const stockCardsContainer = document.getElementById('stock-cards');
    const stockTableContainer = document.getElementById('stock-table-container');
    const paginationContainer = document.getElementById('pagination-container');
    const totalStocksElement = document.getElementById('total-stocks');
    const nyseStocksElement = document.getElementById('nyse-stocks');
    const nasdaqStocksElement = document.getElementById('nasdaq-stocks');
    const lastUpdatedElement = document.getElementById('last-updated');
    const apiStatusIndicator = document.getElementById('api-status-indicator');
    const apiStatusText = document.getElementById('api-status-text');
    const searchInput = document.getElementById('search-input');
    const filtersToggle = document.getElementById('filters-toggle');
    const filtersContent = document.getElementById('filters-content');
    const cardViewButton = document.getElementById('card-view-button');
    const tableViewButton = document.getElementById('table-view-button');
    
    // State
    let currentView = 'card'; // 'card' or 'table'
    let activeFilters = {};
    let currentStocks = [];
    let totalItems = 0;
    let isLoading = false;
    
    // PAGINATION FIX: Ensure pagination is always initialized with default values
    let currentPage = 1;
    let pageSize = 50;
    
    // Debug mode
    const DEBUG = true;
    
    // Initialize app
    initApp();
    
    /**
     * Initialize the application
     */
    function initApp() {
        console.log('Initializing app');
        
        // Set up event listeners
        setupEventListeners();
        
        // PAGINATION FIX: Initialize pagination with default values
        initPagination();
        
        // Load initial data
        loadInitialData();
        
        // Update API status
        updateApiStatus(true);
    }
    
    /**
     * Set up event listeners
     */
    function setupEventListeners() {
        console.log('Setting up event listeners');
        
        // Filters toggle
        filtersToggle.addEventListener('click', toggleFilters);
        
        // View buttons
        cardViewButton.addEventListener('click', () => switchView('card'));
        tableViewButton.addEventListener('click', () => switchView('table'));
        
        // Search input
        searchInput.addEventListener('input', debounce(handleSearch, 500));
        
        // Filter buttons
        document.querySelectorAll('.filter-button').forEach(button => {
            button.addEventListener('click', () => {
                toggleFilter(button);
                // Show loading indicator immediately for better UX
                setLoading(true);
            });
        });
        
        // Preset buttons
        document.querySelectorAll('.preset-button').forEach(button => {
            button.addEventListener('click', () => {
                togglePreset(button);
                // Show loading indicator immediately for better UX
                setLoading(true);
            });
        });
        
        // Window resize
        window.addEventListener('resize', debounce(handleResize, 200));
    }
    
    /**
     * PAGINATION FIX: Initialize pagination with default values
     */
    function initPagination() {
        console.log('Initializing pagination with defaults: page', currentPage, 'pageSize', pageSize);
        
        // Get pagination parameters from URL or defaults
        const urlParams = new URLSearchParams(window.location.search);
        const urlPage = parseInt(urlParams.get('page'));
        const urlPageSize = parseInt(urlParams.get('pageSize'));
        
        // Use URL values if available, otherwise use defaults
        if (!isNaN(urlPage) && urlPage > 0) {
            currentPage = urlPage;
        }
        
        if (!isNaN(urlPageSize) && urlPageSize > 0) {
            pageSize = urlPageSize;
        }
        
        console.log('Final pagination values: page', currentPage, 'pageSize', pageSize);
        
        // Create new pagination controls
        if (window.paginationControls) {
            // Update existing pagination
            window.paginationControls.update(totalItems, currentPage);
            window.paginationControls.pageSize = pageSize;
        } else {
            // Create new pagination controls
            window.paginationControls = new PaginationControls({
                container: paginationContainer,
                totalItems: totalItems,
                pageSize: pageSize,
                currentPage: currentPage,
                onPageChange: handlePageChange
            });
        }
        
        // Verify pagination was initialized correctly
        console.log('Pagination initialized:', 
            'container:', paginationContainer, 
            'controls:', window.paginationControls,
            'current page:', window.paginationControls ? window.paginationControls.currentPage : 'undefined',
            'page size:', window.paginationControls ? window.paginationControls.pageSize : 'undefined'
        );
    }
    
    /**
     * Load initial data
     */
    function loadInitialData() {
        console.log('Loading initial data');
        
        // Show loading state
        setLoading(true);
        
        // Load stats and first page in parallel
        Promise.all([
            fetch('/api/stats').then(response => response.json()),
            loadStocksPage(currentPage, pageSize)
        ])
            .then(([stats]) => {
                updateStats(stats);
            })
            .catch(error => {
                console.error('Error loading initial data:', error);
                updateApiStatus(false);
                setLoading(false);
            });
    }
    
    /**
     * Load a specific page of stocks from API
     * @param {Number} page - Page number
     * @param {Number} pageSize - Items per page
     * @returns {Promise} Promise that resolves with loaded stocks
     */
    function loadStocksPage(page, pageSize) {
        console.log('Loading stocks page', page, 'pageSize', pageSize);
        
        // PAGINATION FIX: Update current page and page size
        currentPage = page;
        
        // Show loading state
        setLoading(true);
        
        // Build query parameters
        const params = new URLSearchParams({
            page: page,
            pageSize: pageSize
        });
        
        // Convert active filters to backend parameters
        const filterParams = convertFiltersToBackendParams(activeFilters);
        
        // Append filter parameters to the main params
        filterParams.forEach((value, key) => {
            params.append(key, value);
        });
        
        console.log('Sending API request with params:', params.toString());
        
        // Fetch stocks from API
        return fetch(`/api/stocks?${params.toString()}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`API error: ${response.status} ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                if (!data || !data.stocks || !Array.isArray(data.stocks)) {
                    throw new Error('Invalid API response format');
                }
                
                console.log('API response received with', data.stocks.length, 'stocks');
                
                // Process stocks data
                const processedStocks = processStocksData(data.stocks);
                
                // Update state
                currentStocks = processedStocks;
                totalItems = data.pagination ? data.pagination.total : processedStocks.length;
                
                // PAGINATION FIX: Update pagination with new total and current page
                updatePagination(totalItems, currentPage);
                
                // DIRECT RENDERING FIX: Use direct DOM rendering approach
                directRenderStocks(currentStocks);
                
                // Update API status
                updateApiStatus(true);
                
                setLoading(false);
                return data;
            })
            .catch(error => {
                console.error('Error loading stocks:', error);
                updateApiStatus(false);
                setLoading(false);
                throw error;
            });
    }
    
    /**
     * PAGINATION FIX: Update pagination with new total and current page
     */
    function updatePagination(total, page) {
        console.log('Updating pagination with total', total, 'page', page);
        
        // Update total items
        totalItems = total;
        
        // Update current page
        currentPage = page;
        
        // Update pagination controls
        if (window.paginationControls) {
            window.paginationControls.update(total, page);
        } else {
            // Create pagination controls if not exists
            initPagination();
        }
        
        // Verify pagination was updated correctly
        console.log('Pagination updated:', 
            'total:', totalItems, 
            'current page:', window.paginationControls ? window.paginationControls.currentPage : 'undefined',
            'total pages:', window.paginationControls ? window.paginationControls.totalPages : 'undefined'
        );
    }
    
    /**
     * Process stocks data
     * @param {Array} stocks - Raw stocks data
     * @returns {Array} Processed stocks
     */
    function processStocksData(stocks) {
        return stocks.map(stock => {
            // Format numbers for display
            if (stock.price) {
                stock.formattedPrice = formatCurrency(stock.price);
            }
            
            if (stock.marketCap) {
                stock.formattedMarketCap = formatLargeNumber(stock.marketCap);
            }
            
            if (stock.avgDollarVolume) {
                stock.formattedVolume = formatLargeNumber(stock.avgDollarVolume);
            }
            
            // Format ROTCE for display if available
            if (stock.rotce) {
                stock.formattedRotce = (stock.rotce * 100).toFixed(2) + '%';
            }
            
            return stock;
        });
    }
    
    /**
     * DIRECT RENDERING FIX: Direct DOM rendering approach
     * This bypasses any potential issues with the normal rendering pipeline
     */
    function directRenderStocks(stocks) {
        console.log('DIRECT RENDERING: Rendering', stocks.length, 'stocks in', currentView, 'view');
        
        // Clear loading state
        document.body.classList.remove('loading');
        isLoading = false;
        
        // Show appropriate container and hide the other
        stockCardsContainer.style.display = currentView === 'card' ? 'grid' : 'none';
        stockTableContainer.style.display = currentView === 'table' ? 'block' : 'none';
        
        // Update active button
        cardViewButton.classList.toggle('active', currentView === 'card');
        tableViewButton.classList.toggle('active', currentView === 'table');
        
        // Clear containers
        stockCardsContainer.innerHTML = '';
        stockTableContainer.innerHTML = '';
        
        // Show empty state if no stocks
        if (!stocks || stocks.length === 0) {
            const emptyState = `
                <div class="empty-state">
                    <div class="empty-icon">📊</div>
                    <div class="empty-title">No stocks found</div>
                    <div class="empty-message">Try adjusting your filters or search criteria</div>
                </div>
            `;
            
            if (currentView === 'card') {
                stockCardsContainer.innerHTML = emptyState;
            } else {
                stockTableContainer.innerHTML = emptyState;
            }
            
            console.log('DIRECT RENDERING: Empty state rendered');
            return;
        }
        
        // Render stocks in current view
        if (currentView === 'card') {
            directRenderCardView(stocks);
        } else {
            directRenderTableView(stocks);
        }
        
        // Force browser to repaint
        forceRepaint();
        
        console.log('DIRECT RENDERING: Completed rendering', stocks.length, 'stocks');
    }
    
    /**
     * DIRECT RENDERING FIX: Force browser to repaint
     */
    function forceRepaint() {
        console.log('Forcing browser repaint');
        
        // Method 1: Force reflow
        if (currentView === 'card') {
            stockCardsContainer.offsetHeight;
        } else {
            stockTableContainer.offsetHeight;
        }
        
        // Method 2: Minimal DOM change
        const tempDiv = document.createElement('div');
        tempDiv.style.cssText = 'position:absolute;width:1px;height:1px;opacity:0.001;';
        document.body.appendChild(tempDiv);
        setTimeout(() => {
            document.body.removeChild(tempDiv);
        }, 50);
        
        // Method 3: CSS animation
        document.body.classList.add('force-repaint');
        setTimeout(() => {
            document.body.classList.remove('force-repaint');
        }, 50);
    }
    
    /**
     * DIRECT RENDERING FIX: Direct render card view
     */
    function directRenderCardView(stocks) {
        console.log('DIRECT RENDERING: Card view with', stocks.length, 'stocks');
        
        // Use document fragment for better performance
        const fragment = document.createDocumentFragment();
        
        // Render each stock card
        stocks.forEach(stock => {
            const card = document.createElement('div');
            card.className = 'stock-card';
            
            // Check if stock has incomplete data
            if (!stock.price || !stock.marketCap || !stock.peRatio) {
                card.classList.add('incomplete-data');
            }
            
            // Create card content
            card.innerHTML = `
                <div class="stock-header">
                    <div class="stock-symbol">${stock.symbol}</div>
                    <div class="stock-exchange">${stock.exchange || 'N/A'}</div>
                </div>
                <div class="stock-name">${stock.name || 'Unknown'}</div>
                <div class="stock-metrics">
                    <div class="metric">
                        <div class="metric-label">Price</div>
                        <div class="metric-value">${stock.formattedPrice || formatCurrency(stock.price) || 'N/A'}</div>
                    </div>
                    <div class="metric">
                        <div class="metric-label">Market Cap</div>
                        <div class="metric-value">${stock.formattedMarketCap || formatLargeNumber(stock.marketCap) || 'N/A'}</div>
                    </div>
                    <div class="metric">
                        <div class="metric-label">P/E Ratio</div>
                        <div class="metric-value">${stock.peRatio ? stock.peRatio.toFixed(2) : 'N/A'}</div>
                    </div>
                    <div class="metric">
                        <div class="metric-label">Dividend Yield</div>
                        <div class="metric-value">${stock.dividendYield ? (stock.dividendYield * 100).toFixed(2) + '%' : 'N/A'}</div>
                    </div>
                    <div class="metric">
                        <div class="metric-label">Debt/EBITDA</div>
                        <div class="metric-value">${stock.netDebtToEBITDA ? stock.netDebtToEBITDA.toFixed(2) + 'x' : 'N/A'}</div>
                    </div>
                    <div class="metric">
                        <div class="metric-label">ROTCE</div>
                        <div class="metric-value">${stock.rotce ? stock.formattedRotce : 'N/A'}</div>
                    </div>
                </div>
            `;
            
            // Append card to fragment
            fragment.appendChild(card);
        });
        
        // Append fragment to container
        stockCardsContainer.appendChild(fragment);
    }
    
    /**
     * DIRECT RENDERING FIX: Direct render table view
     */
    function directRenderTableView(stocks) {
        console.log('DIRECT RENDERING: Table view with', stocks.length, 'stocks');
        
        // Create table element
        const table = document.createElement('table');
        table.className = 'stock-table';
        
        // Create table header
        const thead = document.createElement('thead');
        thead.innerHTML = `
            <tr>
                <th>Symbol</th>
                <th>Name</th>
                <th>Price</th>
                <th>Market Cap</th>
                <th>P/E Ratio</th>
                <th>Dividend Yield</th>
                <th>Debt/EBITDA</th>
                <th>ROTCE</th>
            </tr>
        `;
        table.appendChild(thead);
        
        // Create table body
        const tbody = document.createElement('tbody');
        
        // Add rows for each stock
        stocks.forEach(stock => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="stock-symbol-cell">${stock.symbol}</td>
                <td>${stock.name || 'Unknown'}</td>
                <td>${stock.formattedPrice || formatCurrency(stock.price) || 'N/A'}</td>
                <td>${stock.formattedMarketCap || formatLargeNumber(stock.marketCap) || 'N/A'}</td>
                <td>${stock.peRatio ? stock.peRatio.toFixed(2) : 'N/A'}</td>
                <td>${stock.dividendYield ? (stock.dividendYield * 100).toFixed(2) + '%' : 'N/A'}</td>
                <td>${stock.netDebtToEBITDA ? stock.netDebtToEBITDA.toFixed(2) + 'x' : 'N/A'}</td>
                <td>${stock.rotce ? stock.formattedRotce : 'N/A'}</td>
            `;
            tbody.appendChild(tr);
        });
        
        table.appendChild(tbody);
        stockTableContainer.appendChild(table);
    }
    
    /**
     * Handle page change event
     * @param {Number} page - New page number
     */
    function handlePageChange(page) {
        console.log('Page changed to', page);
        
        // Update URL with new page
        updateUrlParams({ page });
        
        // Load new page
        loadStocksPage(page, pageSize);
    }
    
    /**
     * Handle search input
     */
    function handleSearch() {
        console.log('Search input changed');
        
        const searchTerm = searchInput.value.trim();
        
        // Update active filters
        if (searchTerm) {
            activeFilters.search = searchTerm;
        } else {
            delete activeFilters.search;
        }
        
        // Update URL
        updateUrlParams({ search: searchTerm || null, page: 1 });
        
        // Reset to first page and load
        loadStocksPage(1, pageSize);
    }
    
    /**
     * Toggle filter button
     * @param {HTMLElement} button - Filter button element
     */
    function toggleFilter(button) {
        console.log('Toggle filter', button.dataset.filter, button.dataset.value);
        
        const filter = button.dataset.filter;
        const value = button.dataset.value;
        
        // Toggle active state
        button.classList.toggle('active');
        
        // Update active filters
        if (!activeFilters[filter]) {
            activeFilters[filter] = [];
        }
        
        if (button.classList.contains('active')) {
            // Add filter value if not already present
            if (!activeFilters[filter].includes(value)) {
                activeFilters[filter].push(value);
            }
        } else {
            // Remove filter value
            activeFilters[filter] = activeFilters[filter].filter(v => v !== value);
            
            // Remove empty filter arrays
            if (activeFilters[filter].length === 0) {
                delete activeFilters[filter];
            }
        }
        
        console.log('Updated active filters:', activeFilters);
        
        // Update URL and reset to first page
        updateUrlParams({ ...activeFilters, page: 1 });
        
        // Load first page with new filters
        loadStocksPage(1, pageSize);
    }
    
    /**
     * Toggle preset button
     * @param {HTMLElement} button - Preset button element
     */
    function togglePreset(button) {
        console.log('Toggle preset', button.dataset.preset);
        
        const preset = button.dataset.preset;
        
        // Toggle active state for this button
        button.classList.toggle('active');
        
        // Deactivate other preset buttons
        document.querySelectorAll('.preset-button').forEach(btn => {
            if (btn !== button) {
                btn.classList.remove('active');
            }
        });
        
        // Clear existing filters
        document.querySelectorAll('.filter-button').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Reset active filters
        activeFilters = {};
        
        // Apply preset filters if button is active
        if (button.classList.contains('active')) {
            applyPresetFilters(preset);
        }
        
        // Update filter buttons to match active filters
        updateFilterButtonsFromActiveFilters();
        
        // Update URL and reset to first page
        updateUrlParams({ preset: button.classList.contains('active') ? preset : null, page: 1 });
        
        // Load first page with new filters
        loadStocksPage(1, pageSize);
    }
    
    /**
     * Apply preset filters
     * @param {String} preset - Preset name
     */
    function applyPresetFilters(preset) {
        console.log('Applying preset filters for', preset);
        
        switch (preset) {
            case 'value':
                activeFilters.valuation = ['undervalued'];
                activeFilters.rotce = ['good', 'excellent']; // Add ROTCE filter for value preset
                break;
            case 'growth':
                activeFilters.growth = ['high'];
                break;
            case 'dividend':
                activeFilters.dividend = ['high'];
                break;
            case 'quality':
                activeFilters.debt = ['low'];
                activeFilters.rotce = ['excellent']; // Add ROTCE filter for quality preset
                break;
        }
        
        console.log('Applied preset filters:', activeFilters);
    }
    
    /**
     * Update filter buttons to match active filters
     */
    function updateFilterButtonsFromActiveFilters() {
        console.log('Updating filter buttons from active filters');
        
        // Reset all filter buttons
        document.querySelectorAll('.filter-button').forEach(button => {
            const filter = button.dataset.filter;
            const value = button.dataset.value;
            
            // Check if this filter value is active
            const isActive = activeFilters[filter] && activeFilters[filter].includes(value);
            
            // Update button state
            button.classList.toggle('active', isActive);
        });
    }
    
    /**
     * Convert active filters to backend parameters
     * @param {Object} filters - Active filters object
     * @returns {URLSearchParams} URL search params
     */
    function convertFiltersToBackendParams(filters) {
        console.log('Converting filters to backend params:', filters);
        
        const params = new URLSearchParams();
        
        // Handle search term
        if (filters.search) {
            params.append('search', filters.search);
        }
        
        // Handle market cap filters
        if (filters.market_cap) {
            filters.market_cap.forEach(value => {
                switch (value) {
                    case 'large':
                        params.append('minMarketCap', '10000000000'); // $10B+
                        break;
                    case 'mid':
                        params.append('minMarketCap', '2000000000'); // $2B+
                        params.append('maxMarketCap', '10000000000'); // $10B
                        break;
                    case 'small':
                        params.append('minMarketCap', '300000000'); // $300M+
                        params.append('maxMarketCap', '2000000000'); // $2B
                        break;
                    case 'micro':
                        params.append('maxMarketCap', '300000000'); // $300M
                        break;
                }
            });
        }
        
        // Handle volume filters
        if (filters.volume) {
            filters.volume.forEach(value => {
                switch (value) {
                    case 'high':
                        params.append('minVolume', '10000000'); // $10M+
                        break;
                    case 'medium':
                        params.append('minVolume', '1000000'); // $1M+
                        params.append('maxVolume', '10000000'); // $10M
                        break;
                    case 'low':
                        params.append('maxVolume', '1000000'); // $1M
                        break;
                }
            });
        }
        
        // Handle debt filters
        if (filters.debt) {
            filters.debt.forEach(value => {
                switch (value) {
                    case 'low':
                        params.append('maxDebtToEBITDA', '1.5');
                        break;
                    case 'moderate':
                        params.append('minDebtToEBITDA', '1.5');
                        params.append('maxDebtToEBITDA', '3');
                        break;
                    case 'high':
                        params.append('minDebtToEBITDA', '3');
                        break;
                }
            });
        }
        
        // Handle valuation filters
        if (filters.valuation) {
            filters.valuation.forEach(value => {
                switch (value) {
                    case 'undervalued':
                        params.append('maxPE', '15');
                        break;
                    case 'fair':
                        params.append('minPE', '15');
                        params.append('maxPE', '25');
                        break;
                    case 'overvalued':
                        params.append('minPE', '25');
                        break;
                }
            });
        }
        
        // Handle ROTCE filters
        if (filters.rotce) {
            filters.rotce.forEach(value => {
                switch (value) {
                    case 'excellent':
                        params.append('minROTCE', '0.20'); // 20%+
                        break;
                    case 'good':
                        params.append('minROTCE', '0.15'); // 15%+
                        params.append('maxROTCE', '0.20'); // 20%
                        break;
                    case 'average':
                        params.append('minROTCE', '0.10'); // 10%+
                        params.append('maxROTCE', '0.15'); // 15%
                        break;
                    case 'below_average':
                        params.append('minROTCE', '0.05'); // 5%+
                        params.append('maxROTCE', '0.10'); // 10%
                        break;
                    case 'poor':
                        params.append('maxROTCE', '0.05'); // 5%
                        break;
                }
            });
        }
        
        console.log('Converted params:', params.toString());
        return params;
    }
    
    /**
     * Update URL parameters
     * @param {Object} params - Parameters to update
     */
    function updateUrlParams(params) {
        console.log('Updating URL params:', params);
        
        const url = new URL(window.location.href);
        const searchParams = url.searchParams;
        
        // Clear existing params
        Array.from(searchParams.keys()).forEach(key => {
            searchParams.delete(key);
        });
        
        // Add new params
        Object.entries(params).forEach(([key, value]) => {
            if (value === null || value === undefined) {
                return;
            }
            
            if (Array.isArray(value)) {
                value.forEach(v => searchParams.append(key, v));
            } else {
                searchParams.set(key, value);
            }
        });
        
        // Update URL without reloading page
        window.history.replaceState({}, '', url);
    }
    
    /**
     * Switch between card and table views
     * @param {String} view - View type ('card' or 'table')
     */
    function switchView(view) {
        console.log('Switching to', view, 'view');
        
        if (view === currentView) {
            return;
        }
        
        currentView = view;
        
        // Update URL
        updateUrlParams({ view });
        
        // Re-render stocks in new view
        directRenderStocks(currentStocks);
    }
    
    /**
     * Toggle filters panel
     */
    function toggleFilters() {
        console.log('Toggling filters panel');
        
        filtersContent.classList.toggle('collapsed');
        filtersToggle.classList.toggle('collapsed');
    }
    
    /**
     * Update stats display
     * @param {Object} stats - Stats data
     */
    function updateStats(stats) {
        console.log('Updating stats:', stats);
        
        if (stats.totalStocks) {
            totalStocksElement.textContent = formatNumber(stats.totalStocks);
        }
        
        if (stats.nyseStocks) {
            nyseStocksElement.textContent = formatNumber(stats.nyseStocks);
        }
        
        if (stats.nasdaqStocks) {
            nasdaqStocksElement.textContent = formatNumber(stats.nasdaqStocks);
        }
        
        if (stats.lastUpdated) {
            const date = new Date(stats.lastUpdated);
            lastUpdatedElement.textContent = date.toLocaleTimeString();
        }
    }
    
    /**
     * Update API status indicator
     * @param {Boolean} connected - Whether API is connected
     */
    function updateApiStatus(connected) {
        console.log('Updating API status:', connected ? 'connected' : 'disconnected');
        
        apiStatusIndicator.classList.toggle('connected', connected);
        apiStatusIndicator.classList.toggle('disconnected', !connected);
        apiStatusText.textContent = connected ? 'connected' : 'disconnected';
    }
    
    /**
     * Set loading state
     * @param {Boolean} loading - Whether app is loading
     */
    function setLoading(loading) {
        console.log('Setting loading state:', loading);
        
        isLoading = loading;
        document.body.classList.toggle('loading', loading);
    }
    
    /**
     * Handle window resize
     */
    function handleResize() {
        console.log('Window resized');
        
        // Re-render stocks to adjust layout
        directRenderStocks(currentStocks);
    }
    
    /**
     * Format currency value
     * @param {Number} value - Value to format
     * @returns {String} Formatted currency string
     */
    function formatCurrency(value) {
        if (value === null || value === undefined) {
            return 'N/A';
        }
        
        return '$' + value.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
    }
    
    /**
     * Format large number with appropriate suffix
     * @param {Number} value - Value to format
     * @returns {String} Formatted number string
     */
    function formatLargeNumber(value) {
        if (value === null || value === undefined) {
            return 'N/A';
        }
        
        if (value >= 1e12) {
            return '$' + (value / 1e12).toFixed(2) + 'T';
        } else if (value >= 1e9) {
            return '$' + (value / 1e9).toFixed(2) + 'B';
        } else if (value >= 1e6) {
            return '$' + (value / 1e6).toFixed(2) + 'M';
        } else if (value >= 1e3) {
            return '$' + (value / 1e3).toFixed(2) + 'K';
        } else {
            return '$' + value.toFixed(2);
        }
    }
    
    /**
     * Format number with commas
     * @param {Number} value - Value to format
     * @returns {String} Formatted number string
     */
    function formatNumber(value) {
        if (value === null || value === undefined) {
            return '0';
        }
        
        return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
    
    /**
     * Debounce function to limit how often a function can be called
     * @param {Function} func - Function to debounce
     * @param {Number} wait - Wait time in milliseconds
     * @returns {Function} Debounced function
     */
    function debounce(func, wait) {
        let timeout;
        
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
});
