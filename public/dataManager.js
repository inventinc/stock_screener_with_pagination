/**
 * DataManager - Handles progressive loading and caching of stock data
 * Designed to efficiently manage 5,700+ stocks for the Stock Screener application
 */
class DataManager {
  constructor(options = {}) {
    // Configuration
    this.apiEndpoint = options.apiEndpoint || '/api/stocks';
    this.batchSize = options.batchSize || 500;
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 2000;
    this.useCache = options.useCache !== false;
    this.progressCallback = options.progressCallback;
    this.completeCallback = options.completeCallback;
    
    // State
    this.allStocks = [];
    this.isLoading = false;
    this.loadedCount = 0;
    this.totalCount = 0;
    this.currentOffset = 0;
    this.retryCount = 0;
    this.abortController = null;
    
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
      }
    };
    
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
      const request = indexedDB.open('StockScreenerCache', 1);
      
      // Handle database upgrade/creation
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Create object store for stocks if it doesn't exist
        if (!db.objectStoreNames.contains('stocks')) {
          const store = db.createObjectStore('stocks', { keyPath: 'ticker' });
          store.createIndex('exchange', 'exchange', { unique: false });
          store.createIndex('marketCap', 'market_cap', { unique: false });
        }
        
        // Create object store for metadata
        if (!db.objectStoreNames.contains('metadata')) {
          db.createObjectStore('metadata', { keyPath: 'key' });
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
      // Check metadata for last update time
      const metadataTransaction = this.db.transaction(['metadata'], 'readonly');
      const metadataStore = metadataTransaction.objectStore('metadata');
      const lastUpdateRequest = metadataStore.get('lastUpdate');
      
      lastUpdateRequest.onsuccess = (event) => {
        const lastUpdate = event.target.result;
        
        // If data is less than 24 hours old, use it
        if (lastUpdate && (Date.now() - lastUpdate.timestamp < 24 * 60 * 60 * 1000)) {
          console.log('Loading stocks from cache');
          
          // Get all stocks from cache
          const stocksTransaction = this.db.transaction(['stocks'], 'readonly');
          const stocksStore = stocksTransaction.objectStore('stocks');
          const getAllRequest = stocksStore.getAll();
          
          getAllRequest.onsuccess = (event) => {
            const cachedStocks = event.target.result;
            
            if (cachedStocks && cachedStocks.length > 0) {
              this.allStocks = cachedStocks;
              this.loadedCount = cachedStocks.length;
              this.totalCount = cachedStocks.length;
              
              // Build indices
              this._buildIndices();
              
              // Notify about cached data
              if (this.progressCallback) {
                this.progressCallback(this.loadedCount, this.totalCount, true);
              }
              
              if (this.completeCallback) {
                this.completeCallback(this.allStocks);
              }
              
              console.log(`Loaded ${cachedStocks.length} stocks from cache`);
              
              // Still fetch fresh data in the background
              this.loadAllStocks(true);
            } else {
              // No cached data, load from API
              this.loadAllStocks();
            }
          };
          
          getAllRequest.onerror = (event) => {
            console.error('Error loading from cache:', event.target.error);
            this.loadAllStocks();
          };
        } else {
          // Cache is too old or doesn't exist, load from API
          this.loadAllStocks();
        }
      };
      
      lastUpdateRequest.onerror = (event) => {
        console.error('Error checking cache metadata:', event.target.error);
        this.loadAllStocks();
      };
    } catch (error) {
      console.error('Error loading from cache:', error);
      this.loadAllStocks();
    }
  }
  
  /**
   * Save stocks to cache
   * @private
   */
  async _saveToCache() {
    if (!this.db || !this.useCache || this.allStocks.length === 0) return;
    
    try {
      // Start transaction for both stores
      const transaction = this.db.transaction(['stocks', 'metadata'], 'readwrite');
      
      // Clear existing stocks
      const stocksStore = transaction.objectStore('stocks');
      stocksStore.clear();
      
      // Add all stocks to cache
      this.allStocks.forEach(stock => {
        stocksStore.add(stock);
      });
      
      // Update metadata with timestamp
      const metadataStore = transaction.objectStore('metadata');
      metadataStore.put({
        key: 'lastUpdate',
        timestamp: Date.now(),
        count: this.allStocks.length
      });
      
      transaction.oncomplete = () => {
        console.log(`Saved ${this.allStocks.length} stocks to cache`);
      };
      
      transaction.onerror = (event) => {
        console.error('Error saving to cache:', event.target.error);
      };
    } catch (error) {
      console.error('Error saving to cache:', error);
    }
  }
  
  /**
   * Build indices for fast filtering
   * @private
   */
  _buildIndices() {
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
      }
    };
    
    // Build indices
    this.allStocks.forEach((stock, index) => {
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
      } else {
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
  }
  
  /**
   * Load all stocks from the API in batches
   * @param {Boolean} background - Whether to load in the background (don't clear existing data)
   */
  async loadAllStocks(background = false) {
    if (this.isLoading) {
      console.warn('Already loading stocks');
      return;
    }
    
    this.isLoading = true;
    
    if (!background) {
      // Reset state for fresh load
      this.allStocks = [];
      this.loadedCount = 0;
      this.currentOffset = 0;
      this.retryCount = 0;
    } else {
      // For background refresh, start from beginning but keep existing data
      this.currentOffset = 0;
    }
    
    // Create abort controller for cancellation
    this.abortController = new AbortController();
    
    try {
      // First, get the total count
      await this._fetchTotalCount();
      
      // Then load batches until complete
      await this._loadNextBatch(background);
    } catch (error) {
      console.error('Error loading stocks:', error);
      this.isLoading = false;
      
      // Retry if appropriate
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        console.log(`Retrying (${this.retryCount}/${this.maxRetries})...`);
        
        setTimeout(() => {
          this.loadAllStocks(background);
        }, this.retryDelay);
      }
    }
  }
  
  /**
   * Fetch the total count of stocks
   * @private
   */
  async _fetchTotalCount() {
    try {
      const response = await fetch(`${this.apiEndpoint}/count`, {
        signal: this.abortController.signal
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      this.totalCount = data.count || 5700; // Default to 5700 if not provided
      
      console.log(`Total stocks to load: ${this.totalCount}`);
      
      // Update progress
      if (this.progressCallback) {
        this.progressCallback(this.loadedCount, this.totalCount);
      }
    } catch (error) {
      console.error('Error fetching total count:', error);
      // Use a default if we can't get the count
      this.totalCount = 5700;
    }
  }
  
  /**
   * Load the next batch of stocks
   * @param {Boolean} background - Whether this is a background refresh
   * @private
   */
  async _loadNextBatch(background) {
    if (!this.isLoading || this.currentOffset >= this.totalCount) {
      // All done
      this.isLoading = false;
      
      // Build indices for fast filtering
      this._buildIndices();
      
      // Save to cache
      this._saveToCache();
      
      // Notify completion
      if (this.completeCallback) {
        this.completeCallback(this.allStocks);
      }
      
      return;
    }
    
    try {
      const url = `${this.apiEndpoint}?limit=${this.batchSize}&offset=${this.currentOffset}`;
      const response = await fetch(url, {
        signal: this.abortController.signal
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      const newStocks = data.stocks || [];
      
      if (newStocks.length === 0) {
        // No more stocks to load
        this.isLoading = false;
        
        // Build indices for fast filtering
        this._buildIndices();
        
        // Save to cache
        this._saveToCache();
        
        // Notify completion
        if (this.completeCallback) {
          this.completeCallback(this.allStocks);
        }
        
        return;
      }
      
      // For background refresh, replace stocks with same ticker
      if (background) {
        const tickerMap = {};
        this.allStocks.forEach((stock, index) => {
          tickerMap[stock.ticker || stock.symbol] = index;
        });
        
        newStocks.forEach(stock => {
          const ticker = stock.ticker || stock.symbol;
          if (tickerMap[ticker] !== undefined) {
            // Replace existing stock
            this.allStocks[tickerMap[ticker]] = stock;
          } else {
            // Add new stock
            this.allStocks.push(stock);
          }
        });
      } else {
        // For initial load, just append
        this.allStocks = [...this.allStocks, ...newStocks];
      }
      
      // Update counts
      this.loadedCount = this.allStocks.length;
      this.currentOffset += this.batchSize;
      
      // Update progress
      if (this.progressCallback) {
        this.progressCallback(this.loadedCount, this.totalCount);
      }
      
      // Load next batch
      setTimeout(() => {
        this._loadNextBatch(background);
      }, 100); // Small delay to prevent overwhelming the server
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Stock loading aborted');
        this.isLoading = false;
        return;
      }
      
      console.error('Error loading batch:', error);
      
      // Retry if appropriate
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        console.log(`Retrying batch (${this.retryCount}/${this.maxRetries})...`);
        
        setTimeout(() => {
          this._loadNextBatch(background);
        }, this.retryDelay);
      } else {
        this.isLoading = false;
        throw error;
      }
    }
  }
  
  /**
   * Cancel ongoing loading
   */
  cancelLoading() {
    if (this.isLoading && this.abortController) {
      this.abortController.abort();
      this.isLoading = false;
    }
  }
  
  /**
   * Get all loaded stocks
   * @returns {Array} All loaded stocks
   */
  getAllStocks() {
    return this.allStocks;
  }
  
  /**
   * Get stocks filtered by criteria
   * @param {Object} filters - Filter criteria
   * @returns {Array} Filtered stocks
   */
  getFilteredStocks(filters) {
    // Start with all stocks
    let result = [...this.allStocks];
    
    // Use indices for faster filtering when possible
    if (filters) {
      // Filter by exchange
      if (filters.exchange) {
        const exchangeIndices = this.indices.byExchange[filters.exchange.toUpperCase()] || [];
        result = exchangeIndices.map(index => this.allStocks[index]);
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
          result = result.filter((_, index) => marketCapIndices.includes(index));
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
          result = result.filter((_, index) => volumeIndices.includes(index));
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
          const debtRatio = stock.debt_to_ebitda || 0;
          
          return filters.debt.some(filter => {
            if (filter === 'low') return debtRatio < 1;
            if (filter === 'moderate') return debtRatio >= 1 && debtRatio < 2;
            if (filter === 'high') return debtRatio >= 2 && debtRatio < 3;
            return false;
          });
        });
      }
      
      if (filters.valuation && filters.valuation.length > 0) {
        result = result.filter(stock => {
          const pe = stock.pe_ratio || 0;
          
          return filters.valuation.some(filter => {
            if (filter === 'cheap') return pe > 0 && pe < 15;
            if (filter === 'fair') return pe >= 15 && pe <= 25;
            if (filter === 'premium') return pe > 25;
            return false;
          });
        });
      }
    }
    
    return result;
  }
  
  /**
   * Get loading status
   * @returns {Object} Loading status
   */
  getStatus() {
    return {
      isLoading: this.isLoading,
      loadedCount: this.loadedCount,
      totalCount: this.totalCount,
      progress: this.totalCount > 0 ? (this.loadedCount / this.totalCount) : 0
    };
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DataManager };
}
