const axios = require('axios');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
// p-queue v6 exposes the constructor on the default export
const PQueue = require('p-queue').default;

dotenv.config();

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI;

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000 // Keep trying to connect for 5s
})
.then(() => console.log('MongoDB connected for background job'))
.catch(err => console.error('MongoDB connection error for background job:', err));

// Mongoose Schema and Model (Paste your expanded schema here)
const stockSchema = new mongoose.Schema({
    // From /api/v3/profile/{symbol}
    symbol: { type: String, required: true, unique: true },
    companyName: { type: String },
    image: { type: String },
    website: { type: String },
    description: { type: String },
    sector: { type: String },
    industry: { type: String },
    ceo: { type: String },
    fullTimeEmployees: { type: Number },
    price: { type: Number }, // Can be updated by /quote later for real-time
    mktCap: { type: Number }, // Can be updated by /quote later for real-time
    volAvg: { type: Number }, // Can be updated by /quote later for real-time
    lastDiv: { type: Number },
    range: { type: String }, // e.g., "100 - 200"
    yearHigh: { type: Number }, // Derived from range or from /quote
    yearLow: { type: Number }, // Derived from range or from /quote

    // From /api/v3/quote/{symbol} - Data here can update/confirm profile data
    marketCap: { type: Number }, // Already in profile, kept for potential update frequency
    avgVolume: { type: Number }, // Already in profile, kept for potential update frequency
    yearHighQuote: { type: Number }, // Explicitly from quote if needed
    yearLowQuote: { type: Number }, // Explicitly from quote if needed
    peQuote: { type: Number }, // P/E from quote

    // From /api/v3/ratios-ttm/{symbol}
    priceEarningsRatioTTM: { type: Number },
    debtEquityRatioTTM: { type: Number },
    returnOnEquityTTM: { type: Number },
    returnOnTangibleEquityTTM: { type: Number },
    netIncomePerShareTTM: { type: Number },

    // From /api/v3/key-metrics-ttm/{symbol}
    debtToEbitdaTTM: { type: Number },
    enterpriseValueOverEBITDATTM: { type: Number },
    freeCashFlowPerShareTTM: { type: Number },

    // Timestamps for data freshness (Optional but recommended)

    // Calculated/Derived fields
    simpleScore: { type: Number },
    marketCapCategory: { type: String },
    volumeCategory: { type: String },
    debtCategory: { type: String }, // Corresponds to debtEquityRatioCategory
    valuationCategory: { type: String }, // Corresponds to peRatioCategory
    rotceCategory: { type: String }, // Corresponds to returnOnEquityTTM (ROE proxy for ROTCE)
    numericDebtEbitdaCategory: { type: String }, // e.g., 'le1x', 'le0.5x'
    numericFcfNiCategory: { type: String }, // e.g., 'ge1.2', 'ge1.0'

    // Formatted string fields
    debtEbitda: { type: String }, // Formatted debtToEbitdaTTM
    evEbit: { type: String }, // Formatted enterpriseValueOverEBITDATTM
    fcfNi: { type: String }, // Formatted FCF/NI ratio
    rotce: { type: String }, // Formatted returnOnEquityTTM (as percentage)
    lastUpdated: { type: Date, default: Date.now }
});

stockSchema.index({ symbol: 1 });

const Stock = mongoose.model('Stock', stockSchema);


const FMP_BASE_URL = process.env.FMP_BASE_URL;
const FMP_API_KEY = process.env.FMP_API_KEY;

// Configure p-queue for rate limiting (3000 calls/minute)
// 4 calls per stock * 10,000 stocks = 40,000 calls total
// 3000 calls / minute = 50 calls / second
// To handle 4 calls per stock, with 50 calls per second limit:
// Concurrency can be up to 50. Let's set it a bit lower to be safe, say 40.
// The interval is 1000ms (1 second). The intervalCap is the max number of jobs that can run within the interval.
// So, concurrency of 40 with intervalCap 40 and interval 1000ms means max 40 jobs per second.
const queue = new PQueue({ concurrency: 40, intervalCap: 40, interval: 1000 });

// Helper function to safely get a number or null
const safeNum = (val) => (typeof val === 'number' && !isNaN(val) ? val : null);

// Frontend Calculation Logic (Replicated from stockService.ts)

const calculateSimpleScore = (peRatioTTM, roeTTM) => {
    let score = 0;
    const peWeight = 40; // Max 40 points for PE
    const roeWeight = 60; // Max 60 points for ROE

    // ROE scoring (max 60 points)
    // ROE > 20% = 60 pts, 15-20% = 45 pts, 10-15% = 30pts, 5-10% = 15pts, <5% = 0 pts
    if (roeTTM !== null) {
        if (roeTTM > 0.20) score += roeWeight;
        else if (roeTTM > 0.15) score += roeWeight * 0.75; // 45
        else if (roeTTM > 0.10) score += roeWeight * 0.5; // 30
        else if (roeTTM > 0.05) score += roeWeight * 0.25; // 15
    }

    // P/E scoring (max 40 points for P/E > 0)
    // Lower P/E is better. PE < 10 = 40pts, 10-15 = 30pts, 15-20 = 20pts, 20-25 = 10pts, >25 = 0pts
    if (peRatioTTM !== null && peRatioTTM > 0) {
        if (peRatioTTM < 10) score += peWeight;
        else if (peRatioTTM < 15) score += peWeight * 0.75; // 30
        else if (peRatioTTM < 20) score += peWeight * 0.5; // 20
        else if (peRatioTTM < 25) score += peWeight * 0.25; // 10
    }
    return Math.round(Math.max(0, Math.min(100, score))); // Score is between 0 and 100
};

const getMarketCapCategory = (marketCap) => {
  if (marketCap === null || marketCap === undefined) return "N/A";
  if (marketCap >= 2000000000) return 'midLarge';
  if (marketCap >= 300000000) return 'small';
  if (marketCap >= 50000000) return 'micro';
  if (marketCap > 0) return 'nano';
  return "N/A";
};

const getVolumeCategory = (avgVolume) => {
  if (avgVolume === null || avgVolume === undefined) return "N/A";
  if (avgVolume >= 1000000) return 'high';
  if (avgVolume >= 100000) return 'medium';
  if (avgVolume > 0) return 'low';
  return "N/A";
};

const getDebtCategory = (debtEquityRatio) => {
  if (debtEquityRatio === null || debtEquityRatio === undefined) return "N/A";
  if (debtEquityRatio < 0.5) return 'low';
  if (debtEquityRatio <= 1.0) return 'medium';
  return 'high';
};

const getValuationCategory = (peRatio) => {
  if (peRatio === null || peRatio === undefined) return "N/A";
  if (peRatio < 15 && peRatio > 0) return 'value';
  if (peRatio > 25) return 'growth';
  if (peRatio >=15 && peRatio <=25) return 'blend';
  return "N/A";
};

const getRotceCategory = (roe) => {
  if (roe === null || roe === undefined) return "N/A";
  const roePercent = roe * 100;
  if (roePercent > 20) return 'excellent';
  if (roePercent >= 15) return 'good';
  if (roePercent >= 10) return 'average';
  return 'poor';
};

const NA_STRING = "N/A";
const formatNum = (val, decimals = 2, suffix = '') => {
    if (val === null || val === undefined || isNaN(val)) return NA_STRING;
    return val.toFixed(decimals) + suffix;
};

// Function to calculate numeric category strings
const getNumericDebtEbitdaCategory = (debtToEbitda) => {
    if (debtToEbitda === null) return '';
    if (debtToEbitda <= 0.25) return 'le0.25x';
    if (debtToEbitda <= 0.5) return 'le0.5x';
    if (debtToEbitda <= 1) return 'le1x';
    return '';
};

const getNumericFcfNiCategory = (fcfNiRatio) => {
    if (fcfNiRatio === null) return '';
    if (fcfNiRatio >= 1.2) return 'ge1.2';
    if (fcfNiRatio >= 1.0) return 'ge1.0';
    if (fcfNiRatio >= 0.8) return 'ge0.8';
    return '';
};

async function fetchAndSaveStocks() {
    console.log('Starting background stock data fetch...');

    try {
        // 1. Fetch list of tickers using the stock screener
        console.log('Fetching list of tickers...');
        const screenerUrl = `${FMP_BASE_URL}/api/v3/stock-screener?limit=10000&exchange=NASDAQ,NYSE,OTC&isActivelyTrading=true&apikey=${FMP_API_KEY}`;
        const screenerResponse = await axios.get(screenerUrl);

        if (!screenerResponse.data || screenerResponse.data.length === 0) {
            console.log('No tickers found from stock screener.');
            return;
        }

        const tickers = screenerResponse.data.map(stock => stock.symbol);
        console.log(`Fetched ${tickers.length} tickers. Adding tasks to queue...`);

        // 2. Add tasks to the queue to fetch detailed data and save to MongoDB
        for (const ticker of tickers) {
            queue.add(async () => {
                try {
                    console.log(`Processing ticker: ${ticker}`);
                    const profileUrl = `${FMP_BASE_URL}/api/v3/profile/${ticker}?apikey=${FMP_API_KEY}`;
                    const quoteUrl = `${FMP_BASE_URL}/api/v3/quote/${ticker}?apikey=${FMP_API_KEY}`;
                    const ratiosUrl = `${FMP_BASE_URL}/api/v3/ratios-ttm/${ticker}?apikey=${FMP_API_KEY}`;
                    const metricsUrl = `${FMP_BASE_URL}/api/v3/key-metrics-ttm/${ticker}?apikey=${FMP_API_KEY}`;

                    // Fetch data concurrently for the current ticker
                    const [profileRes, quoteRes, ratiosRes, metricsRes] = await Promise.allSettled([
                        axios.get(profileUrl),
                        axios.get(quoteUrl),
                        axios.get(ratiosUrl),
                        axios.get(metricsUrl)
                    ]);

                    const stockData = {
                        symbol: ticker,
                        lastUpdated: new Date() // Mark when this data was last updated
                    };

                    // Process results from each endpoint (handle rejections)
                    if (profileRes.status === 'fulfilled' && profileRes.value.data && profileRes.value.data.length > 0) {
                        const profile = profileRes.value.data[0];
                        stockData.companyName = profile.companyName;
                        stockData.image = profile.image;
                        stockData.website = profile.website;
                        stockData.description = profile.description;
                        stockData.sector = profile.sector;
                        stockData.industry = profile.industry;
                        stockData.ceo = profile.ceo;
                        stockData.fullTimeEmployees = profile.fullTimeEmployees;
                        stockData.price = profile.price;
                        stockData.mktCap = profile.mktCap;
                        stockData.volAvg = profile.volAvg;
                        stockData.lastDiv = profile.lastDiv;
                        stockData.range = profile.range;
                        // Attempt to derive yearHigh/Low from range if not in quote
                         if (profile.range) {
                            const [low, high] = profile.range.split(' - ').map(Number);
                            if (!isNaN(low)) stockData.yearLow = low;
                            if (!isNaN(high)) stockData.yearHigh = high;
                        }
                    } else if (profileRes.status === 'rejected') {
                        console.error(`Error fetching profile for ${ticker}: ${profileRes.reason.message}`);
                    }


                    if (quoteRes.status === 'fulfilled' && quoteRes.value.data && quoteRes.value.data.length > 0) {
                        const quote = quoteRes.value.data[0];
                        // Prioritize quote data for potentially more real-time values
                        stockData.price = quote.price;
                        stockData.marketCap = quote.marketCap; // Overwrites mktCap from profile if available
                        stockData.avgVolume = quote.avgVolume; // Overwrites volAvg from profile if available
                        stockData.yearHighQuote = quote.yearHigh;
                        stockData.yearLowQuote = quote.yearLow;
                        stockData.peQuote = quote.pe;

                        // Use quote's high/low if available
                        stockData.yearHigh = quote.yearHigh;
                        stockData.yearLow = quote.yearLow;

                    } else if (quoteRes.status === 'rejected') {
                        console.error(`Error fetching quote for ${ticker}: ${quoteRes.reason.message}`);
                    }


                    if (ratiosRes.status === 'fulfilled' && ratiosRes.value.data && ratiosRes.value.data.length > 0) {
                        const ratios = ratiosRes.value.data[0];
                        stockData.priceEarningsRatioTTM = ratios.priceEarningsRatioTTM;
                        stockData.debtEquityRatioTTM = ratios.debtEquityRatioTTM;
                        stockData.returnOnEquityTTM = ratios.returnOnEquityTTM;
                        stockData.returnOnTangibleEquityTTM = ratios.returnOnTangibleEquityTTM;
                        stockData.netIncomePerShareTTM = ratios.netIncomePerShareTTM;
                    } else if (ratiosRes.status === 'rejected') {
                        console.error(`Error fetching ratios for ${ticker}: ${ratiosRes.reason.message}`);
                    }


                    if (metricsRes.status === 'fulfilled' && metricsRes.value.data && metricsRes.value.data.length > 0) {
                        const metrics = metricsRes.value.data[0];
                        stockData.debtToEbitdaTTM = metrics.debtToEbitdaTTM;
                        stockData.enterpriseValueOverEBITDATTM = metrics.enterpriseValueOverEBITDATTM;
                        stockData.freeCashFlowPerShareTTM = metrics.freeCashFlowPerShareTTM;
                    } else if (metricsRes.status === 'rejected') {
                        console.error(`Error fetching metrics for ${ticker}: ${metricsRes.reason.message}`);
                    }

                    // Save or update in MongoDB
                    // Calculate derived fields before saving
                    const peRatioTTM = safeNum(stockData.priceEarningsRatioTTM);
                    const roeTTM = safeNum(stockData.returnOnEquityTTM);
                    const marketCap = safeNum(stockData.marketCap);
                    const avgVolume = safeNum(stockData.avgVolume);
                    const debtEquityRatioTTM = safeNum(stockData.debtEquityRatioTTM);
                    const debtToEbitdaTTM = safeNum(stockData.debtToEbitdaTTM);
                    const enterpriseValueOverEBITDATTM = safeNum(stockData.enterpriseValueOverEBITDATTM);
                    const freeCashFlowPerShareTTM = safeNum(stockData.freeCashFlowPerShareTTM);
                    const netIncomePerShareTTM = safeNum(stockData.netIncomePerShareTTM);
                    const lastDiv = safeNum(stockData.lastDiv);
                    const price = safeNum(stockData.price);
                    const yearHigh = safeNum(stockData.yearHigh); // Use the preferred yearHigh
                    const yearLow = safeNum(stockData.yearLow); // Use the preferred yearLow

                    stockData.simpleScore = calculateSimpleScore(peRatioTTM, roeTTM);
                    stockData.marketCapCategory = getMarketCapCategory(marketCap);
                    stockData.volumeCategory = getVolumeCategory(avgVolume);
                    stockData.debtCategory = getDebtCategory(debtEquityRatioTTM);
                    stockData.valuationCategory = getValuationCategory(peRatioTTM);
                    stockData.rotceCategory = getRotceCategory(roeTTM);

                    const fcfNiRatioNum = (freeCashFlowPerShareTTM !== null && netIncomePerShareTTM !== null && netIncomePerShareTTM !== 0)
                        ? freeCashFlowPerShareTTM / netIncomePerShareTTM : null;

                    stockData.numericDebtEbitdaCategory = getNumericDebtEbitdaCategory(debtToEbitdaTTM);
                    stockData.numericFcfNiCategory = getNumericFcfNiCategory(fcfNiRatioNum);

                    // Check if we have significant data before saving
                    if (stockData.companyName || stockData.price || stockData.marketCap) {
                        await Stock.findOneAndUpdate({ symbol: ticker }, stockData, { upsert: true, new: true });
                        console.log(`Saved/Updated data for ${ticker}`);
                    } else {
                        console.warn(`No significant data fetched for ${ticker}, skipping save.`);
                    }


                } catch (error) {
                    console.error(`Error processing ticker ${ticker}:`, error.message);
                }
            });
        }

        // 3. Wait for the queue to finish
        console.log('Waiting for queue to process all tasks...');
        await queue.onIdle();
        console.log('Background stock data fetch finished.');

    } catch (error) {
        console.error('Error in background stock data fetch:', error.message);
    } finally {
        // Disconnect from MongoDB when the job is done
        mongoose.disconnect().then(() => console.log('MongoDB disconnected for background job')).catch(err => console.error('Error disconnecting MongoDB:', err));
    }
}

// Export the function if you want to call it from another script,
// or call it directly here to run when the script is executed.
if (require.main === module) {
    // Run immediately if the script is executed directly
    fetchAndSaveStocks();
}

module.exports = { fetchAndSaveStocks };
