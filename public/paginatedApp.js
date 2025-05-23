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
    const stockCardsContainer = document.getElementById('stock-cards-container');
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
     * Toggle filter
     * @param {HTMLElement} button - Filter button element
     */
    function toggleFilter(button) {
        // Get filter data
        const filter = button.dataset.filter;
        const value = button.dataset.value;
        
        // Toggle active state
        button.classList.toggle('active');
        const isActive = button.classList.contains('active');
        
        // Update active filters
        if (!activeFilters[filter]) {
            activeFilters[filter] = [];
        }
        
        if (isActive) {
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
        
        // Special case for reset button
        if (button.dataset.action === 'reset-filters') {
            // Clear all filters
            document.querySelectorAll('.filter-button, .preset-button').forEach(btn => {
                if (btn !== button) {
                    btn.classList.remove('active');
                }
            });
            
            // Reset active filters
            activeFilters = {};
        }
        
        // Reload data with current filters
        loadStocksPage(1, pagination.pageSize);
    }
    
    /**
     * Toggle preset
     * @param {HTMLElement} button - Preset button element
     */
    function togglePreset(button) {
        // Get preset data
        const preset = button.dataset.preset;
        
        // Toggle active state
        button.classList.toggle('active');
        const isActive = button.classList.contains('active');
        
        // Update active filters
        if (isActive) {
            // Add preset
            activeFilters.preset = preset;
            
            // Deactivate other presets
            document.querySelectorAll('.preset-button').forEach(btn => {
                if (btn !== button) {
                    btn.classList.remove('active');
                }
            });
        } else {
            // Remove preset
            delete activeFilters.preset;
        }
        
        // Reload data with current filters
        loadStocksPage(1, pagination.pageSize);
    }
    
    /**
     * Handle search input
     */
    function handleSearch() {
        const searchValue = searchInput.value.trim();
        
        // Update active filters
        if (searchValue) {
            activeFilters.search = searchValue;
        } else {
            delete activeFilters.search;
        }
        
        // Reload data with current filters
        loadStocksPage(1, pagination.pageSize);
    }
    
    /**
     * Handle page change
     * @param {Number} page - New page number
     */
    function handlePageChange(page) {
        loadStocksPage(page, pagination.pageSize);
    }
    
    /**
     * Toggle filters visibility
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
        // Update state
        currentView = view;
        
        // Update UI
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
        
        // Render stocks
        renderStocks(currentStocks);
    }
    
    /**
     * Update API status indicator
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
     * Update stats display
     * @param {Object} stats - Stats data
     */
    function updateStats(stats) {
        if (totalStocksElement) {
            totalStocksElement.textContent = stats.total || 0;
        }
        if (nyseStocksElement) {
            nyseStocksElement.textContent = stats.nyse || 0;
        }
        if (nasdaqStocksElement) {
            nasdaqStocksElement.textContent = stats.nasdaq || 0;
        }
        if (lastUpdatedElement) {
            lastUpdatedElement.textContent = formatDate(stats.lastUpdated || new Date());
        }
    }
    
    /**
     * Set loading state
     * @param {Boolean} loading - Whether app is loading
     */
    function setLoading(loading) {
        isLoading = loading;
        
        // Update UI
        const loadingBar = document.getElementById('loading-progress-bar');
        const progressInner = document.getElementById('progress-inner');
        const loadingText = document.getElementById('loading-progress-text');
        
        if (loading) {
            if (loadingBar) loadingBar.style.display = 'block';
            if (progressInner) progressInner.style.width = '70%';
            if (loadingText) {
                loadingText.style.display = 'block';
                loadingText.textContent = 'Loading stocks...';
            }
        } else {
            if (progressInner) {
                progressInner.style.width = '100%';
                setTimeout(() => {
                    if (loadingBar) loadingBar.style.display = 'none';
                    if (progressInner) progressInner.style.width = '0%';
                }, 300);
            }
            if (loadingText) {
                loadingText.style.display = 'none';
            }
        }
    }
    
    /**
     * Handle window resize
     */
    function handleResize() {
        // Adjust UI for current window size
        // (Add responsive adjustments if needed)
    }
    
    /**
     * Format currency value
     * @param {Number} value - Value to format
     * @returns {String} Formatted currency string
     */
    function formatCurrency(value) {
        return '$' + value.toFixed(2);
    }
    
    /**
     * Format large number with suffix
     * @param {Number} value - Value to format
     * @returns {String} Formatted number string
     */
    function formatLargeNumber(value) {
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
     * Format date
     * @param {Date|String} date - Date to format
     * @returns {String} Formatted date string
     */
    function formatDate(date) {
        if (!(date instanceof Date)) {
            date = new Date(date);
        }
        
        return date.toLocaleDateString() + ', ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
    
    /**
     * Tooltip class for showing tooltips
     */
    function Tooltip() {
        const tooltipElement = document.getElementById('tooltip');
        
        // Initialize tooltip
        if (!tooltipElement) return;
        
        // Add event listeners
        document.querySelectorAll('[title]').forEach(element => {
            element.addEventListener('mouseenter', showTooltip);
            element.addEventListener('mouseleave', hideTooltip);
        });
        
        /**
         * Show tooltip
         * @param {Event} event - Mouse event
         */
        function showTooltip(event) {
            const title = event.target.getAttribute('title');
            if (!title) return;
            
            // Store original title and remove to prevent native tooltip
            event.target.dataset.originalTitle = title;
            event.target.removeAttribute('title');
            
            // Set tooltip content
            tooltipElement.textContent = title;
            
            // Position tooltip
            const rect = event.target.getBoundingClientRect();
            tooltipElement.style.top = (rect.top - tooltipElement.offsetHeight - 10) + 'px';
            tooltipElement.style.left = (rect.left + (rect.width / 2) - (tooltipElement.offsetWidth / 2)) + 'px';
            
            // Show tooltip
            tooltipElement.style.display = 'block';
        }
        
        /**
         * Hide tooltip
         * @param {Event} event - Mouse event
         */
        function hideTooltip(event) {
            // Restore original title
            if (event.target.dataset.originalTitle) {
                event.target.setAttribute('title', event.target.dataset.originalTitle);
                delete event.target.dataset.originalTitle;
            }
            
            // Hide tooltip
            tooltipElement.style.display = 'none';
        }
    }
});
