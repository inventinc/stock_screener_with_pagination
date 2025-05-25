/**
 * Test Script for ROTCE and Cash Conversion Ratio Calculation
 * 
 * This script tests the financial metrics calculator and enhanced FMP import
 * to ensure they correctly calculate and store ROTCE and Cash Conversion Ratio.
 */

const mongoose = require('mongoose');
const { connectDB } = require('./db/mongoose');
const Stock = require('./db/models/Stock');
const financialMetricsCalculator = require('./financial_metrics_calculator');
const enhancedFmpImport = require('./enhanced_fmp_import');

// Test symbols to validate
const TEST_SYMBOLS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META'];

/**
 * Test financial metrics calculation with sample data
 */
async function testCalculation() {
  console.log('Testing financial metrics calculation...');
  
  // Sample financial data
  const sampleData = {
    incomeStatement: [
      { netIncome: 100000000 },
      { netIncome: 90000000 },
      { netIncome: 80000000 },
      { netIncome: 70000000 },
      { netIncome: 60000000 }
    ],
    balanceSheet: [
      { 
        totalStockholdersEquity: 500000000,
        intangibleAssets: 100000000
      }
    ],
    cashFlowStatement: [
      { freeCashFlow: 90000000 },
      { freeCashFlow: 85000000 },
      { freeCashFlow: 75000000 },
      { freeCashFlow: 65000000 },
      { freeCashFlow: 55000000 }
    ]
  };
  
  // Calculate metrics
  const metrics = financialMetricsCalculator.calculateFinancialMetrics(sampleData);
  
  // Validate ROTCE calculation
  console.log('ROTCE Calculation:');
  console.log('- Value:', metrics.rotce.value);
  console.log('- Has All Components:', metrics.rotce.hasAllComponents);
  console.log('- Components:', JSON.stringify(metrics.rotce.components, null, 2));
  
  // Expected ROTCE = 100000000 / (500000000 - 100000000) = 0.25
  const expectedROTCE = 0.25;
  const rotceAccuracy = Math.abs(metrics.rotce.value - expectedROTCE) < 0.001;
  console.log('- Calculation Accurate:', rotceAccuracy);
  
  // Validate Cash Conversion calculation
  console.log('\nCash Conversion Calculation:');
  console.log('- Value:', metrics.cashConversion.value);
  console.log('- Has All Components:', metrics.cashConversion.hasAllComponents);
  console.log('- Years Available:', metrics.cashConversion.components.yearsAvailable);
  
  // Expected Cash Conversion = (90+85+75+65+55)/(100+90+80+70+60) = 370/400 = 0.925
  const expectedCashConversion = 0.925;
  const ccAccuracy = Math.abs(metrics.cashConversion.value - expectedCashConversion) < 0.001;
  console.log('- Calculation Accurate:', ccAccuracy);
  
  return rotceAccuracy && ccAccuracy;
}

/**
 * Test data fetching from FMP API
 */
async function testDataFetching() {
  console.log('\nTesting data fetching from FMP API...');
  
  // Test with Apple
  const symbol = 'AAPL';
  console.log(`Fetching comprehensive data for ${symbol}...`);
  
  const financialData = await enhancedFmpImport.fetchComprehensiveFinancialData(symbol);
  
  if (!financialData) {
    console.error('Failed to fetch financial data');
    return false;
  }
  
  // Check if we have the necessary data for calculations
  const hasIncomeStatement = financialData.incomeStatement && financialData.incomeStatement.length > 0;
  const hasBalanceSheet = financialData.balanceSheet && financialData.balanceSheet.length > 0;
  const hasCashFlowStatement = financialData.cashFlowStatement && financialData.cashFlowStatement.length > 0;
  
  console.log('Data Availability:');
  console.log('- Income Statement:', hasIncomeStatement);
  console.log('- Balance Sheet:', hasBalanceSheet);
  console.log('- Cash Flow Statement:', hasCashFlowStatement);
  
  // Calculate metrics with real data
  const metrics = financialMetricsCalculator.calculateFinancialMetrics(financialData);
  
  console.log('\nCalculated Metrics with Real Data:');
  console.log('- ROTCE:', metrics.rotce.value);
  console.log('- ROTCE Has All Components:', metrics.rotce.hasAllComponents);
  console.log('- Cash Conversion:', metrics.cashConversion.value);
  console.log('- Cash Conversion Years:', metrics.cashConversion.components.yearsAvailable);
  
  return hasIncomeStatement && hasBalanceSheet && hasCashFlowStatement;
}

/**
 * Test stock processing and database storage
 */
async function testProcessingAndStorage() {
  console.log('\nTesting stock processing and database storage...');
  
  try {
    // Connect to database
    await connectDB();
    
    // Process a test stock
    const symbol = 'AAPL';
    console.log(`Processing ${symbol}...`);
    
    const stockData = await enhancedFmpImport.processStock({ symbol });
    
    if (!stockData) {
      console.error('Failed to process stock');
      return false;
    }
    
    console.log('Processed Stock Data:');
    console.log('- Symbol:', stockData.symbol);
    console.log('- ROTCE:', stockData.rotce);
    console.log('- ROTCE Has All Components:', stockData.rotceHasAllComponents);
    console.log('- Cash Conversion:', stockData.cashConversion);
    console.log('- Cash Conversion Years:', stockData.cashConversionYears);
    
    // Save to database
    console.log('\nSaving to database...');
    
    const stock = await Stock.findOneAndUpdate(
      { symbol: stockData.symbol },
      stockData,
      { upsert: true, new: true }
    );
    
    console.log('Saved Stock:');
    console.log('- ID:', stock._id);
    console.log('- Symbol:', stock.symbol);
    console.log('- ROTCE:', stock.rotce);
    console.log('- Cash Conversion:', stock.cashConversion);
    
    // Verify we can query by ROTCE
    console.log('\nTesting ROTCE query...');
    
    if (stock.rotce) {
      const minROTCE = stock.rotce * 0.5; // 50% of the value
      const maxROTCE = stock.rotce * 1.5; // 150% of the value
      
      const rotceQuery = await Stock.find({
        rotce: { $gte: minROTCE, $lte: maxROTCE }
      }).limit(5);
      
      console.log(`Found ${rotceQuery.length} stocks with ROTCE between ${minROTCE} and ${maxROTCE}`);
      
      // Verify we can query by Cash Conversion
      console.log('\nTesting Cash Conversion query...');
      
      if (stock.cashConversion) {
        const minCC = stock.cashConversion * 0.5; // 50% of the value
        const maxCC = stock.cashConversion * 1.5; // 150% of the value
        
        const ccQuery = await Stock.find({
          cashConversion: { $gte: minCC, $lte: maxCC }
        }).limit(5);
        
        console.log(`Found ${ccQuery.length} stocks with Cash Conversion between ${minCC} and ${maxCC}`);
      }
    }
    
    // Disconnect from database
    await mongoose.disconnect();
    
    return true;
  } catch (error) {
    console.error('Error in processing and storage test:', error.message);
    
    // Ensure database connection is closed
    try {
      await mongoose.disconnect();
    } catch (err) {
      console.error('Error disconnecting from database:', err.message);
    }
    
    return false;
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('Starting validation tests for ROTCE and Cash Conversion Ratio...');
  
  // Test calculation logic
  const calculationValid = await testCalculation();
  console.log('\nCalculation Logic Valid:', calculationValid);
  
  // Test data fetching
  const dataFetchingValid = await testDataFetching();
  console.log('\nData Fetching Valid:', dataFetchingValid);
  
  // Test processing and storage
  const processingValid = await testProcessingAndStorage();
  console.log('\nProcessing and Storage Valid:', processingValid);
  
  // Overall validation result
  const overallValid = calculationValid && dataFetchingValid && processingValid;
  console.log('\nOverall Validation Result:', overallValid ? 'PASSED' : 'FAILED');
  
  return overallValid;
}

// Run tests if called directly
if (require.main === module) {
  runTests()
    .then(result => {
      console.log('Validation complete with result:', result);
      process.exit(result ? 0 : 1);
    })
    .catch(error => {
      console.error('Validation failed with error:', error);
      process.exit(1);
    });
}

module.exports = { runTests };
