/**
 * Financial Model Prep (FMP) API Service
 * 
 * This module provides a unified interface for interacting with the FMP API,
 * handling rate limiting, error handling, and data formatting.
 */

const axios = require('axios');
require('dotenv').config();

// API configuration
const FMP_API_KEY = process.env.FMP_API_KEY;
const FMP_BASE_URL = 'https://financialmodelingprep.com/api/v3';

/**
 * Fetch data from FMP API
 * @param {string} endpoint - API endpoint
 * @param {Object} params - Query parameters
 * @returns {Promise<Object>} - API response data
 */
async function fetchFMPData(endpoint, params = {}) {
  try {
    const url = `${FMP_BASE_URL}${endpoint}`;
    const response = await axios.get(url, {
      params: {
        ...params,
        apikey: FMP_API_KEY
      }
    });
    
    return response.data;
  } catch (error) {
    console.error(`Error fetching data from ${endpoint}:`, error.message);
    return null;
  }
}

/**
 * Fetch stock price and basic info
 * @param {string} symbol - Stock symbol
 * @returns {Promise<Object>} - Stock price data
 */
async function fetchStockPrice(symbol) {
  try {
    const quoteData = await fetchFMPData(`/quote/${symbol}`);
    
    if (!quoteData || !Array.isArray(quoteData) || quoteData.length === 0) {
      console.log(`No quote data found for ${symbol}`);
      return null;
    }
    
    return quoteData[0];
  } catch (error) {
    console.error(`Error fetching stock price for ${symbol}:`, error.message);
    return null;
  }
}

/**
 * Fetch company profile
 * @param {string} symbol - Stock symbol
 * @returns {Promise<Object>} - Company profile data
 */
async function fetchCompanyProfile(symbol) {
  try {
    const profileData = await fetchFMPData(`/profile/${symbol}`);
    
    if (!profileData || !Array.isArray(profileData) || profileData.length === 0) {
      console.log(`No profile data found for ${symbol}`);
      return null;
    }
    
    return profileData[0];
  } catch (error) {
    console.error(`Error fetching company profile for ${symbol}:`, error.message);
    return null;
  }
}

/**
 * Fetch financial ratios
 * @param {string} symbol - Stock symbol
 * @returns {Promise<Object>} - Financial ratios data
 */
async function fetchFinancialRatios(symbol) {
  try {
    const ratiosData = await fetchFMPData(`/ratios/${symbol}`, { limit: 1 });
    
    if (!ratiosData || !Array.isArray(ratiosData) || ratiosData.length === 0) {
      console.log(`No ratios data found for ${symbol}`);
      return null;
    }
    
    return ratiosData[0];
  } catch (error) {
    console.error(`Error fetching financial ratios for ${symbol}:`, error.message);
    return null;
  }
}

/**
 * Fetch income statement
 * @param {string} symbol - Stock symbol
 * @returns {Promise<Object>} - Income statement data
 */
async function fetchIncomeStatement(symbol) {
  try {
    const incomeData = await fetchFMPData(`/income-statement/${symbol}`, { limit: 1 });
    
    if (!incomeData || !Array.isArray(incomeData) || incomeData.length === 0) {
      console.log(`No income statement data found for ${symbol}`);
      return null;
    }
    
    return incomeData[0];
  } catch (error) {
    console.error(`Error fetching income statement for ${symbol}:`, error.message);
    return null;
  }
}

/**
 * Fetch balance sheet
 * @param {string} symbol - Stock symbol
 * @returns {Promise<Object>} - Balance sheet data
 */
async function fetchBalanceSheet(symbol) {
  try {
    const balanceData = await fetchFMPData(`/balance-sheet-statement/${symbol}`, { limit: 1 });
    
    if (!balanceData || !Array.isArray(balanceData) || balanceData.length === 0) {
      console.log(`No balance sheet data found for ${symbol}`);
      return null;
    }
    
    return balanceData[0];
  } catch (error) {
    console.error(`Error fetching balance sheet for ${symbol}:`, error.message);
    return null;
  }
}

/**
 * Fetch key metrics
 * @param {string} symbol - Stock symbol
 * @returns {Promise<Object>} - Key metrics data
 */
async function fetchKeyMetrics(symbol) {
  try {
    const metricsData = await fetchFMPData(`/key-metrics/${symbol}`, { limit: 1 });
    
    if (!metricsData || !Array.isArray(metricsData) || metricsData.length === 0) {
      console.log(`No key metrics data found for ${symbol}`);
      return null;
    }
    
    return metricsData[0];
  } catch (error) {
    console.error(`Error fetching key metrics for ${symbol}:`, error.message);
    return null;
  }
}

/**
 * Fetch comprehensive financial data for a stock
 * @param {string} symbol - Stock symbol
 * @returns {Promise<Object>} - Comprehensive financial data
 */
async function fetchComprehensiveFinancialData(symbol) {
  try {
    // Fetch data in parallel for efficiency
    const [
      profile,
      quote,
      incomeStatement,
      balanceSheet,
      ratios,
      keyMetrics
    ] = await Promise.all([
      fetchCompanyProfile(symbol),
      fetchStockPrice(symbol),
      fetchIncomeStatement(symbol),
      fetchBalanceSheet(symbol),
      fetchFinancialRatios(symbol),
      fetchKeyMetrics(symbol)
    ]);
    
    // Combine all data into a comprehensive financial object
    return {
      profile,
      quote,
      incomeStatement,
      balanceSheet,
      ratios,
      keyMetrics
    };
  } catch (error) {
    console.error(`Error fetching comprehensive data for ${symbol}:`, error.message);
    return null;
  }
}

module.exports = {
  fetchFMPData,
  fetchStockPrice,
  fetchCompanyProfile,
  fetchFinancialRatios,
  fetchIncomeStatement,
  fetchBalanceSheet,
  fetchKeyMetrics,
  fetchComprehensiveFinancialData
};
