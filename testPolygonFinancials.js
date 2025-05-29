/**
 * Test script to validate the Polygon.io financials endpoint with specific parameters
 * Based on guidance from Polygon.io support
 */

const axios = require('axios');

// Configuration
const POLYGON_API_KEY = 'l2nLlcjoSEzsnnQGNZMSVDyo_spG1PKk';
const TEST_SYMBOL = 'AAPL';

/**
 * Test the financials endpoint with ticker parameter
 */
async function testFinancialsWithTicker() {
  try {
    console.log(`Testing financials endpoint with ticker=${TEST_SYMBOL}...`);
    
    const url = `https://api.polygon.io/vX/reference/financials?ticker=${TEST_SYMBOL}&apiKey=${POLYGON_API_KEY}`;
    console.log(`Request URL: ${url}`);
    
    const response = await axios.get(url);
    
    console.log('\n=== RESPONSE STATUS ===');
    console.log(`Status: ${response.status}`);
    console.log(`Status Text: ${response.statusText}`);
    
    console.log('\n=== RESPONSE HEADERS ===');
    console.log(JSON.stringify(response.headers, null, 2));
    
    console.log('\n=== RESPONSE DATA (SAMPLE) ===');
    // Only show a portion of the data to avoid overwhelming the console
    const results = response.data.results || [];
    console.log(`Total Results: ${results.length}`);
    
    if (results.length > 0) {
      console.log('\nFirst Result Sample:');
      
      // Extract and display key financial metrics
      const firstResult = results[0];
      const financialData = {
        ticker: firstResult.ticker,
        period: firstResult.period,
        calendarDate: firstResult.calendar_date,
        filingDate: firstResult.filing_date,
        
        // Financial ratios (if available)
        ratios: {
          evToEbit: firstResult.ratios?.ev_to_ebit,
          netDebtToEbitda: firstResult.ratios?.net_debt_to_ebitda,
          returnOnTangibleCapital: firstResult.ratios?.return_on_tangible_capital
        },
        
        // Income statement highlights
        incomeStatement: {
          revenue: firstResult.financials?.income_statement?.revenues?.value,
          netIncome: firstResult.financials?.income_statement?.net_income_loss?.value,
          ebit: firstResult.financials?.income_statement?.operating_income_loss?.value
        },
        
        // Balance sheet highlights
        balanceSheet: {
          totalAssets: firstResult.financials?.balance_sheet?.assets?.value,
          totalLiabilities: firstResult.financials?.balance_sheet?.liabilities?.value,
          totalEquity: firstResult.financials?.balance_sheet?.equity?.value
        }
      };
      
      console.log(JSON.stringify(financialData, null, 2));
    }
    
    console.log('\nTest completed successfully!');
    return true;
  } catch (error) {
    console.error('\n=== ERROR ===');
    console.error(`Status: ${error.response?.status}`);
    console.error(`Message: ${error.message}`);
    
    if (error.response?.data) {
      console.error('\nError Response Data:');
      console.error(JSON.stringify(error.response.data, null, 2));
    }
    
    console.error('\nTest failed.');
    return false;
  }
}

/**
 * Main test function
 */
async function runTests() {
  console.log('=== TESTING POLYGON.IO FINANCIALS ENDPOINT ===\n');
  
  const tickerTestResult = await testFinancialsWithTicker();
  
  console.log('\n=== TEST SUMMARY ===');
  console.log(`Financials with ticker parameter: ${tickerTestResult ? 'SUCCESS' : 'FAILED'}`);
  
  if (tickerTestResult) {
    console.log('\nGood news! The financials endpoint is accessible with your API key.');
    console.log('You can now use this endpoint directly instead of relying on Yahoo Finance fallback.');
  } else {
    console.log('\nThe financials endpoint test failed.');
    console.log('You may need to continue using the Yahoo Finance fallback for financial ratios.');
  }
}

// Run the tests
runTests();
