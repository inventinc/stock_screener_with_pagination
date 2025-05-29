/**
 * Polygon.io financials service
 * Fetches and processes financial data from Polygon.io financials endpoint
 */

const axios = require('axios');

// Configuration
const POLYGON_API_KEY = process.env.POLYGON_API_KEY || 'l2nLlcjoSEzsnnQGNZMSVDyo_spG1PKk';

/**
 * Fetch financial data from Polygon.io
 * @param {string} symbol - Stock symbol
 * @returns {Promise<Object>} Financial data
 */
async function fetchPolygonFinancials(symbol) {
  try {
    console.log(`Fetching Polygon.io financials for ${symbol}...`);
    
    const url = `https://api.polygon.io/vX/reference/financials?ticker=${symbol}&apiKey=${POLYGON_API_KEY}`;
    const response = await axios.get(url);
    
    // Update rate limit info if headers are available
    if (response.headers['x-ratelimit-limit']) {
      console.log(`Rate limit remaining: ${response.headers['x-ratelimit-remaining']}`);
    }
    
    return response.data.results || [];
  } catch (error) {
    console.error(`Error fetching Polygon financials for ${symbol}:`, error.message);
    return null;
  }
}

/**
 * Calculate financial ratios from raw financial data
 * @param {Array<Object>} financialsData - Array of financial data objects
 * @param {number} currentPrice - Current stock price
 * @param {number} outstandingShares - Outstanding shares (if available)
 * @returns {Object} Calculated financial ratios
 */
function calculateFinancialRatios(financialsData, currentPrice, outstandingShares) {
  try {
    // If no financials data available, return null
    if (!financialsData || financialsData.length === 0) {
      return null;
    }
    
    // Get the most recent financial data
    const latestFinancials = financialsData[0];
    
    // Extract income statement data
    const incomeStatement = latestFinancials.financials?.income_statement || {};
    const balanceSheet = latestFinancials.financials?.balance_sheet || {};
    const cashFlow = latestFinancials.financials?.cash_flow_statement || {};
    
    // Extract key financial metrics
    const revenue = incomeStatement.revenues?.value || 0;
    const netIncome = incomeStatement.net_income_loss?.value || 0;
    const ebit = incomeStatement.operating_income_loss?.value || 0;
    const ebitda = ebit + (incomeStatement.depreciation_and_amortization?.value || 0);
    
    const totalAssets = balanceSheet.assets?.value || 0;
    const totalLiabilities = balanceSheet.liabilities?.value || 0;
    const totalEquity = balanceSheet.equity?.value || 0;
    const totalDebt = (balanceSheet.long_term_debt?.value || 0) + (balanceSheet.short_term_debt?.value || 0);
    
    const cash = balanceSheet.cash_and_equivalents?.value || 0;
    const netDebt = totalDebt - cash;
    
    // Calculate market cap if price and shares are available
    const marketCap = currentPrice && outstandingShares ? currentPrice * outstandingShares : null;
    
    // Calculate enterprise value
    const enterpriseValue = marketCap ? marketCap + netDebt : null;
    
    // Calculate financial ratios
    const evToEBIT = enterpriseValue && ebit ? enterpriseValue / ebit : null;
    const netDebtToEBITDA = netDebt && ebitda ? netDebt / ebitda : null;
    
    // Calculate ROTCE (Return on Tangible Common Equity)
    // Tangible Common Equity = Total Equity - Intangible Assets
    const intangibleAssets = balanceSheet.intangible_assets?.value || 0;
    const tangibleCommonEquity = totalEquity - intangibleAssets;
    const rotce = tangibleCommonEquity && netIncome ? netIncome / tangibleCommonEquity : null;
    
    return {
      evToEBIT,
      netDebtToEBITDA,
      rotce,
      // Include raw financial metrics for reference
      revenue,
      netIncome,
      ebit,
      ebitda,
      totalAssets,
      totalLiabilities,
      totalEquity,
      totalDebt,
      netDebt,
      tangibleCommonEquity
    };
  } catch (error) {
    console.error('Error calculating financial ratios:', error.message);
    return null;
  }
}

module.exports = {
  fetchPolygonFinancials,
  calculateFinancialRatios
};
