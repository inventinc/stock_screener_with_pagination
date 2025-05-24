/**
 * ImprovedDataManager - Optimized data management for stock screener with 5,700+ stocks
 * Features:
 * - Smaller batch sizes (50-75) for better performance
 * - LocalStorage caching for persistence between page refreshes
 * - Optimized filtering and sorting
 * - Memory management for large datasets
 */
class IncrementalDataManager {
    /**
     * Create a new IncrementalDataManager
     * @param {Object} options - Configuration options
     * @param {String} options.apiEndpoint - API endpoint for fetching stocks
     * @param {Number} options.batchSize - Number of stocks to fetch per batch
     * @param {Boolean} options.useCache - Whether to use browser cache
     * @param {Boolean} options.excludeETFs - Whether to exclude ETFs
     * @param {Number} options.maxConcurrentRequests - Maximum number of concurrent requests
     * @param {Function} options.progressCallback - Callback for progress updates
     * @param {Function} options.completeCallback - Callback for completion
     * @param {Function} options.batchLoadedCallback - Callback for batch loaded
     */
    constructor(options) {
        this.apiEndpoint = options.apiEndpoint || '/api/stocks';
        this.batchSize = options.batchSize || 50;
        this.useCache = options.useCache !== false;
        this.excludeETFs = options.excludeETFs !== false;
        this.maxConcurrentRequests = options.maxConcurrentRequests || 1;
        
        // Callbacks
        this.progressCallback = options.progressCallback || (() => {});
        this.completeCallback = options.completeCallback || (() => {});
        this.batchLoadedCallback = options.batchLoadedCallback || (() => {});
        
        // State
        this.stocks = [];
        this.filteredStocks = [];
        this.activeRequests = 0;
        this.currentOffset = 0;
        this.totalCount = 0;
        this.isLoading = false;
        this.isComplete = false;
        this.hasError = false;
        this.lastError = null;
        
        // Performance metrics
        this.metrics = {
            loadTime: 0,
            filterTime: 0,
            memoryUsage: 0,
            requestCount: 0
        };
        
        // Initialize
        this.init();
    }
    
    /**
     * Initialize the data manager
     */
    init() {
        // Check if we have cached data in localStorage
        if (this.useCache) {
            const cachedData = this.loadFromCache();
            if (cachedData && cachedData.stocks && cachedData.stocks.length > 0) {
                console.log(`Loaded ${cachedData.stocks.length} stocks from cache`);
                this.stocks = cachedData.stocks;
                this.totalCount = cachedData.totalCount || cachedData.stocks.length;
                this.currentOffset = cachedData.stocks.length;
                this.isComplete = cachedData.isComplete || false;
                
                // Notify progress
                this.progressCallback(this.stocks.length, this.totalCount, true);
                
                // Notify batch loaded
                this.batchLoadedCallback(this.stocks, true);
                
                // If complete, notify completion
                if (this.isComplete) {
                    this.completeCallback(this.stocks);
                }
            } else {
                // Get total count first
                this.fetchTotalCount();
            }
        } else {
            // Get total count first
            this.fetchTotalCount();
        }
    }
    
    /**
     * Fetch total count of stocks
     */
    async fetchTotalCount() {
        try {
            const response = await fetch(`${this.apiEndpoint}/count?excludeETFs=${this.excludeETFs}`);
            const data = await response.json();
            
            this.totalCount = data.count;
            console.log(`Total stocks: ${this.totalCount}`);
            
            // Notify progress
            this.progressCallback(this.stocks.length, this.totalCount);
        } catch (error) {
            console.error('Error fetching total count:', error);
            this.hasError = true;
            this.lastError = error;
            
            // Use a default count
            this.totalCount = 5700;
            
            // Notify progress
            this.progressCallback(this.stocks.length, this.totalCount);
        }
    }
    
    /**
     * Load next batch of stocks
     * @returns {Promise<Boolean>} Success status
     */
    async loadNextBatch() {
        // If already complete or loading, don't load more
        if (this.isComplete || this.isLoading || this.activeRequests >= this.maxConcurrentRequests) {
            return false;
        }
        
        // Set loading state
        this.isLoading = true;
        this.activeRequests++;
        
        try {
            const startTime = performance.now();
            
            // Build query parameters
            const params = new URLSearchParams({
                offset: this.currentOffset,
                limit: this.batchSize,
                excludeETFs: this.excludeETFs
            });
            
            // Fetch data
            const response = await fetch(`${this.apiEndpoint}?${params}`);
            const data = await response.json();
            
            // Update metrics
            this.metrics.loadTime = performance.now() - startTime;
            this.metrics.requestCount++;
            
            // Process data
            if (data && data.stocks) {
                // Add new stocks to array
                this.stocks = [...this.stocks, ...data.stocks];
                
                // Update offset
                this.currentOffset += data.stocks.length;
                
                // Check if complete
                this.isComplete = !data.pagination.hasMore;
                
                // Save to cache
                if (this.useCache) {
                    this.saveToCache();
                }
                
                // Notify progress
                this.progressCallback(this.stocks.length, this.totalCount);
                
                // Notify batch loaded
                this.batchLoadedCallback(this.stocks);
                
                // If complete, notify completion
                if (this.isComplete) {
                    this.completeCallback(this.stocks);
                }
                
                console.log(`Loaded ${data.stocks.length} stocks, total: ${this.stocks.length}`);
            }
            
            // Reset loading state
            this.isLoading = false;
            this.activeRequests--;
            
            return true;
        } catch (error) {
            console.error('Error loading stocks:', error);
            this.hasError = true;
            this.lastError = error;
            
            // Reset loading state
            this.isLoading = false;
            this.activeRequests--;
            
            return false;
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
     * Get filtered stocks based on criteria
     * @param {Object} filters - Filter criteria
     * @returns {Array} Filtered stocks
     */
    getFilteredStocks(filters = {}) {
        const startTime = performance.now();
        
        // Start with all stocks
        let result = this.stocks;
        
        // Apply search filter
        if (filters.search) {
            const searchTerm = filters.search.toLowerCase();
            result = result.filter(stock => {
                const symbol = (stock.ticker || stock.symbol || '').toLowerCase();
                const name = (stock.name || '').toLowerCase();
                return symbol.includes(searchTerm) || name.includes(searchTerm);
            });
        }
        
        // Apply market cap filters
        if (filters.marketCap && filters.marketCap.length > 0) {
            result = result.filter(stock => {
                const marketCap = stock.market_cap || stock.marketCap || 0;
                
                if (filters.marketCap.includes('large') && marketCap >= 10e9) {
                    return true;
                }
                
                if (filters.marketCap.includes('mid') && marketCap >= 2e9 && marketCap < 10e9) {
                    return true;
                }
                
                if (filters.marketCap.includes('small') && marketCap >= 300e6 && marketCap < 2e9) {
                    return true;
                }
                
                if (filters.marketCap.includes('micro') && marketCap < 300e6) {
                    return true;
                }
                
                return false;
            });
        }
        
        // Apply volume filters
        if (filters.volume && filters.volume.length > 0) {
            result = result.filter(stock => {
                const volume = stock.volume || 0;
                const price = stock.price || (stock.last_trade && stock.last_trade.p) || 0;
                const dollarVolume = volume * price;
                
                if (filters.volume.includes('high') && dollarVolume >= 5e6) {
                    return true;
                }
                
                if (filters.volume.includes('medium') && dollarVolume >= 1e6 && dollarVolume < 5e6) {
                    return true;
                }
                
                if (filters.volume.includes('low') && dollarVolume >= 5e5 && dollarVolume < 1e6) {
                    return true;
                }
                
                return false;
            });
        }
        
        // Apply debt filters
        if (filters.debt && filters.debt.length > 0) {
            result = result.filter(stock => {
                const debtToEbitda = stock.netDebtToEBITDA || stock.debt_to_ebitda || 0;
                
                if (filters.debt.includes('low') && debtToEbitda < 1) {
                    return true;
                }
                
                if (filters.debt.includes('moderate') && debtToEbitda >= 1 && debtToEbitda <= 2) {
                    return true;
                }
                
                if (filters.debt.includes('high') && debtToEbitda > 2) {
                    return true;
                }
                
                return false;
            });
        }
        
        // Apply valuation filters
        if (filters.valuation && filters.valuation.length > 0) {
            result = result.filter(stock => {
                const pe = stock.pe_ratio || stock.peRatio || 0;
                
                // Skip stocks with invalid P/E
                if (pe <= 0) return false;
                
                if (filters.valuation.includes('undervalued') && pe < 15) {
                    return true;
                }
                
                if (filters.valuation.includes('fair') && pe >= 15 && pe <= 25) {
                    return true;
                }
                
                if (filters.valuation.includes('overvalued') && pe > 25) {
                    return true;
                }
                
                return false;
            });
        }
        
        // Apply preset filters
        if (filters.preset) {
            switch (filters.preset) {
                case 'value':
                    result = result.filter(stock => {
                        const pe = stock.pe_ratio || stock.peRatio || 0;
                        const debtToEbitda = stock.netDebtToEBITDA || stock.debt_to_ebitda || 0;
                        return pe > 0 && pe < 15 && debtToEbitda < 3;
                    });
                    break;
                    
                case 'growth':
                    result = result.filter(stock => {
                        const score = stock.custom_score || stock.score || 0;
                        return score >= 70;
                    });
                    break;
                    
                case 'dividend':
                    result = result.filter(stock => {
                        const dividendYield = stock.dividend_yield || stock.dividendYield || 0;
                        return dividendYield > 0.02; // > 2%
                    });
                    break;
                    
                case 'quality':
                    result = result.filter(stock => {
                        const rotce = stock.rotce || stock.returnOnTangibleCapital || 0;
                        const debtToEbitda = stock.netDebtToEBITDA || stock.debt_to_ebitda || 0;
                        return rotce > 0.15 && debtToEbitda < 2; // > 15% ROTCE and < 2x Debt/EBITDA
                    });
                    break;
            }
        }
        
        // Update metrics
        this.metrics.filterTime = performance.now() - startTime;
        
        // Cache filtered results
        this.filteredStocks = result;
        
        return result;
    }
    
    /**
     * Get loading status
     * @returns {Object} Loading status
     */
    getLoadingStatus() {
        return {
            isLoading: this.isLoading,
            isComplete: this.isComplete,
            hasError: this.hasError,
            lastError: this.lastError,
            loadedCount: this.stocks.length,
            totalCount: this.totalCount,
            progress: this.totalCount > 0 ? this.stocks.length / this.totalCount : 0,
            hasMoreData: !this.isComplete
        };
    }
    
    /**
     * Get performance metrics
     * @returns {Object} Performance metrics
     */
    getPerformanceMetrics() {
        // Update memory usage if available
        if (window.performance && window.performance.memory) {
            this.metrics.memoryUsage = window.performance.memory.usedJSHeapSize;
        }
        
        return {
            loadTime: `${this.metrics.loadTime.toFixed(2)}ms`,
            filterTime: `${this.metrics.filterTime.toFixed(2)}ms`,
            memoryUsage: this.metrics.memoryUsage > 0 ? 
                `${Math.round(this.metrics.memoryUsage / (1024 * 1024))}MB` : 'N/A',
            requestCount: this.metrics.requestCount,
            stockCount: this.stocks.length,
            filteredCount: this.filteredStocks.length
        };
    }
    
    /**
     * Save data to cache
     */
    saveToCache() {
        try {
            const cacheData = {
                stocks: this.stocks,
                totalCount: this.totalCount,
                isComplete: this.isComplete,
                timestamp: Date.now()
            };
            
            localStorage.setItem('stockScreenerData', JSON.stringify(cacheData));
        } catch (error) {
            console.error('Error saving to cache:', error);
        }
    }
    
    /**
     * Load data from cache
     * @returns {Object|null} Cached data or null if not found
     */
    loadFromCache() {
        try {
            const cacheData = localStorage.getItem('stockScreenerData');
            if (!cacheData) return null;
            
            const data = JSON.parse(cacheData);
            
            // Check if data is too old (more than 24 hours)
            if (Date.now() - data.timestamp > 24 * 60 * 60 * 1000) {
                console.log('Cache is too old, not using it');
                return null;
            }
            
            return data;
        } catch (error) {
            console.error('Error loading from cache:', error);
            return null;
        }
    }
}
