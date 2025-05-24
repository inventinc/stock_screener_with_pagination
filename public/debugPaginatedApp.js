/**
 * PaginatedStockApp - Stock screener application with pagination and adaptive card view
 * 
 * Features:
 * - Classic pagination with modern UX
 * - Adaptive card heights for mobile
 * - Optimized data loading
 * - Responsive design for all devices
 * - Debug logging for filter operations
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
    const debugLogElement = document.getElementById('debug-log');
    
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
    
    // Debug logging function
    function logDebug(message, data) {
        const timestamp = new Date().toLocaleTimeString();
        const logMessage = `${timestamp}: ${message}`;
        console.log(logMessage, data);
        
        if (debugLogElement) {
            const logEntry = document.createElement('div');
            logEntry.className = 'debug-log-entry';
            logEntry.innerHTML = `<span class="debug-timestamp">${timestamp}</span> ${message}`;
            
            if (data) {
                const dataStr = typeof data === 'object' ? JSON.stringify(data, null, 2) : data;
                const dataElement = document.createElement('pre');
                dataElement.className = 'debug-data';
                dataElement.textContent = dataStr;
                logEntry.appendChild(dataElement);
            }
            
            debugLogElement.appendChild(logEntry);
            debugLogElement.scrollTop = debugLogElement.scrollHeight;
        }
    }
    
    // Initialize app
    initApp();
    
    /**
     * Initialize the application
     */
    function initApp() {
        logDebug('Initializing application');
        
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
        logDebug('Setting up event listeners');
        
        // Filters toggle
        filtersToggle.addEventListener('click', toggleFilters);
        
        // View buttons
        cardViewButton.addEventListener('click', () => switchView('card'));
        tableViewButton.addEventListener('click', () => switchView('table'));
        
        // Search input
        searchInput.addEventListener('input', debounce(handleSearch, 300));
        
        // Filter buttons
        document.querySelectorAll('.filter-button').forEach(button => {
            button.addEventListener('click', () => {
                logDebug(`Filter button clicked: ${button.textContent}`, {
                    filterType: button.dataset.filterType,
                    filterValue: button.dataset.filterValue
                });
                toggleFilter(button);
            });
        });
        
        // Preset buttons
        document.querySelectorAll('.preset-button').forEach(button => {
            button.addEventListener('click', () => {
                logDebug(`Preset button clicked: ${button.textContent}`, {
                    preset: button.dataset.preset
                });
                togglePreset(button);
            });
        });
        
        // Window resize
        window.addEventListener('resize', debounce(handleResize, 200));
        
        logDebug('Event listeners set up successfully');
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
        
        logDebug('Loading initial data', { page, pageSize });
        
        // Update pagination control
        pagination.currentPage = page;
        pagination.pageSize = pageSize;
        
        // Load stats
        fetch('/api/stats')
            .then(response => response.json())
            .then(stats => {
                updateStats(stats);
                logDebug('Stats loaded successfully', stats);
                
                // Load first page of stocks
                return loadStocksPage(page, pageSize);
            })
            .catch(error => {
                console.error('Error loading stats:', error);
                logDebug('Error loading stats', error.message);
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
        
        const apiUrl = `/api/enhanced-stocks?${params.toString()}`;
        logDebug('Loading stocks page', { 
            page, 
            pageSize, 
            activeFilters, 
            apiUrl 
        });
        
        // Fetch stocks from API
        return fetch(apiUrl)
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
                
                logDebug('Stocks loaded successfully', { 
                    count: data.stocks.length,
                    total: data.pagination ? data.pagination.total : 0
                });
                
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
                logDebug('Error loading stocks', error.message);
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
            logDebug('Rendered empty state for card view');
            return;
        }
        
        logDebug(`Rendering ${stocks.length} stock cards`);
        
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
            logDebug('Rendered empty state for table view');
            return;
        }
        
        logDebug(`Rendering ${stocks.length} stocks in table view`);
        
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
        
        // Add header cells
        columns.forEach(column => {
            const th = document.createElement('th');
            th.textContent = column.label;
            headerRow.appendChild(th);
        });
        
        thead.appendChild(headerRow);
        table.appendChild(thead);
        
        // Create table body
        const tbody = document.createElement('tbody');
        
        // Add rows
        stocks.forEach(stock => {
            const row = document.createElement('tr');
            
            // Add cells
            columns.forEach(column => {
                const td = document.createElement('td');
                
                // Format cell content based on field
                if (column.field === 'symbol') {
                    td.className = 'stock-symbol-cell';
                    td.textContent = stock.symbol || 'N/A';
                } else if (column.field === 'name') {
                    td.textContent = stock.name || 'Unknown';
                } else if (column.field === 'exchange') {
                    td.textContent = stock.exchange || 'N/A';
                } else if (column.field === 'price') {
                    td.textContent = stock.formattedPrice || formatCurrency(stock.price) || 'N/A';
                } else if (column.field === 'marketCap') {
                    td.textContent = stock.formattedMarketCap || formatLargeNumber(stock.marketCap) || 'N/A';
                } else if (column.field === 'peRatio') {
                    td.textContent = stock.peRatio ? stock.peRatio.toFixed(2) : 'N/A';
                } else if (column.field === 'dividendYield') {
                    td.textContent = stock.dividendYield ? (stock.dividendYield * 100).toFixed(2) + '%' : 'N/A';
                } else if (column.field === 'netDebtToEBITDA') {
                    td.textContent = stock.netDebtToEBITDA ? stock.netDebtToEBITDA.toFixed(2) + 'x' : 'N/A';
                } else if (column.field === 'score') {
                    td.innerHTML = renderScore(stock.score);
                } else {
                    td.textContent = stock[column.field] || 'N/A';
                }
                
                row.appendChild(td);
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
        
        logDebug(`Rendered ${Math.min(pageSize, 12)} card skeletons`);
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
        
        // Add header cells
        for (let i = 0; i < 9; i++) {
            const th = document.createElement('th');
            th.innerHTML = '<div class="skeleton-cell"></div>';
            headerRow.appendChild(th);
        }
        
        thead.appendChild(headerRow);
        table.appendChild(thead);
        
        // Create table body
        const tbody = document.createElement('tbody');
        
        // Add rows
        for (let i = 0; i < Math.min(pageSize, 20); i++) {
            const row = document.createElement('tr');
            
            // Add cells
            for (let j = 0; j < 9; j++) {
                const td = document.createElement('td');
                td.innerHTML = '<div class="skeleton-cell"></div>';
                row.appendChild(td);
            }
            
            tbody.appendChild(row);
        }
        
        table.appendChild(tbody);
        stockTableContainer.appendChild(table);
        
        logDebug(`Rendered table skeleton with ${Math.min(pageSize, 20)} rows`);
    }
    
    /**
     * Render score with color coding
     * @param {Number} score - Score value
     * @returns {String} HTML for score display
     */
    function renderScore(score) {
        if (!score && score !== 0) {
            return 'N/A';
        }
        
        let scoreClass = 'poor';
        
        if (score >= 80) {
            scoreClass = 'excellent';
        } else if (score >= 60) {
            scoreClass = 'good';
        } else if (score >= 40) {
            scoreClass = 'average';
        } else if (score >= 20) {
            scoreClass = 'below-average';
        }
        
        return `<span class="score ${scoreClass}">${score.toFixed(0)}</span>`;
    }
    
    /**
     * Format currency value
     * @param {Number} value - Value to format
     * @returns {String} Formatted currency string
     */
    function formatCurrency(value) {
        if (!value && value !== 0) {
            return null;
        }
        
        return '$' + value.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }
    
    /**
     * Format large number with appropriate suffix
     * @param {Number} value - Value to format
     * @returns {String} Formatted number string
     */
    function formatLargeNumber(value) {
        if (!value && value !== 0) {
            return null;
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
     * Update stats display
     * @param {Object} stats - Stats data
     */
    function updateStats(stats) {
        if (!stats) {
            return;
        }
        
        // Update stats
        totalStocksElement.textContent = stats.totalStocks || 0;
        nyseStocksElement.textContent = stats.nyseStocks || 0;
        nasdaqStocksElement.textContent = stats.nasdaqStocks || 0;
        
        // Update last updated time
        if (stats.lastUpdated) {
            const date = new Date(stats.lastUpdated);
            lastUpdatedElement.textContent = `Last updated: ${date.toLocaleString()}`;
        }
    }
    
    /**
     * Update API status indicator
     * @param {Boolean} connected - Whether API is connected
     */
    function updateApiStatus(connected) {
        if (connected) {
            apiStatusIndicator.classList.add('connected');
            apiStatusIndicator.classList.remove('disconnected');
            apiStatusText.textContent = 'Connected';
        } else {
            apiStatusIndicator.classList.add('disconnected');
            apiStatusIndicator.classList.remove('connected');
            apiStatusText.textContent = 'Disconnected';
        }
        
        logDebug(`API status updated: ${connected ? 'Connected' : 'Disconnected'}`);
    }
    
    /**
     * Set loading state
     * @param {Boolean} loading - Whether app is loading
     */
    function setLoading(loading) {
        isLoading = loading;
        
        if (loading) {
            document.body.classList.add('loading');
        } else {
            document.body.classList.remove('loading');
        }
        
        logDebug(`Loading state: ${loading}`);
    }
    
    /**
     * Handle page change
     * @param {Number} page - New page number
     */
    function handlePageChange(page) {
        logDebug(`Page changed to ${page}`);
        
        // Update URL
        const url = new URL(window.location);
        url.searchParams.set('page', page);
        window.history.pushState({}, '', url);
        
        // Load new page
        loadStocksPage(page, pagination.pageSize);
    }
    
    /**
     * Handle search input
     */
    function handleSearch() {
        const searchTerm = searchInput.value.trim();
        
        logDebug(`Search term: "${searchTerm}"`);
        
        if (searchTerm) {
            activeFilters.search = searchTerm;
        } else {
            delete activeFilters.search;
        }
        
        // Reset to first page and reload
        pagination.goToPage(1);
    }
    
    /**
     * Toggle filters visibility
     */
    function toggleFilters() {
        filtersContent.classList.toggle('collapsed');
        filtersToggle.classList.toggle('collapsed');
        
        logDebug(`Filters visibility toggled: ${!filtersContent.classList.contains('collapsed')}`);
    }
    
    /**
     * Toggle filter button
     * @param {HTMLElement} button - Filter button element
     */
    function toggleFilter(button) {
        const filterType = button.dataset.filterType;
        const filterValue = button.dataset.filterValue;
        
        // Get all buttons in this filter group
        const filterGroup = button.closest('.filter-group');
        const groupButtons = filterGroup.querySelectorAll('.filter-button');
        
        // Check if this is a multi-select filter group
        const isMultiSelect = filterGroup.dataset.multiSelect === 'true';
        
        logDebug(`Toggling filter: ${filterType}=${filterValue}`, {
            isMultiSelect,
            currentActiveFilters: {...activeFilters}
        });
        
        if (isMultiSelect) {
            // Toggle this button
            button.classList.toggle('active');
            
            // Update active filters
            if (!activeFilters[filterType]) {
                activeFilters[filterType] = [];
            }
            
            if (button.classList.contains('active')) {
                // Add to active filters
                if (!activeFilters[filterType].includes(filterValue)) {
                    activeFilters[filterType].push(filterValue);
                }
            } else {
                // Remove from active filters
                activeFilters[filterType] = activeFilters[filterType].filter(v => v !== filterValue);
                
                // Remove empty arrays
                if (activeFilters[filterType].length === 0) {
                    delete activeFilters[filterType];
                }
            }
        } else {
            // Single select - deactivate all other buttons in group
            groupButtons.forEach(btn => {
                btn.classList.remove('active');
            });
            
            // If clicking already active button, deactivate it
            if (button.classList.contains('active')) {
                button.classList.remove('active');
                delete activeFilters[filterType];
            } else {
                // Activate this button
                button.classList.add('active');
                activeFilters[filterType] = filterValue;
            }
        }
        
        logDebug(`Active filters updated`, activeFilters);
        
        // Reset to first page and reload
        pagination.goToPage(1);
    }
    
    /**
     * Toggle preset button
     * @param {HTMLElement} button - Preset button element
     */
    function togglePreset(button) {
        const presetValue = button.dataset.preset;
        
        // Get all preset buttons
        const presetButtons = document.querySelectorAll('.preset-button');
        
        logDebug(`Toggling preset: ${presetValue}`, {
            currentActiveFilters: {...activeFilters}
        });
        
        // If clicking already active button, deactivate it
        if (button.classList.contains('active')) {
            button.classList.remove('active');
            delete activeFilters.preset;
        } else {
            // Deactivate all preset buttons
            presetButtons.forEach(btn => {
                btn.classList.remove('active');
            });
            
            // Activate this button
            button.classList.add('active');
            activeFilters.preset = presetValue;
        }
        
        logDebug(`Active filters updated after preset toggle`, activeFilters);
        
        // Reset to first page and reload
        pagination.goToPage(1);
    }
    
    /**
     * Switch view mode
     * @param {String} view - View mode ('card' or 'table')
     */
    function switchView(view) {
        if (view === currentView) {
            return;
        }
        
        currentView = view;
        logDebug(`View switched to ${view}`);
        
        // Update view buttons
        if (view === 'card') {
            cardViewButton.classList.add('active');
            tableViewButton.classList.remove('active');
            stockCardsContainer.style.display = 'grid';
            stockTableContainer.style.display = 'none';
        } else {
            cardViewButton.classList.remove('active');
            tableViewButton.classList.add('active');
            stockCardsContainer.style.display = 'none';
            stockTableContainer.style.display = 'block';
        }
        
        // Render current stocks in new view
        renderStocks(currentStocks);
    }
    
    /**
     * Handle window resize
     */
    function handleResize() {
        // Adjust UI based on window size if needed
        logDebug('Window resized');
    }
    
    /**
     * Debounce function to limit function calls
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
