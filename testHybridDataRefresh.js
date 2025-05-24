/**
 * Test script to validate the hybrid data refresh implementation
 * Tests both Polygon.io and Yahoo Finance data sources
 */

const { connectDB } = require('./db/mongoose');
const { updateStockData } = require('./hybridDataRefresh');

// Sample stock for testing
const testStock = {
  symbol: 'AAPL',
  name: 'Apple Inc.',
  exchange: 'XNAS',
  sector: 'Technology',
  industry: 'Consumer Electronics',
  price: 0,
  marketCap: 0,
  avgDollarVolume: 0,
  netDebtToEBITDA: 0,
  evToEBIT: 0,
  rotce: 0,
  score: 0
};

/**
 * Main test function
 */
async function testHybridDataRefresh() {
  try {
    console.log('Testing hybrid data refresh implementation...');
    
    // Connect to MongoDB
    await connectDB();
    console.log('Connected to MongoDB');
    
    // Test updating a single stock
    console.log(`\nUpdating test stock: ${testStock.symbol}`);
    const updatedStock = await updateStockData(testStock);
    
    // Display updated stock data
    console.log('\n=== UPDATED STOCK DATA ===\n');
    console.log(JSON.stringify(updatedStock, null, 2));
    
    // Display data sources used
    console.log('\n=== DATA SOURCES USED ===\n');
    console.log(JSON.stringify(updatedStock.dataSource, null, 2));
    
    // Validate critical fields for filtering
    console.log('\n=== VALIDATION RESULTS ===\n');
    
    const validationResults = {
      price: {
        value: updatedStock.price,
        status: updatedStock.price > 0 ? 'VALID' : 'INVALID',
        source: updatedStock.dataSource.priceData
      },
      marketCap: {
        value: updatedStock.marketCap,
        status: updatedStock.marketCap > 0 ? 'VALID' : 'INVALID',
        source: updatedStock.dataSource.priceData
      },
      avgDollarVolume: {
        value: updatedStock.avgDollarVolume,
        status: updatedStock.avgDollarVolume > 0 ? 'VALID' : 'INVALID',
        source: updatedStock.dataSource.priceData
      },
      netDebtToEBITDA: {
        value: updatedStock.netDebtToEBITDA,
        status: updatedStock.netDebtToEBITDA !== undefined ? 'VALID' : 'INVALID',
        source: updatedStock.dataSource.financialRatios
      },
      evToEBIT: {
        value: updatedStock.evToEBIT,
        status: updatedStock.evToEBIT !== undefined ? 'VALID' : 'INVALID',
        source: updatedStock.dataSource.financialRatios
      },
      rotce: {
        value: updatedStock.rotce,
        status: updatedStock.rotce !== undefined ? 'VALID' : 'INVALID',
        source: updatedStock.dataSource.financialRatios
      },
      score: {
        value: updatedStock.score,
        status: updatedStock.score >= 0 ? 'VALID' : 'INVALID',
        source: 'calculated'
      }
    };
    
    console.log(JSON.stringify(validationResults, null, 2));
    
    // Overall validation result
    const allValid = Object.values(validationResults).every(result => result.status === 'VALID');
    console.log(`\nOverall validation: ${allValid ? 'PASSED' : 'FAILED'}`);
    
    console.log('\nHybrid data refresh test completed');
    
  } catch (error) {
    console.error('Error testing hybrid data refresh:', error);
  }
}

// Run the test
testHybridDataRefresh();
