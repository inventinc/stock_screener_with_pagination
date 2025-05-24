/**
 * PaginatedStockApp - Stock screener application with pagination and adaptive card view
 *
 * Features:
 * - Classic pagination with modern UX
 * - Adaptive card heights for mobile
 * - Optimized data loading
 * - Responsive design for all devices
 */

// Export key functions to global scope for accessibility
window.toggleFilter = toggleFilter;
window.togglePreset = togglePreset;
window.loadStocksPage = loadStocksPage;
window.activeFilters = {};

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
    window.activeFilters = {}; // Moved to global scope
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
        if (filtersToggle) {
            filtersToggle.addEventListener('click', toggleFilters);
        }

        // View buttons
        if (cardViewButton && tableViewButton) {
            cardViewButton.addEventListener('click', () => switchView('card'));
            tableViewButton.addEventListener('click', () => switchView('table'));
        }

        // Search input
        if (searchInput) {
            searchInput.addEventListener('input', debounce(handleSearch, 300));
        }

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
     * Handle page change
     */
    function handlePageChange(page, pageSize) {
        loadStocksPage(page, pageSize);
    }

    /**
     * Switch view between card and table
     */
    function switchView(view) {
        currentView = view;
        
        // Update active state of view buttons
        if (cardViewButton && tableViewButton) {
            if (view === 'card') {
                cardViewButton.classList.add('active');
                tableViewButton.classList.remove('active');
            } else {
                cardViewButton.classList.remove('active');
                tableViewButton.classList.add('active');
            }
        }
        
        // Re-render stocks with current view
        renderStocks(currentStocks);
    }

    /**
     * Toggle filters panel
     */
    function toggleFilters() {
        if (filtersContent) {
            filtersContent.classList.toggle('collapsed');
        }
        if (filtersToggle) {
            const toggleIcon = filtersToggle.querySelector('.filters-toggle');
            if (toggleIcon) {
                toggleIcon.classList.toggle('collapsed');
            }
        }
    }

    /**
     * Handle search input
     */
    function handleSearch() {
        if (searchInput) {
            const searchTerm = searchInput.value.trim();
            
            // Update active filters
            if (searchTerm) {
                window.activeFilters.search = searchTerm;
            } else {
                delete window.activeFilters.search;
            }
            
            // Reload data with search filter
            loadStocksPage(1, pagination.pageSize);
        }
    }

    /**
     * Handle window resize
     */
    function handleResize() {
        // Re-render stocks to adjust card heights
        if (currentView === 'card') {
            renderStocks(currentStocks);
        }
    }

    /**
     * Set loading state
     */
    function setLoading(loading) {
        isLoading = loading;
        
        // Update loading UI
        const loadingProgressBar = document.querySelector('.loading-progress-bar');
        const loadingProgressText = document.querySelector('.loading-progress-text');
        
        if (loadingProgressBar && loadingProgressText) {
            if (loading) {
                loadingProgressBar.style.display = 'block';
                loadingProgressText.style.display = 'block';
                
                // Animate progress bar
                const progressInner = loadingProgressBar.querySelector('.progress-inner');
                if (progressInner) {
                    progressInner.style.width = '0%';
                    setTimeout(() => {
                        progressInner.style.width = '70%';
                    }, 100);
                }
            } else {
                // Complete progress animation
                const progressInner = loadingProgressBar.querySelector('.progress-inner');
                if (progressInner) {
                    progressInner.style.width = '100%';
                }
                
                // Hide loading UI after animation
                setTimeout(() => {
                    loadingProgressBar.style.display = 'none';
                    loadingProgressText.style.display = 'none';
                }, 300);
            }
        }
    }

    /**
     * Update API status indicator
     */
    function updateApiStatus(connected) {
        if (apiStatusIndicator && apiStatusText) {
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
    }

    /**
     * Update stats display
     */
    function updateStats(stats) {
        if (totalStocksElement) {
            totalStocksElement.textContent = stats.total.toLocaleString();
        }
        
        if (nyseStocksElement) {
            nyseStocksElement.textContent = stats.nyse.toLocaleString();
        }
        
        if (nasdaqStocksElement) {
            nasdaqStocksElement.textContent = stats.nasdaq.toLocaleString();
        }
        
        if (lastUpdatedElement && stats.lastUpdated) {
            const date = new Date(stats.lastUpdated);
            lastUpdatedElement.textContent = `${date.toLocaleDateString()}, ${date.toLocaleTimeString()}`;
        }
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
     * Debounce function to limit function calls
     */
    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }
});

/**
 * Load a specific page of stocks
 * @param {Number} page - Page number
 * @param {Number} pageSize - Items per page
 * @returns {Promise} Promise that resolves with loaded stocks
 */
function loadStocksPage(page, pageSize) {
    console.log("loadStocksPage called with page:", page, "pageSize:", pageSize);
    console.log("Active filters:", window.activeFilters);
    
    // Show loading state
    const loadingProgressBar = document.querySelector('.loading-progress-bar');
    const loadingProgressText = document.querySelector('.loading-progress-text');
    
    if (loadingProgressBar && loadingProgressText) {
        loadingProgressBar.style.display = 'block';
        loadingProgressText.style.display = 'block';
        
        // Animate progress bar
        const progressInner = loadingProgressBar.querySelector('.progress-inner');
        if (progressInner) {
            progressInner.style.width = '0%';
            setTimeout(() => {
                progressInner.style.width = '70%';
            }, 100);
        }
    }

    // Build query parameters
    const params = new URLSearchParams({
        page: page,
        pageSize: pageSize
    });

    // Convert filter values to backend-expected parameters
    const backendParams = convertFiltersToBackendParams(window.activeFilters);
    
    // Add filter parameters
    Object.entries(backendParams).forEach(([key, value]) => {
        if (Array.isArray(value)) {
            value.forEach(v => params.append(key, v));
        } else if (value !== undefined && value !== null) {
            params.append(key, value);
        }
    });

    console.log("API request URL:", `/api/stocks?${params.toString()}`);

    // Fetch stocks from API
    return fetch(`/api/stocks?${params.toString()}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`API error: ${response.status} ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            console.log("API response:", data);
            
            if (!data || !data.stocks || !Array.isArray(data.stocks)) {
                throw new Error('Invalid API response format');
            }

            // Process stocks data
            const processedStocks = data.stocks.map(stock => {
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

            // Update state
            const currentStocks = processedStocks;
            const totalItems = data.pagination ? data.pagination.total : processedStocks.length;

            // Update pagination
            const paginationContainer = document.getElementById('pagination-container');
            if (paginationContainer && window.PaginationControls) {
                const pagination = new PaginationControls({
                    container: paginationContainer,
                    totalItems: totalItems,
                    pageSize: pageSize,
                    currentPage: page,
                    onPageChange: (newPage, newPageSize) => loadStocksPage(newPage, newPageSize)
                });
                pagination.update(totalItems, page);
            }

            // Render stocks
            if (currentStocks && currentStocks.length > 0) {
                const currentView = document.getElementById('card-view-button').classList.contains('active') ? 'card' : 'table';
                if (currentView === 'card') {
                    renderCardView(currentStocks);
                } else {
                    renderTableView(currentStocks);
                }
            }

            // Update API status
            const apiStatusIndicator = document.getElementById('api-status-indicator');
            const apiStatusText = document.getElementById('api-status-text');
            if (apiStatusIndicator && apiStatusText) {
                apiStatusIndicator.classList.remove('disconnected');
                apiStatusIndicator.classList.add('connected');
                apiStatusText.textContent = 'connected';
            }

            // Hide loading state
            if (loadingProgressBar && loadingProgressText) {
                // Complete progress animation
                const progressInner = loadingProgressBar.querySelector('.progress-inner');
                if (progressInner) {
                    progressInner.style.width = '100%';
                }
                
                // Hide loading UI after animation
                setTimeout(() => {
                    loadingProgressBar.style.display = 'none';
                    loadingProgressText.style.display = 'none';
                }, 300);
            }

            return processedStocks;
        })
        .catch(error => {
            console.error('Error loading stocks:', error);
            
            // Update API status
            const apiStatusIndicator = document.getElementById('api-status-indicator');
            const apiStatusText = document.getElementById('api-status-text');
            if (apiStatusIndicator && apiStatusText) {
                apiStatusIndicator.classList.remove('connected');
                apiStatusIndicator.classList.add('disconnected');
                apiStatusText.textContent = 'disconnected';
            }
            
            // Hide loading state
            if (loadingProgressBar && loadingProgressText) {
                loadingProgressBar.style.display = 'none';
                loadingProgressText.style.display = 'none';
            }
            
            throw error;
        });
}

/**
 * Convert frontend filter values to backend parameters
 * @param {Object} filters - Frontend filter values
 * @returns {Object} Backend filter parameters
 */
function convertFiltersToBackendParams(filters) {
    const backendParams = {};
    
    // Handle market cap filters
    if (filters.market_cap) {
        const marketCapValues = Array.isArray(filters.market_cap) ? filters.market_cap : [filters.market_cap];
        
        marketCapValues.forEach(value => {
            switch (value) {
                case 'large':
                    backendParams.marketCapMin = 10000000000; // $10B+
                    break;
                case 'mid':
                    backendParams.marketCapMin = 2000000000; // $2B
                    backendParams.marketCapMax = 10000000000; // $10B
                    break;
                case 'small':
                    backendParams.marketCapMin = 300000000; // $300M
                    backendParams.marketCapMax = 2000000000; // $2B
                    break;
                case 'micro':
                    backendParams.marketCapMax = 300000000; // $300M
                    break;
            }
        });
    }
    
    // Handle volume filters
    if (filters.volume) {
        const volumeValues = Array.isArray(filters.volume) ? filters.volume : [filters.volume];
        
        volumeValues.forEach(value => {
            switch (value) {
                case 'high':
                    backendParams.volumeMin = 5000000; // $5M+
                    break;
                case 'medium':
                    backendParams.volumeMin = 1000000; // $1M
                    backendParams.volumeMax = 5000000; // $5M
                    break;
                case 'low':
                    backendParams.volumeMax = 1000000; // $1M
                    break;
            }
        });
    }
    
    // Handle debt filters
    if (filters.debt) {
        const debtValues = Array.isArray(filters.debt) ? filters.debt : [filters.debt];
        
        debtValues.forEach(value => {
            switch (value) {
                case 'low':
                    backendParams.debtMax = 0.5;
                    break;
                case 'medium':
                    backendParams.debtMin = 0.5;
                    backendParams.debtMax = 1.5;
                    break;
                case 'high':
                    backendParams.debtMin = 1.5;
                    break;
            }
        });
    }
    
    // Handle valuation filters
    if (filters.valuation) {
        const valuationValues = Array.isArray(filters.valuation) ? filters.valuation : [filters.valuation];
        
        valuationValues.forEach(value => {
            switch (value) {
                case 'undervalued':
                    backendParams.peMax = 15;
                    break;
                case 'fair':
                    backendParams.peMin = 15;
                    backendParams.peMax = 25;
                    break;
                case 'overvalued':
                    backendParams.peMin = 25;
                    break;
            }
        });
    }
    
    // Handle preset filters
    if (filters.preset) {
        backendParams.preset = filters.preset;
    }
    
    // Handle search
    if (filters.search) {
        backendParams.search = filters.search;
    }
    
    return backendParams;
}

/**
 * Toggle filter
 * @param {HTMLElement} button - Filter button element
 */
function toggleFilter(button) {
    console.log("toggleFilter called with button:", button);
    
    // Get filter data
    const filter = button.dataset.filter;
    const value = button.dataset.value;
    
    console.log("Filter:", filter, "Value:", value);
    
    // Toggle active state
    button.classList.toggle('active');
    const isActive = button.classList.contains('active');
    
    // Update active filters
    if (!window.activeFilters[filter]) {
        window.activeFilters[filter] = [];
    }
    
    if (isActive) {
        // Add filter
        if (!window.activeFilters[filter].includes(value)) {
            window.activeFilters[filter].push(value);
        }
    } else {
        // Remove filter
        window.activeFilters[filter] = window.activeFilters[filter].filter(v => v !== value);
        // Remove empty filter
        if (window.activeFilters[filter].length === 0) {
            delete window.activeFilters[filter];
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
        window.activeFilters = {};
    }
    
    console.log("Updated activeFilters:", window.activeFilters);
    
    // Reload data with current filters
    loadStocksPage(1, 50);
}

/**
 * Toggle preset
 * @param {HTMLElement} button - Preset button element
 */
function togglePreset(button) {
    console.log("togglePreset called with button:", button);
    
    // Get preset data
    const preset = button.dataset.preset;
    
    console.log("Preset:", preset);
    
    // Toggle active state
    button.classList.toggle('active');
    const isActive = button.classList.contains('active');
    
    // Update active filters
    if (isActive) {
        // Add preset
        window.activeFilters.preset = preset;
        
        // Deactivate other presets
        document.querySelectorAll('.preset-button').forEach(btn => {
            if (btn !== button) {
                btn.classList.remove('active');
            }
        });
    } else {
        // Remove preset
        delete window.activeFilters.preset;
    }
    
    console.log("Updated activeFilters:", window.activeFilters);
    
    // Reload data with current filters
    loadStocksPage(1, 50);
}

/**
 * Format currency value
 * @param {Number} value - Value to format
 * @returns {String} Formatted currency
 */
function formatCurrency(value) {
    if (value === undefined || value === null) return 'N/A';
    
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(value);
}

/**
 * Format large number with suffix (K, M, B, T)
 * @param {Number} value - Value to format
 * @returns {String} Formatted number
 */
function formatLargeNumber(value) {
    if (value === undefined || value === null) return 'N/A';
    
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
