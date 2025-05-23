/**
 * IncrementalDataManager - Optimized for handling 5,700+ stocks with smaller batch sizes
 * Implements efficient incremental loading, caching, and memory management
 */
class IncrementalDataManager {
  constructor(options = {}) {
    // Configuration
    this.apiEndpoint = options.apiEndpoint || '/api/stocks';
    this.batchSize = options.batchSize || 50; // Reduced batch size for better user experience
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1500;
    this.useCache = options.useCache !== false;
    this.progressCallback = options.progressCallback;
    this.completeCallback = options.completeCallback;
    this.batchLoadedCallback = options.batchLoadedCallback; // New callback for when a batch is loaded
    this.excludeETFs = options.excludeETFs !== false; // Default to excluding ETFs
    this.maxConcurrentRequests = options.maxConcurrentRequests || 1; // Reduced to prevent overwhelming
    this.autoLoadThreshold = options.autoLoadThreshold || 0.8; // When to trigger next batch load
    this.manualLoadMode = options.manualLoadMode || false; // Whether to use manual loading mode
    
    // State
    this.allStocks = [];
    this.isLoading = false;
    this.loadedCount = 0;
    this.totalCount = 0;
    this.currentOffset = 0;
    this.retryCount = 0;
    this.abortController = null;
    this.pendingRequests = 0;
    this.requestQueue = [];
    this.lastProgressUpdate = 0;
    this.cacheVersion = '1.1.0'; // Updated for new incremental loading
    this.hasMoreData = true; // Whether there's more data to load
    this.lastFilterCriteria = null; // Last used filter criteria
    
    // Indices for fast filtering
    this.indices = {
      byExchange: {},
      byMarketCap: {
        large: [], // $10B+
        mid: [],   // $2-10B
        small: [], // $300M-2B
        micro: []  // < $300M
      },
      byVolume: {
        high: [],   // $5M+
        medium: [], // $1-5M
        low: []     // $500K-1M
      },
      bySymbol: {} // For fast symbol lookup
    };
    
    // Performance monitoring
    this.requestTimes = [];
    this.processingTimes = [];
    this.memoryUsage = [];
    
    // Initialize cache if enabled
    if (this.useCache) {
      this._initializeCache();
    }
  }
  
  /**
   * Initialize the cache system
   * @private
   */
  async _initializeCache() {
    try {
      // Check if browser supports IndexedDB
      if (!window.indexedDB) {
        console.warn('IndexedDB not supported, caching disabled');
        this.useCache = false;
        return;
      }
      
      // Open/create the database
      const request = indexedDB.open('StockScreenerCache', 3); // Version 3 for incremental loading
      
      // Handle database upgrade/creation
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Create object store for stocks if it doesn't exist
        if (!db.objectStoreNames.contains('stocks')) {
          const store = db.createObjectStore('stocks', { keyPath: 'ticker' });
          store.createIndex('exchange', 'exchange', { unique: false });
          store.createIndex('marketCap', 'market_cap', { unique: false });
          store.createIndex('type', 'type', { unique: false }); // For filtering ETFs
        }
        
        // Create object store for metadata
        if (!db.objectStoreNames.contains('metadata')) {
          db.createObjectStore('metadata', { keyPath: 'key' });
        }
        
        // Create object store for batches
        if (!db.objectStoreNames.contains('batches')) {
          db.createObjectStore('batches', { keyPath: 'offset' });
        }
      };
      
      // Store database reference when successfully opened
      request.onsuccess = (event) => {
        this.db = event.target.result;
        console.log('Cache initialized successfully');
        
        // Check for cached data
        this._loadFromCache();
      };
      
      request.onerror = (event) => {
        console.error('Error opening cache database:', event.target.error);
        this.useCache = false;
      };
    } catch (error) {
      console.error('Error initializing cache:', error);
      this.useCache = false;
    }
  }
  
  /**
   * Load stocks from cache if available
   * @private
   */
  async _loadFromCache() {
    if (!this.db) return;
    
    try {
      // Check metadata for last update time and version
      const metadataTransaction = this.db.transaction(['metadata'], 'readonly');
      const metadataStore = metadataTransaction.objectStore('metadata');
      const lastUpdateRequest = metadataStore.get('lastUpdate');
      const versionRequest = metadataStore.get('version');
      
      // Process metadata results
      Promise.all([
        new Promise(resolve => {
          lastUpdateRequest.onsuccess = (event) => resolve(event.target.result);
          lastUpdateRequest.onerror = () => resolve(null);
        }),
        new Promise(resolve => {
          versionRequest.onsuccess = (event) => resolve(event.target.result);
          versionRequest.onerror = () => resolve(null);
        })
      ]).then(([lastUpdate, version]) => {
        // Check if cache is valid (not too old and correct version)
        const isCacheValid = lastUpdate && 
                            (Date.now() - lastUpdate.timestamp < 24 * 60 * 60 * 1000) &&
                            version && 
                            version.value === this.cacheVersion;
        
        if (isCacheValid) {
          console.log('Loading first batch from cache');
          
          // Get first batch from cache
          const batchTransaction = this.db.transaction(['batches'], 'readonly');
          const batchStore = batchTransaction.objectStore('batches');
          const firstBatchRequest = batchStore.get(0); // Get first batch (offset 0)
          
          firstBatchRequest.onsuccess = (event) => {
            const firstBatch = event.target.result;
            
            if (firstBatch && firstBatch.stocks && firstBatch.stocks.length > 0) {
              // Filter out ETFs if needed
              const stocks = this.excludeETFs 
                ? firstBatch.stocks.filter(stock => stock.type !== 'ETF')
                : firstBatch.stocks;
              
              this.allStocks = stocks;
              this.loadedCount = stocks.length;
              this.currentOffset = stocks.length;
              
              // Get total count from metadata
              const totalCountRequest = metadataStore.get('totalCount');
              totalCountRequest.onsuccess = (event) => {
                const totalCountData = event.target.result;
                if (totalCountData) {
                  this.totalCount = totalCountData.value;
                  this.hasMoreData = this.loadedCount < this.totalCount;
                }
                
                // Build indices
                this._buildIndices();
                
                // Notify about cached data
                if (this.progressCallback) {
                  this.progressCallback(this.loadedCount, this.totalCount, true);
                }
                
                if (this.batchLoadedCallback) {
                  this.batchLoadedCallback(this.allStocks, true);
                }
                
                console.log(`Loaded ${stocks.length} stocks from cache (batch 1)`);
                
                // Still fetch fresh data in the background after a delay
                setTimeout(() => {
                  this._fetchTotalCount();
                }, 2000);
              };
            } else {
              // No cached data, load from API
              this.loadNextBatch();
            }
          };
          
          firstBatchRequest.onerror = (event) => {
            console.error('Error loading from cache:', event.target.error);
            this.loadNextBatch();
          };
        } else {
          // Cache is too old or wrong version, load from API
          this.loadNextBatch();
        }
      });
    } catch (error) {
      console.error('Error loading from cache:', error);
      this.loadNextBatch();
    }
  }
  
  /**
   * Save batch to cache
   * @param {Array} stocks - Stocks in this batch
   * @param {Number} offset - Offset of this batch
   * @private
   */
  async _saveBatchToCache(stocks, offset) {
    if (!this.db || !this.useCache || !stocks || stocks.length === 0) return;
    
    try {
      // Start transaction for batches store
      const transaction = this.db.transaction(['batches', 'metadata'], 'readwrite');
      
      // Save batch
      const batchStore = transaction.objectStore('batches');
      batchStore.put({
        offset: offset,
        stocks: stocks,
        timestamp: Date.now()
      });
      
      // Update metadata
      const metadataStore = transaction.objectStore('metadata');
      metadataStore.put({
        key: 'lastUpdate',
        timestamp: Date.now(),
        count: this.loadedCount
      });
      
      metadataStore.put({
        key: 'version',
        value: this.cacheVersion
      });
      
      metadataStore.put({
        key: 'totalCount',
        value: this.totalCount
      });
      
      transaction.oncomplete = () => {
        console.log(`Saved batch at offset ${offset} to cache (${stocks.length} stocks)`);
      };
      
      transaction.onerror = (event) => {
        console.error('Error saving batch to cache:', event.target.error);
      };
    } catch (error) {
      console.error('Error saving batch to cache:', error);
    }
  }
  
  /**
   * Build indices for fast filtering
   * @private
   */
  _buildIndices() {
    console.log('Building indices for fast filtering');
    const startTime = performance.now();
    
    // Reset indices
    this.indices = {
      byExchange: {},
      byMarketCap: {
        large: [],
        mid: [],
        small: [],
        micro: []
      },
      byVolume: {
        high: [],
        medium: [],
        low: []
      },
      bySymbol: {}
    };
    
    // Build indices
    this.allStocks.forEach((stock, index) => {
      // By symbol for fast lookup
      const symbol = (stock.ticker || stock.symbol || '').toUpperCase();
      this.indices.bySymbol[symbol] = index;
      
      // By exchange
      const exchange = (stock.primary_exchange || stock.exchange || '').toUpperCase();
      if (!this.indices.byExchange[exchange]) {
        this.indices.byExchange[exchange] = [];
      }
      this.indices.byExchange[exchange].push(index);
      
      // By market cap
      const marketCap = stock.market_cap || stock.marketCap || 0;
      if (marketCap >= 10e9) {
        this.indices.byMarketCap.large.push(index);
      } else if (marketCap >= 2e9) {
        this.indices.byMarketCap.mid.push(index);
      } else if (marketCap >= 300e6) {
        this.indices.byMarketCap.small.push(index);
      } else if (marketCap > 0) {
        this.indices.byMarketCap.micro.push(index);
      }
      
      // By volume
      const volume = stock.volume || 0;
      if (volume >= 5e6) {
        this.indices.byVolume.high.push(index);
      } else if (volume >= 1e6) {
        this.indices.byVolume.medium.push(index);
      } else if (volume >= 5e5) {
        this.indices.byVolume.low.push(index);
      }
    });
    
    const endTime = performance.now();
    console.log(`Indices built in ${(endTime - startTime).toFixed(2)}ms`);
  }
  
  /**
   * Process the next request in the queue
   * @private
   */
  _processNextRequest() {
    if (this.requestQueue.length === 0 || this.pendingRequests >= this.maxConcurrentRequests) {
      return;
    }
    
    const request = this.requestQueue.shift();
    this.pendingRequests++;
    
    request().finally(() => {
      this.pendingRequests--;
      this._processNextRequest();
    });
  }
  
  /**
   * Add a request to the queue
   * @param {Function} requestFn - Function that returns a promise
   * @private
   */
  _queueRequest(requestFn) {
    this.requestQueue.push(requestFn);
    this._processNextRequest();
  }
  
  /**
   * Fetch the total count of stocks
   * @private
   */
  async _fetchTotalCount() {
    try {
      const response = await fetch(`${this.apiEndpoint}/count${this.excludeETFs ? '?excludeETFs=true' : ''}`, {
        signal: this.abortController ? this.abortController.signal : null
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      this.totalCount = data.count || 5700; // Default to 5700 if not provided
      this.hasMoreData = this.loadedCount < this.totalCount;
      
      console.log(`Total stocks to load: ${this.totalCount}`);
      
      // Update progress
      if (this.progressCallback) {
        this.progressCallback(this.loadedCount, this.totalCount);
      }
    } catch (error) {
      console.error('Error fetching total count:', error);
      // Use a default if we can't get the count
      this.totalCount = 5700;
      this.hasMoreData = this.loadedCount < this.totalCount;
    }
  }
  
  /**
   * Load the next batch of stocks
   * @param {Object} filterCriteria - Optional filter criteria to apply
   * @returns {Promise} Promise that resolves when batch is loaded
   */
  async loadNextBatch(filterCriteria = null) {
    if (this.isLoading || !this.hasMoreData) {
      console.log(this.isLoading ? 'Already loading stocks' : 'No more data to load');
      return Promise.resolve(false);
    }
    
    this.isLoading = true;
    
    // Create abort controller for cancellation if needed
    if (!this.abortController) {
      this.abortController = new AbortController();
    }
    
    // Store filter criteria if provided
    if (filterCriteria) {
      this.lastFilterCriteria = filterCriteria;
    }
    
    try {
      // If we don't have a total count yet, fetch it
      if (this.totalCount === 0) {
        await this._fetchTotalCount();
      }
      
      const startTime = performance.now();
      
      // Build URL with parameters
      let url = `${this.apiEndpoint}?limit=${this.batchSize}&offset=${this.currentOffset}`;
      
      // Add ETF exclusion if needed
      if (this.excludeETFs) {
        url += '&excludeETFs=true';
      }
      
      // Add filter criteria if available
      if (this.lastFilterCriteria) {
        Object.entries(this.lastFilterCriteria).forEach(([key, value]) => {
          if (Array.isArray(value)) {
            value.forEach(v => {
              url += `&${key}=${encodeURIComponent(v)}`;
            });
          } else if (value !== null && value !== undefined) {
            url += `&${key}=${encodeURIComponent(value)}`;
          }
        });
      }
      
      const response = await fetch(url, {
        signal: this.abortController.signal
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      const newStocks = data.stocks || [];
      
      const requestTime = performance.now() - startTime;
      this.requestTimes.push(requestTime);
      
      if (this.requestTimes.length > 10) this.requestTimes.shift();
      
      if (newStocks.length === 0) {
        this.hasMoreData = false;
        this.isLoading = false;
        
        // Notify completion
        if (this.completeCallback) {
          this.completeCallback(this.allStocks);
        }
        
        return Promise.resolve(false);
      }
      
      const processStart = performance.now();
      
      // Append new stocks
      this.allStocks = [...this.allStocks, ...newStocks];
      
      // Update counts
      this.loadedCount = this.allStocks.length;
      this.currentOffset += newStocks.length;
      
      // Check if we have more data
      this.hasMoreData = newStocks.length === this.batchSize && this.loadedCount < this.totalCount;
      
      // Save batch to cache
      this._saveBatchToCache(newStocks, this.currentOffset - newStocks.length);
      
      // Rebuild indices
      this._buildIndices();
      
      const processTime = performance.now() - processStart;
      this.processingTimes.push(processTime);
      
      if (this.processingTimes.length > 10) this.processingTimes.shift();
      
      // Update progress
      if (this.progressCallback) {
        this.progressCallback(this.loadedCount, this.totalCount);
      }
      
      // Notify batch loaded
      if (this.batchLoadedCallback) {
        this.batchLoadedCallback(this.allStocks, false);
      }
      
      // Log performance
      console.log(`Batch loaded: ${newStocks.length} stocks, ${requestTime.toFixed(2)}ms request, ${processTime.toFixed(2)}ms processing`);
      console.log(`Total loaded: ${this.loadedCount}/${this.totalCount} stocks, hasMoreData: ${this.hasMoreData}`);
      
      // Track memory usage if available
      if (window.performance && window.performance.memory) {
        const memory = window.performance.memory;
        this.memoryUsage.push({
          usedJSHeapSize: memory.usedJSHeapSize,
          totalJSHeapSize: memory.totalJSHeapSize,
          timestamp: Date.now()
        });
        
        if (this.memoryUsage.length > 10) this.memoryUsage.shift();
        
        console.log(`Memory usage: ${Math.round(memory.usedJSHeapSize / (1024 * 1024))}MB / ${Math.round(memory.totalJSHeapSize / (1024 * 1024))}MB`);
      }
      
      this.isLoading = false;
      return Promise.resolve(true);
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Stock loading aborted');
        this.isLoading = false;
        return Promise.resolve(false);
      }
      
      console.error('Error loading batch:', error);
      this.isLoading = false;
      
      // Retry if appropriate
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        
        console.log(`Retrying batch (${this.retryCount}/${this.maxRetries})...`);
        
        return new Promise((resolve) => {
          setTimeout(() => {
            this.loadNextBatch().then(resolve);
          }, this.retryDelay * Math.pow(2, this.retryCount - 1));
        });
      }
      
      return Promise.resolve(false);
    }
  }
  
  /**
   * Check if we should load more data based on scroll position
   * @param {Number} scrollPosition - Current scroll position
   * @param {Number} viewportHeight - Viewport height
   * @param {Number} totalHeight - Total scrollable height
   * @returns {Boolean} Whether more data should be loaded
   */
  shouldLoadMoreData(scrollPosition, viewportHeight, totalHeight) {
    if (this.manualLoadMode || this.isLoading || !this.hasMoreData) {
      return false;
    }
    
    const scrollPercentage = (scrollPosition + viewportHeight) / totalHeight;
    return scrollPercentage > this.autoLoadThreshold;
  }
  
  /**
   * Cancel ongoing loading
   */
  cancelLoading() {
    if (this.isLoading && this.abortController) {
      this.abortController.abort();
      this.abortController = new AbortController();
      this.isLoading = false;
      this.requestQueue = [];
    }
  }
  
  /**
   * Reset and start fresh
   */
  reset() {
    this.cancelLoading();
    this.allStocks = [];
    this.loadedCount = 0;
    this.currentOffset = 0;
    this.retryCount = 0;
    this.hasMoreData = true;
    this.lastFilterCriteria = null;
    
    // Rebuild indices
    this._buildIndices();
    
    // Load first batch
    return this.loadNextBatch();
  }
  
  /**
   * Get all loaded stocks
   * @returns {Array} All loaded stocks
   */
  getAllStocks() {
    return this.allStocks;
  }
  
  /**
   * Get stock by symbol
   * @param {String} symbol - Stock symbol
   * @returns {Object|null} Stock object or null if not found
   */
  getStockBySymbol(symbol) {
    if (!symbol) return null;
    
    const upperSymbol = symbol.toUpperCase();
    const index = this.indices.bySymbol[upperSymbol];
    
    if (index !== undefined) {
      return this.allStocks[index];
    }
    
    // Fallback to linear search if not in index
    return this.allStocks.find(stock => 
      (stock.ticker || stock.symbol || '').toUpperCase() === upperSymbol
    ) || null;
  }
  
  /**
   * Get stocks filtered by criteria
   * @param {Object} filters - Filter criteria
   * @returns {Array} Filtered stocks
   */
  getFilteredStocks(filters) {
    console.log('Filtering stocks with criteria:', filters);
    const startTime = performance.now();
    
    // Start with all stocks
    let result = [...this.allStocks];
    
    // Use indices for faster filtering when possible
    if (filters) {
      // Filter by exchange
      if (filters.exchange) {
        const exchangeIndices = [];
        
        // Handle multiple exchanges
        if (Array.isArray(filters.exchange)) {
          filters.exchange.forEach(exchange => {
            const indices = this._getExchangeIndices(exchange);
            exchangeIndices.push(...indices);
          });
        } else {
          const indices = this._getExchangeIndices(filters.exchange);
          exchangeIndices.push(...indices);
        }
        
        if (exchangeIndices.length > 0) {
          // Use Set for faster lookups
          const indexSet = new Set(exchangeIndices);
          result = result.filter((_, index) => indexSet.has(index));
        }
      }
      
      // Filter by market cap
      if (filters.marketCap && filters.marketCap.length > 0) {
        const marketCapIndices = [];
        filters.marketCap.forEach(cap => {
          if (this.indices.byMarketCap[cap]) {
            marketCapIndices.push(...this.indices.byMarketCap[cap]);
          }
        });
        
        if (marketCapIndices.length > 0) {
          // Use Set for faster lookups
          const indexSet = new Set(marketCapIndices);
          result = result.filter((_, index) => indexSet.has(index));
        }
      }
      
      // Filter by volume
      if (filters.volume && filters.volume.length > 0) {
        const volumeIndices = [];
        filters.volume.forEach(vol => {
          if (this.indices.byVolume[vol]) {
            volumeIndices.push(...this.indices.byVolume[vol]);
          }
        });
        
        if (volumeIndices.length > 0) {
          // Use Set for faster lookups
          const indexSet = new Set(volumeIndices);
          result = result.filter((_, index) => indexSet.has(index));
        }
      }
      
      // Apply other filters that don't have indices
      if (filters.search) {
        const searchTerm = filters.search.toLowerCase();
        result = result.filter(stock => 
          (stock.ticker || stock.symbol || '').toLowerCase().includes(searchTerm) || 
          (stock.name || '').toLowerCase().includes(searchTerm)
        );
      }
      
      if (filters.debt && filters.debt.length > 0) {
        result = result.filter(stock => {
          const debtRatio = stock.debt_to_ebitda || stock.netDebtToEBITDA || 0;
          
          return filters.debt.some(filter => {
            if (filter === 'low') return debtRatio < 1;
            if (filter === 'moderate') return debtRatio >= 1 && debtRatio < 2;
            if (filter === 'high') return debtRatio >= 2;
            return false;
          });
        });
      }
      
      if (filters.valuation && filters.valuation.length > 0) {
        result = result.filter(stock => {
          const pe = stock.pe_ratio || stock.peRatio || 0;
          
          return filters.valuation.some(filter => {
            if (filter === 'undervalued') return pe > 0 && pe < 15;
            if (filter === 'fair') return pe >= 15 && pe < 25;
            if (filter === 'overvalued') return pe >= 25;
            return false;
          });
        });
      }
      
      // Apply preset filters
      if (filters.preset) {
        switch(filters.preset) {
          case 'value':
            result = result.filter(stock => {
              const pe = stock.pe_ratio || stock.peRatio || 0;
              const debt = stock.debt_to_ebitda || stock.netDebtToEBITDA || 0;
              return pe > 0 && pe < 15 && debt < 3;
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
              const dividend = stock.dividend_yield || stock.dividendYield || 0;
              return dividend > 0.02; // > 2%
            });
            break;
          case 'quality':
            result = result.filter(stock => {
              const rotce = stock.rotce || stock.returnOnTangibleCapital || 0;
              const debt = stock.debt_to_ebitda || stock.netDebtToEBITDA || 0;
              return rotce > 0.15 && debt < 2; // > 15% ROTCE and low debt
            });
            break;
        }
      }
    }
    
    const endTime = performance.now();
    console.log(`Filtering completed in ${(endTime - startTime).toFixed(2)}ms, returned ${result.length} stocks`);
    
    return result;
  }
  
  /**
   * Get indices for a specific exchange, handling different formats
   * @param {String} exchange - Exchange name
   * @returns {Array} Array of indices
   * @private
   */
  _getExchangeIndices(exchange) {
    const indices = [];
    const upperExchange = exchange.toUpperCase();
    
    // Handle different exchange code formats
    if (upperExchange === 'NYSE') {
      // Check both NYSE and XNYS
      if (this.indices.byExchange['NYSE']) indices.push(...this.indices.byExchange['NYSE']);
      if (this.indices.byExchange['XNYS']) indices.push(...this.indices.byExchange['XNYS']);
    } else if (upperExchange === 'NASDAQ') {
      // Check both NASDAQ and XNAS
      if (this.indices.byExchange['NASDAQ']) indices.push(...this.indices.byExchange['NASDAQ']);
      if (this.indices.byExchange['XNAS']) indices.push(...this.indices.byExchange['XNAS']);
    } else {
      // Direct lookup
      if (this.indices.byExchange[upperExchange]) indices.push(...this.indices.byExchange[upperExchange]);
    }
    
    return indices;
  }
  
  /**
   * Get loading status information
   * @returns {Object} Loading status
   */
  getLoadingStatus() {
    return {
      isLoading: this.isLoading,
      loadedCount: this.loadedCount,
      totalCount: this.totalCount,
      hasMoreData: this.hasMoreData,
      percentLoaded: this.totalCount > 0 ? (this.loadedCount / this.totalCount * 100) : 0,
      manualLoadMode: this.manualLoadMode
    };
  }
  
  /**
   * Get performance metrics
   * @returns {Object} Performance metrics
   */
  getPerformanceMetrics() {
    const avgRequestTime = this.requestTimes.length > 0 
      ? this.requestTimes.reduce((sum, time) => sum + time, 0) / this.requestTimes.length 
      : 0;
      
    const avgProcessTime = this.processingTimes.length > 0
      ? this.processingTimes.reduce((sum, time) => sum + time, 0) / this.processingTimes.length
      : 0;
      
    return {
      loadedStocks: this.loadedCount,
      totalStocks: this.totalCount,
      pendingRequests: this.pendingRequests,
      queuedRequests: this.requestQueue.length,
      averageRequestTime: avgRequestTime,
      averageProcessingTime: avgProcessTime,
      cacheEnabled: this.useCache,
      excludeETFs: this.excludeETFs,
      memoryUsage: this.memoryUsage.length > 0 ? this.memoryUsage[this.memoryUsage.length - 1] : null
    };
  }
  
  /**
   * Toggle manual load mode
   * @param {Boolean} enabled - Whether manual load mode should be enabled
   */
  setManualLoadMode(enabled) {
    this.manualLoadMode = enabled;
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { IncrementalDataManager };
} else {
  // For browser usage
  window.IncrementalDataManager = IncrementalDataManager;
}
