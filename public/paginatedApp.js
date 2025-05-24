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
                    <div class="metric-value">
                        ${renderScore(stock.score)}
                    </div>
                </div>
            </div>
        `;
        
        container.innerHTML = content;
    }
    
    /**
     * Render card skeletons for loading state
     */
    function renderCardSkeletons() {
        const pageSize = pagination.pageSize;
        
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
            stockCardsContainer.appendChild(skeleton);
        }
    }
    
    /**
     * Render table skeleton for loading state
     */
    function renderTableSkeleton() {
        const pageSize = pagination.pageSize;
        
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
        
        // Create rows
        for (let i = 0; i < Math.min(pageSize, 20); i++) {
            const row = document.createElement('tr');
            
            // Add cells
            for (let j = 0; j < 9; j++) {
                const cell = document.createElement('td');
                cell.innerHTML = '<div class="skeleton-cell"></div>';
                row.appendChild(cell);
            }
            
            tbody.appendChild(row);
        }
        
        table.appendChild(tbody);
        stockTableContainer.appendChild(table);
    }
    
    /**
     * Render score
     * @param {Number} score - Score value
     * @returns {String} HTML for score
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
     * Handle page change
     * @param {Number} page - New page number
     * @param {Number} pageSize - Items per page
     */
    function handlePageChange(page, pageSize) {
        loadStocksPage(page, pageSize);
    }
    
    /**
     * Update stats
     * @param {Object} stats - Stats data
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
    }
    
    /**
     * Update API status
     * @param {Boolean} connected - Whether API is connected
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
     * @param {Boolean} loading - Whether data is loading
     */
    function setLoading(loading) {
        isLoading = loading;
        
        // Update loading indicator
        document.body.classList.toggle('loading', loading);
        
        // Render appropriate view
        if (loading) {
            renderStocks([]);
        }
    }
    
    /**
     * Toggle filters
     */
    function toggleFilters() {
        filtersContent.classList.toggle('collapsed');
        filtersToggle.classList.toggle('collapsed');
    }
    
    /**
     * Switch view
     * @param {String} view - View to switch to ('card' or 'table')
     */
    function switchView(view) {
        if (currentView === view) return;
        
        currentView = view;
        
        // Update active button
        cardViewButton.classList.toggle('active', view === 'card');
        tableViewButton.classList.toggle('active', view === 'table');
        
        // Show/hide containers
        stockCardsContainer.style.display = view === 'card' ? 'grid' : 'none';
        stockTableContainer.style.display = view === 'table' ? 'block' : 'none';
        
        // Render current stocks in new view
        renderStocks(currentStocks);
    }
    
    /**
     * Handle search
     */
    function handleSearch() {
        const searchValue = searchInput.value.trim();
        
        // Update active filters
        if (searchValue) {
            activeFilters.search = searchValue;
        } else {
            delete activeFilters.search;
        }
        
        // Reset to first page and apply filters
        pagination.goToPage(1);
    }
    
    /**
     * Toggle filter
     * @param {HTMLElement} button - Filter button
     */
    function toggleFilter(button) {
        const filter = button.dataset.filter;
        const value = button.dataset.value;
        
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
        
        // Reset to first page and apply filters
        pagination.goToPage(1);
    }
    
    /**
     * Toggle preset
     * @param {HTMLElement} button - Preset button
     */
    function togglePreset(button) {
        const preset = button.dataset.preset;
        
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
        
        // Reset to first page and apply filters
        pagination.goToPage(1);
    }
    
    /**
     * Handle resize
     */
    function handleResize() {
        // Refresh current view
        renderStocks(currentStocks);
    }
    
    /**
     * Format currency
     * @param {Number} value - Value to format
     * @returns {String} Formatted currency
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
     * @param {Number} value - Value to format
     * @returns {String} Formatted number
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
     * @param {Number} value - Value to format
     * @returns {String} Formatted number
     */
    function formatNumber(value) {
        return new Intl.NumberFormat('en-US').format(value);
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
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }
});
