const axios = require('axios');
require('dotenv').config();

// Get API key and base URL from environment variables
const API_KEY = process.env.FMP_API_KEY;
const BASE_URL = process.env.FMP_API_BASE_URL || 'https://financialmodelingprep.com/api/v3';

// Add console logging for debugging
console.log('FMP Service initialized with:');
console.log(`API Key present: ${!!API_KEY}`);
console.log(`Base URL: ${BASE_URL}`);

/**
 * Get company profile from FMP API
 * @param {string} symbol - Stock symbol
 * @returns {Promise<Object>} - Company profile data
 */
async function getCompanyProfile(symbol) {
  try {
    console.log(`Fetching company profile for ${symbol}`);
    const response = await axios.get(`${BASE_URL}/profile/${symbol}?apikey=${API_KEY}`);
    console.log(`Profile API response status: ${response.status}`);
    
    if (response.data && response.data.length > 0) {
      console.log(`Successfully retrieved profile for ${symbol}`);
      return response.data[0];
    }
    
    console.log(`No profile data found for ${symbol}`);
    return null;
  } catch (error) {
    console.error(`Error fetching company profile for ${symbol}:`, error.message);
    if (error.response) {
      console.error(`Status: ${error.response.status}, Data:`, error.response.data);
    }
    return null;
  }
}

/**
 * Get financial ratios from FMP API
 * @param {string} symbol - Stock symbol
 * @returns {Promise<Array>} - Financial ratios data
 */
async function getFinancialRatios(symbol) {
  try {
    console.log(`Fetching financial ratios for ${symbol}`);
    const response = await axios.get(`${BASE_URL}/ratios/${symbol}?apikey=${API_KEY}`);
    console.log(`Ratios API response status: ${response.status}`);
    
    if (response.data && response.data.length > 0) {
      console.log(`Successfully retrieved ${response.data.length} financial ratios for ${symbol}`);
      return response.data;
    }
    
    console.log(`No financial ratios found for ${symbol}`);
    return [];
  } catch (error) {
    console.error(`Error fetching financial ratios for ${symbol}:`, error.message);
    if (error.response) {
      console.error(`Status: ${error.response.status}, Data:`, error.response.data);
    }
    return [];
  }
}

/**
 * Get key metrics from FMP API
 * @param {string} symbol - Stock symbol
 * @returns {Promise<Array>} - Key metrics data
 */
async function getKeyMetrics(symbol) {
  try {
    console.log(`Fetching key metrics for ${symbol}`);
    const response = await axios.get(`${BASE_URL}/key-metrics/${symbol}?apikey=${API_KEY}`);
    console.log(`Key metrics API response status: ${response.status}`);
    
    if (response.data && response.data.length > 0) {
      console.log(`Successfully retrieved ${response.data.length} key metrics for ${symbol}`);
      return response.data;
    }
    
    console.log(`No key metrics found for ${symbol}`);
    return [];
  } catch (error) {
    console.error(`Error fetching key metrics for ${symbol}:`, error.message);
    if (error.response) {
      console.error(`Status: ${error.response.status}, Data:`, error.response.data);
    }
    return [];
  }
}

/**
 * Get cash flow statement from FMP API
 * @param {string} symbol - Stock symbol
 * @returns {Promise<Array>} - Cash flow statement data
 */
async function getCashFlowStatement(symbol) {
  try {
    console.log(`Fetching cash flow statement for ${symbol}`);
    const response = await axios.get(`${BASE_URL}/cash-flow-statement/${symbol}?apikey=${API_KEY}`);
    console.log(`Cash flow API response status: ${response.status}`);
    
    if (response.data && response.data.length > 0) {
      console.log(`Successfully retrieved ${response.data.length} cash flow statements for ${symbol}`);
      return response.data;
    }
    
    console.log(`No cash flow statement found for ${symbol}`);
    return [];
  } catch (error) {
    console.error(`Error fetching cash flow statement for ${symbol}:`, error.message);
    if (error.response) {
      console.error(`Status: ${error.response.status}, Data:`, error.response.data);
    }
    return [];
  }
}

/**
 * Get income statement from FMP API
 * @param {string} symbol - Stock symbol
 * @returns {Promise<Array>} - Income statement data
 */
async function getIncomeStatement(symbol) {
  try {
    console.log(`Fetching income statement for ${symbol}`);
    const response = await axios.get(`${BASE_URL}/income-statement/${symbol}?apikey=${API_KEY}`);
    console.log(`Income statement API response status: ${response.status}`);
    
    if (response.data && response.data.length > 0) {
      console.log(`Successfully retrieved ${response.data.length} income statements for ${symbol}`);
      return response.data;
    }
    
    console.log(`No income statement found for ${symbol}`);
    return [];
  } catch (error) {
    console.error(`Error fetching income statement for ${symbol}:`, error.message);
    if (error.response) {
      console.error(`Status: ${error.response.status}, Data:`, error.response.data);
    }
    return [];
  }
}

/**
 * Get balance sheet from FMP API
 * @param {string} symbol - Stock symbol
 * @returns {Promise<Array>} - Balance sheet data
 */
async function getBalanceSheet(symbol) {
  try {
    console.log(`Fetching balance sheet for ${symbol}`);
    const response = await axios.get(`${BASE_URL}/balance-sheet-statement/${symbol}?apikey=${API_KEY}`);
    console.log(`Balance sheet API response status: ${response.status}`);
    
    if (response.data && response.data.length > 0) {
      console.log(`Successfully retrieved ${response.data.length} balance sheets for ${symbol}`);
      return response.data;
    }
    
    console.log(`No balance sheet found for ${symbol}`);
    return [];
  } catch (error) {
    console.error(`Error fetching balance sheet for ${symbol}:`, error.message);
    if (error.response) {
      console.error(`Status: ${error.response.status}, Data:`, error.response.data);
    }
    return [];
  }
}

/**
 * Get insider transactions from FMP API
 * @param {string} symbol - Stock symbol
 * @returns {Promise<Array>} - Insider transactions data
 */
async function getInsiderTransactions(symbol) {
  try {
    console.log(`Fetching insider transactions for ${symbol}`);
    const response = await axios.get(`${BASE_URL}/insider-trading?symbol=${symbol}&apikey=${API_KEY}`);
    console.log(`Insider transactions API response status: ${response.status}`);
    
    if (response.data && response.data.length > 0) {
      console.log(`Successfully retrieved ${response.data.length} insider transactions for ${symbol}`);
      return response.data;
    }
    
    console.log(`No insider transactions found for ${symbol}`);
    return [];
  } catch (error) {
    console.error(`Error fetching insider transactions for ${symbol}:`, error.message);
    if (error.response) {
      console.error(`Status: ${error.response.status}, Data:`, error.response.data);
    }
    return [];
  }
}

/**
 * Get all stock symbols from FMP API
 * @returns {Promise<Array>} - All stock symbols
 */
async function getAllStockSymbols() {
  try {
    console.log('Fetching all stock symbols');
    const response = await axios.get(`${BASE_URL}/stock/list?apikey=${API_KEY}`);
    console.log(`Stock list API response status: ${response.status}`);
    
    if (response.data && response.data.length > 0) {
      console.log(`Successfully retrieved ${response.data.length} stock symbols`);
      return response.data;
    }
    
    console.log('No stock symbols found');
    return [];
  } catch (error) {
    console.error('Error fetching all stock symbols:', error.message);
    if (error.response) {
      console.error(`Status: ${error.response.status}, Data:`, error.response.data);
    }
    return [];
  }
}

module.exports = {
  getCompanyProfile,
  getFinancialRatios,
  getKeyMetrics,
  getCashFlowStatement,
  getIncomeStatement,
  getBalanceSheet,
  getInsiderTransactions,
  getAllStockSymbols
};
