/**
 * FMP-Optimized Debt/EBITDA Calculation Module - Fixed Version
 * 
 * This module provides functions to calculate Debt/EBITDA ratio from
 * Financial Model Prep API data when the direct ratio is not available.
 * 
 * Optimized for FMP API field names and data structure.
 * 
 * FIXES:
 * - Ensures null values are preserved and not converted to zero
 * - Improves logging for debugging calculation paths
 * - Adds additional validation to prevent false zeros
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
    console.log('Debt/EBITDA calculation: Missing financials object');
    result.error = 'Missing financials object';
    return result;
  }
  
  // Extract and store debt components (FMP field names)
  const longTermDebt = financials.longTermDebt !== undefined ? financials.longTermDebt : null;
  const shortTermDebt = financials.shortTermDebt !== undefined ? financials.shortTermDebt : null;
  
  // FMP sometimes provides totalDebt directly
  let totalDebt = null;
  if (financials.totalDebt !== undefined && financials.totalDebt !== null) {
    totalDebt = financials.totalDebt;
  } else if (longTermDebt !== null && shortTermDebt !== null) {
    totalDebt = longTermDebt + shortTermDebt;
  }
  
  result.components.longTermDebt = longTermDebt;
  result.components.shortTermDebt = shortTermDebt;
  result.components.totalDebt = totalDebt;
  
  console.log(`Debt/EBITDA calculation: Debt components - longTerm: ${longTermDebt}, shortTerm: ${shortTermDebt}, total: ${totalDebt}`);
  
  // Method 1: Calculate EBITDA from net income and add-backs (FMP field names)
  const netIncome = financials.netIncome !== undefined ? financials.netIncome : null;
  const interestExpense = financials.interestExpense !== undefined ? financials.interestExpense : null;
  const incomeTaxExpense = financials.incomeTaxExpense !== undefined ? financials.incomeTaxExpense : null;
  // FMP typically combines depreciation and amortization
  const depreciationAndAmortization = financials.depreciationAndAmortization !== undefined ? financials.depreciationAndAmortization : null;
  
  let ebitda1 = null;
  if (netIncome !== null && (interestExpense !== null || incomeTaxExpense !== null || depreciationAndAmortization !== null)) {
    ebitda1 = netIncome;
    if (interestExpense !== null) ebitda1 += interestExpense;
    if (incomeTaxExpense !== null) ebitda1 += incomeTaxExpense;
    if (depreciationAndAmortization !== null) ebitda1 += depreciationAndAmortization;
  }
  
  result.components.netIncome = netIncome;
  result.components.interestExpense = interestExpense;
  result.components.incomeTaxExpense = incomeTaxExpense;
  result.components.depreciationAndAmortization = depreciationAndAmortization;
  result.components.ebitda1 = ebitda1;
  
  console.log(`Debt/EBITDA calculation: EBITDA method 1 components - netIncome: ${netIncome}, interestExpense: ${interestExpense}, incomeTaxExpense: ${incomeTaxExpense}, depreciationAndAmortization: ${depreciationAndAmortization}`);
  console.log(`Debt/EBITDA calculation: EBITDA method 1 result: ${ebitda1}`);
  
  // Method 2: Calculate EBITDA from operating income (FMP field names)
  const operatingIncome = financials.operatingIncome !== undefined ? financials.operatingIncome : 
                         (financials.ebit !== undefined ? financials.ebit : null);
  
  let ebitda2 = null;
  if (operatingIncome !== null && depreciationAndAmortization !== null) {
    ebitda2 = operatingIncome + depreciationAndAmortization;
  }
  
  result.components.operatingIncome = operatingIncome;
  result.components.ebitda2 = ebitda2;
  
  console.log(`Debt/EBITDA calculation: EBITDA method 2 components - operatingIncome: ${operatingIncome}, depreciationAndAmortization: ${depreciationAndAmortization}`);
  console.log(`Debt/EBITDA calculation: EBITDA method 2 result: ${ebitda2}`);
  
  // Method 3: Use EBITDA directly if available (FMP provides this)
  const directEBITDA = financials.ebitda !== undefined ? financials.ebitda : null;
  result.components.directEBITDA = directEBITDA;
  
  console.log(`Debt/EBITDA calculation: Direct EBITDA: ${directEBITDA}`);
  
  // Determine which EBITDA calculation to use
  let finalEBITDA = null;
  if (directEBITDA !== null && directEBITDA > 0) {
    finalEBITDA = directEBITDA;
    result.method = 'direct';
  } else if (ebitda1 !== null && ebitda1 > 0 && hasMinimumComponents(financials, 'method1')) {
    finalEBITDA = ebitda1;
    result.method = 'netIncome';
  } else if (ebitda2 !== null && ebitda2 > 0 && hasMinimumComponents(financials, 'method2')) {
    finalEBITDA = ebitda2;
    result.method = 'operatingIncome';
  }
  
  result.components.finalEBITDA = finalEBITDA;
  
  console.log(`Debt/EBITDA calculation: Final EBITDA (${result.method}): ${finalEBITDA}`);
  
  // Check if we have all necessary components for a reliable calculation
  result.hasAllComponents = (totalDebt !== null && finalEBITDA !== null && finalEBITDA > 0);
  
  // Calculate the ratio (with division by zero protection)
  if (result.hasAllComponents) {
    if (finalEBITDA === 0) {
      // Handle division by zero - if there's debt but no EBITDA, this indicates high leverage
      result.value = totalDebt > 0 ? Infinity : 0;
    } else {
      result.value = totalDebt / finalEBITDA;
    }
    console.log(`Debt/EBITDA calculation: Final value: ${result.value}`);
  } else {
    console.log(`Debt/EBITDA calculation: Cannot calculate, missing components. hasAllComponents: ${result.hasAllComponents}`);
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
  
  console.log('Processing financial data for Debt/EBITDA calculation');
  
  // Check if Debt/EBITDA is directly available from ratios
  if (fmpData.ratios && 
      (fmpData.ratios.debtToEBITDA !== undefined || fmpData.ratios.netDebtToEBITDA !== undefined)) {
    
    // Important: Check for null/undefined before assignment
    if (fmpData.ratios.netDebtToEBITDA !== undefined && fmpData.ratios.netDebtToEBITDA !== null) {
      result.netDebtToEBITDA = fmpData.ratios.netDebtToEBITDA;
      result.netDebtToEBITDACalculated = false;
      console.log(`Using direct netDebtToEBITDA from ratios: ${result.netDebtToEBITDA}`);
    } else if (fmpData.ratios.debtToEBITDA !== undefined && fmpData.ratios.debtToEBITDA !== null) {
      result.netDebtToEBITDA = fmpData.ratios.debtToEBITDA;
      result.netDebtToEBITDACalculated = false;
      console.log(`Using direct debtToEBITDA from ratios: ${result.netDebtToEBITDA}`);
    } else {
      console.log('Ratio fields exist but values are null/undefined');
    }
  } else {
    console.log('No direct Debt/EBITDA ratio available, attempting calculation');
    
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
      console.log(`Successfully calculated Debt/EBITDA: ${result.netDebtToEBITDA} using method: ${result.netDebtToEBITDAMethod}`);
    } else {
      console.log('Could not calculate Debt/EBITDA, keeping as null');
    }
  }
  
  return result;
}

module.exports = {
  calculateDebtToEBITDA,
  hasMinimumComponents,
  processFinancialData
};
