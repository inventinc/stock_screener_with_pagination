/**
 * Custom Debt/EBITDA Calculation Module
 * 
 * This module provides functions to calculate Debt/EBITDA ratio from
 * component financial metrics when the direct ratio is not available
 * from the API data source.
 */

/**
 * Calculate Debt/EBITDA ratio from financial statement components
 * @param {Object} financials - Financial data object containing component metrics
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
  
  // Extract and store debt components
  const longTermDebt = financials.longTermDebt || financials.debt || 0;
  const shortTermDebt = financials.shortTermDebt || financials.currentDebt || 0;
  const totalDebt = longTermDebt + shortTermDebt;
  
  result.components.longTermDebt = longTermDebt;
  result.components.shortTermDebt = shortTermDebt;
  result.components.totalDebt = totalDebt;
  
  // Method 1: Calculate EBITDA from net income and add-backs
  const netIncome = financials.netIncome || 0;
  const interestExpense = financials.interestExpense || 0;
  const incomeTaxExpense = financials.incomeTaxExpense || 0;
  const depreciation = financials.depreciation || financials.depreciationAndAmortization || 0;
  const amortization = financials.amortization || 0;
  
  const ebitda1 = netIncome + interestExpense + incomeTaxExpense + depreciation + amortization;
  
  result.components.netIncome = netIncome;
  result.components.interestExpense = interestExpense;
  result.components.incomeTaxExpense = incomeTaxExpense;
  result.components.depreciation = depreciation;
  result.components.amortization = amortization;
  result.components.ebitda1 = ebitda1;
  
  // Method 2: Calculate EBITDA from operating income
  const operatingIncome = financials.operatingIncome || financials.ebit || 0;
  const depreciationAndAmortization = financials.depreciationAndAmortization || (depreciation + amortization) || 0;
  
  const ebitda2 = operatingIncome + depreciationAndAmortization;
  
  result.components.operatingIncome = operatingIncome;
  result.components.depreciationAndAmortization = depreciationAndAmortization;
  result.components.ebitda2 = ebitda2;
  
  // Method 3: Use EBITDA directly if available
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
    result.value = finalEBITDA > 0 ? totalDebt / finalEBITDA : null;
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
        (financials.depreciation !== undefined && financials.depreciation !== null) ||
        (financials.depreciationAndAmortization !== undefined && financials.depreciationAndAmortization !== null)
      )
    );
  } else if (method === 'method2') {
    // For operating income method, we need operating income
    return (
      (financials.operatingIncome !== undefined && financials.operatingIncome !== null) ||
      (financials.ebit !== undefined && financials.ebit !== null)
    );
  }
  
  return false;
}

/**
 * Integration example for import scripts
 * 
 * This shows how to integrate the custom calculation into your import process
 */
function processFinancialData(apiData) {
  // Process API data as usual
  const processedData = {
    // ... other fields
  };
  
  // Check if Debt/EBITDA is directly available from API
  if (apiData.ratios && (apiData.ratios.debtToEBITDA || apiData.ratios.netDebtToEBITDA)) {
    processedData.netDebtToEBITDA = apiData.ratios.debtToEBITDA || apiData.ratios.netDebtToEBITDA;
    processedData.netDebtToEBITDACalculated = false;
  } else {
    // Calculate from components if direct value not available
    const calculationResult = calculateDebtToEBITDA(apiData.financials);
    
    if (calculationResult.hasAllComponents && calculationResult.value !== null) {
      processedData.netDebtToEBITDA = calculationResult.value;
      processedData.netDebtToEBITDACalculated = true;
      processedData.netDebtToEBITDAMethod = calculationResult.method;
    } else {
      processedData.netDebtToEBITDA = null;
    }
  }
  
  return processedData;
}

module.exports = {
  calculateDebtToEBITDA,
  hasMinimumComponents,
  processFinancialData
};
