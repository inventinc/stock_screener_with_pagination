/**
 * Test script to validate MongoDB in-memory server setup
 * This script tests the connection to the in-memory MongoDB server
 * and validates that we can perform basic CRUD operations
 */

const { connectDB, mongoose } = require('./db/mongoose');
const Stock = require('./db/models/Stock');
const stocksDAO = require('./db/stocksDAO');

async function testMongoDBConnection() {
  try {
    console.log('Testing MongoDB in-memory server connection...');
    
    // Connect to MongoDB
    await connectDB();
    
    // Test creating a stock
    console.log('Testing stock creation...');
    const testStock = {
      symbol: 'TEST',
      name: 'Test Stock',
      exchange: 'XNAS',
      sector: 'Technology',
      industry: 'Software',
      price: 100.00,
      marketCap: 1000000000,
      avgDollarVolume: 5000000,
      netDebtToEBITDA: 1.5,
      evToEBIT: 15.0,
      rotce: 0.25,
      score: 80
    };
    
    const createdStock = await stocksDAO.createOrUpdateStock(testStock);
    console.log('Stock created successfully:', createdStock.symbol);
    
    // Test retrieving stocks
    console.log('Testing stock retrieval...');
    const stocks = await stocksDAO.getStocks();
    console.log(`Retrieved ${stocks.length} stocks`);
    
    // Test retrieving stock by symbol
    console.log('Testing stock retrieval by symbol...');
    const retrievedStock = await stocksDAO.getStockBySymbol('TEST');
    console.log('Stock retrieved by symbol:', retrievedStock.symbol);
    
    // Test updating stock
    console.log('Testing stock update...');
    testStock.price = 110.00;
    const updatedStock = await stocksDAO.createOrUpdateStock(testStock);
    console.log('Stock updated successfully:', updatedStock.price);
    
    // Test getting stock stats
    console.log('Testing stock stats...');
    const stats = await stocksDAO.getStockStats();
    console.log('Stock stats:', stats);
    
    // Test deleting stock
    console.log('Testing stock deletion...');
    await stocksDAO.deleteStock('TEST');
    const deletedStock = await stocksDAO.getStockBySymbol('TEST');
    console.log('Stock deleted successfully:', deletedStock === null);
    
    console.log('\nAll MongoDB tests passed successfully!');
    
    // Close connection
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
    
    return true;
  } catch (error) {
    console.error('MongoDB test failed:', error);
    
    // Try to close connection if it exists
    if (mongoose.connection) {
      await mongoose.connection.close();
      console.log('MongoDB connection closed');
    }
    
    return false;
  }
}

// Run test if script is executed directly
if (require.main === module) {
  testMongoDBConnection()
    .then(success => {
      if (success) {
        console.log('MongoDB in-memory server is working correctly');
        process.exit(0);
      } else {
        console.error('MongoDB in-memory server test failed');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('Unhandled error during MongoDB test:', error);
      process.exit(1);
    });
} else {
  // Export for use in other modules
  module.exports = { testMongoDBConnection };
}
