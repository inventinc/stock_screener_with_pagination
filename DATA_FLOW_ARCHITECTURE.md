# Data Flow Architecture: From Import to Frontend Display

## 🔄 Complete Data Flow Overview

Your stock screener application has a **dual-architecture** approach with two data sources:

### Architecture Diagram:
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   FMP API       │    │  Import Script  │    │   MongoDB       │
│ (External Data) │───▶│fetchStocksBack  │───▶│   Database      │
└─────────────────┘    │ground.js        │    │                 │
                       └─────────────────┘    └─────────────────┘
                                                       │
                                                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React         │    │  Express API    │    │   Backend API   │
│   Frontend      │◄───│  /api/v1/stocks │◄───│   server.js     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        │
        ▼
┌─────────────────┐
│   FMP API       │
│ (Direct Calls)  │
└─────────────────┘
```

## 📊 Two Data Sources Explained

### 1. **MongoDB Database (Imported Data)**
- **Source**: `fetchStocksBackground.js` imports data from FMP API
- **Storage**: MongoDB with comprehensive stock data
- **Access**: Backend API endpoint `/api/v1/stocks`
- **Advantage**: Fast, cached, comprehensive data with calculated metrics

### 2. **Direct FMP API Calls (Real-time Data)**
- **Source**: Frontend makes direct calls to FMP API
- **Storage**: None (real-time)
- **Access**: Direct HTTP requests from React components
- **Advantage**: Real-time data, detailed company information

## 🔧 How Data Variables Connect

### MongoDB Schema → Frontend Variables

The import script creates this data structure in MongoDB:

```javascript
// MongoDB Document Structure (from fetchStocksBackground.js)
{
  symbol: "AAPL",
  companyName: "Apple Inc.",
  sector: "Technology",
  industry: "Consumer Electronics",
  price: 150.25,
  marketCap: 2500000000000,
  
  // Financial Metrics
  priceEarningsRatioTTM: 25.5,
  returnOnEquityTTM: 0.85,
  debtEquityRatioTTM: 1.2,
  
  // Calculated Categories
  marketCapCategory: "midLarge",
  volumeCategory: "high",
  debtCategory: "medium",
  simpleScore: 75,
  
  // Formatted Display Values
  debtEbitda: "1.2x",
  evEbit: "15.5x",
  rotce: "85.0%"
}
```

### Frontend Type Definitions

The frontend expects this structure (from `types.ts`):

```typescript
interface Stock {
  id: string;
  symbol: string;
  name: string;
  sector: string;
  price: number;
  simpleScore: number;
  marketCapCategory: string;
  volumeCategory: string;
  // ... many more fields
}
```

## 🔌 Current Frontend Connection

**Currently, your frontend is using the FMP API directly**, not the MongoDB data. Here's why:

### In `stockService.ts`:
```typescript
// Frontend fetches directly from FMP API
const screenerUrl = `${FMP_BASE_URL}/stock-screener?limit=${INITIAL_STOCK_LOAD_COUNT}...`;
const screenerResponse = await fetch(screenerUrl);
```

### To Use MongoDB Data Instead:
You would need to modify the frontend to call your local API:

```typescript
// Modified to use local MongoDB API
const localApiUrl = `/api/v1/stocks?page=1&limit=100`;
const response = await fetch(localApiUrl);
```

## 🎯 Benefits of Each Approach

### Using MongoDB Data (Recommended for Production):
✅ **Faster**: Pre-calculated metrics and categories  
✅ **Reliable**: No API rate limits  
✅ **Comprehensive**: All 10,000+ stocks available  
✅ **Consistent**: Standardized data format  
✅ **Offline Capable**: Works without external API  

### Using Direct FMP API:
✅ **Real-time**: Always current data  
✅ **Detailed**: Access to all FMP endpoints  
✅ **Flexible**: Can fetch any specific data on demand  

## 🔄 How to Switch to MongoDB Data

### Option 1: Modify Frontend Service
Update `stockService.ts` to use your local API:

```typescript
export const fetchStockListFromMongoDB = async (): Promise<Stock[]> => {
  const response = await fetch('/api/v1/stocks?limit=1000');
  const data = await response.json();
  return data.data; // Your API returns { data: [...], pagination: {...} }
};
```

### Option 2: Hybrid Approach (Best of Both)
- Use MongoDB for initial stock list and screening
- Use FMP API for detailed individual stock data
- Use MongoDB for fast filtering and sorting

## 📈 Data Synchronization

### Current Import Process:
1. **Daily Schedule**: `scheduler.js` runs at 3 AM daily
2. **Data Fetch**: Calls FMP API for 10,000+ stocks
3. **Processing**: Calculates scores, categories, formatted values
4. **Storage**: Saves/updates MongoDB with upsert operations
5. **Frontend**: Can access via `/api/v1/stocks` endpoint

### Manual Import:
```bash
node fetchStocksBackground.js  # Imports fresh data immediately
```

## 🎨 Frontend Display Logic

The frontend uses these calculated fields for display:

```typescript
// Color coding based on simpleScore
const getSimpleScoreColor = (score: number) => {
  if (score >= 75) return 'bg-green-500';  // Excellent
  if (score >= 50) return 'bg-blue-500';   // Good
  if (score >= 25) return 'bg-orange-500'; // Fair
  return 'bg-red-500';                     // Poor
};

// Category filtering
const filterByMarketCap = (stocks: Stock[], category: string) => {
  return stocks.filter(stock => stock.marketCapCategory === category);
};
```

## 🚀 Recommendation

For optimal performance, I recommend:

1. **Keep the import script** running daily to populate MongoDB
2. **Modify the frontend** to use the local MongoDB API for the main stock list
3. **Use direct FMP calls** only for detailed individual stock analysis
4. **This gives you**: Fast loading + comprehensive data + real-time details when needed

Would you like me to modify the frontend to use the MongoDB data instead of direct FMP API calls?

