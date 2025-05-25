/**
 * ROTCE and Cash Conversion Ratio Calculator Module
 * 
 * This module provides functions to calculate Return on Tangible Common Equity (ROTCE)
 * and Cash Conversion Ratio from financial data provided by Financial Modeling Prep API.
 */

/**
 * Calculate Return on Tangible Common Equity (ROTCE)
 * 
 * Formula: ROTCE = Net Income / (Total Equity - Intangible Assets)
 * 
 * @param {Object} financials - Financial data from FMP API
 * @returns {Object} - ROTCE calculation result with value and metadata
 */
function calculateROTCE(financials) {
  // Default result structure
  const result = {
    value: null,
    hasAllComponents: false,
    components: {
      netIncome: null,
      totalEquity: null,
      intangibleAssets: null,
      tangibleCommonEquity: null
    },
    method: 'direct'
  };
  
  // Extract required components
  if (!financials) return result;
  
  // Get net income from income statement
  const netIncome = financials.netIncome || 
                   (financials.incomeStatement && financials.incomeStatement[0] && 
                    financials.incomeStatement[0].netIncome);
  
  // Get total equity and intangible assets from balance sheet
  const totalEquity = financials.totalStockholdersEquity || 
                     (financials.balanceSheet && financials.balanceSheet[0] && 
                      financials.balanceSheet[0].totalStockholdersEquity);
  
  const intangibleAssets = financials.intangibleAssets || 
                          (financials.balanceSheet && financials.balanceSheet[0] && 
                           financials.balanceSheet[0].intangibleAssets) || 0;
  
  // Update components in result
  result.components.netIncome = netIncome;
  result.components.totalEquity = totalEquity;
  result.components.intangibleAssets = intangibleAssets;
  
  // Check if we have all required components
  if (netIncome && totalEquity !== undefined) {
    // Calculate tangible common equity
    const tangibleCommonEquity = totalEquity - intangibleAssets;
    result.components.tangibleCommonEquity = tangibleCommonEquity;
    
    // Avoid division by zero
    if (tangibleCommonEquity > 0) {
      result.value = netIncome / tangibleCommonEquity;
      result.hasAllComponents = true;
    }
  }
  
  return result;
}

/**
 * Calculate Cash Conversion Ratio over a 5-year period
 * 
 * Formula: Cash Conversion = Σ Free Cash Flow / Σ Net Income (over 5 years)
 * 
 * @param {Object} financials - Financial data from FMP API with 5 years of history
 * @returns {Object} - Cash Conversion calculation result with value and metadata
 */
function calculateCashConversion(financials) {
  // Default result structure
  const result = {
    value: null,
    hasAllComponents: false,
    components: {
      freeCashFlows: [],
      netIncomes: [],
      totalFreeCashFlow: null,
      totalNetIncome: null,
      yearsAvailable: 0
    },
    method: 'direct'
  };
  
  // Extract required components
  if (!financials) return result;
  
  // Get arrays of income statements and cash flow statements
  const incomeStatements = financials.incomeStatement || 
                          (financials.financialStatements && 
                           financials.financialStatements.incomeStatements) || [];
  
  const cashFlowStatements = financials.cashFlowStatement || 
                            (financials.financialStatements && 
                             financials.financialStatements.cashFlowStatements) || [];
  
  // Extract up to 5 years of data
  const netIncomes = [];
  const freeCashFlows = [];
  
  // Process income statements (up to 5 years)
  for (let i = 0; i < Math.min(incomeStatements.length, 5); i++) {
    const statement = incomeStatements[i];
    if (statement && statement.netIncome !== undefined) {
      netIncomes.push(statement.netIncome);
    }
  }
  
  // Process cash flow statements (up to 5 years)
  for (let i = 0; i < Math.min(cashFlowStatements.length, 5); i++) {
    const statement = cashFlowStatements[i];
    if (statement && statement.freeCashFlow !== undefined) {
      freeCashFlows.push(statement.freeCashFlow);
    }
  }
  
  // Update components in result
  result.components.netIncomes = netIncomes;
  result.components.freeCashFlows = freeCashFlows;
  result.components.yearsAvailable = Math.min(netIncomes.length, freeCashFlows.length);
  
  // Calculate totals
  if (netIncomes.length > 0 && freeCashFlows.length > 0) {
    const totalNetIncome = netIncomes.reduce((sum, value) => sum + value, 0);
    const totalFreeCashFlow = freeCashFlows.reduce((sum, value) => sum + value, 0);
    
    result.components.totalNetIncome = totalNetIncome;
    result.components.totalFreeCashFlow = totalFreeCashFlow;
    
    // Calculate ratio if we have positive net income
    if (totalNetIncome > 0) {
      result.value = totalFreeCashFlow / totalNetIncome;
      result.hasAllComponents = true;
    }
  }
  
  return result;
}

/**
 * Calculate both ROTCE and Cash Conversion from financial data
 * 
 * @param {Object} financials - Financial data from FMP API
 * @returns {Object} - Object containing both calculations
 */
function calculateFinancialMetrics(financials) {
  return {
    rotce: calculateROTCE(financials),
    cashConversion: calculateCashConversion(financials)
  };
}

module.exports = {
  calculateROTCE,
  calculateCashConversion,
  calculateFinancialMetrics
};
