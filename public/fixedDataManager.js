/**
 * Fixed version of the EnhancedDataManager class
 * Resolves issues with data loading and integration with DataFieldMapper
 */
class EnhancedDataManager {
    /**
     * Constructor
     * @param {Object} options - Configuration options
     */
    constructor(options = {}) {
        this.apiEndpoint = options.apiEndpoint || '/api/stocks';
        this.advancedApiEndpoint = options.advancedApiEndpoint || '/api/advancedFilters';
        this.batchSize = options.batchSize || 75;
        this.progressCallback = options.progressCallback || (() => {});
        this.completeCallback = options.completeCallback || (() => {});
        this.batchLoadedCallback = options.batchLoadedCallback || (() => {});
        
        this.stocks = [];
        this.filteredStocks = [];
        this.currentPage = 1;
        this.totalPages = 1;
        this.isLoading = false;
        this.isComplete = false;
        this.lastFilters = {};
        
        // Initialize cache
        this.initCache();
    }
    
    /**
     * Initialize cache
     */
    initCache() {
        try {
            // Check if localStorage is available
            if (typeof localStorage !== 'undefined') {
                const cachedStocks = localStorage.getItem('stocksCache');
                
                if (cachedStocks) {
                    const cache = JSON.parse(cachedStocks);
                    
                    // Check if cache is valid and not expired
                    if (cache && cache.timestamp && cache.stocks) {
                        const now = new Date().getTime();
                        const cacheAge = now - cache.timestamp;
                        
                        // Cache is valid for 1 hour
                        if (cacheAge < 3600000) {
                            console.log(`Loading ${cache.stocks.length} stocks from cache`);
                            this.stocks = cache.stocks;
                            this.progressCallback(this.stocks.length, this.stocks.length, true);
                            this.batchLoadedCallback(this.stocks, true);
                            return;
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error initializing cache:', error);
        }
    }
    
    /**
     * Update cache
     */
    updateCache() {
        try {
            // Check if localStorage is available
            if (typeof localStorage !== 'undefined') {
                const cache = {
                    timestamp: new Date().getTime(),
                    stocks: this.stocks
                };
                
                localStorage.setItem('stocksCache', JSON.stringify(cache));
                console.log(`Updated cache with ${this.stocks.length} stocks`);
            }
        } catch (error) {
            console.error('Error updating cache:', error);
        }
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
        console.log(`Loading batch: page=${this.currentPage}, size=${this.batchSize}`);
        
        try {
            // Fetch stocks from API
            const response = await fetch(`${this.apiEndpoint}?page=${this.currentPage}&limit=${this.batchSize}`);
            
            if (!response.ok) {
                throw new Error(`API error: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log(`API response:`, data);
            
            if (!data || !data.stocks || !Array.isArray(data.stocks)) {
                console.error('Invalid API response format:', data);
                throw new Error('Invalid API response format');
            }
            
            // Map stocks using DataFieldMapper
            const mappedStocks = data.stocks.map(stock => {
                // Check if DataFieldMapper is available
                if (typeof DataFieldMapper !== 'undefined') {
                    return DataFieldMapper.mapToFrontend(stock);
                }
                return stock;
            });
            
            console.log(`Mapped ${mappedStocks.length} stocks`);
            
            // Add stocks to collection
            this.stocks = [...this.stocks, ...mappedStocks];
            
            // Update pagination
            this.currentPage++;
            this.totalPages = data.pagination ? data.pagination.pages : 1;
            this.isComplete = this.currentPage > this.totalPages;
            
            // Update cache
            this.updateCache();
            
            // Call callbacks
            this.progressCallback(this.stocks.length, data.pagination ? data.pagination.total : this.stocks.length);
            this.batchLoadedCallback(mappedStocks);
            
            if (this.isComplete) {
                this.completeCallback(this.stocks);
            }
            
            this.isLoading = false;
            return mappedStocks;
        } catch (error) {
            console.error('Error loading stocks:', error);
            this.isLoading = false;
            throw error;
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
        
        // Apply filters
        return this.stocks.filter(stock => {
            // Apply market cap filter
            if (filters.market_cap && filters.market_cap.length > 0) {
                const marketCap = stock.market_cap || stock.marketCap || 0;
                
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
                const volume = stock.avg_dollar_volume || stock.avgDollarVolume || 0;
                
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
                const debtToEBITDA = stock.netDebtToEBITDA || (stock.financials && stock.financials.debt_to_ebitda) || 0;
                
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
                const evToEBIT = stock.evToEBIT || (stock.financials && stock.financials.ev_to_ebit) || 0;
                
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
                    const peRatio = stock.pe_ratio || stock.peRatio || 0;
                    const evToEBIT = stock.evToEBIT || (stock.financials && stock.financials.ev_to_ebit) || 0;
                    
                    if (peRatio > 15 || evToEBIT > 10) {
                        return false;
                    }
                }
                
                if (filters.preset.includes('growth')) {
                    const revenueGrowth = (stock.financials && stock.financials.revenue_growth) || 0;
                    
                    if (revenueGrowth < 0.15) { // 15% growth
                        return false;
                    }
                }
                
                if (filters.preset.includes('dividend')) {
                    const dividendYield = stock.dividend_yield || stock.dividendYield || 0;
                    
                    if (dividendYield < 0.03) { // 3% yield
                        return false;
                    }
                }
                
                if (filters.preset.includes('quality')) {
                    const rotce = stock.rotce || (stock.financials && stock.financials.rotce) || 0;
                    
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
    }
    
    /**
     * Load filtered stocks based on advanced filters
     * @param {Object} filters - Advanced filter criteria
     * @returns {Promise} Promise that resolves with filtered stocks
     */
    async loadFilteredStocks(filters = {}) {
        if (Object.keys(filters).length === 0) {
            return this.stocks;
        }
        
        try {
            // Fetch filtered stocks from API
            const response = await fetch(this.advancedApiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(filters)
            });
            
            if (!response.ok) {
                throw new Error(`API error: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (!data || !data.stocks || !Array.isArray(data.stocks)) {
                throw new Error('Invalid API response format');
            }
            
            // Map stocks using DataFieldMapper
            const mappedStocks = data.stocks.map(stock => {
                // Check if DataFieldMapper is available
                if (typeof DataFieldMapper !== 'undefined') {
                    return DataFieldMapper.mapToFrontend(stock);
                }
                return stock;
            });
            
            // Store filtered stocks
            this.filteredStocks = mappedStocks;
            this.lastFilters = filters;
            
            return this.filteredStocks;
        } catch (error) {
            console.error('Error loading filtered stocks:', error);
            throw error;
        }
    }
    
    /**
     * Load more filtered results
     * @returns {Promise} Promise that resolves with more filtered stocks
     */
    async loadMoreFilteredResults() {
        // If no filters, load next batch
        if (Object.keys(this.lastFilters).length === 0) {
            return this.loadNextBatch();
        }
        
        try {
            // Fetch more filtered stocks from API
            const response = await fetch(`${this.advancedApiEndpoint}?page=${this.currentPage}&limit=${this.batchSize}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(this.lastFilters)
            });
            
            if (!response.ok) {
                throw new Error(`API error: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (!data || !data.stocks || !Array.isArray(data.stocks)) {
                throw new Error('Invalid API response format');
            }
            
            // Map stocks using DataFieldMapper
            const mappedStocks = data.stocks.map(stock => {
                // Check if DataFieldMapper is available
                if (typeof DataFieldMapper !== 'undefined') {
                    return DataFieldMapper.mapToFrontend(stock);
                }
                return stock;
            });
            
            // Add stocks to filtered collection
            this.filteredStocks = [...this.filteredStocks, ...mappedStocks];
            
            // Update pagination
            this.currentPage++;
            
            return mappedStocks;
        } catch (error) {
            console.error('Error loading more filtered results:', error);
            throw error;
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EnhancedDataManager;
}
