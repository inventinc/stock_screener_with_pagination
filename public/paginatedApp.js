/**
 * Fixed PaginatedApp.js with Multi-Select Filter Logic and Enhanced Tooltips
 * 
 * This version fixes:
 * 1. Debt filter functionality
 * 2. ROTCE filter support
 * 3. Filter parameter mapping
 * 4. Multi-select filter logic for market cap, volume, and other categories
 * 5. Tooltip functionality with modern icons
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
    
    // Load Font Awesome if not already loaded
    if (!document.querySelector('link[href*="font-awesome"]')) {
        const fontAwesome = document.createElement('link');
        fontAwesome.rel = 'stylesheet';
        fontAwesome.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
        document.head.appendChild(fontAwesome);
    }
    
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
     * Helper function to get appropriate icon and tooltip for metrics
     * @param {String} metricName - Name of the metric
     * @param {*} value - Value of the metric
     * @param {Boolean} calculated - Whether the value was calculated
     * @returns {Object} Object with icon and tooltipText properties
     */
    function getMetricInfo(metricName, value, calculated = false) {
        let icon = '';
        let tooltipText = '';
        
        // Default is N/A
        if (value === null || value === undefined || value === 'N/A') {
            icon = '<i class="fas fa-exclamation-circle" style="margin-left: 4px; font-size: 0.8em; color: #d9534f;"></i>';
            tooltipText = 'Data not available from API';
            return { icon, tooltipText };
        }
        
        // Specific metric handling
        switch(metricName) {
            case 'netDebtToEBITDA':
                if (calculated) {
                    icon = '<i class="fas fa-calculator" style="margin-left: 4px; font-size: 0.8em; color: #f0ad4e;"></i>';
                    tooltipText = 'Calculated from financial components';
                } else {
                    icon = '<i class="fas fa-database" style="margin-left: 4px; font-size: 0.8em; color: #5cb85c;"></i>';
                    tooltipText = 'Direct value from API';
                }
                
                if (value < 1) {
                    tooltipText += '. Low debt relative to earnings.';
                } else if (value < 3) {
                    tooltipText += '. Moderate debt relative to earnings.';
                } else {
                    tooltipText += '. High debt relative to earnings.';
                }
                break;
                
            case 'rotce':
                if (calculated) {
                    icon = '<i class="fas fa-calculator" style="margin-left: 4px; font-size: 0.8em; color: #f0ad4e;"></i>';
                    tooltipText = 'Calculated from financial components';
                } else {
                    icon = '<i class="fas fa-database" style="margin-left: 4px; font-size: 0.8em; color: #5cb85c;"></i>';
                    tooltipText = 'Direct value from API';
                }
                
                if (value > 0.2) {
                    tooltipText += '. Excellent return on tangible capital.';
                } else if (value > 0.1) {
                    tooltipText += '. Good return on tangible capital.';
                } else {
                    tooltipText += '. Below average return on tangible capital.';
                }
                break;
                
            default:
                icon = '<i class="fas fa-info-circle" style="margin-left: 4px; font-size: 0.8em; color: #5bc0de;"></i>';
                tooltipText = 'Direct value from API';
        }
        
        return { icon, tooltipText };
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
        
        // Initialize tooltips after rendering
        if (window.initTooltip) {
            window.initTooltip();
        }
        
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
            
            // Get metric info for Debt/EBITDA
            const debtEbitdaInfo = getMetricInfo(
                'netDebtToEBITDA', 
                stock.netDebtToEBITDA, 
                stock.netDebtToEBITDACalculated
            );
            
            // Get metric info for ROTCE
            const rotceInfo = getMetricInfo(
                'rotce', 
                stock.rotce, 
                stock.rotceCalculationMethod !== undefined
            );
            
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
                        <div class="metric-value" title="Current stock price">${stock.formattedPrice || formatCurrency(stock.price) || 'N/A'}</div>
                    </div>
                    <div class="metric">
                        <div class="metric-label">Market Cap</div>
                        <div class="metric-value" title="Total market value of the company">${stock.formattedMarketCap || formatLargeNumber(stock.marketCap) || 'N/A'}</div>
                    </div>
                    <div class="metric">
                        <div class="metric-label">P/E Ratio</div>
                        <div class="metric-value" title="Price to Earnings ratio - lower values may indicate better value">${stock.peRatio ? stock.peRatio.toFixed(2) : 'N/A'}</div>
                    </div>
                    <div class="metric">
                        <div class="metric-label">Dividend Yield</div>
                        <div class="metric-value" title="Annual dividend as percentage of share price">${stock.dividendYield ? (stock.dividendYield * 100).toFixed(2) + '%' : 'N/A'}</div>
                    </div>
                    <div class="metric">
                        <div class="metric-label">Debt/EBITDA</div>
                        <div class="metric-value" title="${debtEbitdaInfo.tooltipText}">${stock.netDebtToEBITDA ? stock.netDebtToEBITDA.toFixed(2) + 'x' : 'N/A'}${debtEbitdaInfo.icon}</div>
                    </div>
                    <div class="metric">
                        <div class="metric-label">ROTCE</div>
                        <div class="metric-value" title="${rotceInfo.tooltipText}">${stock.rotce ? (stock.rotce * 100).toFixed(2) + '%' : 'N/A'}${rotceInfo.icon}</div>
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
            
            // Get metric info for Debt/EBITDA
            const debtEbitdaInfo = getMetricInfo(
                'netDebtToEBITDA', 
                stock.netDebtToEBITDA, 
                stock.netDebtToEBITDACalculated
            );
            
            // Get metric info for ROTCE
            const rotceInfo = getMetricInfo(
                'rotce', 
                stock.rotce, 
                stock.rotceCalculationMethod !== undefined
            );
            
            tr.innerHTML = `
                <td>${stock.symbol}</td>
                <td>${stock.name || 'Unknown'}</td>
                <td>${stock.exchange || 'N/A'}</td>
                <td title="Current stock price">${stock.formattedPrice || formatCurrency(stock.price) || 'N/A'}</td>
                <td title="Total market value of the company">${stock.formattedMarketCap || formatLargeNumber(stock.marketCap) || 'N/A'}</td>
                <td title="Price to Earnings ratio - lower values may indicate better value">${stock.peRatio ? stock.peRatio.toFixed(2) : 'N/A'}</td>
                <td title="Annual dividend as percentage of share price">${stock.dividendYield ? (stock.dividendYield * 100).toFixed(2) + '%' : 'N/A'}</td>
                <td title="${debtEbitdaInfo.tooltipText}">${stock.netDebtToEBITDA ? stock.netDebtToEBITDA.toFixed(2) + 'x' : 'N/A'}${debtEbitdaInfo.icon}</td>
                <td title="${rotceInfo.tooltipText}">${stock.rotce ? (stock.rotce * 100).toFixed(2) + '%' : 'N/A'}${rotceInfo.icon}</td>
            `;
            
            tbody.appendChild(tr);
        });
        
        table.appendChild(tbody);
        
        // Add table to container
        stockTableContainer.appendChild(table);
    }
    
    /**
     * Update stats display
     * @param {Object} stats - Stats data
     */
    function updateStats(stats) {
        console.log('Updating stats:', stats);
        
        if (!stats) {
            console.error('Invalid stats data');
            return;
        }
        
        // Update stats display
        totalStocksElement.textContent = stats.totalStocks || 0;
        nyseStocksElement.textContent = stats.nyseStocks || 0;
        nasdaqStocksElement.textContent = stats.nasdaqStocks || 0;
        
        // Update last updated timestamp
        if (stats.lastUpdated) {
            const date = new Date(stats.lastUpdated);
            lastUpdatedElement.textContent = `${date.toLocaleDateString()}, ${date.toLocaleTimeString()}`;
        } else {
            lastUpdatedElement.textContent = 'Unknown';
        }
    }
    
    /**
     * Update API status indicator
     * @param {Boolean} isConnected - Whether API is connected
     */
    function updateApiStatus(isConnected) {
        console.log('Updating API status:', isConnected);
        
        apiStatusIndicator.classList.toggle('connected', isConnected);
        apiStatusText.textContent = isConnected ? 'connected' : 'disconnected';
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
     * Handle page change
     * @param {Number} page - New page number
     */
    function handlePageChange(page) {
        console.log('Handling page change to', page);
        
        // Update URL with new page
        const url = new URL(window.location);
        url.searchParams.set('page', page);
        window.history.pushState({}, '', url);
        
        // Load new page
        loadStocksPage(page, pageSize);
    }
    
    /**
     * Handle search input
     * @param {Event} event - Input event
     */
    function handleSearch(event) {
        console.log('Handling search:', event.target.value);
        
        const searchTerm = event.target.value.trim();
        
        // Update active filters
        if (searchTerm) {
            activeFilters.search = searchTerm;
        } else {
            delete activeFilters.search;
        }
        
        // Reset to first page and reload
        currentPage = 1;
        loadStocksPage(currentPage, pageSize);
    }
    
    /**
     * Toggle filters visibility
     */
    function toggleFilters() {
        console.log('Toggling filters');
        
        filtersContent.classList.toggle('collapsed');
        filtersToggle.classList.toggle('collapsed');
    }
    
    /**
     * Switch view between card and table
     * @param {String} view - View type ('card' or 'table')
     */
    function switchView(view) {
        console.log('Switching view to', view);
        
        if (view === currentView) {
            return;
        }
        
        currentView = view;
        
        // Update URL with new view
        const url = new URL(window.location);
        url.searchParams.set('view', view);
        window.history.pushState({}, '', url);
        
        // Re-render stocks
        directRenderStocks(currentStocks);
    }
    
    /**
     * Toggle filter button
     * @param {HTMLElement} button - Filter button element
     */
    function toggleFilter(button) {
        console.log('Toggling filter:', button.dataset.filter, button.dataset.value);
        
        const filter = button.dataset.filter;
        const value = button.dataset.value;
        
        // Toggle button selection
        button.classList.toggle('selected');
        
        // Update active filters
        if (!activeFilters[filter]) {
            activeFilters[filter] = [];
        }
        
        if (button.classList.contains('selected')) {
            // Add filter value
            if (!activeFilters[filter].includes(value)) {
                activeFilters[filter].push(value);
            }
        } else {
            // Remove filter value
            activeFilters[filter] = activeFilters[filter].filter(v => v !== value);
            
            // Remove empty filter
            if (activeFilters[filter].length === 0) {
                delete activeFilters[filter];
            }
        }
        
        console.log('Updated active filters:', activeFilters);
        
        // Reset to first page and reload
        currentPage = 1;
        loadStocksPage(currentPage, pageSize);
    }
    
    /**
     * Toggle preset button
     * @param {HTMLElement} button - Preset button element
     */
    function togglePreset(button) {
        console.log('Toggling preset:', button.dataset.preset);
        
        const preset = button.dataset.preset;
        
        // Clear existing filters
        activeFilters = {};
        
        // Remove selection from all filter buttons
        document.querySelectorAll('.filter-button').forEach(btn => {
            btn.classList.remove('selected');
        });
        
        // Apply preset filters
        switch (preset) {
            case 'value':
                // Value stocks: Low P/E, Low Debt, High Dividend
                selectFilterButton('pe', 'low');
                selectFilterButton('debt', 'low');
                selectFilterButton('dividend', 'high');
                break;
                
            case 'growth':
                // Growth stocks: High P/E, High Volume
                selectFilterButton('pe', 'high');
                selectFilterButton('volume', 'high');
                break;
                
            case 'dividend':
                // Dividend stocks: High Dividend, Large Cap
                selectFilterButton('dividend', 'high');
                selectFilterButton('marketCap', 'large');
                break;
                
            case 'quality':
                // Quality stocks: Low Debt, High ROTCE
                selectFilterButton('debt', 'low');
                selectFilterButton('rotce', 'excellent');
                break;
        }
        
        console.log('Applied preset filters:', activeFilters);
        
        // Reset to first page and reload
        currentPage = 1;
        loadStocksPage(currentPage, pageSize);
    }
    
    /**
     * Select a filter button and update active filters
     * @param {String} filter - Filter name
     * @param {String} value - Filter value
     */
    function selectFilterButton(filter, value) {
        const button = document.querySelector(`.filter-button[data-filter="${filter}"][data-value="${value}"]`);
        
        if (button) {
            button.classList.add('selected');
            
            if (!activeFilters[filter]) {
                activeFilters[filter] = [];
            }
            
            if (!activeFilters[filter].includes(value)) {
                activeFilters[filter].push(value);
            }
        }
    }
    
    /**
     * Convert active filters to backend parameters
     * @param {Object} filters - Active filters
     * @returns {URLSearchParams} - URL search params
     */
    function convertFiltersToBackendParams(filters) {
        console.log('Converting filters to backend params:', filters);
        
        const params = new URLSearchParams();
        
        // Add search parameter
        if (filters.search) {
            params.append('search', filters.search);
        }
        
        // Process market cap filters
        if (filters.marketCap && filters.marketCap.length > 0) {
            let minMarketCap = 0;
            let maxMarketCap = Infinity;
            
            filters.marketCap.forEach(value => {
                switch (value) {
                    case 'large':
                        minMarketCap = Math.max(minMarketCap, 10000000000); // $10B+
                        break;
                    case 'mid':
                        minMarketCap = Math.max(minMarketCap, 2000000000); // $2B+
                        maxMarketCap = Math.min(maxMarketCap, 10000000000); // <$10B
                        break;
                    case 'small':
                        minMarketCap = Math.max(minMarketCap, 300000000); // $300M+
                        maxMarketCap = Math.min(maxMarketCap, 2000000000); // <$2B
                        break;
                    case 'micro':
                        maxMarketCap = Math.min(maxMarketCap, 300000000); // <$300M
                        break;
                }
            });
            
            if (minMarketCap > 0) {
                params.append('minMarketCap', minMarketCap);
            }
            
            if (maxMarketCap < Infinity) {
                params.append('maxMarketCap', maxMarketCap);
            }
        }
        
        // Process volume filters
        if (filters.volume && filters.volume.length > 0) {
            let minVolume = 0;
            let maxVolume = Infinity;
            
            filters.volume.forEach(value => {
                switch (value) {
                    case 'high':
                        minVolume = Math.max(minVolume, 5000000); // $5M+
                        break;
                    case 'medium':
                        minVolume = Math.max(minVolume, 1000000); // $1M+
                        maxVolume = Math.min(maxVolume, 5000000); // <$5M
                        break;
                    case 'low':
                        maxVolume = Math.min(maxVolume, 1000000); // <$1M
                        break;
                }
            });
            
            if (minVolume > 0) {
                params.append('minVolume', minVolume);
            }
            
            if (maxVolume < Infinity) {
                params.append('maxVolume', maxVolume);
            }
        }
        
        // Process debt filters
        if (filters.debt && filters.debt.length > 0) {
            let minDebtToEBITDA = 0;
            let maxDebtToEBITDA = Infinity;
            
            filters.debt.forEach(value => {
                switch (value) {
                    case 'low':
                        maxDebtToEBITDA = Math.min(maxDebtToEBITDA, 0.5); // <0.5x
                        break;
                    case 'medium':
                        minDebtToEBITDA = Math.max(minDebtToEBITDA, 0.5); // 0.5x+
                        maxDebtToEBITDA = Math.min(maxDebtToEBITDA, 1.5); // <1.5x
                        break;
                    case 'high':
                        minDebtToEBITDA = Math.max(minDebtToEBITDA, 1.5); // 1.5x+
                        break;
                }
            });
            
            if (minDebtToEBITDA > 0) {
                params.append('minDebtToEBITDA', minDebtToEBITDA);
            }
            
            if (maxDebtToEBITDA < Infinity) {
                params.append('maxDebtToEBITDA', maxDebtToEBITDA);
            }
        }
        
        // Process P/E ratio filters
        if (filters.pe && filters.pe.length > 0) {
            let minPE = 0;
            let maxPE = Infinity;
            
            filters.pe.forEach(value => {
                switch (value) {
                    case 'low':
                        maxPE = Math.min(maxPE, 15); // <15
                        break;
                    case 'medium':
                        minPE = Math.max(minPE, 15); // 15+
                        maxPE = Math.min(maxPE, 25); // <25
                        break;
                    case 'high':
                        minPE = Math.max(minPE, 25); // 25+
                        break;
                }
            });
            
            if (minPE > 0) {
                params.append('minPE', minPE);
            }
            
            if (maxPE < Infinity) {
                params.append('maxPE', maxPE);
            }
        }
        
        // Process ROTCE filters
        if (filters.rotce && filters.rotce.length > 0) {
            let minROTCE = 0;
            let maxROTCE = Infinity;
            
            filters.rotce.forEach(value => {
                switch (value) {
                    case 'excellent':
                        minROTCE = Math.max(minROTCE, 0.2); // 20%+
                        break;
                    case 'good':
                        minROTCE = Math.max(minROTCE, 0.15); // 15%+
                        maxROTCE = Math.min(maxROTCE, 0.2); // <20%
                        break;
                    case 'average':
                        minROTCE = Math.max(minROTCE, 0.1); // 10%+
                        maxROTCE = Math.min(maxROTCE, 0.15); // <15%
                        break;
                    case 'belowAverage':
                        minROTCE = Math.max(minROTCE, 0.05); // 5%+
                        maxROTCE = Math.min(maxROTCE, 0.1); // <10%
                        break;
                    case 'poor':
                        maxROTCE = Math.min(maxROTCE, 0.05); // <5%
                        break;
                }
            });
            
            if (minROTCE > 0) {
                params.append('minROTCE', minROTCE);
            }
            
            if (maxROTCE < Infinity) {
                params.append('maxROTCE', maxROTCE);
            }
        }
        
        return params;
    }
    
    /**
     * Handle window resize
     */
    function handleResize() {
        console.log('Handling window resize');
        
        // Re-render stocks to adjust layout
        directRenderStocks(currentStocks);
    }
    
    /**
     * Format currency value
     * @param {Number} value - Currency value
     * @returns {String} Formatted currency string
     */
    function formatCurrency(value) {
        if (value === null || value === undefined) {
            return null;
        }
        
        return '$' + value.toFixed(2);
    }
    
    /**
     * Format large number with suffix (K, M, B, T)
     * @param {Number} value - Number value
     * @returns {String} Formatted number string
     */
    function formatLargeNumber(value) {
        if (value === null || value === undefined) {
            return null;
        }
        
        if (value >= 1000000000000) {
            return '$' + (value / 1000000000000).toFixed(2) + 'T';
        } else if (value >= 1000000000) {
            return '$' + (value / 1000000000).toFixed(2) + 'B';
        } else if (value >= 1000000) {
            return '$' + (value / 1000000).toFixed(2) + 'M';
        } else if (value >= 1000) {
            return '$' + (value / 1000).toFixed(2) + 'K';
        } else {
            return '$' + value.toFixed(2);
        }
    }
    
    /**
     * Debounce function to limit function calls
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
