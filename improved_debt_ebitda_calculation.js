/**
 * Improved Debt/EBITDA Calculation Logic
 * 
 * This file contains the improved calculation logic for the Debt/EBITDA ratio
 * to fix the display issue in the stock screener application.
 * 
 * Problem: The Debt/EBITDA value isn't showing up because the current logic
 * only calculates it when both debt and ebitda exist and are non-zero.
 * When either is missing or zero, the frontend displays "N/A".
 * 
 * Solution: This improved version handles edge cases more gracefully by:
 * 1. Using null instead of 0 as the default value to distinguish missing data
 * 2. Explicitly handling division by zero cases
 * 3. Providing clear documentation of the logic
 */

/**
 * Calculate Net Debt to EBITDA ratio with improved edge case handling
 * @param {Object} financials - Financial data object containing debt and ebitda
 * @returns {Number|null} - Calculated ratio or null if data is insufficient
 */
function calculateNetDebtToEBITDA(financials) {
  // Early return if financials object is missing
  if (!financials) {
    console.log('Missing financials object for Debt/EBITDA calculation');
    return null;
  }

  const { debt, ebitda } = financials;
  
  // Initialize as null to distinguish from calculated zero values
  let netDebtToEBITDA = null;

  // Check if both values exist (not undefined and not null)
  if (debt !== undefined && debt !== null && ebitda !== undefined && ebitda !== null) {
    // Handle division by zero
    if (ebitda === 0) {
      // If there's debt but no EBITDA, this indicates high leverage
      netDebtToEBITDA = debt > 0 ? Infinity : 0;
      console.log(`Division by zero in Debt/EBITDA calculation: debt=${debt}, ebitda=${ebitda}, result=${netDebtToEBITDA}`);
    } else {
      // Normal calculation
      netDebtToEBITDA = debt / ebitda;
    }
  } else {
    // Log missing data for debugging
    console.log(`Missing data for Debt/EBITDA calculation: debt=${debt}, ebitda=${ebitda}`);
  }

  return netDebtToEBITDA;
}

/**
 * Implementation example for server.js
 * Replace the existing Debt/EBITDA calculation with this improved version
 */

// Original code in server.js:
// let netDebtToEBITDA = 0;
// if (fin.debt && fin.ebitda) {
//   netDebtToEBITDA = fin.debt / fin.ebitda;
// }

// Improved code:
let netDebtToEBITDA = null; // Change default from 0 to null

if (fin.debt !== undefined && fin.debt !== null && 
    fin.ebitda !== undefined && fin.ebitda !== null) {
  if (fin.ebitda === 0) {
    // Handle division by zero
    netDebtToEBITDA = fin.debt > 0 ? Infinity : 0;
  } else {
    netDebtToEBITDA = fin.debt / fin.ebitda;
  }
}

/**
 * Frontend rendering code example
 * Update the frontend rendering to handle the improved backend values
 */

// Original frontend code:
// cell.textContent = value ? value.toFixed(2) + 'x' : 'N/A';

// Improved frontend code:
if (value === null || value === undefined) {
  cell.textContent = 'N/A';
} else if (value === 0) {
  cell.textContent = '0.00x';
} else if (!isFinite(value)) {
  cell.textContent = 'High';
} else {
  cell.textContent = value.toFixed(2) + 'x';
}

/**
 * Installation Instructions:
 * 
 * 1. Replace the Debt/EBITDA calculation in server.js with the improved version above
 * 2. Update the frontend rendering code in your JavaScript files (like paginatedApp.js)
 * 3. Restart your server to apply the changes
 * 
 * Note: You may need to adjust the variable names to match your codebase.
 */

module.exports = { calculateNetDebtToEBITDA };
