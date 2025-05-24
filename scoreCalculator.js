/**
 * Score calculator module for stock screener
 * Calculates composite scores based on various financial metrics
 */

/**
 * Calculate composite score for a stock based on multiple metrics
 * @param {Object} stock - Stock object with financial metrics
 * @returns {number} - Composite score from 0-100
 */
function calculateScore(stock) {
  // Initialize score components
  const components = {
    valueScore: calculateValueScore(stock),
    qualityScore: calculateQualityScore(stock),
    growthScore: calculateGrowthScore(stock),
    financialHealthScore: calculateFinancialHealthScore(stock)
  };
  
  // Calculate weighted average
  const weights = {
    valueScore: 0.35,
    qualityScore: 0.30,
    growthScore: 0.20,
    financialHealthScore: 0.15
  };
  
  let totalWeight = 0;
  let weightedSum = 0;
  
  // Calculate weighted sum of available components
  Object.keys(components).forEach(component => {
    if (components[component] !== null) {
      weightedSum += components[component] * weights[component];
      totalWeight += weights[component];
    }
  });
  
  // Return normalized score if we have any components, otherwise null
  if (totalWeight > 0) {
    // Normalize to account for missing components
    return (weightedSum / totalWeight) * 100;
  }
  
  return null;
}

/**
 * Calculate value score based on valuation metrics
 * @param {Object} stock - Stock object with financial metrics
 * @returns {number} - Value score from 0-1
 */
function calculateValueScore(stock) {
  // Use available valuation metrics
  const metrics = [];
  
  // EV/EBIT score (lower is better)
  if (stock.evToEBIT !== null && stock.evToEBIT !== undefined) {
    // Score from 0-1, with 5x being ideal (1.0) and 25x being poor (0.2)
    const evToEBITScore = stock.evToEBIT <= 5 ? 1.0 : 
                         (stock.evToEBIT >= 25 ? 0.2 : 
                         (1.0 - ((stock.evToEBIT - 5) / 20) * 0.8));
    metrics.push(evToEBITScore);
  }
  
  // Price/Book score (lower is better)
  if (stock.priceToBook !== null && stock.priceToBook !== undefined) {
    // Score from 0-1, with 1x being ideal (1.0) and 5x being poor (0.2)
    const priceToBookScore = stock.priceToBook <= 1 ? 1.0 : 
                            (stock.priceToBook >= 5 ? 0.2 : 
                            (1.0 - ((stock.priceToBook - 1) / 4) * 0.8));
    metrics.push(priceToBookScore);
  }
  
  // Return average if we have any metrics, otherwise null
  if (metrics.length > 0) {
    return metrics.reduce((sum, score) => sum + score, 0) / metrics.length;
  }
  
  return null;
}

/**
 * Calculate quality score based on profitability metrics
 * @param {Object} stock - Stock object with financial metrics
 * @returns {number} - Quality score from 0-1
 */
function calculateQualityScore(stock) {
  // Use available quality metrics
  const metrics = [];
  
  // ROTCE score (higher is better)
  if (stock.rotce !== null && stock.rotce !== undefined) {
    // Score from 0-1, with 20% being ideal (1.0) and 5% being poor (0.2)
    const rotceScore = stock.rotce >= 20 ? 1.0 : 
                      (stock.rotce <= 5 ? 0.2 : 
                      (0.2 + ((stock.rotce - 5) / 15) * 0.8));
    metrics.push(rotceScore);
  }
  
  // FCF to Net Income score (higher is better)
  if (stock.fcfToNetIncome !== null && stock.fcfToNetIncome !== undefined) {
    // Score from 0-1, with 1.2 being ideal (1.0) and 0.5 being poor (0.2)
    const fcfToNetIncomeScore = stock.fcfToNetIncome >= 1.2 ? 1.0 : 
                               (stock.fcfToNetIncome <= 0.5 ? 0.2 : 
                               (0.2 + ((stock.fcfToNetIncome - 0.5) / 0.7) * 0.8));
    metrics.push(fcfToNetIncomeScore);
  }
  
  // Return average if we have any metrics, otherwise null
  if (metrics.length > 0) {
    return metrics.reduce((sum, score) => sum + score, 0) / metrics.length;
  }
  
  return null;
}

/**
 * Calculate growth score based on growth metrics
 * @param {Object} stock - Stock object with financial metrics
 * @returns {number} - Growth score from 0-1
 */
function calculateGrowthScore(stock) {
  // Use available growth metrics
  const metrics = [];
  
  // Revenue growth score (higher is better)
  if (stock.revenueGrowth !== null && stock.revenueGrowth !== undefined) {
    // Score from 0-1, with 20% being ideal (1.0) and 0% being poor (0.2)
    const revenueGrowthScore = stock.revenueGrowth >= 20 ? 1.0 : 
                              (stock.revenueGrowth <= 0 ? 0.2 : 
                              (0.2 + (stock.revenueGrowth / 20) * 0.8));
    metrics.push(revenueGrowthScore);
  }
  
  // Share count growth score (lower is better)
  if (stock.shareCountGrowth !== null && stock.shareCountGrowth !== undefined) {
    // Score from 0-1, with -5% being ideal (1.0) and 10% being poor (0.2)
    const shareCountGrowthScore = stock.shareCountGrowth <= -5 ? 1.0 : 
                                 (stock.shareCountGrowth >= 10 ? 0.2 : 
                                 (1.0 - ((stock.shareCountGrowth + 5) / 15) * 0.8));
    metrics.push(shareCountGrowthScore);
  }
  
  // Return average if we have any metrics, otherwise null
  if (metrics.length > 0) {
    return metrics.reduce((sum, score) => sum + score, 0) / metrics.length;
  }
  
  return null;
}

/**
 * Calculate financial health score based on balance sheet metrics
 * @param {Object} stock - Stock object with financial metrics
 * @returns {number} - Financial health score from 0-1
 */
function calculateFinancialHealthScore(stock) {
  // Use available financial health metrics
  const metrics = [];
  
  // Net Debt to EBITDA score (lower is better)
  if (stock.netDebtToEBITDA !== null && stock.netDebtToEBITDA !== undefined) {
    // Score from 0-1, with 0 being ideal (1.0) and 4 being poor (0.2)
    const netDebtToEBITDAScore = stock.netDebtToEBITDA <= 0 ? 1.0 : 
                                (stock.netDebtToEBITDA >= 4 ? 0.2 : 
                                (1.0 - (stock.netDebtToEBITDA / 4) * 0.8));
    metrics.push(netDebtToEBITDAScore);
  }
  
  // Return average if we have any metrics, otherwise null
  if (metrics.length > 0) {
    return metrics.reduce((sum, score) => sum + score, 0) / metrics.length;
  }
  
  return null;
}

module.exports = {
  calculateScore
};
