const axios = require('axios');
const NodeCache = require('node-cache');

// Initialize cache with 30 minute TTL default
const cache = new NodeCache({ stdTTL: 1800 });

class FMPService {
  constructor() {
    this.apiKey = process.env.FMP_API_KEY;
    this.baseUrl = process.env.FMP_API_BASE_URL || 'https://financialmodelingprep.com/api/v3';
  }

  /**
   * Get company profile data
   * @param {string} symbol - Stock symbol
   * @returns {Promise} - Company profile data
   */
  async getCompanyProfile(symbol) {
    const cacheKey = `profile_${symbol}`;
    const cachedData = cache.get(cacheKey);
    
    if (cachedData) {
      return cachedData;
    }
    
    try {
      const response = await axios.get(`${this.baseUrl}/profile/${symbol}?apikey=${this.apiKey}`);
      
      if (response.data && response.data.length > 0) {
        cache.set(cacheKey, response.data[0]);
        return response.data[0];
      }
      
      return null;
    } catch (error) {
      console.error(`Error fetching company profile for ${symbol}:`, error.message);
      throw error;
    }
  }

  /**
   * Get company financial ratios
   * @param {string} symbol - Stock symbol
   * @returns {Promise} - Financial ratios data
   */
  async getFinancialRatios(symbol) {
    const cacheKey = `ratios_${symbol}`;
    const cachedData = cache.get(cacheKey);
    
    if (cachedData) {
      return cachedData;
    }
    
    try {
      const response = await axios.get(`${this.baseUrl}/ratios/${symbol}?limit=4&apikey=${this.apiKey}`);
      
      if (response.data && response.data.length > 0) {
        cache.set(cacheKey, response.data);
        return response.data;
      }
      
      return [];
    } catch (error) {
      console.error(`Error fetching financial ratios for ${symbol}:`, error.message);
      throw error;
    }
  }

  /**
   * Get company key metrics
   * @param {string} symbol - Stock symbol
   * @returns {Promise} - Key metrics data
   */
  async getKeyMetrics(symbol) {
    const cacheKey = `metrics_${symbol}`;
    const cachedData = cache.get(cacheKey);
    
    if (cachedData) {
      return cachedData;
    }
    
    try {
      const response = await axios.get(`${this.baseUrl}/key-metrics/${symbol}?limit=4&apikey=${this.apiKey}`);
      
      if (response.data && response.data.length > 0) {
        cache.set(cacheKey, response.data);
        return response.data;
      }
      
      return [];
    } catch (error) {
      console.error(`Error fetching key metrics for ${symbol}:`, error.message);
      throw error;
    }
  }

  /**
   * Get company cash flow statement
   * @param {string} symbol - Stock symbol
   * @returns {Promise} - Cash flow statement data
   */
  async getCashFlowStatement(symbol) {
    const cacheKey = `cashflow_${symbol}`;
    const cachedData = cache.get(cacheKey);
    
    if (cachedData) {
      return cachedData;
    }
    
    try {
      const response = await axios.get(`${this.baseUrl}/cash-flow-statement/${symbol}?limit=4&apikey=${this.apiKey}`);
      
      if (response.data && response.data.length > 0) {
        cache.set(cacheKey, response.data);
        return response.data;
      }
      
      return [];
    } catch (error) {
      console.error(`Error fetching cash flow statement for ${symbol}:`, error.message);
      throw error;
    }
  }

  /**
   * Get company income statement
   * @param {string} symbol - Stock symbol
   * @returns {Promise} - Income statement data
   */
  async getIncomeStatement(symbol) {
    const cacheKey = `income_${symbol}`;
    const cachedData = cache.get(cacheKey);
    
    if (cachedData) {
      return cachedData;
    }
    
    try {
      const response = await axios.get(`${this.baseUrl}/income-statement/${symbol}?limit=4&apikey=${this.apiKey}`);
      
      if (response.data && response.data.length > 0) {
        cache.set(cacheKey, response.data);
        return response.data;
      }
      
      return [];
    } catch (error) {
      console.error(`Error fetching income statement for ${symbol}:`, error.message);
      throw error;
    }
  }

  /**
   * Get company balance sheet
   * @param {string} symbol - Stock symbol
   * @returns {Promise} - Balance sheet data
   */
  async getBalanceSheet(symbol) {
    const cacheKey = `balance_${symbol}`;
    const cachedData = cache.get(cacheKey);
    
    if (cachedData) {
      return cachedData;
    }
    
    try {
      const response = await axios.get(`${this.baseUrl}/balance-sheet-statement/${symbol}?limit=4&apikey=${this.apiKey}`);
      
      if (response.data && response.data.length > 0) {
        cache.set(cacheKey, response.data);
        return response.data;
      }
      
      return [];
    } catch (error) {
      console.error(`Error fetching balance sheet for ${symbol}:`, error.message);
      throw error;
    }
  }

  /**
   * Get company insider transactions
   * @param {string} symbol - Stock symbol
   * @returns {Promise} - Insider transactions data
   */
  async getInsiderTransactions(symbol) {
    const cacheKey = `insider_${symbol}`;
    const cachedData = cache.get(cacheKey);
    
    if (cachedData) {
      return cachedData;
    }
    
    try {
      const response = await axios.get(`${this.baseUrl}/insider-transactions/${symbol}?apikey=${this.apiKey}`);
      
      if (response.data && response.data.length > 0) {
        cache.set(cacheKey, response.data);
        return response.data;
      }
      
      return [];
    } catch (error) {
      console.error(`Error fetching insider transactions for ${symbol}:`, error.message);
      throw error;
    }
  }

  /**
   * Search for stocks by query
   * @param {string} query - Search query
   * @returns {Promise} - Search results
   */
  async searchStocks(query) {
    const cacheKey = `search_${query}`;
    const cachedData = cache.get(cacheKey);
    
    if (cachedData) {
      return cachedData;
    }
    
    try {
      const response = await axios.get(`${this.baseUrl}/search?query=${query}&limit=30&apikey=${this.apiKey}`);
      
      if (response.data) {
        cache.set(cacheKey, response.data);
        return response.data;
      }
      
      return [];
    } catch (error) {
      console.error(`Error searching stocks for ${query}:`, error.message);
      throw error;
    }
  }

  /**
   * Get stock screener results based on parameters
   * @param {Object} params - Screening parameters
   * @returns {Promise} - Screener results
   */
  async screenStocks(params) {
    // Create a cache key based on the parameters
    const cacheKey = `screen_${JSON.stringify(params)}`;
    const cachedData = cache.get(cacheKey);
    
    if (cachedData) {
      return cachedData;
    }
    
    try {
      // Build query string from params
      const queryParams = new URLSearchParams();
      
      // Add API key
      queryParams.append('apikey', this.apiKey);
      
      // Add all screening parameters
      Object.keys(params).forEach(key => {
        if (params[key] !== undefined && params[key] !== null) {
          queryParams.append(key, params[key]);
        }
      });
      
      const response = await axios.get(`${this.baseUrl}/stock-screener?${queryParams.toString()}`);
      
      if (response.data) {
        cache.set(cacheKey, response.data);
        return response.data;
      }
      
      return [];
    } catch (error) {
      console.error('Error screening stocks:', error.message);
      throw error;
    }
  }

  /**
   * Get all available stock symbols
   * @returns {Promise} - List of stock symbols
   */
  async getAllStockSymbols() {
    const cacheKey = 'all_symbols';
    const cachedData = cache.get(cacheKey);
    
    if (cachedData) {
      return cachedData;
    }
    
    try {
      const response = await axios.get(`${this.baseUrl}/stock/list?apikey=${this.apiKey}`);
      
      if (response.data) {
        cache.set(cacheKey, response.data);
        return response.data;
      }
      
      return [];
    } catch (error) {
      console.error('Error fetching all stock symbols:', error.message);
      throw error;
    }
  }

  /**
   * Clear cache for specific key or all cache
   * @param {string} key - Cache key to clear (optional)
   */
  clearCache(key = null) {
    if (key) {
      cache.del(key);
    } else {
      cache.flushAll();
    }
  }
}

module.exports = new FMPService();
