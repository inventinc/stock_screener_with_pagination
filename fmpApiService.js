/**
 * Financial Modeling Prep API Service
 * 
 * This service handles all interactions with the Financial Modeling Prep API
 * for fetching stock data, financial information, and other market data.
 */

const axios = require('axios');
require('dotenv').config();

// Get API key from environment variables
const FMP_API_KEY = process.env.FMP_API_KEY;
const BASE_URL = 'https://financialmodelingprep.com/api/v3';

/**
 * Make API request to Financial Modeling Prep
 * @param {string} endpoint - API endpoint
 * @param {Object} params - Query parameters
 * @returns {Promise<Object>} - API response
 */
async function makeApiRequest(endpoint, params = {}) {
  try {
    // Add API key to params
    params.apikey = FMP_API_KEY;
    
    // Build URL
    const url = `${BASE_URL}${endpoint}`;
    
    // Make request with axios
    const response = await axios.get(url, {
      params: params,
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 15000 // 15 second timeout
    });
    
    // Return data
    return response.data;
  } catch (error) {
    console.error('[ERROR] FMP API Request:', error.message);
    throw error;
  }
}

/**
 * Get all stock symbols from FMP
 * @returns {Promise<Array>} - Array of stock objects
 */
async function getAllStocks() {
  try {
    console.log('Fetching all stock symbols from FMP...');
    
    // Get all stocks from NYSE and NASDAQ
    const stocks = await makeApiRequest('/stock/list', {
      exchange: 'NYSE,NASDAQ'
    });
    
    // Filter out ETFs and preferred stocks
    const filteredStocks = stocks.filter(stock => 
      !stock.name?.includes('ETF') && 
      !stock.name?.includes('ETN') &&
      !stock.symbol?.includes('-') &&
      !stock.symbol?.includes('.') &&
      stock.type === 'stock'
    );
    
    console.log(`Fetched ${filteredStocks.length} stocks from FMP`);
    
    return filteredStocks;
  } catch (error) {
    console.error('Error fetching all stocks:', error.message);
    throw error;
  }
}

/**
 * Get company profile for a stock
 * @param {string} symbol - Stock symbol
 * @returns {Promise<Object>} - Company profile
 */
async function getCompanyProfile(symbol) {
  try {
    const profiles = await makeApiRequest('/profile/' + symbol);
    
    if (profiles && profiles.length > 0) {
      return profiles[0];
    }
    
    return null;
  } catch (error) {
    console.error(`Error getting profile for ${symbol}:`, error.message);
    return null;
  }
}

/**
 * Get quote for a stock
 * @param {string} symbol - Stock symbol
 * @returns {Promise<Object>} - Stock quote
 */
async function getStockQuote(symbol) {
  try {
    const quotes = await makeApiRequest('/quote/' + symbol);
    
    if (quotes && quotes.length > 0) {
      return quotes[0];
    }
    
    return null;
  } catch (error) {
    console.error(`Error getting quote for ${symbol}:`, error.message);
    return null;
  }
}

/**
 * Get key financial ratios for a stock
 * @param {string} symbol - Stock symbol
 * @returns {Promise<Object>} - Financial ratios
 */
async function getFinancialRatios(symbol) {
  try {
    const ratios = await makeApiRequest('/ratios/' + symbol);
    
    if (ratios && ratios.length > 0) {
      return ratios[0];
    }
    
    return null;
  } catch (error) {
    console.error(`Error getting financial ratios for ${symbol}:`, error.message);
    return null;
  }
}

/**
 * Get key metrics for a stock
 * @param {string} symbol - Stock symbol
 * @returns {Promise<Object>} - Key metrics
 */
async function getKeyMetrics(symbol) {
  try {
    const metrics = await makeApiRequest('/key-metrics/' + symbol);
    
    if (metrics && metrics.length > 0) {
      return metrics[0];
    }
    
    return null;
  } catch (error) {
    console.error(`Error getting key metrics for ${symbol}:`, error.message);
    return null;
  }
}

/**
 * Get all data for a stock (profile, quote, ratios, metrics)
 * @param {string} symbol - Stock symbol
 * @returns {Promise<Object>} - Combined stock data
 */
async function getStockData(symbol) {
  try {
    // Get all data in parallel
    const [profile, quote, ratios, metrics] = await Promise.all([
      getCompanyProfile(symbol),
      getStockQuote(symbol),
      getFinancialRatios(symbol),
      getKeyMetrics(symbol)
    ]);
    
    // Calculate score
    const score = calculateScore({
      marketCap: profile?.mktCap || 0,
      netDebtToEBITDA: ratios?.netDebtToEBITDA || 0,
      evToEBIT: ratios?.enterpriseValueOverEBIT || 0,
      rotce: metrics?.roic || 0
    });
    
    // Return combined data
    return {
      symbol: symbol,
      name: profile?.companyName || '',
      exchange: profile?.exchange || '',
      sector: profile?.sector || '',
      industry: profile?.industry || '',
      price: quote?.price || 0,
      marketCap: profile?.mktCap || 0,
      avgDollarVolume: quote?.avgVolume * quote?.price || 0,
      netDebtToEBITDA: ratios?.netDebtToEBITDA || 0,
      evToEBIT: ratios?.enterpriseValueOverEBIT || 0,
      rotce: metrics?.roic || 0,
      fcfToNetIncome: metrics?.freeCashFlowToNetIncome || 0,
      shareCountGrowth: metrics?.shareGrowth || 0,
      priceToBook: quote?.priceToBookRatio || 0,
      insiderOwnership: profile?.insiderOwnership || 0,
      revenueGrowth: metrics?.revenueGrowth || 0,
      score: score,
      lastUpdated: new Date().toISOString()
    };
  } catch (error) {
    console.error(`Error getting all data for ${symbol}:`, error.message);
    return null;
  }
}

/**
 * Helper function to calculate score
 * @param {Object} details - Stock details
 * @returns {number} - Score
 */
function calculateScore(details) {
  let score = 0;
  
  // Market cap score (0-20)
  if (details.marketCap > 10000000000) score += 20; // $10B+
  else if (details.marketCap > 2000000000) score += 15; // $2B+
  else if (details.marketCap > 300000000) score += 10; // $300M+
  else score += 5;
  
  // Debt score (0-20)
  if (details.netDebtToEBITDA < 1) score += 20;
  else if (details.netDebtToEBITDA < 2) score += 15;
  else if (details.netDebtToEBITDA < 3) score += 10;
  else score += 5;
  
  // Valuation score (0-20)
  if (details.evToEBIT > 0 && details.evToEBIT < 10) score += 20;
  else if (details.evToEBIT > 0 && details.evToEBIT < 15) score += 15;
  else if (details.evToEBIT > 0 && details.evToEBIT < 20) score += 10;
  else score += 5;
  
  // Profitability score (0-20)
  if (details.rotce > 0.2) score += 20;
  else if (details.rotce > 0.15) score += 15;
  else if (details.rotce > 0.1) score += 10;
  else score += 5;
  
  // Add random factor (0-20) for demonstration
  score += Math.floor(Math.random() * 20);
  
  return score;
}

module.exports = {
  getAllStocks,
  getCompanyProfile,
  getStockQuote,
  getFinancialRatios,
  getKeyMetrics,
  getStockData
};
