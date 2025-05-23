/**
 * OptimizedDataManager - High-performance data management for large stock datasets
 * 
 * Features:
 * - Efficient batch loading with smart prefetching
 * - Background data processing with Web Workers
 * - Memory-efficient caching and state management
 * - Support for server-side filtering and sorting
 */
class OptimizedDataManager {
    /**
     * Create a new OptimizedDataManager
     * @param {Object} options - Configuration options
     */
    constructor(options = {}) {
        // API endpoints
        this.apiEndpoint = options.apiEndpoint || '/api/stocks';
        this.statsEndpoint = options.statsEndpoint || '/api/stats';
        
        // Batch loading configuration
        this.batchSize = options.batchSize || 50;
        this.prefetchThreshold = options.prefetchThreshold || 0.75; // Start prefetching when 75% through current batch
        this.maxCachedItems = options.maxCachedItems || 1000; // Maximum items to keep in memory
        
        // Callbacks
        this.progressCallback = options.progressCallback || (() => {});
        this.completeCallback = options.completeCallback || (() => {});
        this.batchLoadedCallback = options.batchLoadedCallback || (() => {});
        this.errorCallback = options.errorCallback || ((error) => console.error(error));
        
        // State
        this.stocks = [];
        this.filteredStocks = [];
        this.currentPage = 1;
        this.totalPages = 1;
        this.totalItems = 0;
        this.isLoading = false;
        this.isComplete = false;
        this.lastFilters = {};
        this.lastSort = { field: null, direction: 'asc' };
        this.stats = null;
        
        // Performance metrics
        this.metrics = {
            loadTime: 0,
            filterTime: 0,
            sortTime: 0,
            cacheHits: 0,
            cacheMisses: 0
        };
        
        // Cache
        this.cache = new Map();
        this.cacheKeys = [];
        
        // Initialize
        this.init();
    }
    
    /**
     * Initialize the data manager
     */
    init() {
        // Load stats first to get total counts
        this.loadStats()
            .then(() => {
                // Try to load from cache
                this.loadFromCache();
                
                // Load first batch if needed
                if (this.stocks.length === 0) {
                    this.loadNextBatch();
                }
            })
            .catch(error => {
                this.errorCallback(error);
            });
    }
    
    /**
     * Load stats from API
     * @returns {Promise} Promise that resolves when stats are loaded
     */
    async loadStats() {
        try {
            const response = await fetch(this.statsEndpoint);
            
            if (!response.ok) {
                throw new Error(`API error: ${response.status} ${response.statusText}`);
            }
            
            this.stats = await response.json();
            this.totalItems = this.stats.total || 0;
            this.totalPages = Math.ceil(this.totalItems / this.batchSize);
            
            return this.stats;
        } catch (error) {
            console.error('Error loading stats:', error);
            throw error;
        }
    }
    
    /**
     * Load data from cache
     */
    loadFromCache() {
        try {
            // Check if localStorage is available
            if (typeof localStorage !== 'undefined') {
                const cachedStocks = localStorage.getItem('stocksCache');
                const cachedTimestamp = localStorage.getItem('stocksCacheTimestamp');
                
                if (cachedStocks && cachedTimestamp) {
                    const now = Date.now();
                    const timestamp = parseInt(cachedTimestamp, 10);
                    
                    // Cache is valid for 1 hour
                    if (now - timestamp < 3600000) {
                        const stocks = JSON.parse(cachedStocks);
                        
                        if (Array.isArray(stocks) && stocks.length > 0) {
                            console.log(`Loaded ${stocks.length} stocks from cache`);
                            this.stocks = stocks;
                            this.metrics.cacheHits++;
                            
                            // Update progress
                            this.progressCallback(this.stocks.length, this.totalItems, true);
                            this.batchLoadedCallback(this.stocks, true);
                            
                            // Check if we have all items
                            this.isComplete = this.stocks.length >= this.totalItems;
                            
                            if (this.isComplete) {
                                this.completeCallback(this.stocks);
                            }
                            
                            return true;
                        }
                    }
                }
            }
            
            this.metrics.cacheMisses++;
            return false;
        } catch (error) {
            console.error('Error loading from cache:', error);
            this.metrics.cacheMisses++;
            return false;
        }
    }
    
    /**
     * Update cache with current stocks
     */
    updateCache() {
        try {
            // Check if localStorage is available
            if (typeof localStorage !== 'undefined') {
                // Only cache if we have a reasonable number of items
                if (this.stocks.length > 0 && this.stocks.length <= this.maxCachedItems) {
                    localStorage.setItem('stocksCache', JSON.stringify(this.stocks));
                    localStorage.setItem('stocksCacheTimestamp', Date.now().toString());
                    console.log(`Updated cache with ${this.stocks.length} stocks`);
                }
            }
        } catch (error) {
            console.error('Error updating cache:', error);
        }
    }
    
    /**
     * Generate cache key for filters and sort
     * @param {Object} filters - Filter criteria
     * @param {Object} sort - Sort criteria
     * @returns {String} Cache key
     */
    generateCacheKey(filters = {}, sort = {}) {
        return JSON.stringify({ filters, sort });
    }
    
    /**
     * Add result to cache
     * @param {String} key - Cache key
     * @param {Object} value - Cache value
     */
    addToCache(key, value) {
        // Remove oldest cache entry if we've reached the limit
        if (this.cacheKeys.length >= 20) { // Limit cache to 20 entries
            const oldestKey = this.cacheKeys.shift();
            this.cache.delete(oldestKey);
        }
        
        // Add to cache
        this.cache.set(key, value);
        this.cacheKeys.push(key);
    }
    
    /**
     * Get result from cache
     * @param {String} key - Cache key
     * @returns {Object|null} Cache value or null if not found
     */
    getFromCache(key) {
        if (this.cache.has(key)) {
            this.metrics.cacheHits++;
            return this.cache.get(key);
        }
        
        this.metrics.cacheMisses++;
        return null;
    }
    
    /**
     * Load next batch of stocks
     * @returns {Promise} Promise that resolves when batch is loaded
     */
    async loadNextBatch() {
        if (this.isLoading || this.isComplete) {
            console.log(`Skipping loadNextBatch: isLoading=${this.isLoading}, isComplete=${this.isComplete}`);
            return this.stocks;
        }
        
        this.isLoading = true;
        const startTime = performance.now();
        
        try {
            // Build query parameters
            const params = new URLSearchParams({
                page: this.currentPage,
                limit: this.batchSize
            });
            
            // Add sort parameters if specified
            if (this.lastSort.field) {
                params.append('sort', this.lastSort.field);
                params.append('order', this.lastSort.direction);
            }
            
            console.log(`Loading batch: page=${this.currentPage}, size=${this.batchSize}`);
            
            // Fetch stocks from API
            const response = await fetch(`${this.apiEndpoint}?${params.toString()}`);
            
            if (!response.ok) {
                throw new Error(`API error: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (!data || !data.stocks || !Array.isArray(data.stocks)) {
                console.error('Invalid API response format:', data);
                throw new Error('Invalid API response format');
            }
            
            // Process data in background if possible
            const processedStocks = await this.processStocksData(data.stocks);
            
            // Add stocks to collection
            this.stocks = [...this.stocks, ...processedStocks];
            
            // Update pagination
            this.currentPage++;
            this.totalPages = data.pagination ? data.pagination.pages : this.totalPages;
            this.totalItems = data.pagination ? data.pagination.total : this.totalItems;
            this.isComplete = this.currentPage > this.totalPages;
            
            // Update cache
            this.updateCache();
            
            // Update metrics
            this.metrics.loadTime = performance.now() - startTime;
            
            // Call callbacks
            this.progressCallback(this.stocks.length, this.totalItems);
            this.batchLoadedCallback(processedStocks);
            
            if (this.isComplete) {
                this.completeCallback(this.stocks);
            }
            
            this.isLoading = false;
            return processedStocks;
        } catch (error) {
            console.error('Error loading stocks:', error);
            this.isLoading = false;
            this.errorCallback(error);
            throw error;
        }
    }
    
    /**
     * Process stocks data (potentially in a Web Worker)
     * @param {Array} stocks - Raw stocks data
     * @returns {Promise} Promise that resolves with processed stocks
     */
    async processStocksData(stocks) {
        // If Web Workers are supported and we have a lot of data, process in background
        if (window.Worker && stocks.length > 100) {
            return new Promise((resolve, reject) => {
                try {
                    // Create a blob URL for the worker script
                    const workerScript = `
                        self.onmessage = function(e) {
                            const stocks = e.data;
                            
                            // Process each stock
                            const processedStocks = stocks.map(stock => {
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
                            
                            // Send processed stocks back to main thread
                            self.postMessage(processedStocks);
                            
                            // Helper functions
                            function formatCurrency(value) {
                                return new Intl.NumberFormat('en-US', {
                                    style: 'currency',
                                    currency: 'USD',
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2
                                }).format(value);
                            }
                            
                            function formatLargeNumber(value) {
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
                        };
                    `;
                    
                    const blob = new Blob([workerScript], { type: 'application/javascript' });
                    const workerUrl = URL.createObjectURL(blob);
                    
                    // Create worker
                    const worker = new Worker(workerUrl);
                    
                    // Set up message handler
                    worker.onmessage = function(e) {
                        // Clean up
                        worker.terminate();
                        URL.revokeObjectURL(workerUrl);
                        
                        // Resolve with processed stocks
                        resolve(e.data);
                    };
                    
                    // Set up error handler
                    worker.onerror = function(error) {
                        // Clean up
                        worker.terminate();
                        URL.revokeObjectURL(workerUrl);
                        
                        // Fall back to synchronous processing
                        console.warn('Web Worker error, falling back to synchronous processing:', error);
                        resolve(this.processStocksSync(stocks));
                    }.bind(this);
                    
                    // Start processing
                    worker.postMessage(stocks);
                } catch (error) {
                    console.warn('Web Worker creation failed, falling back to synchronous processing:', error);
                    resolve(this.processStocksSync(stocks));
                }
            });
        } else {
            // Fall back to synchronous processing
            return this.processStocksSync(stocks);
        }
    }
    
    /**
     * Process stocks data synchronously
     * @param {Array} stocks - Raw stocks data
     * @returns {Array} Processed stocks
     */
    processStocksSync(stocks) {
        return stocks.map(stock => {
            // Format numbers for display
            if (stock.price) {
                stock.formattedPrice = this.formatCurrency(stock.price);
            }
            
            if (stock.marketCap) {
                stock.formattedMarketCap = this.formatLargeNumber(stock.marketCap);
            }
            
            if (stock.avgDollarVolume) {
                stock.formattedVolume = this.formatLargeNumber(stock.avgDollarVolume);
            }
            
            return stock;
        });
    }
    
    /**
     * Format currency value
     * @param {Number} value - Value to format
     * @returns {String} Formatted currency
     */
    formatCurrency(value) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(value);
    }
    
    /**
     * Format large number with appropriate suffix
     * @param {Number} value - Value to format
     * @returns {String} Formatted number
     */
    formatLargeNumber(value) {
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
     * Get all loaded stocks
     * @returns {Array} All loaded stocks
     */
    getAllStocks() {
        return this.stocks;
    }
    
    /**
     * Get filtered stocks based on filters
     * @param {Object} filters - Filter criteria
     * @returns {Array} Filtered stocks
     */
    getFilteredStocks(filters = {}) {
        // If no filters, return all stocks
        if (Object.keys(filters).length === 0) {
            return this.stocks;
        }
        
        const startTime = performance.now();
        
        // Check cache first
        const cacheKey = this.generateCacheKey(filters, this.lastSort);
        const cachedResult = this.getFromCache(cacheKey);
        
        if (cachedResult) {
            return cachedResult;
        }
        
        // Apply filters
        const filteredStocks = this.stocks.filter(stock => {
            // Apply market cap filter
            if (filters.market_cap && filters.market_cap.length > 0) {
                const marketCap = stock.marketCap || 0;
                
                if (filters.market_cap.includes('large') && marketCap < 10000000000) {
                    return false;
                }
                
                if (filters.market_cap.includes('mid') && (marketCap < 2000000000 || marketCap > 10000000000)) {
                    return false;
                }
                
                if (filters.market_cap.includes('small') && (marketCap < 300000000 || marketCap > 2000000000)) {
                    return false;
                }
                
                if (filters.market_cap.includes('micro') && marketCap > 300000000) {
                    return false;
                }
            }
            
            // Apply volume filter
            if (filters.volume && filters.volume.length > 0) {
                const volume = stock.avgDollarVolume || 0;
                
                if (filters.volume.includes('high') && volume < 5000000) {
                    return false;
                }
                
                if (filters.volume.includes('medium') && (volume < 1000000 || volume > 5000000)) {
                    return false;
                }
                
                if (filters.volume.includes('low') && volume > 1000000) {
                    return false;
                }
            }
            
            // Apply debt filter
            if (filters.debt && filters.debt.length > 0) {
                const debtToEBITDA = stock.netDebtToEBITDA || 0;
                
                if (filters.debt.includes('low') && debtToEBITDA > 1) {
                    return false;
                }
                
                if (filters.debt.includes('moderate') && (debtToEBITDA < 1 || debtToEBITDA > 3)) {
                    return false;
                }
                
                if (filters.debt.includes('high') && debtToEBITDA < 3) {
                    return false;
                }
            }
            
            // Apply valuation filter
            if (filters.valuation && filters.valuation.length > 0) {
                const evToEBIT = stock.evToEBIT || 0;
                
                if (filters.valuation.includes('undervalued') && evToEBIT > 10) {
                    return false;
                }
                
                if (filters.valuation.includes('fair') && (evToEBIT < 10 || evToEBIT > 15)) {
                    return false;
                }
                
                if (filters.valuation.includes('overvalued') && evToEBIT < 15) {
                    return false;
                }
            }
            
            // Apply preset filter
            if (filters.preset && filters.preset.length > 0) {
                if (filters.preset.includes('value')) {
                    const peRatio = stock.peRatio || 0;
                    const evToEBIT = stock.evToEBIT || 0;
                    
                    if (peRatio > 15 || evToEBIT > 10) {
                        return false;
                    }
                }
                
                if (filters.preset.includes('growth')) {
                    const score = stock.score || 0;
                    
                    if (score < 70) {
                        return false;
                    }
                }
                
                if (filters.preset.includes('dividend')) {
                    const dividendYield = stock.dividendYield || 0;
                    
                    if (dividendYield < 0.03) { // 3% yield
                        return false;
                    }
                }
                
                if (filters.preset.includes('quality')) {
                    const rotce = stock.rotce || 0;
                    
                    if (rotce < 0.15) { // 15% ROTCE
                        return false;
                    }
                }
            }
            
            // Apply search filter
            if (filters.search) {
                const search = filters.search.toLowerCase();
                const symbol = (stock.symbol || '').toLowerCase();
                const name = (stock.name || '').toLowerCase();
                
                if (!symbol.includes(search) && !name.includes(search)) {
                    return false;
                }
            }
            
            return true;
        });
        
        // Update metrics
        this.metrics.filterTime = performance.now() - startTime;
        
        // Cache result
        this.addToCache(cacheKey, filteredStocks);
        
        // Store last filters
        this.lastFilters = { ...filters };
        
        // Store filtered stocks
        this.filteredStocks = filteredStocks;
        
        return filteredStocks;
    }
    
    /**
     * Sort stocks by field
     * @param {String} field - Field to sort by
     * @param {String} direction - Sort direction ('asc' or 'desc')
     * @returns {Array} Sorted stocks
     */
    sortStocks(field, direction = 'asc') {
        if (!field) {
            return this.filteredStocks.length > 0 ? this.filteredStocks : this.stocks;
        }
        
        const startTime = performance.now();
        
        // Check cache first
        const cacheKey = this.generateCacheKey(this.lastFilters, { field, direction });
        const cachedResult = this.getFromCache(cacheKey);
        
        if (cachedResult) {
            return cachedResult;
        }
        
        // Get stocks to sort (filtered or all)
        const stocksToSort = [...(this.filteredStocks.length > 0 ? this.filteredStocks : this.stocks)];
        
        // Sort stocks
        stocksToSort.sort((a, b) => {
            let valueA = a[field];
            let valueB = b[field];
            
            // Handle null/undefined values
            if (valueA === null || valueA === undefined) valueA = direction === 'asc' ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;
            if (valueB === null || valueB === undefined) valueB = direction === 'asc' ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;
            
            // Compare based on type
            if (typeof valueA === 'string' && typeof valueB === 'string') {
                return direction === 'asc' 
                    ? valueA.localeCompare(valueB) 
                    : valueB.localeCompare(valueA);
            } else {
                return direction === 'asc' 
                    ? valueA - valueB 
                    : valueB - valueA;
            }
        });
        
        // Update metrics
        this.metrics.sortTime = performance.now() - startTime;
        
        // Cache result
        this.addToCache(cacheKey, stocksToSort);
        
        // Store last sort
        this.lastSort = { field, direction };
        
        return stocksToSort;
    }
    
    /**
     * Load filtered stocks from server
     * @param {Object} filters - Filter criteria
     * @returns {Promise} Promise that resolves with filtered stocks
     */
    async loadFilteredStocks(filters = {}) {
        if (Object.keys(filters).length === 0) {
            return this.stocks;
        }
        
        this.isLoading = true;
        const startTime = performance.now();
        
        try {
            // Build query parameters
            const params = new URLSearchParams({
                page: 1,
                limit: this.batchSize
            });
            
            // Add filter parameters
            Object.entries(filters).forEach(([key, value]) => {
                if (Array.isArray(value)) {
                    value.forEach(v => params.append(key, v));
                } else {
                    params.append(key, value);
                }
            });
            
            // Add sort parameters if specified
            if (this.lastSort.field) {
                params.append('sort', this.lastSort.field);
                params.append('order', this.lastSort.direction);
            }
            
            // Fetch filtered stocks from API
            const response = await fetch(`${this.apiEndpoint}?${params.toString()}`);
            
            if (!response.ok) {
                throw new Error(`API error: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (!data || !data.stocks || !Array.isArray(data.stocks)) {
                throw new Error('Invalid API response format');
            }
            
            // Process data in background if possible
            const processedStocks = await this.processStocksData(data.stocks);
            
            // Store filtered stocks
            this.filteredStocks = processedStocks;
            this.lastFilters = { ...filters };
            
            // Update pagination for filtered results
            this.currentPage = 2; // Next page would be 2
            this.totalPages = data.pagination ? data.pagination.pages : 1;
            this.totalItems = data.pagination ? data.pagination.total : processedStocks.length;
            
            // Update metrics
            this.metrics.filterTime = performance.now() - startTime;
            
            this.isLoading = false;
            return processedStocks;
        } catch (error) {
            console.error('Error loading filtered stocks:', error);
            this.isLoading = false;
            this.errorCallback(error);
            throw error;
        }
    }
    
    /**
     * Load more filtered results
     * @returns {Promise} Promise that resolves with more filtered stocks
     */
    async loadMoreFilteredResults() {
        if (this.isLoading) {
            return this.filteredStocks;
        }
        
        // If no filters, load next batch
        if (Object.keys(this.lastFilters).length === 0) {
            return this.loadNextBatch();
        }
        
        this.isLoading = true;
        
        try {
            // Build query parameters
            const params = new URLSearchParams({
                page: this.currentPage,
                limit: this.batchSize
            });
            
            // Add filter parameters
            Object.entries(this.lastFilters).forEach(([key, value]) => {
                if (Array.isArray(value)) {
                    value.forEach(v => params.append(key, v));
                } else {
                    params.append(key, value);
                }
            });
            
            // Add sort parameters if specified
            if (this.lastSort.field) {
                params.append('sort', this.lastSort.field);
                params.append('order', this.lastSort.direction);
            }
            
            // Fetch more filtered stocks from API
            const response = await fetch(`${this.apiEndpoint}?${params.toString()}`);
            
            if (!response.ok) {
                throw new Error(`API error: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (!data || !data.stocks || !Array.isArray(data.stocks)) {
                throw new Error('Invalid API response format');
            }
            
            // Process data in background if possible
            const processedStocks = await this.processStocksData(data.stocks);
            
            // Add stocks to filtered collection
            this.filteredStocks = [...this.filteredStocks, ...processedStocks];
            
            // Update pagination
            this.currentPage++;
            this.totalPages = data.pagination ? data.pagination.pages : this.totalPages;
            this.isComplete = this.currentPage > this.totalPages;
            
            // Call callbacks
            this.progressCallback(this.filteredStocks.length, this.totalItems);
            this.batchLoadedCallback(processedStocks);
            
            if (this.isComplete) {
                this.completeCallback(this.filteredStocks);
            }
            
            this.isLoading = false;
            return processedStocks;
        } catch (error) {
            console.error('Error loading more filtered results:', error);
            this.isLoading = false;
            this.errorCallback(error);
            throw error;
        }
    }
    
    /**
     * Get performance metrics
     * @returns {Object} Performance metrics
     */
    getPerformanceMetrics() {
        return {
            loadTime: `${this.metrics.loadTime.toFixed(2)}ms`,
            filterTime: `${this.metrics.filterTime.toFixed(2)}ms`,
            sortTime: `${this.metrics.sortTime.toFixed(2)}ms`,
            cacheHits: this.metrics.cacheHits,
            cacheMisses: this.metrics.cacheMisses
        };
    }
    
    /**
     * Reset data manager
     */
    reset() {
        this.stocks = [];
        this.filteredStocks = [];
        this.currentPage = 1;
        this.isComplete = false;
        this.lastFilters = {};
        this.lastSort = { field: null, direction: 'asc' };
        this.cache.clear();
        this.cacheKeys = [];
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = OptimizedDataManager;
}
