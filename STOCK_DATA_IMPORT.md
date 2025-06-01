# Stock Data Import Guide

## Overview
Yes! Your project includes comprehensive stock data import functionality. There are two main files that handle importing stock data into MongoDB:

## 📁 Data Import Files

### 1. `fetchStocksBackground.js` - Main Data Import Script
This is a comprehensive script that fetches stock data from Financial Modeling Prep (FMP) API and saves it to MongoDB.

**What it does:**
- Fetches up to 10,000 stock tickers from NASDAQ, NYSE, and OTC exchanges
- For each ticker, retrieves data from 4 different API endpoints:
  - `/api/v3/profile/{symbol}` - Company profile data
  - `/api/v3/quote/{symbol}` - Real-time quote data  
  - `/api/v3/ratios-ttm/{symbol}` - Financial ratios (TTM)
  - `/api/v3/key-metrics-ttm/{symbol}` - Key financial metrics
- Calculates derived fields like simple scores, categories, and formatted values
- Uses rate limiting (40 concurrent requests per second) to respect API limits
- Saves/updates data in MongoDB with upsert operations

### 2. `scheduler.js` - Automated Scheduling
Schedules the data import to run automatically every day at 3:00 AM using node-schedule.

## 🚀 How to Run Stock Data Import

### Option 1: Manual One-Time Import
```bash
# Run the import script directly
node fetchStocksBackground.js
```

### Option 2: Scheduled Daily Import
```bash
# Start the scheduler (runs daily at 3 AM)
node scheduler.js
```

### Option 3: Integration with Main Server
You can also integrate the scheduler into your main server by adding this to `server.js`:
```javascript
// Add at the top of server.js
require('./scheduler');
```

## 📊 Data Structure
The import script fetches and calculates:

**Basic Company Data:**
- Company name, sector, industry, CEO
- Market cap, price, volume
- Website, description, employee count

**Financial Metrics:**
- P/E ratio, ROE, debt-to-equity ratio
- Free cash flow, enterprise value
- Debt-to-EBITDA, net income per share

**Calculated Categories:**
- Market cap categories (nano, micro, small, mid/large)
- Volume categories (high, medium, low)
- Debt categories, valuation categories
- Simple scoring system (0-100 based on PE and ROE)

## ⚙️ Configuration

### Environment Variables Required:
```
MONGODB_URI=your_mongodb_connection_string
FMP_API_KEY=your_financial_modeling_prep_api_key
FMP_BASE_URL=https://financialmodelingprep.com
```

### API Rate Limits:
- Configured for 3,000 calls per minute (FMP limit)
- Uses 40 concurrent requests per second
- Handles up to 10,000 stocks (40,000 total API calls)

## 🔧 Installation Requirements

The import scripts require an additional dependency:
```bash
npm install node-schedule
```

## 📈 Expected Results
After running the import:
- Your MongoDB database will be populated with comprehensive stock data
- The frontend will display real stock information instead of "Loading..."
- All filtering and screening functionality will work with real data
- Data includes calculated scores and categories for effective screening

## ⏱️ Runtime Expectations
- Full import of 10,000 stocks takes approximately 5-7 minutes
- Progress is logged to console for each processed ticker
- Failed API calls are logged but don't stop the process
- Uses MongoDB upsert operations to handle updates efficiently

## 🛠️ Troubleshooting
- Ensure your FMP API key has sufficient quota
- Check MongoDB connection before running
- Monitor console output for API errors
- Verify network connectivity for API calls

