/**
 * Script to populate MongoDB database with stock data from Polygon.io API
 */

const mongoose = require('mongoose');
const StockModel = require('./db/models/Stock');
const { connectDB } = require('./db/mongoose');
const polygonApiService = require('./polygonApiService');
const fetchAllTickers = require('./fetchAllTickers');
require('dotenv').config();

// Constants
const POLYGON_API_KEY = process.env.POLYGON_API_KEY || 'l2nLlcjoSEzsnnQGNZMSVDyo_spG1PKk';
const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 3000;
const MAX_STOCKS = 2000;

/**
 * Process stocks in batches with delay
 * @param {Array<Object>} tickers - Array of ticker objects
 */
async function processBatchesWithDelay(tickers) {
  try {
    const totalBatches = Math.ceil(tickers.length / BATCH_SIZE);
    console.log(`Processing ${tickers.length} tickers in ${totalBatches} batches...`);
    
    for (let i = 0; i < tickers.length; i += BATCH_SIZE) {
      const batch = tickers.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      
      console.log(`Processing batch ${batchNumber}/${totalBatches}...`);
      
      // Process batch in parallel
      await Promise.all(batch.map(ticker => processStock(ticker.ticker)));
      
      // Add delay between batches to avoid rate limits
      if (i + BATCH_SIZE < tickers.length) {
        console.log(`Waiting ${BATCH_DELAY_MS}ms before next batch...`);
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }
    
    console.log('All batches processed successfully');
  } catch (error) {
    console.error('Error processing batches:', error.message);
  }
}

/**
 * Process a single stock
 * @param {string} symbol - Stock symbol
 */
async function processStock(symbol) {
  try {
    console.log(`Processing ${symbol}...`);
    
    // Check if stock already exists in database
    const existingStock = await StockModel.findOne({ symbol });
    if (existingStock) {
      console.log(`${symbol} already exists in database, skipping`);
      return;
    }
    
    // Fetch ticker details
    const tickerDetails = await polygonApiService.fetchPolygonTickerDetails(symbol);
    
    // Fetch latest price data
    const priceData = await polygonApiService.fetchPolygonLatestPrice(symbol);
    
    // Fetch financial data
    const financialsData = await polygonApiService.fetchPolygonFinancials(symbol);
    
    // Extract current price and shares outstanding
    const currentPrice = priceData?.lastTrade?.p || 0;
    const outstandingShares = tickerDetails?.weighted_shares_outstanding || 0;
    
    // Calculate financial ratios
    const ratios = polygonApiService.calculateFinancialRatios(financialsData, currentPrice, outstandingShares);
    
    // Prepare stock data
    const stockData = {
      symbol: symbol,
      name: tickerDetails?.name || '',
      exchange: tickerDetails?.primary_exchange || '',
      sector: tickerDetails?.sic_description || '',
      industry: tickerDetails?.standard_industrial_classification?.industry_title || '',
      price: currentPrice,
      marketCap: currentPrice * outstandingShares,
      avgDollarVolume: currentPrice * (priceData?.day?.v || 0),
      netDebtToEBITDA: ratios?.netDebtToEBITDA || 0,
      evToEBIT: ratios?.evToEBIT || 0,
      rotce: ratios?.rotce || 0,
      lastUpdated: new Date(),
      dataSource: {
        tickerDetails: 'polygon',
        priceData: 'polygon',
        financialRatios: 'polygon-calculated'
      }
    };
    
    // Calculate score
    const score = calculateScore(stockData);
    stockData.score = score;
    
    // Save to database
    const newStock = new StockModel(stockData);
    await newStock.save();
    
    console.log(`${symbol} processed and saved successfully`);
  } catch (error) {
    console.error(`Error processing ${symbol}:`, error.message);
  }
}

/**
 * Calculate stock score based on financial metrics
 * @param {Object} stock - Stock data
 * @returns {number} Score value
 */
function calculateScore(stock) {
  try {
    // Extract metrics
    const { netDebtToEBITDA, evToEBIT, rotce } = stock;
    
    // Calculate individual scores
    let debtScore = 0;
    let valuationScore = 0;
    let returnsScore = 0;
    
    // Debt score (lower is better)
    if (netDebtToEBITDA <= 0) {
      debtScore = 33.33; // No debt is best
    } else if (netDebtToEBITDA <= 1) {
      debtScore = 30;
    } else if (netDebtToEBITDA <= 2) {
      debtScore = 25;
    } else if (netDebtToEBITDA <= 3) {
      debtScore = 20;
    } else if (netDebtToEBITDA <= 4) {
      debtScore = 15;
    } else {
      debtScore = 10;
    }
    
    // Valuation score (lower is better)
    if (evToEBIT <= 5) {
      valuationScore = 33.33;
    } else if (evToEBIT <= 10) {
      valuationScore = 30;
    } else if (evToEBIT <= 15) {
      valuationScore = 25;
    } else if (evToEBIT <= 20) {
      valuationScore = 20;
    } else if (evToEBIT <= 25) {
      valuationScore = 15;
    } else {
      valuationScore = 10;
    }
    
    // Returns score (higher is better)
    if (rotce >= 0.4) {
      returnsScore = 33.33;
    } else if (rotce >= 0.3) {
      returnsScore = 30;
    } else if (rotce >= 0.2) {
      returnsScore = 25;
    } else if (rotce >= 0.15) {
      returnsScore = 20;
    } else if (rotce >= 0.1) {
      returnsScore = 15;
    } else {
      returnsScore = 10;
    }
    
    // Calculate total score
    const totalScore = debtScore + valuationScore + returnsScore;
    return totalScore;
  } catch (error) {
    console.error('Error calculating score:', error.message);
    return 0;
  }
}

/**
 * Main function to populate database with stock data
 */
async function populateDatabase() {
  try {
    console.log('Starting database population...');
    
    // Connect to MongoDB
    await connectDB();
    
    // Fetch all tickers (excluding ETFs)
    const tickers = await fetchAllTickers();
    
    if (tickers.length === 0) {
      console.error('No tickers found, aborting');
      process.exit(1);
    }
    
    console.log(`Found ${tickers.length} equity tickers (excluding ETFs)`);
    
    // Process tickers in batches
    await processBatchesWithDelay(tickers);
    
    console.log('Database population completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error populating database:', error.message);
    process.exit(1);
  }
}

// Run the population script
populateDatabase();
