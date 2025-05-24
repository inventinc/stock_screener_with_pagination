/**
 * Minimal Stock Screener - Simplified rendering with vanilla JavaScript
 * 
 * This version maintains the exact same visual appearance and functionality
 * but uses a simplified rendering approach to ensure stocks always display
 * when filters are applied.
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
    
    // Simple state
    let currentView = 'card'; // 'card' or 'table'
    let activeFilters = {};
    let currentStocks = [];
    let totalItems = 0;
    let isLoading = false;
    
    // Debug mode - log all major operations
    const DEBUG = true;
    
    // Initialize app
    initApp();
    
    /**
     * Initialize the application
     */
    function initApp() {
        logDebug('Initializing app');
        
        // Set up event listeners
        setupEventListeners();
        
        // Load initial data
        loadInitialData();
    }
    
    /**
     * Set up event listeners
     */
    function setupEventListeners() {
        logDebug('Setting up event listeners');
        
        // Filters toggle
        filtersToggle.addEventListener('click', toggleFilters);
        
        // View buttons
        cardViewButton.addEventListener('click', function() {
            logDebug('Card view button clicked');
            switchView('card');
        });
        
        tableViewButton.addEventListener('click', function() {
            logDebug('Table view button clicked');
            switchView('table');
        });
        
        // Search input
        searchInput.addEventListener('input', debounce(function() {
            logDebug('Search input changed');
            handleSearch();
        }, 500));
        
        // Filter buttons
        document.querySelectorAll('.filter-button').forEach(button => {
            button.addEventListener('click', function() {
                logDebug('Filter button clicked:', button.dataset.filter, button.dataset.value);
                toggleFilter(button);
            });
        });
        
        // Preset buttons
        document.querySelectorAll('.preset-button').forEach(button => {
            button.addEventListener('click', function() {
                logDebug('Preset button clicked:', button.dataset.preset);
                togglePreset(button);
            });
        });
    }
    
    /**
     * Load initial data
     */
    function loadInitialData() {
        logDebug('Loading initial data');
        
        // Show loading state
        setLoading(true);
        
        // Get pagination parameters from URL or defaults
        const urlParams = new URLSearchParams(window.location.search);
        const page = parseInt(urlParams.get('page')) || 1;
        const pageSize = parseInt(urlParams.get('pageSize')) || 50;
        
        // Initialize pagination
        initPagination(page, pageSize);
        
        // Load stats
        fetch('/api/stats')
            .then(response => response.json())
            .then(stats => {
                logDebug('Stats loaded:', stats);
                updateStats(stats);
            })
            .catch(error => {
                console.error('Error loading stats:', error);
            });
        
        // Load first page of stocks
        loadStocksPage(page, pageSize);
    }
    
    /**
     * Initialize pagination
     */
    function initPagination(page, pageSize) {
        logDebug('Initializing pagination with page', page, 'pageSize', pageSize);
        
        // Create pagination controls if not exists
        if (!window.paginationControls) {
            window.paginationControls = new PaginationControls({
                container: paginationContainer,
                totalItems: 0,
                pageSize: pageSize,
                currentPage: page,
                onPageChange: function(newPage, newPageSize) {
                    logDebug('Page changed to', newPage, 'pageSize', newPageSize);
                    loadStocksPage(newPage, newPageSize);
                }
            });
        } else {
            // Update existing pagination
            window.paginationControls.update(totalItems, page);
            window.paginationControls.pageSize = pageSize;
            window.paginationControls.currentPage = page;
        }
    }
    
    /**
     * Load a specific page of stocks from API
     */
    function loadStocksPage(page, pageSize) {
        logDebug('Loading stocks page', page, 'pageSize', pageSize);
        
        // Show loading state
        setLoading(true);
        
        // Build query parameters
        const params = new URLSearchParams({
            page: page,
            pageSize: pageSize
        });
        
        // Convert active filters to backend parameters
        Object.entries(activeFilters).forEach(([key, value]) => {
            if (key === 'market_cap') {
                processMarketCapFilters(value, params);
            } else if (key === 'volume') {
                processVolumeFilters(value, params);
            } else if (key === 'debt') {
                processDebtFilters(value, params);
            } else if (key === 'valuation') {
                processValuationFilters(value, params);
            } else if (key === 'preset') {
                if (Array.isArray(value)) {
                    value.forEach(v => params.append('preset', v));
                } else {
                    params.append('preset', value);
                }
            } else if (key === 'search') {
                params.append('search', value);
            } else {
                if (Array.isArray(value)) {
                    value.forEach(v => params.append(key, v));
                } else {
                    params.append(key, value);
                }
            }
        });
        
        logDebug('API request params:', params.toString());
        
        // Fetch stocks from API
        fetch(`/api/stocks?${params.toString()}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`API error: ${response.status} ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                logDebug('API response received with', data.stocks.length, 'stocks');
                
                // Process stocks data
                processAndRenderStocks(data);
            })
            .catch(error => {
                console.error('Error loading stocks:', error);
                setLoading(false);
            });
    }
    
    /**
     * Process and render stocks data
     */
    function processAndRenderStocks(data) {
        if (!data || !data.stocks || !Array.isArray(data.stocks)) {
            console.error('Invalid API response format');
            setLoading(false);
            return;
        }
        
        // Format stock data for display
        const processedStocks = data.stocks.map(stock => {
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
        
        // Update state
        currentStocks = processedStocks;
        totalItems = data.pagination ? data.pagination.total : processedStocks.length;
        
        // Update pagination
        if (window.paginationControls) {
            window.paginationControls.update(totalItems);
        }
        
        // Render stocks
        renderStocks();
        
        // Hide loading state
        setLoading(false);
        
        logDebug('Stocks processed and rendered');
    }
    
    /**
     * Render stocks in current view
     */
    function renderStocks() {
        logDebug('Rendering stocks in', currentView, 'view with', currentStocks.length, 'stocks');
        
        // Clear containers first
        stockCardsContainer.innerHTML = '';
        stockTableContainer.innerHTML = '';
        
        // Show appropriate container
        stockCardsContainer.style.display = currentView === 'card' ? 'grid' : 'none';
        stockTableContainer.style.display = currentView === 'table' ? 'block' : 'none';
        
        // Update active button
        cardViewButton.classList.toggle('active', currentView === 'card');
        tableViewButton.classList.toggle('active', currentView === 'table');
        
        // If loading, show skeletons
        if (isLoading) {
            if (currentView === 'card') {
                renderCardSkeletons();
            } else {
                renderTableSkeleton();
            }
            return;
        }
        
        // If no stocks, show empty state
        if (!currentStocks || currentStocks.length === 0) {
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
            return;
        }
        
        // Render stocks in current view
        if (currentView === 'card') {
            renderCardView();
        } else {
            renderTableView();
        }
        
        // Force browser to repaint
        forceRepaint();
    }
    
    /**
     * Force browser to repaint
     */
    function forceRepaint() {
        logDebug('Forcing browser repaint');
        
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
     * Render card view
     */
    function renderCardView() {
        logDebug('Rendering card view');
        
        // Create document fragment for better performance
        const fragment = document.createDocumentFragment();
        
        // Render each stock card
        currentStocks.forEach(stock => {
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
                        <div class="metric-label">Score</div>
                        <div class="metric-value">
                            ${renderScore(stock.score)}
                        </div>
                    </div>
                </div>
            `;
            
            fragment.appendChild(card);
        });
        
        // Append all cards at once
        stockCardsContainer.appendChild(fragment);
    }
    
    /**
     * Render table view
     */
    function renderTableView() {
        logDebug('Rendering table view');
        
        // Create table
        const table = document.createElement('table');
        table.className = 'stock-table';
        
        // Create table header
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        
        // Define columns
        const columns = [
            { field: 'symbol', label: 'Symbol' },
            { field: 'name', label: 'Name' },
            { field: 'exchange', label: 'Exchange' },
            { field: 'price', label: 'Price' },
            { field: 'marketCap', label: 'Market Cap' },
            { field: 'peRatio', label: 'P/E Ratio' },
            { field: 'dividendYield', label: 'Div Yield' },
            { field: 'netDebtToEBITDA', label: 'Debt/EBITDA' },
            { field: 'score', label: 'Score' }
        ];
        
        // Create header cells
        columns.forEach(column => {
            const th = document.createElement('th');
            th.textContent = column.label;
            headerRow.appendChild(th);
        });
        
        thead.appendChild(headerRow);
        table.appendChild(thead);
        
        // Create table body
        const tbody = document.createElement('tbody');
        
        // Create document fragment for better performance
        const fragment = document.createDocumentFragment();
        
        // Create rows
        currentStocks.forEach(stock => {
            const row = document.createElement('tr');
            
            // Add cells
            columns.forEach(column => {
                const cell = document.createElement('td');
                
                // Get value
                let value = stock[column.field];
                
                // Format value
                if (column.field === 'symbol') {
                    cell.innerHTML = `<span class="stock-symbol-cell">${value}</span>`;
                } else if (column.field === 'price') {
                    cell.textContent = stock.formattedPrice || formatCurrency(value) || 'N/A';
                } else if (column.field === 'marketCap') {
                    cell.textContent = stock.formattedMarketCap || formatLargeNumber(value) || 'N/A';
                } else if (column.field === 'peRatio') {
                    cell.textContent = value ? value.toFixed(2) : 'N/A';
                } else if (column.field === 'dividendYield') {
                    cell.textContent = value ? (value * 100).toFixed(2) + '%' : 'N/A';
                } else if (column.field === 'netDebtToEBITDA') {
                    cell.textContent = value ? value.toFixed(2) + 'x' : 'N/A';
                } else if (column.field === 'score') {
                    cell.innerHTML = renderScore(value);
                } else {
                    cell.textContent = value || 'N/A';
                }
                
                row.appendChild(cell);
            });
            
            fragment.appendChild(row);
        });
        
        // Append all rows at once
        tbody.appendChild(fragment);
        table.appendChild(tbody);
        stockTableContainer.appendChild(table);
    }
    
    /**
     * Render card skeletons for loading state
     */
    function renderCardSkeletons() {
        logDebug('Rendering card skeletons');
        
        const pageSize = window.paginationControls ? window.paginationControls.pageSize : 50;
        
        // Create document fragment for better performance
        const fragment = document.createDocumentFragment();
        
        for (let i = 0; i < Math.min(pageSize, 12); i++) {
            const skeleton = document.createElement('div');
            skeleton.className = 'stock-card skeleton';
            skeleton.innerHTML = `
                <div class="skeleton-header">
                    <div class="skeleton-symbol"></div>
                    <div class="skeleton-exchange"></div>
                </div>
                <div class="skeleton-name"></div>
                <div class="skeleton-metrics">
                    <div class="skeleton-metric"></div>
                    <div class="skeleton-metric"></div>
                    <div class="skeleton-metric"></div>
                    <div class="skeleton-metric"></div>
                    <div class="skeleton-metric"></div>
                    <div class="skeleton-metric"></div>
                </div>
            `;
            fragment.appendChild(skeleton);
        }
        
        stockCardsContainer.appendChild(fragment);
    }
    
    /**
     * Render table skeleton for loading state
     */
    function renderTableSkeleton() {
        logDebug('Rendering table skeleton');
        
        const pageSize = window.paginationControls ? window.paginationControls.pageSize : 50;
        
        const table = document.createElement('table');
        table.className = 'stock-table skeleton-table';
        
        // Create table header
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        
        // Create header cells
        for (let i = 0; i < 9; i++) {
            const th = document.createElement('th');
            th.innerHTML = '<div class="skeleton-header"></div>';
            headerRow.appendChild(th);
        }
        
        thead.appendChild(headerRow);
        table.appendChild(thead);
        
        // Create table body
        const tbody = document.createElement('tbody');
        
        // Create document fragment for better performance
        const fragment = document.createDocumentFragment();
        
        // Create rows
        for (let i = 0; i < Math.min(pageSize, 20); i++) {
            const row = document.createElement('tr');
            
            // Add cells
            for (let j = 0; j < 9; j++) {
                const cell = document.createElement('td');
                cell.innerHTML = '<div class="skeleton-cell"></div>';
                row.appendChild(cell);
            }
            
            fragment.appendChild(row);
        }
        
        tbody.appendChild(fragment);
        table.appendChild(tbody);
        stockTableContainer.appendChild(table);
    }
    
    /**
     * Render score
     */
    function renderScore(score) {
        if (!score && score !== 0) return 'N/A';
        
        let scoreClass = '';
        if (score >= 80) scoreClass = 'excellent';
        else if (score >= 60) scoreClass = 'good';
        else if (score >= 40) scoreClass = 'average';
        else if (score >= 20) scoreClass = 'below-average';
        else scoreClass = 'poor';
        
        return `<span class="score ${scoreClass}">${score}</span>`;
    }
    
    /**
     * Update stats
     */
    function updateStats(stats) {
        if (!stats) return;
        
        // Update stats in UI
        totalStocksElement.textContent = formatNumber(stats.total || 0);
        nyseStocksElement.textContent = formatNumber(stats.nyse || 0);
        nasdaqStocksElement.textContent = formatNumber(stats.nasdaq || 0);
        
        // Update last updated
        if (stats.lastUpdated) {
            const date = new Date(stats.lastUpdated);
            lastUpdatedElement.textContent = date.toLocaleString();
        }
        
        // Update API status
        updateApiStatus(true);
    }
    
    /**
     * Update API status
     */
    function updateApiStatus(connected) {
        if (connected) {
            apiStatusIndicator.classList.remove('disconnected');
            apiStatusIndicator.classList.add('connected');
            apiStatusText.textContent = 'connected';
        } else {
            apiStatusIndicator.classList.remove('connected');
            apiStatusIndicator.classList.add('disconnected');
            apiStatusText.textContent = 'disconnected';
        }
    }
    
    /**
     * Set loading state
     */
    function setLoading(loading) {
        logDebug('Setting loading state to', loading);
        
        isLoading = loading;
        
        // Update loading indicator
        document.body.classList.toggle('loading', loading);
    }
    
    /**
     * Toggle filters
     */
    function toggleFilters() {
        logDebug('Toggling filters');
        
        filtersContent.classList.toggle('collapsed');
        filtersToggle.classList.toggle('collapsed');
    }
    
    /**
     * Switch view
     */
    function switchView(view) {
        if (currentView === view) return;
        
        logDebug('Switching view to', view);
        
        currentView = view;
        
        // Render stocks in new view
        renderStocks();
    }
    
    /**
     * Handle search
     */
    function handleSearch() {
        const searchValue = searchInput.value.trim();
        
        logDebug('Handling search for', searchValue);
        
        // Update active filters
        if (searchValue) {
            activeFilters.search = searchValue;
        } else {
            delete activeFilters.search;
        }
        
        // Reset to first page and apply filters
        if (window.paginationControls) {
            window.paginationControls.goToPage(1);
        }
        
        // Load stocks with new filters
        loadStocksPage(1, window.paginationControls ? window.paginationControls.pageSize : 50);
    }
    
    /**
     * Toggle filter
     */
    function toggleFilter(button) {
        const filter = button.dataset.filter;
        const value = button.dataset.value;
        
        logDebug('Toggling filter', filter, value);
        
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
            
            // Remove empty filter
            if (activeFilters[filter].length === 0) {
                delete activeFilters[filter];
            }
        }
        
        logDebug('Active filters after toggle:', activeFilters);
        
        // Reset to first page and apply filters
        if (window.paginationControls) {
            window.paginationControls.goToPage(1);
        }
        
        // Load stocks with new filters
        loadStocksPage(1, window.paginationControls ? window.paginationControls.pageSize : 50);
    }
    
    /**
     * Toggle preset
     */
    function togglePreset(button) {
        const preset = button.dataset.preset;
        
        logDebug('Toggling preset', preset);
        
        // Toggle active state
        button.classList.toggle('active');
        
        // Update active filters
        if (!activeFilters.preset) {
            activeFilters.preset = [];
        }
        
        if (button.classList.contains('active')) {
            // Add preset
            if (!activeFilters.preset.includes(preset)) {
                activeFilters.preset.push(preset);
            }
        } else {
            // Remove preset
            activeFilters.preset = activeFilters.preset.filter(p => p !== preset);
            
            // Remove empty preset
            if (activeFilters.preset.length === 0) {
                delete activeFilters.preset;
            }
        }
        
        logDebug('Active presets after toggle:', activeFilters.preset);
        
        // Reset to first page and apply filters
        if (window.paginationControls) {
            window.paginationControls.goToPage(1);
        }
        
        // Load stocks with new filters
        loadStocksPage(1, window.paginationControls ? window.paginationControls.pageSize : 50);
    }
    
    /**
     * Process market cap filters
     */
    function processMarketCapFilters(values, params) {
        if (!Array.isArray(values)) {
            values = [values];
        }
        
        values.forEach(value => {
            switch (value) {
                case 'large':
                    // Large cap: $10B+
                    params.append('marketCapMin', 10000000000);
                    break;
                case 'mid':
                    // Mid cap: $2B-$10B
                    params.append('marketCapMin', 2000000000);
                    params.append('marketCapMax', 10000000000);
                    break;
                case 'small':
                    // Small cap: $300M-$2B
                    params.append('marketCapMin', 300000000);
                    params.append('marketCapMax', 2000000000);
                    break;
                case 'micro':
                    // Micro cap: <$300M
                    params.append('marketCapMax', 300000000);
                    break;
            }
        });
    }
    
    /**
     * Process volume filters
     */
    function processVolumeFilters(values, params) {
        if (!Array.isArray(values)) {
            values = [values];
        }
        
        values.forEach(value => {
            switch (value) {
                case 'high':
                    // High volume: >$5M
                    params.append('avgVolumeMin', 5000000);
                    break;
                case 'medium':
                    // Medium volume: $1M-$5M
                    params.append('avgVolumeMin', 1000000);
                    params.append('avgVolumeMax', 5000000);
                    break;
                case 'low':
                    // Low volume: <$1M
                    params.append('avgVolumeMax', 1000000);
                    break;
            }
        });
    }
    
    /**
     * Process debt filters
     */
    function processDebtFilters(values, params) {
        if (!Array.isArray(values)) {
            values = [values];
        }
        
        values.forEach(value => {
            switch (value) {
                case 'low':
                    // Low debt: <0.5x
                    params.append('debtMin', 0);
                    params.append('debtMax', 0.5);
                    break;
                case 'medium':
                    // Medium debt: 0.5x-1.5x
                    params.append('debtMin', 0.5);
                    params.append('debtMax', 1.5);
                    break;
                case 'high':
                    // High debt: >1.5x
                    params.append('debtMin', 1.5);
                    break;
            }
        });
    }
    
    /**
     * Process valuation filters
     */
    function processValuationFilters(values, params) {
        if (!Array.isArray(values)) {
            values = [values];
        }
        
        values.forEach(value => {
            switch (value) {
                case 'undervalued':
                    // Undervalued: P/E < 15
                    params.append('peMin', 0); // Exclude negative P/E
                    params.append('peMax', 15);
                    break;
                case 'fair':
                    // Fair value: P/E 15-25
                    params.append('peMin', 15);
                    params.append('peMax', 25);
                    break;
                case 'overvalued':
                    // Overvalued: P/E > 25
                    params.append('peMin', 25);
                    break;
            }
        });
    }
    
    /**
     * Format currency
     */
    function formatCurrency(value) {
        if (value === null || value === undefined) return null;
        
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(value);
    }
    
    /**
     * Format large number
     */
    function formatLargeNumber(value) {
        if (value === null || value === undefined) return null;
        
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
     * Format number
     */
    function formatNumber(value) {
        return new Intl.NumberFormat('en-US').format(value);
    }
    
    /**
     * Debounce function
     */
    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }
    
    /**
     * Log debug message
     */
    function logDebug(...args) {
        if (DEBUG) {
            console.log('[StockScreener]', ...args);
        }
    }
    
    // Add CSS for force-repaint class
    const style = document.createElement('style');
    style.textContent = `
        .force-repaint {
            animation: force-repaint-keyframes 0.001s;
        }
        @keyframes force-repaint-keyframes {
            0% { opacity: 0.99999; }
            100% { opacity: 1; }
        }
    `;
    document.head.appendChild(style);
    
    // Add a manual refresh function for debugging
    window.refreshStocks = function() {
        logDebug('Manual refresh triggered');
        renderStocks();
    };
    
    // Add a periodic check to ensure UI is in sync with data
    setInterval(function() {
        if (currentStocks.length > 0 && 
            document.querySelectorAll('.stock-card, .stock-table tbody tr').length === 0 && 
            !isLoading) {
            logDebug('Detected UI out of sync with data, forcing re-render');
            renderStocks();
        }
    }, 2000);
});
