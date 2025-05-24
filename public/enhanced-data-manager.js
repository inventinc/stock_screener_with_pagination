/**
 * Enhanced Data Manager with Pagination Support
 * 
 * This module extends the DataManager class to support pagination,
 * allowing users to navigate through large sets of stock data.
 */

/**
 * Data Manager
 * Handles loading, filtering, and caching of stock data with pagination support
 */
class EnhancedDataManager {
    /**
     * Create a data manager
     * @param {Object} options - Configuration options
     * @param {String} options.apiEndpoint - API endpoint for stock data
     * @param {Number} options.pageSize - Number of stocks to load per page
     * @param {Boolean} options.useCache - Whether to use local storage cache
     * @param {Function} options.progressCallback - Callback for progress updates
     * @param {Function} options.completeCallback - Callback for completion
     */
    constructor(options) {
        // Use current host for API endpoint if not specified
        const currentProtocol = window.location.protocol;
        const currentHost = window.location.host;
        const defaultApiEndpoint = currentProtocol + '//' + currentHost + '/api/stocks';
        
        this.apiEndpoint = options.apiEndpoint || defaultApiEndpoint;
        console.log('EnhancedDataManager initialized with API endpoint:', this.apiEndpoint);
        
        this.pageSize = options.pageSize || 50;
        this.useCache = options.useCache !== false;
        this.progressCallback = options.progressCallback || (() => {});
        this.completeCallback = options.completeCallback || (() => {});
        
        this.stocks = [];
        this.totalStocks = 0;
        this.currentPage = 1;
        this.totalPages = 1;
        this.isLoading = false;
        this.lastUpdated = null;
        this.activeFilters = {};
    }
    
    /**
     * Load a specific page of stocks
     * @param {Number} page - Page number to load
     * @param {Object} filters - Filter criteria
     * @returns {Promise} Promise that resolves when page is loaded
     */
    async loadPage(page, filters = {}) {
        if (this.isLoading) return;
        this.isLoading = true;
        
        try {
            // Show loading state
            this.progressCallback(0, 1, false);
            
            // Build query parameters
            const queryParams = new URLSearchParams();
            queryParams.append('page', page);
            queryParams.append('limit', this.pageSize);
            
            // Add filters to query
            if (filters.search) {
                queryParams.append('search', filters.search);
            }
            
            if (filters.exchange && filters.exchange.length) {
                filters.exchange.forEach(ex => {
                    queryParams.append('exchange', ex);
                });
            }
            
            if (filters.marketCap && filters.marketCap.length) {
                // Convert market cap filters to min/max values
                filters.marketCap.forEach(cap => {
                    switch (cap) {
                        case 'large':
                            queryParams.append('marketCapMin', '10000000000');
                            break;
                        case 'mid':
                            queryParams.append('marketCapMin', '2000000000');
                            queryParams.append('marketCapMax', '10000000000');
                            break;
                        case 'small':
                            queryParams.append('marketCapMin', '300000000');
                            queryParams.append('marketCapMax', '2000000000');
                            break;
                        case 'micro':
                            queryParams.append('marketCapMax', '300000000');
                            break;
                    }
                });
            }
            
            // Add volume filters with correct parameter names
            if (filters.volume && filters.volume.length) {
                filters.volume.forEach(vol => {
                    switch (vol) {
                        case 'high':
                            queryParams.append('avgDollarVolumeMin', '5000000'); // >5M
                            break;
                        case 'medium':
                            queryParams.append('avgDollarVolumeMin', '1000000'); // >1M
                            queryParams.append('avgDollarVolumeMax', '5000000'); // <5M
                            break;
                        case 'low':
                            queryParams.append('avgDollarVolumeMax', '1000000'); // <1M
                            break;
                    }
                });
            }
            
            // Add debt filters with correct parameter names
            if (filters.debt && filters.debt.length) {
                filters.debt.forEach(debt => {
                    switch (debt) {
                        case 'low':
                            queryParams.append('debtMax', '0.5'); // <0.5
                            break;
                        case 'medium':
                            queryParams.append('debtMin', '0.5'); // >0.5
                            queryParams.append('debtMax', '1.5'); // <1.5
                            break;
                        case 'high':
                            queryParams.append('debtMin', '1.5'); // >1.5
                            break;
                    }
                });
            }
            
            if (filters.valuation && filters.valuation.length) {
                // Convert valuation filters to min/max PE values
                filters.valuation.forEach(val => {
                    switch (val) {
                        case 'undervalued':
                            queryParams.append('peMax', '15');
                            break;
                        case 'fair':
                            queryParams.append('peMin', '15');
                            queryParams.append('peMax', '25');
                            break;
                        case 'overvalued':
                            queryParams.append('peMin', '25');
                            break;
                    }
                });
            }
            
            // Add preset filters
            if (filters.preset === 'dividend') {
                queryParams.append('hasDividend', 'true');
            }
            
            // Store active filters
            this.activeFilters = filters;
            
            // Generate cache key based on query parameters
            const cacheKey = `stocks_${queryParams.toString()}`;
            
            // Check if data is in cache
            if (this.useCache) {
                const cachedData = this.getFromCache(cacheKey);
                if (cachedData) {
                    console.log(`Returning cached data for ${cacheKey}`);
                    this.stocks = cachedData.stocks;
                    this.totalStocks = cachedData.total;
                    this.currentPage = cachedData.page;
                    this.totalPages = cachedData.totalPages;
                    this.lastUpdated = new Date(cachedData.timestamp);
                    
                    // Report progress
                    this.progressCallback(1, 1, true);
                    
                    // Call complete callback
                    this.completeCallback(this.stocks, {
                        currentPage: this.currentPage,
                        totalPages: this.totalPages,
                        totalStocks: this.totalStocks
                    });
                    
                    this.isLoading = false;
                    return;
                }
            }
            
            // Build URL with query parameters
            const url = `${this.apiEndpoint}?${queryParams.toString()}`;
            console.log(`Loading page ${page} from: ${url}`);
            
            // Fetch data from API
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP error ${response.status}`);
            }
            
            const data = await response.json();
            
            // Update state
            this.stocks = data.stocks || [];
            this.totalStocks = data.pagination?.total || 0;
            this.currentPage = data.pagination?.page || page;
            this.totalPages = data.pagination?.pages || Math.ceil(this.totalStocks / this.pageSize);
            
            // Store stats for display
            if (data.stats) {
                this.stats = data.stats;
            }
            this.lastUpdated = new Date();
            
            console.log(`Page ${page} loaded: ${this.stocks.length} stocks of ${this.totalStocks} total (${this.totalPages} pages)`);
            
            // Save to cache
            if (this.useCache) {
                this.saveToCache(cacheKey, {
                    stocks: this.stocks,
                    total: this.totalStocks,
                    page: this.currentPage,
                    totalPages: this.totalPages,
                    timestamp: Date.now()
                });
            }
            
            // Report progress
            this.progressCallback(1, 1, false);
            
            // Call complete callback
            this.completeCallback(this.stocks, {
                currentPage: this.currentPage,
                totalPages: this.totalPages,
                totalStocks: this.totalStocks
            });
        } catch (error) {
            console.error('Error loading page:', error);
        }
        
        this.isLoading = false;
    }
    
    /**
     * Reload current page with current filters
     * @returns {Promise} Promise that resolves when page is reloaded
     */
    async reloadCurrentPage() {
        return this.loadPage(this.currentPage, this.activeFilters);
    }
    
    /**
     * Change page size and reload data
     * @param {Number} newPageSize - New page size
     * @returns {Promise} Promise that resolves when data is loaded with new page size
     */
    async changePageSize(newPageSize) {
        // Calculate new page number to maintain position
        const currentPosition = (this.currentPage - 1) * this.pageSize;
        const newPage = Math.floor(currentPosition / newPageSize) + 1;
        
        // Update page size
        this.pageSize = newPageSize;
        
        // Load new page
        return this.loadPage(newPage, this.activeFilters);
    }
    
    /**
     * Get all stocks on current page
     * @returns {Array} All stocks on current page
     */
    getCurrentPageStocks() {
        return this.stocks;
    }
    
    /**
     * Get from cache
     * @param {String} key - Cache key
     * @returns {Object|null} Cached data or null if not found
     */
    getFromCache(key) {
        try {
            const cached = localStorage.getItem(key);
            if (!cached) return null;
            
            const data = JSON.parse(cached);
            if (!data || !data.timestamp) return null;
            
            // Check if cache is still valid (less than 5 minutes old)
            const cacheAge = Date.now() - data.timestamp;
            if (cacheAge > 300000) return null;
            
            return data;
        } catch (error) {
            console.error('Error loading from cache:', error);
            return null;
        }
    }
    
    /**
     * Save to cache
     * @param {String} key - Cache key
     * @param {Object} data - Data to cache
     */
    saveToCache(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
        } catch (error) {
            console.error('Error saving to cache:', error);
        }
    }
}

// Export to window
window.EnhancedDataManager = EnhancedDataManager;