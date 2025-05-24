/**
 * Optimized script to import all stocks (target: 5,700) into MongoDB
 * Uses parallel processing, batching, and rate limiting for maximum efficiency
 */
require('dotenv').config();
const axios = require('axios');
const mongoose = require('mongoose');
const { connectDB } = require('./db/mongoose');
const Stock = require('./db/models/Stock');
const pLimit = require('p-limit');

// Configuration
const POLYGON_API_KEY = process.env.POLYGON_API_KEY;
const BATCH_SIZE = 50; // Process 50 tickers at once
const CONCURRENT_REQUESTS = 5; // 5 concurrent API requests
const RATE_LIMIT_DELAY = 200; // 200ms delay between API calls to avoid rate limiting

// Initialize rate limiter
const limit = pLimit(CONCURRENT_REQUESTS);

// Connect to MongoDB
async function main() {
  try {
    await connectDB();
    console.log('Connected to MongoDB');
    
    // Get current stock count
    const currentCount = await Stock.countDocuments();
    console.log(`Current stock count: ${currentCount}`);
    
    // Fetch all tickers
    console.log('Fetching all tickers...');
    const tickers = await fetchAllTickers();
    console.log(`Total tickers fetched: ${tickers.length}`);
    
    // Filter out ETFs and non-equities
    const filteredTickers = tickers.filter(ticker => 
      ticker.type === 'CS' && // Common Stock
      !ticker.name.includes('ETF') &&
      !ticker.name.includes('Fund') &&
      !ticker.name.includes('Trust') &&
      ticker.market === 'stocks' &&
      (ticker.primary_exchange === 'XNYS' || ticker.primary_exchange === 'XNAS') // NYSE or NASDAQ
    );
    
    console.log(`Filtered tickers (excluding ETFs): ${filteredTickers.length}`);
    
    // Process tickers in batches
    const totalBatches = Math.ceil(filteredTickers.length / BATCH_SIZE);
    console.log(`Processing ${totalBatches} batches of ${BATCH_SIZE} tickers each`);
    
    let processedCount = 0;
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < filteredTickers.length; i += BATCH_SIZE) {
      const batch = filteredTickers.slice(i, i + BATCH_SIZE);
      console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${totalBatches}`);
      
      // Process batch in parallel with rate limiting
      const promises = batch.map(ticker => {
        return limit(async () => {
          try {
            await processStock(ticker);
            successCount++;
            return { success: true, ticker: ticker.ticker };
          } catch (error) {
            errorCount++;
            return { success: false, ticker: ticker.ticker, error: error.message };
          } finally {
            processedCount++;
            // Log progress every 10 stocks
            if (processedCount % 10 === 0) {
              const progress = ((processedCount / filteredTickers.length) * 100).toFixed(2);
              console.log(`Progress: ${processedCount}/${filteredTickers.length} (${progress}%)`);
              console.log(`Success: ${successCount}, Errors: ${errorCount}`);
            }
          }
        });
      });
      
      const results = await Promise.all(promises);
      const errors = results.filter(r => !r.success);
      
      if (errors.length > 0) {
        console.log(`Batch had ${errors.length} errors`);
      }
      
      // Add a small delay between batches to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Final report
    const finalCount = await Stock.countDocuments();
    console.log('\n--- Import Complete ---');
    console.log(`Initial count: ${currentCount}`);
    console.log(`Final count: ${finalCount}`);
    console.log(`Added: ${finalCount - currentCount}`);
    console.log(`Success: ${successCount}, Errors: ${errorCount}`);
    
    console.log('Done!');
  } catch (error) {
    console.error('Error in main process:', error);
  } finally {
    // Keep the connection open for the server to use
    // mongoose.connection.close();
  }
}

/**
 * Fetch all stock tickers from Polygon.io
 */
async function fetchAllTickers() {
  let allTickers = [];
  let hasMorePages = true;
  let nextUrl = `https://api.polygon.io/v3/reference/tickers?market=stocks&active=true&limit=1000&apiKey=${POLYGON_API_KEY}`;
  
  while (hasMorePages) {
    try {
      console.log(`Fetching tickers page: ${allTickers.length / 1000 + 1}`);
      const response = await axios.get(nextUrl);
      const { results, next_url } = response.data;
      
      if (results && results.length > 0) {
        allTickers = [...allTickers, ...results];
        console.log(`Fetched ${results.length} tickers, total: ${allTickers.length}`);
      }
      
      if (next_url) {
        nextUrl = `${next_url}&apiKey=${POLYGON_API_KEY}`;
      } else {
        hasMorePages = false;
      }
      
      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
    } catch (error) {
      console.error('Error fetching tickers:', error.message);
      hasMorePages = false;
    }
  }
  
  return allTickers;
}

/**
 * Process a single stock: fetch details, financials, and save to database
 */
async function processStock(ticker) {
  try {
    // Check if stock already exists
    const existingStock = await Stock.findOne({ symbol: ticker.ticker });
    if (existingStock) {
      // Skip if already in database
      return existingStock;
    }
    
    // Fetch stock details
    const details = await fetchStockDetails(ticker.ticker);
    
    // Create stock object with essential fields
    const stockData = {
      symbol: ticker.ticker,
      name: ticker.name,
      exchange: ticker.primary_exchange,
      type: ticker.type,
      currency: ticker.currency_name,
      price: details.price || 0,
      marketCap: details.marketCap || 0,
      netDebtToEBITDA: details.netDebtToEBITDA || 0,
      evToEBIT: details.evToEBIT || 0,
      rotce: details.rotce || 0,
      score: calculateScore(details),
      lastUpdated: new Date()
    };
    
    // Save to database
    const stock = new Stock(stockData);
    await stock.save();
    
    // Add delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
    
    return stock;
  } catch (error) {
    console.error(`Error processing stock ${ticker.ticker}:`, error.message);
    throw error;
  }
}

/**
 * Fetch stock details from Polygon.io
 */
async function fetchStockDetails(symbol) {
  try {
    // Fetch current price
    const priceResponse = await axios.get(
      `https://api.polygon.io/v2/aggs/ticker/${symbol}/prev?apiKey=${POLYGON_API_KEY}`
    );
    
    // Fetch financials
    const financialsResponse = await axios.get(
      `https://api.polygon.io/vX/reference/financials?ticker=${symbol}&apiKey=${POLYGON_API_KEY}`
    );
    
    // Extract price data
    let price = 0;
    let marketCap = 0;
    
    if (priceResponse.data.results && priceResponse.data.results.length > 0) {
      price = priceResponse.data.results[0].c; // Closing price
    }
    
    // Extract financial data
    let netDebtToEBITDA = 0;
    let evToEBIT = 0;
    let rotce = 0;
    
    if (financialsResponse.data.results && financialsResponse.data.results.length > 0) {
      const financials = financialsResponse.data.results[0];
      
      // Calculate market cap
      if (financials.shares_outstanding && price) {
        marketCap = financials.shares_outstanding * price;
      }
      
      // Extract other metrics if available
      if (financials.financials) {
        const fin = financials.financials;
        
        // Net Debt to EBITDA
        if (fin.debt && fin.ebitda) {
          netDebtToEBITDA = fin.debt / fin.ebitda;
        }
        
        // EV to EBIT
        if (fin.enterprise_value && fin.ebit) {
          evToEBIT = fin.enterprise_value / fin.ebit;
        }
        
        // Return on Tangible Capital Employed
        if (fin.net_income && fin.tangible_assets) {
          rotce = fin.net_income / fin.tangible_assets;
        }
      }
    }
    
    return {
      price,
      marketCap,
      netDebtToEBITDA,
      evToEBIT,
      rotce
    };
  } catch (error) {
    console.error(`Error fetching details for ${symbol}:`, error.message);
    // Return default values on error
    return {
      price: 0,
      marketCap: 0,
      netDebtToEBITDA: 0,
      evToEBIT: 0,
      rotce: 0
    };
  }
}

/**
 * Calculate quality score based on financial metrics
 */
function calculateScore(details) {
  let score = 0;
  
  // Market cap score (0-20)
  if (details.marketCap > 10000000000) score += 20; // $10B+
  else if (details.marketCap > 2000000000) score += 15; // $2B+
  else if (details.marketCap > 300000000) score += 10; // $300M+
  else score += 5;
  
  // Debt score (0-20)
  if (details.netDebtToEBITDA < 1) score += 20;
  else if (details.netDebtToEBITDA < 2) score += 15;
  else if (details.netDebtToEBITDA < 3) score += 10;
  else score += 5;
  
  // Valuation score (0-20)
  if (details.evToEBIT > 0 && details.evToEBIT < 10) score += 20;
  else if (details.evToEBIT > 0 && details.evToEBIT < 15) score += 15;
  else if (details.evToEBIT > 0 && details.evToEBIT < 20) score += 10;
  else score += 5;
  
  // Profitability score (0-20)
  if (details.rotce > 0.2) score += 20;
  else if (details.rotce > 0.15) score += 15;
  else if (details.rotce > 0.1) score += 10;
  else score += 5;
  
  // Add random factor (0-20) for demonstration
  score += Math.floor(Math.random() * 20);
  
  return score;
}

// Run the script
main().catch(console.error);
