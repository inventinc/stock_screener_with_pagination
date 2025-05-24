/**
 * PaginatedStockApp - Stock screener application with pagination and adaptive card view
 * 
 * Features:
 * - Classic pagination with modern UX
 * - Adaptive card heights for mobile
 * - Optimized data loading
 * - Responsive design for all devices
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
    
    // Initialize pagination controls
    const pagination = new PaginationControls({
        container: paginationContainer,
        totalItems: 0,
        pageSize: 50,
        currentPage: 1,
        onPageChange: handlePageChange
    });
    
    // Initialize tooltip
    const tooltip = new Tooltip();
    
    // Initialize app
    initApp();
    
    /**
     * Initialize the application
     */
    function initApp() {
        // Set up event listeners
        setupEventListeners();
        
        // Load initial data
        loadInitialData();
        
        // Update API status
        updateApiStatus(true);
    }
    
    /**
     * Set up event listeners
     */
    function setupEventListeners() {
        // Filters toggle
        filtersToggle.addEventListener('click', toggleFilters);
        
        // View buttons
        cardViewButton.addEventListener('click', () => switchView('card'));
        tableViewButton.addEventListener('click', () => switchView('table'));
        
        // Search input
        searchInput.addEventListener('input', debounce(handleSearch, 300));
        
        // Filter buttons
        document.querySelectorAll('.filter-button').forEach(button => {
            button.addEventListener('click', () => toggleFilter(button));
        });
        
        // Preset buttons
        document.querySelectorAll('.preset-button').forEach(button => {
            button.addEventListener('click', () => togglePreset(button));
        });
        
        // Window resize
        window.addEventListener('resize', debounce(handleResize, 200));
    }
    
    /**
     * Load initial data
     */
    function loadInitialData() {
        // Show loading state
        setLoading(true);
        
        // Get pagination parameters from URL or defaults
        const urlParams = new URLSearchParams(window.location.search);
        const page = parseInt(urlParams.get('page')) || 1;
        const pageSize = parseInt(urlParams.get('pageSize')) || 50;
        
        // Update pagination control
        pagination.currentPage = page;
        pagination.pageSize = pageSize;
        
        // Load stats
        fetch('/api/stats')
            .then(response => response.json())
            .then(stats => {
                updateStats(stats);
                
                // Load first page of stocks
                return loadStocksPage(page, pageSize);
            })
            .catch(error => {
                console.error('Error loading stats:', error);
                updateApiStatus(false);
                setLoading(false);
            });
    }
    
    /**
     * Load a specific page of stocks
     * @param {Number} page - Page number
     * @param {Number} pageSize - Items per page
     * @returns {Promise} Promise that resolves with loaded stocks
     */
    function loadStocksPage(page, pageSize) {
        setLoading(true);
        
        // Build query parameters
        const params = new URLSearchParams({
            page: page,
            pageSize: pageSize
        });
        
        // Add filter parameters
        Object.entries(activeFilters).forEach(([key, value]) => {
            if (Array.isArray(value)) {
                value.forEach(v => params.append(key, v));
            } else if (value) {
                params.append(key, value);
            }
        });
        
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
                
                // Process stocks data
                const processedStocks = processStocksData(data.stocks);
                
                // Update state
                currentStocks = processedStocks;
                totalItems = data.pagination ? data.pagination.total : processedStocks.length;
                
                // Update pagination
                pagination.update(totalItems, page);
                
                // Render stocks
                renderStocks(processedStocks);
                
                // Update API status
                updateApiStatus(true);
                
                setLoading(false);
                return processedStocks;
            })
            .catch(error => {
                console.error('Error loading stocks:', error);
                updateApiStatus(false);
                setLoading(false);
                throw error;
            });
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
     * Render stocks in current view
     * @param {Array} stocks - Stocks to render
     */
    function renderStocks(stocks) {
        if (currentView === 'card') {
            renderCardView(stocks);
        } else {
            renderTableView(stocks);
        }
    }
    
    /**
     * Render card view
     * @param {Array} stocks - Stocks to render
     */
    function renderCardView(stocks) {
        // Clear container
        stockCardsContainer.innerHTML = '';
        
        // Show loading skeleton if loading
        if (isLoading) {
            renderCardSkeletons();
            return;
        }
        
        // Show empty state if no stocks
        if (!stocks || stocks.length === 0) {
            stockCardsContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📊</div>
                    <div class="empty-title">No stocks found</div>
                    <div class="empty-message">Try adjusting your filters or search criteria</div>
                </div>
            `;
            return;
        }
        
        // Render each stock card
        stocks.forEach(stock => {
            const cardElement = document.createElement('div');
            renderStockCard(stock, cardElement);
            stockCardsContainer.appendChild(cardElement);
        });
    }
    
    /**
     * Render table view
     * @param {Array} stocks - Stocks to render
     */
    function renderTableView(stocks) {
        // Clear container
        stockTableContainer.innerHTML = '';
        stockTableContainer.style.display = 'block';
        
        // Show loading skeleton if loading
        if (isLoading) {
            renderTableSkeleton();
            return;
        }
        
        // Show empty state if no stocks
        if (!stocks || stocks.length === 0) {
            stockTableContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📊</div>
                    <div class="empty-title">No stocks found</div>
                    <div class="empty-message">Try adjusting your filters or search criteria</div>
                </div>
            `;
            return;
        }
        
        // Create table
        const table = document.createElement('table');
        table.className = 'stock-table';
        
        // Create table header
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        
        // Define columns - EXPLICITLY INCLUDE P/E RATIO AND DIVIDEND YIELD
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
        
        // Create rows
        stocks.forEach(stock => {
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
            
            tbody.appendChild(row);
        });
        
        table.appendChild(tbody);
        stockTableContainer.appendChild(table);
    }
    
    /**
     * Render stock card
     * @param {Object} stock - Stock data
     * @param {HTMLElement} container - Container element
     */
    function renderStockCard(stock, container) {
        // Clear container
        container.innerHTML = '';
        container.className = 'stock-card';
        
        // Check if stock has incomplete data
        const hasIncompleteData = !stock.price || !stock.marketCap || !stock.peRatio;
        if (hasIncompleteData) {
            container.classList.add('incomplete-data');
        }
        
        // Create card content with adaptive height
        const content = `
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
                    <div class="metric-value">${renderScore(stock.score)}</div>
                </div>
            </div>
        `;
        
        container.innerHTML = content;
    }
    
    /**
     * Render card skeletons
     */
    function renderCardSkeletons() {
        for (let i = 0; i < 12; i++) {
            const skeleton = document.createElement('div');
            skeleton.className = 'stock-card skeleton';
            skeleton.innerHTML = `
                <div class="stock-header">
                    <div class="skeleton-symbol"></div>
                    <div class="skeleton-exchange"></div>
                </div>
                <div class="skeleton-name"></div>
                <div class="skeleton-metrics">
                    <div class="skeleton-metric"></div>
                    <div class="skeleton-metric"></div>
                    <div class="skeleton-metric"></div>
                    <div class="skeleton-metric"></div>
                </div>
            `;
            stockCardsContainer.appendChild(skeleton);
        }
    }
    
    /**
     * Render table skeleton
     */
    function renderTableSkeleton() {
        const table = document.createElement('table');
        table.className = 'stock-table';
        
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        
        for (let i = 0; i < 8; i++) {
            const th = document.createElement('th');
            th.className = 'skeleton-header';
            headerRow.appendChild(th);
        }
        
        thead.appendChild(headerRow);
        table.appendChild(thead);
        
        const tbody = document.createElement('tbody');
        
        for (let i = 0; i < 10; i++) {
            const row = document.createElement('tr');
            
            for (let j = 0; j < 8; j++) {
                const cell = document.createElement('td');
                cell.className = 'skeleton-cell';
                row.appendChild(cell);
            }
            
            tbody.appendChild(row);
        }
        
        table.appendChild(tbody);
        stockTableContainer.appendChild(table);
    }
    
    /**
     * Switch view
     * @param {String} view - View to switch to ('card' or 'table')
     */
    function switchView(view) {
        if (view === currentView) return;
        
        currentView = view;
        
        // Update buttons
        cardViewButton.classList.toggle('active', view === 'card');
        tableViewButton.classList.toggle('active', view === 'table');
        
        // Update containers
        stockCardsContainer.style.display = view === 'card' ? 'grid' : 'none';
        stockTableContainer.style.display = view === 'table' ? 'block' : 'none';
        
        // Render current view
        renderStocks(currentStocks);
    }
    
    /**
     * Toggle filters
     */
    function toggleFilters() {
        filtersContent.classList.toggle('collapsed');
        filtersToggle.classList.toggle('collapsed');
    }
    
    /**
     * Toggle filter
     * @param {HTMLElement} button - Filter button
     */
    function toggleFilter(button) {
        const filterType = button.dataset.filterType;
        const filterValue = button.dataset.filterValue;
        const multiSelect = button.closest('.filter-group').dataset.multiSelect === 'true';
        
        // Get current filter values
        const currentValues = activeFilters[filterType] || [];
        
        // Check if filter is already active
        const isActive = button.classList.contains('active');
        
        // Update button state
        button.classList.toggle('active', !isActive);
        
        // Update filter values
        if (multiSelect) {
            // Multi-select: add or remove value
            if (isActive) {
                activeFilters[filterType] = currentValues.filter(v => v !== filterValue);
            } else {
                activeFilters[filterType] = [...currentValues, filterValue];
            }
            
            // Remove filter if empty
            if (activeFilters[filterType].length === 0) {
                delete activeFilters[filterType];
            }
        } else {
            // Single-select: replace or remove value
            if (isActive) {
                delete activeFilters[filterType];
            } else {
                // Deactivate other buttons in the same group
                button.closest('.filter-group').querySelectorAll('.filter-button').forEach(btn => {
                    if (btn !== button) {
                        btn.classList.remove('active');
                    }
                });
                
                activeFilters[filterType] = filterValue;
            }
        }
        
        // Reset to first page and reload
        pagination.currentPage = 1;
        loadStocksPage(1, pagination.pageSize);
        
        // Update URL
        updateURL();
    }
    
    /**
     * Toggle preset
     * @param {HTMLElement} button - Preset button
     */
    function togglePreset(button) {
        const presetValue = button.dataset.preset;
        
        // Check if preset is already active
        const isActive = button.classList.contains('active');
        
        // Update button state
        button.classList.toggle('active', !isActive);
        
        // Deactivate other preset buttons
        document.querySelectorAll('.preset-button').forEach(btn => {
            if (btn !== button) {
                btn.classList.remove('active');
            }
        });
        
        // Update filter values
        if (isActive) {
            delete activeFilters.preset;
        } else {
            activeFilters.preset = presetValue;
        }
        
        // Reset to first page and reload
        pagination.currentPage = 1;
        loadStocksPage(1, pagination.pageSize);
        
        // Update URL
        updateURL();
    }
    
    /**
     * Handle search
     */
    function handleSearch() {
        const searchTerm = searchInput.value.trim();
        
        if (searchTerm) {
            activeFilters.search = searchTerm;
        } else {
            delete activeFilters.search;
        }
        
        // Reset to first page and reload
        pagination.currentPage = 1;
        loadStocksPage(1, pagination.pageSize);
        
        // Update URL
        updateURL();
    }
    
    /**
     * Handle page change
     * @param {Number} page - New page number
     */
    function handlePageChange(page) {
        loadStocksPage(page, pagination.pageSize);
        
        // Update URL
        updateURL();
        
        // Scroll to top
        window.scrollTo(0, 0);
    }
    
    /**
     * Handle resize
     */
    function handleResize() {
        // Adjust card layout
        renderStocks(currentStocks);
    }
    
    /**
     * Update URL with current filters and pagination
     */
    function updateURL() {
        const params = new URLSearchParams();
        
        // Add pagination parameters
        params.set('page', pagination.currentPage);
        params.set('pageSize', pagination.pageSize);
        
        // Add filter parameters
        Object.entries(activeFilters).forEach(([key, value]) => {
            if (Array.isArray(value)) {
                value.forEach(v => params.append(key, v));
            } else if (value) {
                params.append(key, value);
            }
        });
        
        // Update URL
        const newURL = `${window.location.pathname}?${params.toString()}`;
        window.history.replaceState({}, '', newURL);
    }
    
    /**
     * Update stats
     * @param {Object} stats - Stats data
     */
    function updateStats(stats) {
        if (!stats) return;
        
        totalStocksElement.textContent = formatNumber(stats.totalStocks || stats.total || 0);
        nyseStocksElement.textContent = formatNumber(stats.nyseStocks || stats.nyse || 0);
        nasdaqStocksElement.textContent = formatNumber(stats.nasdaqStocks || stats.nasdaq || 0);
        
        if (stats.lastUpdated) {
            const date = new Date(stats.lastUpdated);
            lastUpdatedElement.textContent = `Last updated: ${formatDate(date)}`;
        }
    }
    
    /**
     * Update API status
     * @param {Boolean} connected - Whether API is connected
     */
    function updateApiStatus(connected) {
        apiStatusIndicator.className = `api-status-indicator ${connected ? 'connected' : 'disconnected'}`;
        apiStatusText.textContent = connected ? 'Connected' : 'Disconnected';
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
     * Format currency
     * @param {Number} value - Value to format
     * @returns {String} Formatted currency
     */
    function formatCurrency(value) {
        if (!value && value !== 0) return null;
        
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(value);
    }
    
    /**
     * Format large number
     * @param {Number} value - Value to format
     * @returns {String} Formatted number
     */
    function formatLargeNumber(value) {
        if (!value && value !== 0) return null;
        
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
     * @param {Number} value - Value to format
     * @returns {String} Formatted number
     */
    function formatNumber(value) {
        if (!value && value !== 0) return '0';
        
        return new Intl.NumberFormat('en-US').format(value);
    }
    
    /**
     * Format date
     * @param {Date} date - Date to format
     * @returns {String} Formatted date
     */
    function formatDate(date) {
        if (!date) return '';
        
        return new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    }
    
    /**
     * Render score
     * @param {Number} score - Score value
     * @returns {String} Rendered score HTML
     */
    function renderScore(score) {
        if (!score && score !== 0) return 'N/A';
        
        let scoreClass = 'average';
        
        if (score >= 80) {
            scoreClass = 'excellent';
        } else if (score >= 60) {
            scoreClass = 'good';
        } else if (score >= 40) {
            scoreClass = 'average';
        } else if (score >= 20) {
            scoreClass = 'below-average';
        } else {
            scoreClass = 'poor';
        }
        
        return `<span class="score ${scoreClass}">${score.toFixed(0)}</span>`;
    }
    
    /**
     * Debounce function
     * @param {Function} func - Function to debounce
     * @param {Number} wait - Wait time in milliseconds
     * @returns {Function} Debounced function
     */
    function debounce(func, wait) {
        let timeout;
        
        return function(...args) {
            const context = this;
            
            clearTimeout(timeout);
            
            timeout = setTimeout(() => {
                func.apply(context, args);
            }, wait);
        };
    }
});
