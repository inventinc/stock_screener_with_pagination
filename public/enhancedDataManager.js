/**
 * Enhanced DataManager with support for advanced filters
 * Optimized for batch loading of 50-75 stocks at a time
 */
class EnhancedDataManager {
    constructor(options) {
        this.apiEndpoint = options.apiEndpoint || '/api/stocks';
        this.advancedApiEndpoint = options.advancedApiEndpoint || '/api/advancedFilters';
        this.batchSize = options.batchSize || 75; // Default to 75 stocks per batch
        this.useCache = options.useCache !== undefined ? options.useCache : true;
        
        // Callbacks
        this.progressCallback = options.progressCallback || function() {};
        this.completeCallback = options.completeCallback || function() {};
        this.batchLoadedCallback = options.batchLoadedCallback || function() {};
        
        // State
        this.stocks = [];
        this.filteredStocks = [];
        this.currentPage = 1;
        this.totalPages = 1;
        this.totalStocks = 0;
        this.isLoading = false;
        this.hasMoreData = true;
        this.lastFilters = {};
        
        // Initialize cache
        this.initCache();
    }
    
    /**
     * Initialize cache
     */
    initCache() {
        if (!this.useCache) return;
        
        // Check for cached stocks
        const cachedStocks = localStorage.getItem('stockScreenerStocks');
        const cachedTimestamp = localStorage.getItem('stockScreenerTimestamp');
        
        if (cachedStocks && cachedTimestamp) {
            try {
                // Check if cache is still valid (less than 1 hour old)
                const timestamp = parseInt(cachedTimestamp, 10);
                const now = Date.now();
                const oneHour = 60 * 60 * 1000;
                
                if (now - timestamp < oneHour) {
                    // Parse cached stocks
                    this.stocks = JSON.parse(cachedStocks);
                    
                    // Update state
                    this.totalStocks = this.stocks.length;
                    this.hasMoreData = false;
                    
                    // Notify progress
                    this.progressCallback(this.stocks.length, this.stocks.length, true);
                    
                    // Notify batch loaded
                    this.batchLoadedCallback(this.stocks, true);
                    
                    // Notify complete
                    this.completeCallback(this.stocks);
                    
                    console.log(`Loaded ${this.stocks.length} stocks from cache`);
                    return;
                }
            } catch (error) {
                console.error('Error parsing cached stocks:', error);
            }
        }
    }
    
    /**
     * Update cache
     */
    updateCache() {
        if (!this.useCache || this.stocks.length === 0) return;
        
        try {
            // Store stocks in cache
            localStorage.setItem('stockScreenerStocks', JSON.stringify(this.stocks));
            localStorage.setItem('stockScreenerTimestamp', Date.now().toString());
            
            console.log(`Cached ${this.stocks.length} stocks`);
        } catch (error) {
            console.error('Error caching stocks:', error);
        }
    }
    
    /**
     * Load next batch of stocks
     * @returns {Promise} Promise that resolves when batch is loaded
     */
    async loadNextBatch() {
        if (this.isLoading || !this.hasMoreData) return Promise.resolve(false);
        
        this.isLoading = true;
        
        try {
            // Build URL
            const url = `${this.apiEndpoint}?page=${this.currentPage}&limit=${this.batchSize}&excludeETFs=true`;
            
            // Fetch data
            const response = await fetch(url);
            const data = await response.json();
            
            // Update state
            this.stocks = [...this.stocks, ...data.stocks];
            this.currentPage = data.pagination.page + 1;
            this.totalPages = data.pagination.pages;
            this.totalStocks = data.pagination.total;
            this.hasMoreData = this.currentPage <= this.totalPages;
            
            // Notify progress
            this.progressCallback(this.stocks.length, this.totalStocks);
            
            // Notify batch loaded
            this.batchLoadedCallback(this.stocks);
            
            // Update cache if complete
            if (!this.hasMoreData) {
                this.updateCache();
                this.completeCallback(this.stocks);
            }
            
            console.log(`Loaded batch ${this.currentPage - 1} of ${this.totalPages}, total stocks: ${this.stocks.length}`);
            
            this.isLoading = false;
            return true;
        } catch (error) {
            console.error('Error loading stocks:', error);
            this.isLoading = false;
            return false;
        }
    }
    
    /**
     * Load all stocks
     * @returns {Promise} Promise that resolves when all stocks are loaded
     */
    async loadAllStocks() {
        if (this.isLoading) return Promise.resolve(false);
        
        // Reset state
        this.stocks = [];
        this.currentPage = 1;
        this.hasMoreData = true;
        
        // Load first batch
        await this.loadNextBatch();
        
        // Continue loading until complete
        while (this.hasMoreData) {
            await this.loadNextBatch();
        }
        
        return true;
    }
    
    /**
     * Apply advanced filters
     * @param {Object} filters - Advanced filter criteria
     * @returns {Promise} Promise that resolves with filtered stocks
     */
    async applyAdvancedFilters(filters) {
        if (this.isLoading) return Promise.resolve(this.filteredStocks);
        
        this.isLoading = true;
        this.lastFilters = filters;
        
        try {
            // Build query string
            const queryParams = new URLSearchParams();
            
            // Add filter parameters
            Object.entries(filters).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    queryParams.append(key, value.toString());
                }
            });
            
            // Add pagination
            queryParams.append('page', '1');
            queryParams.append('limit', '100'); // Start with 100 results
            
            // Fetch data
            const url = `${this.advancedApiEndpoint}?${queryParams.toString()}`;
            const response = await fetch(url);
            const data = await response.json();
            
            // Update filtered stocks
            this.filteredStocks = data.stocks;
            
            // Update pagination info
            this.currentPage = data.pagination.page;
            this.totalPages = data.pagination.pages;
            this.totalStocks = data.pagination.total;
            
            console.log(`Applied advanced filters, found ${this.filteredStocks.length} matching stocks`);
            
            this.isLoading = false;
            return this.filteredStocks;
        } catch (error) {
            console.error('Error applying advanced filters:', error);
            this.isLoading = false;
            return this.filteredStocks;
        }
    }
    
    /**
     * Load more filtered results
     * @returns {Promise} Promise that resolves with additional filtered stocks
     */
    async loadMoreFilteredResults() {
        if (this.isLoading || this.currentPage >= this.totalPages) {
            return Promise.resolve(this.filteredStocks);
        }
        
        this.isLoading = true;
        
        try {
            // Build query string
            const queryParams = new URLSearchParams();
            
            // Add filter parameters
            Object.entries(this.lastFilters).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    queryParams.append(key, value.toString());
                }
            });
            
            // Add pagination
            queryParams.append('page', (this.currentPage + 1).toString());
            queryParams.append('limit', '100');
            
            // Fetch data
            const url = `${this.advancedApiEndpoint}?${queryParams.toString()}`;
            const response = await fetch(url);
            const data = await response.json();
            
            // Update filtered stocks
            this.filteredStocks = [...this.filteredStocks, ...data.stocks];
            
            // Update pagination info
            this.currentPage = data.pagination.page;
            
            console.log(`Loaded more filtered results, total: ${this.filteredStocks.length}`);
            
            this.isLoading = false;
            return this.filteredStocks;
        } catch (error) {
            console.error('Error loading more filtered results:', error);
            this.isLoading = false;
            return this.filteredStocks;
        }
    }
    
    /**
     * Get filtered stocks based on criteria
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
            // Search filter
            if (filters.search && !this.matchesSearch(stock, filters.search)) {
                return false;
            }
            
            // Market cap filter
            if (filters.marketCap && !this.matchesMarketCap(stock, filters.marketCap)) {
                return false;
            }
            
            // Volume filter
            if (filters.volume && !this.matchesVolume(stock, filters.volume)) {
                return false;
            }
            
            // Debt filter
            if (filters.debt && !this.matchesDebt(stock, filters.debt)) {
                return false;
            }
            
            // Valuation filter
            if (filters.valuation && !this.matchesValuation(stock, filters.valuation)) {
                return false;
            }
            
            // Preset filter
            if (filters.preset && !this.matchesPreset(stock, filters.preset)) {
                return false;
            }
            
            return true;
        });
    }
    
    /**
     * Check if stock matches search query
     * @param {Object} stock - Stock data
     * @param {String} query - Search query
     * @returns {Boolean} Whether stock matches search
     */
    matchesSearch(stock, query) {
        const searchTerms = query.toLowerCase().split(' ');
        const symbol = (stock.ticker || stock.symbol || '').toLowerCase();
        const name = (stock.name || '').toLowerCase();
        
        return searchTerms.every(term => {
            return symbol.includes(term) || name.includes(term);
        });
    }
    
    /**
     * Check if stock matches market cap filter
     * @param {Object} stock - Stock data
     * @param {Array} marketCapFilters - Market cap filter values
     * @returns {Boolean} Whether stock matches market cap filter
     */
    matchesMarketCap(stock, marketCapFilters) {
        const marketCap = stock.market_cap || stock.marketCap || 0;
        
        return marketCapFilters.some(filter => {
            switch (filter) {
                case 'large':
                    return marketCap >= 10000000000; // $10B+
                case 'mid':
                    return marketCap >= 2000000000 && marketCap < 10000000000; // $2B-$10B
                case 'small':
                    return marketCap >= 300000000 && marketCap < 2000000000; // $300M-$2B
                case 'micro':
                    return marketCap < 300000000; // <$300M
                default:
                    return false;
            }
        });
    }
    
    /**
     * Check if stock matches volume filter
     * @param {Object} stock - Stock data
     * @param {Array} volumeFilters - Volume filter values
     * @returns {Boolean} Whether stock matches volume filter
     */
    matchesVolume(stock, volumeFilters) {
        const volume = stock.avg_volume || stock.volume || 0;
        const price = stock.price || (stock.last_trade && stock.last_trade.p) || 0;
        const dollarVolume = volume * price;
        
        return volumeFilters.some(filter => {
            switch (filter) {
                case 'high':
                    return dollarVolume >= 5000000; // $5M+
                case 'medium':
                    return dollarVolume >= 1000000 && dollarVolume < 5000000; // $1M-$5M
                case 'low':
                    return dollarVolume < 1000000; // <$1M
                default:
                    return false;
            }
        });
    }
    
    /**
     * Check if stock matches debt filter
     * @param {Object} stock - Stock data
     * @param {Array} debtFilters - Debt filter values
     * @returns {Boolean} Whether stock matches debt filter
     */
    matchesDebt(stock, debtFilters) {
        const debtToEbitda = stock.financials?.debt_to_ebitda || 0;
        
        return debtFilters.some(filter => {
            switch (filter) {
                case 'low':
                    return debtToEbitda < 1;
                case 'moderate':
                    return debtToEbitda >= 1 && debtToEbitda <= 2;
                case 'high':
                    return debtToEbitda > 2;
                default:
                    return false;
            }
        });
    }
    
    /**
     * Check if stock matches valuation filter
     * @param {Object} stock - Stock data
     * @param {Array} valuationFilters - Valuation filter values
     * @returns {Boolean} Whether stock matches valuation filter
     */
    matchesValuation(stock, valuationFilters) {
        const pe = stock.pe_ratio || stock.peRatio || 0;
        
        return valuationFilters.some(filter => {
            switch (filter) {
                case 'undervalued':
                    return pe > 0 && pe < 15;
                case 'fair':
                    return pe >= 15 && pe <= 25;
                case 'overvalued':
                    return pe > 25;
                default:
                    return false;
            }
        });
    }
    
    /**
     * Check if stock matches preset filter
     * @param {Object} stock - Stock data
     * @param {String} preset - Preset filter value
     * @returns {Boolean} Whether stock matches preset filter
     */
    matchesPreset(stock, preset) {
        switch (preset) {
            case 'value':
                // Low P/E, Low Debt
                const pe = stock.pe_ratio || stock.peRatio || 0;
                const debtToEbitda = stock.financials?.debt_to_ebitda || 0;
                return pe > 0 && pe < 15 && debtToEbitda < 1;
                
            case 'growth':
                // High Revenue Growth, High ROTCE
                const revenueGrowth = stock.financials?.revenue_growth || 0;
                const rotce = stock.financials?.rotce || 0;
                return revenueGrowth > 15 && rotce > 15;
                
            case 'dividend':
                // Dividend Yield > 2%
                const dividendYield = stock.dividend_yield || stock.dividendYield || 0;
                return dividendYield > 0.02;
                
            case 'quality':
                // High ROTCE, Low Debt
                const qualityRotce = stock.financials?.rotce || 0;
                const qualityDebtToEbitda = stock.financials?.debt_to_ebitda || 0;
                return qualityRotce > 15 && qualityDebtToEbitda < 1;
                
            default:
                return false;
        }
    }
    
    /**
     * Get all stocks
     * @returns {Array} All loaded stocks
     */
    getAllStocks() {
        return this.stocks;
    }
    
    /**
     * Get loading status
     * @returns {Object} Loading status
     */
    getLoadingStatus() {
        return {
            isLoading: this.isLoading,
            hasMoreData: this.hasMoreData,
            currentPage: this.currentPage,
            totalPages: this.totalPages,
            loadedCount: this.stocks.length,
            totalCount: this.totalStocks
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EnhancedDataManager;
}
