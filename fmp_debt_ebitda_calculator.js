/**
 * FMP-Optimized Debt/EBITDA Calculation Module
 * 
 * This module provides functions to calculate Debt/EBITDA ratio from
 * Financial Model Prep API data when the direct ratio is not available.
 * 
 * Optimized for FMP API field names and data structure.
 */

/**
 * Calculate Debt/EBITDA ratio from FMP financial statement components
 * @param {Object} financials - Financial data object containing component metrics from FMP API
 * @returns {Object} - Calculated ratio and metadata
 */
function calculateDebtToEBITDA(financials) {
  // Initialize result object with metadata
  const result = {
    value: null,
    calculated: true,
    method: null,
    components: {},
    hasAllComponents: false
  };
  
  // Return early if financials object is missing
  if (!financials) {
    result.error = 'Missing financials object';
    return result;
  }
  
  // Extract and store debt components (FMP field names)
  const longTermDebt = financials.longTermDebt || 0;
  const shortTermDebt = financials.shortTermDebt || 0;
  // FMP sometimes provides totalDebt directly
  const totalDebt = financials.totalDebt || (longTermDebt + shortTermDebt);
  
  result.components.longTermDebt = longTermDebt;
  result.components.shortTermDebt = shortTermDebt;
  result.components.totalDebt = totalDebt;
  
  // Method 1: Calculate EBITDA from net income and add-backs (FMP field names)
  const netIncome = financials.netIncome || 0;
  const interestExpense = financials.interestExpense || 0;
  const incomeTaxExpense = financials.incomeTaxExpense || 0;
  // FMP typically combines depreciation and amortization
  const depreciationAndAmortization = financials.depreciationAndAmortization || 0;
  
  const ebitda1 = netIncome + interestExpense + incomeTaxExpense + depreciationAndAmortization;
  
  result.components.netIncome = netIncome;
  result.components.interestExpense = interestExpense;
  result.components.incomeTaxExpense = incomeTaxExpense;
  result.components.depreciationAndAmortization = depreciationAndAmortization;
  result.components.ebitda1 = ebitda1;
  
  // Method 2: Calculate EBITDA from operating income (FMP field names)
  const operatingIncome = financials.operatingIncome || financials.ebit || 0;
  
  const ebitda2 = operatingIncome + depreciationAndAmortization;
  
  result.components.operatingIncome = operatingIncome;
  result.components.ebitda2 = ebitda2;
  
  // Method 3: Use EBITDA directly if available (FMP provides this)
  const directEBITDA = financials.ebitda || 0;
  result.components.directEBITDA = directEBITDA;
  
  // Determine which EBITDA calculation to use
  let finalEBITDA = 0;
  if (directEBITDA > 0) {
    finalEBITDA = directEBITDA;
    result.method = 'direct';
  } else if (ebitda1 > 0 && hasMinimumComponents(financials, 'method1')) {
    finalEBITDA = ebitda1;
    result.method = 'netIncome';
  } else if (ebitda2 > 0 && hasMinimumComponents(financials, 'method2')) {
    finalEBITDA = ebitda2;
    result.method = 'operatingIncome';
  }
  
  result.components.finalEBITDA = finalEBITDA;
  
  // Check if we have all necessary components for a reliable calculation
  result.hasAllComponents = (totalDebt > 0 && finalEBITDA > 0);
  
  // Calculate the ratio (with division by zero protection)
  if (result.hasAllComponents) {
    if (finalEBITDA === 0) {
      // Handle division by zero - if there's debt but no EBITDA, this indicates high leverage
      result.value = totalDebt > 0 ? Infinity : 0;
    } else {
      result.value = totalDebt / finalEBITDA;
    }
  }
  
  return result;
}

/**
 * Check if financials object has minimum required components for calculation
 * @param {Object} financials - Financial data object
 * @param {String} method - Calculation method to check components for
 * @returns {Boolean} - Whether minimum components are available
 */
function hasMinimumComponents(financials, method) {
  if (method === 'method1') {
    // For net income method, we need at least net income and one add-back
    return (
      (financials.netIncome !== undefined && financials.netIncome !== null) &&
      (
        (financials.interestExpense !== undefined && financials.interestExpense !== null) ||
        (financials.incomeTaxExpense !== undefined && financials.incomeTaxExpense !== null) ||
        (financials.depreciationAndAmortization !== undefined && financials.depreciationAndAmortization !== null)
      )
    );
  } else if (method === 'method2') {
    // For operating income method, we need operating income and depreciation/amortization
    return (
      ((financials.operatingIncome !== undefined && financials.operatingIncome !== null) ||
       (financials.ebit !== undefined && financials.ebit !== null)) &&
      (financials.depreciationAndAmortization !== undefined && financials.depreciationAndAmortization !== null)
    );
  }
  
  return false;
}

/**
 * Process FMP financial data to extract or calculate Debt/EBITDA
 * @param {Object} fmpData - Comprehensive financial data from FMP API
 * @returns {Object} - Processed data with Debt/EBITDA
 */
function processFinancialData(fmpData) {
  // Initialize result
  const result = {
    netDebtToEBITDA: null,
    netDebtToEBITDACalculated: false,
    netDebtToEBITDAMethod: null
  };
  
  // Check if Debt/EBITDA is directly available from ratios
  if (fmpData.ratios && (fmpData.ratios.debtToEBITDA || fmpData.ratios.netDebtToEBITDA)) {
    result.netDebtToEBITDA = fmpData.ratios.netDebtToEBITDA || fmpData.ratios.debtToEBITDA;
    result.netDebtToEBITDACalculated = false;
  } else {
    // Prepare financial data for custom calculation
    const financialsForCalculation = {
      // Balance sheet items
      longTermDebt: fmpData.balanceSheet?.longTermDebt,
      shortTermDebt: fmpData.balanceSheet?.shortTermDebt,
      totalDebt: fmpData.balanceSheet?.totalDebt,
      
      // Income statement items
      netIncome: fmpData.incomeStatement?.netIncome,
      interestExpense: fmpData.incomeStatement?.interestExpense,
      incomeTaxExpense: fmpData.incomeStatement?.incomeTaxExpense,
      operatingIncome: fmpData.incomeStatement?.operatingIncome,
      ebit: fmpData.incomeStatement?.ebit,
      
      // Combined items
      depreciationAndAmortization: fmpData.incomeStatement?.depreciationAndAmortization,
      ebitda: fmpData.incomeStatement?.ebitda || fmpData.keyMetrics?.ebitda
    };
    
    // Calculate using custom calculator
    const calculationResult = calculateDebtToEBITDA(financialsForCalculation);
    
    if (calculationResult.hasAllComponents && calculationResult.value !== null) {
      result.netDebtToEBITDA = calculationResult.value;
      result.netDebtToEBITDACalculated = true;
      result.netDebtToEBITDAMethod = calculationResult.method;
    }
  }
  
  return result;
}

module.exports = {
  calculateDebtToEBITDA,
  hasMinimumComponents,
  processFinancialData
};
