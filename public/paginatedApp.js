/**
 * Fixed PaginatedApp.js with Multi-Select Filter Logic
 * 
 * This version fixes:
 * 1. Debt filter functionality
 * 2. ROTCE filter support
 * 3. Filter parameter mapping
 * 4. Multi-select filter logic for market cap, volume, and other categories
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
                        <div class="metric-value">${formatDebtToEBITDA(stock.netDebtToEBITDA)}</div>
                    </div>
                    <div class="metric">
                        <div class="metric-label">ROTCE</div>
                        <div class="metric-value">${stock.rotce ? (stock.rotce * 100).toFixed(2) + '%' : 'N/A'}</div>
                    </div>
                </div>
            `;
            
            // Add card to fragment
            fragment.appendChild(card);
        });
        
        // Add fragment to container
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
                <th>Exchange</th>
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
                <td>${stock.symbol}</td>
                <td>${stock.name || 'Unknown'}</td>
                <td>${stock.exchange || 'N/A'}</td>
                <td>${stock.formattedPrice || formatCurrency(stock.price) || 'N/A'}</td>
                <td>${stock.formattedMarketCap || formatLargeNumber(stock.marketCap) || 'N/A'}</td>
                <td>${stock.peRatio ? stock.peRatio.toFixed(2) : 'N/A'}</td>
                <td>${stock.dividendYield ? (stock.dividendYield * 100).toFixed(2) + '%' : 'N/A'}</td>
                <td>${formatDebtToEBITDA(stock.netDebtToEBITDA)}</td>
                <td>${stock.rotce ? (stock.rotce * 100).toFixed(2) + '%' : 'N/A'}</td>
            `;
            
            tbody.appendChild(tr);
        });
        
        table.appendChild(tbody);
        
        // Add table to container
        stockTableContainer.appendChild(table);
    }
    
    /**
     * Format Debt/EBITDA value with improved handling of edge cases
     * @param {Number|null} value - Debt/EBITDA value
     * @returns {String} Formatted value for display
     */
    function formatDebtToEBITDA(value) {
        if (value === null || value === undefined) {
            return 'N/A';
        } else if (value === 0) {
            return '0.00x';
        } else if (!isFinite(value)) {
            return 'High';
        } else {
            return value.toFixed(2) + 'x';
        }
    }
    
    /**
     * Update stats display
     * @param {Object} stats - Stats data
     */
    function updateStats(stats) {
        console.log('Updating stats with', stats);
        
        if (!stats) {
            console.error('Invalid stats data');
            return;
        }
        
        // Update stats display
        totalStocksElement.textContent = stats.totalStocks || 0;
        nyseStocksElement.textContent = stats.nyseStocks || 0;
        nasdaqStocksElement.textContent = stats.nasdaqStocks || 0;
        
        // Update last updated time
        if (stats.lastUpdated) {
            const date = new Date(stats.lastUpdated);
            lastUpdatedElement.textContent = date.toLocaleString();
        } else {
            lastUpdatedElement.textContent = 'Never';
        }
    }
    
    /**
     * Update API status indicator
     * @param {Boolean} connected - Whether API is connected
     */
    function updateApiStatus(connected) {
        apiStatusIndicator.classList.toggle('connected', connected);
        apiStatusIndicator.classList.toggle('disconnected', !connected);
        apiStatusText.textContent = connected ? 'connected' : 'disconnected';
    }
    
    /**
     * Set loading state
     * @param {Boolean} loading - Whether app is loading
     */
    function setLoading(loading) {
        isLoading = loading;
        document.body.classList.toggle('loading', loading);
    }
    
    /**
     * Handle page change
     * @param {Number} page - New page number
     */
    function handlePageChange(page) {
        console.log('Page changed to', page);
        
        // Update URL with new page
        const url = new URL(window.location);
        url.searchParams.set('page', page);
        window.history.replaceState({}, '', url);
        
        // Load new page
        loadStocksPage(page, pageSize);
    }
    
    /**
     * Handle search input
     */
    function handleSearch() {
        const searchTerm = searchInput.value.trim();
        console.log('Search term:', searchTerm);
        
        // Update active filters
        if (searchTerm) {
            activeFilters.search = searchTerm;
        } else {
            delete activeFilters.search;
        }
        
        // Reset to first page and load
        currentPage = 1;
        loadStocksPage(currentPage, pageSize);
    }
    
    /**
     * Toggle filters panel
     */
    function toggleFilters() {
        filtersContent.classList.toggle('collapsed');
        filtersToggle.querySelector('.filters-toggle').classList.toggle('collapsed');
    }
    
    /**
     * Switch view between card and table
     * @param {String} view - View type ('card' or 'table')
     */
    function switchView(view) {
        if (currentView === view) return;
        
        currentView = view;
        
        // Update URL with new view
        const url = new URL(window.location);
        url.searchParams.set('view', view);
        window.history.replaceState({}, '', url);
        
        // Render stocks in new view
        directRenderStocks(currentStocks);
    }
    
    /**
     * Toggle filter button
     * @param {HTMLElement} button - Filter button element
     */
    function toggleFilter(button) {
        const filter = button.dataset.filter;
        const value = button.dataset.value;
        
        console.log('Toggle filter:', filter, value);
        
        // Toggle active state
        button.classList.toggle('active');
        
        // Update active filters
        if (!activeFilters[filter]) {
            activeFilters[filter] = [];
        }
        
        if (button.classList.contains('active')) {
            // Add filter
            if (!activeFilters[filter].includes(value)) {
                activeFilters[filter].push(value);
            }
        } else {
            // Remove filter
            activeFilters[filter] = activeFilters[filter].filter(v => v !== value);
            if (activeFilters[filter].length === 0) {
                delete activeFilters[filter];
            }
        }
        
        console.log('Active filters:', activeFilters);
        
        // Reset to first page and load
        currentPage = 1;
        loadStocksPage(currentPage, pageSize);
    }
    
    /**
     * Toggle preset button
     * @param {HTMLElement} button - Preset button element
     */
    function togglePreset(button) {
        const preset = button.dataset.preset;
        
        console.log('Toggle preset:', preset);
        
        // Clear all active filters
        activeFilters = {};
        
        // Remove active class from all filter buttons
        document.querySelectorAll('.filter-button').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Remove active class from all preset buttons
        document.querySelectorAll('.preset-button').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Toggle active state
        button.classList.toggle('active');
        
        // Apply preset filters if active
        if (button.classList.contains('active')) {
            applyPreset(preset);
        }
        
        console.log('Active filters after preset:', activeFilters);
        
        // Reset to first page and load
        currentPage = 1;
        loadStocksPage(currentPage, pageSize);
    }
    
    /**
     * Apply preset filters
     * @param {String} preset - Preset name
     */
    function applyPreset(preset) {
        switch (preset) {
            case 'value':
                // Value stocks preset
                activeFilters.valuation = ['undervalued'];
                activeFilters.debt = ['low', 'medium'];
                activeFilters.rotce = ['good', 'excellent']; // Added ROTCE filter
                
                // Activate corresponding buttons
                document.querySelector('.filter-button[data-filter="valuation"][data-value="undervalued"]').classList.add('active');
                document.querySelector('.filter-button[data-filter="debt"][data-value="low"]').classList.add('active');
                document.querySelector('.filter-button[data-filter="debt"][data-value="medium"]').classList.add('active');
                document.querySelector('.filter-button[data-filter="rotce"][data-value="good"]').classList.add('active');
                document.querySelector('.filter-button[data-filter="rotce"][data-value="excellent"]').classList.add('active');
                break;
                
            case 'growth':
                // Growth stocks preset
                activeFilters.valuation = ['fair', 'overvalued'];
                activeFilters.market_cap = ['mid', 'large'];
                
                // Activate corresponding buttons
                document.querySelector('.filter-button[data-filter="valuation"][data-value="fair"]').classList.add('active');
                document.querySelector('.filter-button[data-filter="valuation"][data-value="overvalued"]').classList.add('active');
                document.querySelector('.filter-button[data-filter="market_cap"][data-value="mid"]').classList.add('active');
                document.querySelector('.filter-button[data-filter="market_cap"][data-value="large"]').classList.add('active');
                break;
                
            case 'dividend':
                // Dividend stocks preset
                activeFilters.market_cap = ['large'];
                activeFilters.debt = ['low', 'medium'];
                
                // Activate corresponding buttons
                document.querySelector('.filter-button[data-filter="market_cap"][data-value="large"]').classList.add('active');
                document.querySelector('.filter-button[data-filter="debt"][data-value="low"]').classList.add('active');
                document.querySelector('.filter-button[data-filter="debt"][data-value="medium"]').classList.add('active');
                break;
                
            case 'quality':
                // Quality stocks preset
                activeFilters.market_cap = ['large', 'mid'];
                activeFilters.debt = ['low'];
                activeFilters.rotce = ['excellent']; // Added ROTCE filter
                
                // Activate corresponding buttons
                document.querySelector('.filter-button[data-filter="market_cap"][data-value="large"]').classList.add('active');
                document.querySelector('.filter-button[data-filter="market_cap"][data-value="mid"]').classList.add('active');
                document.querySelector('.filter-button[data-filter="debt"][data-value="low"]').classList.add('active');
                document.querySelector('.filter-button[data-filter="rotce"][data-value="excellent"]').classList.add('active');
                break;
        }
    }
    
    /**
     * FIXED: Convert filters to backend parameters with improved multi-select handling
     * @param {Object} filters - Active filters
     * @returns {URLSearchParams} Backend parameters
     */
    function convertFiltersToBackendParams(filters) {
        console.log('Converting filters to backend params:', filters);
        
        const params = new URLSearchParams();
        
        // Add search parameter
        if (filters.search) {
            params.append('search', filters.search);
        }
        
        // FIXED: Add market cap filters with improved multi-select handling
        if (filters.market_cap && filters.market_cap.length > 0) {
            // Find the lowest minimum value among selected options
            let minMarketCap = null;
            if (filters.market_cap.includes('micro')) minMarketCap = 0;
            else if (filters.market_cap.includes('small')) minMarketCap = 300000000;
            else if (filters.market_cap.includes('mid')) minMarketCap = 2000000000;
            else if (filters.market_cap.includes('large')) minMarketCap = 10000000000;
            
            // Find the highest maximum value among selected options
            let maxMarketCap = null;
            if (filters.market_cap.includes('large')) maxMarketCap = null; // No upper limit
            else if (filters.market_cap.includes('mid')) maxMarketCap = 10000000000;
            else if (filters.market_cap.includes('small')) maxMarketCap = 2000000000;
            else if (filters.market_cap.includes('micro')) maxMarketCap = 300000000;
            
            // Apply the parameters
            if (minMarketCap !== null) {
                params.append('minMarketCap', minMarketCap.toString());
            }
            
            if (maxMarketCap !== null) {
                params.append('maxMarketCap', maxMarketCap.toString());
            }
        }
        
        // FIXED: Add volume filters with improved multi-select handling
        if (filters.volume && filters.volume.length > 0) {
            // Find the lowest minimum value among selected options
            let minVolume = null;
            if (filters.volume.includes('low')) minVolume = 0;
            else if (filters.volume.includes('medium')) minVolume = 1000000;
            else if (filters.volume.includes('high')) minVolume = 5000000;
            
            // Find the highest maximum value among selected options
            let maxVolume = null;
            if (filters.volume.includes('high')) maxVolume = null; // No upper limit
            else if (filters.volume.includes('medium')) maxVolume = 5000000;
            else if (filters.volume.includes('low')) maxVolume = 1000000;
            
            // Apply the parameters
            if (minVolume !== null) {
                params.append('minVolume', minVolume.toString());
            }
            
            if (maxVolume !== null) {
                params.append('maxVolume', maxVolume.toString());
            }
        }
        
        // FIXED: Add debt filters with improved multi-select handling
        if (filters.debt && filters.debt.length > 0) {
            // Find the lowest minimum value among selected options
            let minDebtToEBITDA = null;
            if (filters.debt.includes('low')) minDebtToEBITDA = 0;
            else if (filters.debt.includes('medium')) minDebtToEBITDA = 0.5;
            else if (filters.debt.includes('high')) minDebtToEBITDA = 1.5;
            
            // Find the highest maximum value among selected options
            let maxDebtToEBITDA = null;
            if (filters.debt.includes('high')) maxDebtToEBITDA = null; // No upper limit
            else if (filters.debt.includes('medium')) maxDebtToEBITDA = 1.5;
            else if (filters.debt.includes('low')) maxDebtToEBITDA = 0.5;
            
            // Apply the parameters
            if (minDebtToEBITDA !== null) {
                params.append('minDebtToEBITDA', minDebtToEBITDA.toString());
            }
            
            if (maxDebtToEBITDA !== null) {
                params.append('maxDebtToEBITDA', maxDebtToEBITDA.toString());
            }
        }
        
        // FIXED: Add valuation filters with improved multi-select handling
        if (filters.valuation && filters.valuation.length > 0) {
            // Find the lowest minimum value among selected options
            let minPE = null;
            if (filters.valuation.includes('undervalued')) minPE = 0;
            else if (filters.valuation.includes('fair')) minPE = 15;
            else if (filters.valuation.includes('overvalued')) minPE = 25;
            
            // Find the highest maximum value among selected options
            let maxPE = null;
            if (filters.valuation.includes('overvalued')) maxPE = null; // No upper limit
            else if (filters.valuation.includes('fair')) maxPE = 25;
            else if (filters.valuation.includes('undervalued')) maxPE = 15;
            
            // Apply the parameters
            if (minPE !== null) {
                params.append('minPE', minPE.toString());
            }
            
            if (maxPE !== null) {
                params.append('maxPE', maxPE.toString());
            }
        }
        
        // FIXED: Add ROTCE filters with improved multi-select handling
        if (filters.rotce && filters.rotce.length > 0) {
            // Find the lowest minimum value among selected options
            let minROTCE = null;
            if (filters.rotce.includes('poor')) minROTCE = 0;
            else if (filters.rotce.includes('below_average')) minROTCE = 0.05;
            else if (filters.rotce.includes('average')) minROTCE = 0.1;
            else if (filters.rotce.includes('good')) minROTCE = 0.15;
            else if (filters.rotce.includes('excellent')) minROTCE = 0.2;
            
            // Find the highest maximum value among selected options
            let maxROTCE = null;
            if (filters.rotce.includes('excellent')) maxROTCE = null; // No upper limit
            else if (filters.rotce.includes('good')) maxROTCE = 0.2;
            else if (filters.rotce.includes('average')) maxROTCE = 0.15;
            else if (filters.rotce.includes('below_average')) maxROTCE = 0.1;
            else if (filters.rotce.includes('poor')) maxROTCE = 0.05;
            
            // Apply the parameters
            if (minROTCE !== null) {
                params.append('minROTCE', minROTCE.toString());
            }
            
            if (maxROTCE !== null) {
                params.append('maxROTCE', maxROTCE.toString());
            }
        }
        
        console.log('Converted params:', params.toString());
        return params;
    }
    
    /**
     * Handle window resize
     */
    function handleResize() {
        // Re-render stocks to adjust layout
        directRenderStocks(currentStocks);
    }
    
    /**
     * Format currency value
     * @param {Number} value - Currency value
     * @returns {String} Formatted currency string
     */
    function formatCurrency(value) {
        if (value === undefined || value === null) return null;
        
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(value);
    }
    
    /**
     * Format large number with abbreviation
     * @param {Number} value - Large number
     * @returns {String} Formatted number string
     */
    function formatLargeNumber(value) {
        if (value === undefined || value === null) return null;
        
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
