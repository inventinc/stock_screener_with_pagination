/**
 * Test script to validate the integrated Polygon.io financials service
 */

const { connectDB } = require('./db/mongoose');
const { 
  fetchPolygonTickerDetails, 
  fetchPolygonLatestPrice,
  fetchPolygonFinancials,
  calculateFinancialRatios 
} = require('./polygonApiService');

// Sample stock for testing
const TEST_SYMBOL = 'AAPL';

/**
 * Main test function
 */
async function testPolygonFinancialsIntegration() {
  try {
    console.log('Testing Polygon.io financials integration...');
    
    // Fetch ticker details to get shares outstanding
    console.log(`\nFetching ticker details for ${TEST_SYMBOL}...`);
    const tickerDetails = await fetchPolygonTickerDetails(TEST_SYMBOL);
    console.log('Ticker details fetched successfully');
    
    // Fetch latest price data
    console.log(`\nFetching latest price data for ${TEST_SYMBOL}...`);
    const priceData = await fetchPolygonLatestPrice(TEST_SYMBOL);
    console.log('Price data fetched successfully');
    
    // Extract current price and shares outstanding
    const currentPrice = priceData?.lastTrade?.p || 0;
    const outstandingShares = tickerDetails?.weighted_shares_outstanding || 0;
    
    console.log(`\nCurrent price: $${currentPrice}`);
    console.log(`Outstanding shares: ${outstandingShares.toLocaleString()}`);
    
    // Fetch financial data
    console.log(`\nFetching financial data for ${TEST_SYMBOL}...`);
    const financialsData = await fetchPolygonFinancials(TEST_SYMBOL);
    
    if (!financialsData || financialsData.length === 0) {
      console.error('No financial data found');
      return;
    }
    
    console.log(`Financial data fetched successfully (${financialsData.length} records)`);
    
    // Calculate financial ratios
    console.log('\nCalculating financial ratios...');
    const ratios = calculateFinancialRatios(financialsData, currentPrice, outstandingShares);
    
    // Display results
    console.log('\n=== FINANCIAL RATIOS ===\n');
    console.log(JSON.stringify(ratios, null, 2));
    
    // Validate critical ratios
    console.log('\n=== VALIDATION RESULTS ===\n');
    
    const validationResults = {
      evToEBIT: {
        value: ratios.evToEBIT,
        status: ratios.evToEBIT !== null ? 'VALID' : 'MISSING',
        source: 'polygon-calculated'
      },
      netDebtToEBITDA: {
        value: ratios.netDebtToEBITDA,
        status: ratios.netDebtToEBITDA !== null ? 'VALID' : 'MISSING',
        source: 'polygon-calculated'
      },
      rotce: {
        value: ratios.rotce,
        status: ratios.rotce !== null ? 'VALID' : 'MISSING',
        source: 'polygon-calculated'
      }
    };
    
    console.log(JSON.stringify(validationResults, null, 2));
    
    // Overall validation result
    const allValid = Object.values(validationResults).every(result => result.status === 'VALID');
    console.log(`\nOverall validation: ${allValid ? 'PASSED' : 'PARTIAL'}`);
    
    if (!allValid) {
      console.log('\nNote: Some ratios could not be calculated from the available financial data.');
      console.log('The hybrid approach with Yahoo Finance fallback will be used for missing ratios.');
    }
    
    console.log('\nPolygon.io financials integration test completed');
    
  } catch (error) {
    console.error('Error testing Polygon.io financials integration:', error);
  }
}

// Run the test
testPolygonFinancialsIntegration();
