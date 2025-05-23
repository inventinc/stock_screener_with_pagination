/**
 * OptimizedApp - Main application with virtualized table for handling large datasets
 * 
 * Features:
 * - High-performance virtualized table view
 * - Optimized data loading and management
 * - Efficient filtering and sorting
 * - Responsive UI with minimal glitches
 */
document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const stockCardsContainer = document.getElementById('stock-cards');
    const stockTableContainer = document.getElementById('stock-table-container');
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
    let virtualScroller = null;
    let virtualizedTable = null;
    
    // Initialize data manager
    const dataManager = new OptimizedDataManager({
        batchSize: 50,
        progressCallback: updateProgress,
        completeCallback: handleDataLoadComplete,
        batchLoadedCallback: handleBatchLoaded,
        errorCallback: handleError
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
        
        // Initialize card view
        initCardView();
        
        // Initialize table view
        initTableView();
        
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
     * Initialize card view
     */
    function initCardView() {
        // Create virtual scroller for card view
        virtualScroller = new IncrementalVirtualScroller({
            container: stockCardsContainer,
            itemHeight: 220, // Adjust based on your card height
            bufferSize: 10,
            renderItem: renderStockCard,
            loadMoreCallback: loadMoreStocks
        });
    }
    
    /**
     * Initialize table view
     */
    function initTableView() {
        // Define table columns
        const columns = [
            { field: 'symbol', label: 'Symbol', sortable: true },
            { field: 'name', label: 'Name', sortable: true },
            { field: 'exchange', label: 'Exchange', sortable: true },
            { 
                field: 'price', 
                label: 'Price', 
                sortable: true,
                formatter: (value, row) => row.formattedPrice || formatCurrency(value)
            },
            { 
                field: 'marketCap', 
                label: 'Market Cap', 
                sortable: true,
                formatter: (value, row) => row.formattedMarketCap || formatLargeNumber(value)
            },
            { 
                field: 'peRatio', 
                label: 'P/E Ratio', 
                sortable: true,
                formatter: value => value ? value.toFixed(2) : 'N/A'
            },
            { 
                field: 'dividendYield', 
                label: 'Div Yield', 
                sortable: true,
                formatter: value => value ? (value * 100).toFixed(2) + '%' : 'N/A'
            },
            { 
                field: 'netDebtToEBITDA', 
                label: 'Debt/EBITDA', 
                sortable: true,
                formatter: value => value ? value.toFixed(2) + 'x' : 'N/A'
            },
            { 
                field: 'score', 
                label: 'Score', 
                sortable: true,
                formatter: value => {
                    if (!value && value !== 0) return 'N/A';
                    
                    let scoreClass = '';
                    if (value >= 80) scoreClass = 'excellent';
                    else if (value >= 60) scoreClass = 'good';
                    else if (value >= 40) scoreClass = 'average';
                    else if (value >= 20) scoreClass = 'below-average';
                    else scoreClass = 'poor';
                    
                    return `<span class="score ${scoreClass}">${value}</span>`;
                }
            }
        ];
        
        // Create virtualized table
        virtualizedTable = new VirtualizedTable({
            container: stockTableContainer,
            columns: columns,
            rowHeight: 50,
            headerHeight: 40,
            bufferSize: 20,
            loadMoreCallback: loadMoreStocks
        });
    }
    
    /**
     * Load initial data
     */
    function loadInitialData() {
        // Show loading state
        updateProgress(0, 0);
        
        // Load stats
        fetch('/api/stats')
            .then(response => response.json())
            .then(stats => {
                updateStats(stats);
            })
            .catch(error => {
                console.error('Error loading stats:', error);
                updateApiStatus(false);
            });
    }
    
    /**
     * Handle batch loaded
     * @param {Array} stocks - Loaded stocks
     * @param {Boolean} fromCache - Whether loaded from cache
     */
    function handleBatchLoaded(stocks, fromCache = false) {
        // Update virtual scroller
        if (virtualScroller) {
            const allStocks = dataManager.getAllStocks();
            virtualScroller.setItems(allStocks);
            virtualScroller.setTotalItemsCount(dataManager.totalItems);
        }
        
        // Update virtualized table
        if (virtualizedTable) {
            const allStocks = dataManager.getAllStocks();
            virtualizedTable.setData(allStocks);
            virtualizedTable.setTotalRowsCount(dataManager.totalItems);
        }
        
        // Update API status
        updateApiStatus(true);
    }
    
    /**
     * Handle data load complete
     * @param {Array} stocks - All loaded stocks
     */
    function handleDataLoadComplete(stocks) {
        console.log(`Data loading complete: ${stocks.length} stocks loaded`);
    }
    
    /**
     * Load more stocks
     * @returns {Promise} Promise that resolves when more stocks are loaded
     */
    function loadMoreStocks() {
        // If we have active filters, load more filtered results
        if (Object.keys(activeFilters).length > 0) {
            return dataManager.loadMoreFilteredResults();
        }
        
        // Otherwise, load next batch
        return dataManager.loadNextBatch();
    }
    
    /**
     * Update progress
     * @param {Number} loaded - Number of loaded items
     * @param {Number} total - Total number of items
     * @param {Boolean} fromCache - Whether loaded from cache
     */
    function updateProgress(loaded, total, fromCache = false) {
        // Update progress in UI
        if (total > 0) {
            const percent = Math.round((loaded / total) * 100);
            console.log(`Loading progress: ${percent}% (${loaded}/${total})`);
        }
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
     * Handle error
     * @param {Error} error - Error object
     */
    function handleError(error) {
        console.error('Error:', error);
        updateApiStatus(false);
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
        
        // Refresh view
        if (view === 'card' && virtualScroller) {
            virtualScroller.refresh();
        } else if (view === 'table' && virtualizedTable) {
            virtualizedTable.refresh();
        }
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
        
        // Apply filters
        applyFilters();
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
        
        // Apply filters
        applyFilters();
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
        
        // Apply filters
        applyFilters();
    }
    
    /**
     * Apply filters
     */
    function applyFilters() {
        // Get filtered stocks
        const filteredStocks = dataManager.getFilteredStocks(activeFilters);
        
        // Update virtual scroller
        if (virtualScroller) {
            virtualScroller.setItems(filteredStocks);
            virtualScroller.setTotalItemsCount(filteredStocks.length);
        }
        
        // Update virtualized table
        if (virtualizedTable) {
            virtualizedTable.setData(filteredStocks);
            virtualizedTable.setTotalRowsCount(filteredStocks.length);
        }
    }
    
    /**
     * Handle resize
     */
    function handleResize() {
        // Refresh views
        if (virtualScroller) {
            virtualScroller.refresh();
        }
        
        if (virtualizedTable) {
            virtualizedTable.refresh();
        }
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
        
        // Create card content
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
