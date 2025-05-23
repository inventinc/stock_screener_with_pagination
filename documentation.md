# Stock Screener Application Documentation

## Overview
This document provides comprehensive documentation for the Stock Screener application, a full-stack web application that allows users to browse, filter, and analyze stock data from various exchanges.

## Architecture

### Frontend
- **Technology**: HTML5, CSS3, JavaScript (Vanilla)
- **UI Framework**: Bootstrap 5
- **Icons**: Bootstrap Icons
- **Responsive Design**: Mobile and desktop optimized

### Backend
- **Technology**: Node.js, Express.js
- **Database**: MongoDB Atlas (Cloud)
- **Data Source**: Polygon.io API

### Key Features
1. **Real-time Stock Data**: Fetches and displays current stock information
2. **Advanced Filtering**: Multiple filter categories with intuitive UI
3. **Dual View Modes**: Table and card views for different user preferences
4. **Data Visualization**: Clear presentation of financial metrics
5. **Manual Refresh**: Ability to refresh individual stock data
6. **API Status Indicator**: Shows connection status to data source
7. **Export Functionality**: Export filtered results to CSV
8. **Responsive Design**: Works on all device sizes

## Installation and Setup

### Prerequisites
- Node.js (v14+)
- MongoDB Atlas account
- Polygon.io API key

### Installation Steps
1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Configure environment variables:
   - Create a `.env` file with:
     ```
     MONGODB_URI=your_mongodb_connection_string
     POLYGON_API_KEY=your_polygon_api_key
     PORT=3001
     ```
4. Start the server:
   ```
   node server.js
   ```

## API Endpoints

### GET /api/stocks
Returns all stocks in the database.

### GET /api/stocks/:symbol
Returns detailed information for a specific stock.

### GET /api/stats
Returns statistics about the database (total stocks, exchange breakdown).

### POST /api/refresh/:symbol
Refreshes data for a specific stock symbol.

### GET /api/health
Returns API health status.

## Database Schema

### Stock Model
```javascript
{
  symbol: String,
  name: String,
  exchange: String,
  type: String,
  price: Number,
  change: Number,
  changePercent: Number,
  marketCap: Number,
  volume: Number,
  avgVolume: Number,
  pe: Number,
  eps: Number,
  dividend: Number,
  yield: Number,
  beta: Number,
  high52: Number,
  low52: Number,
  open: Number,
  previousClose: Number,
  dayHigh: Number,
  dayLow: Number,
  lastUpdated: Date,
  sector: String,
  industry: String,
  website: String,
  description: String,
  ceo: String,
  employees: Number,
  headquarters: String,
  founded: Number,
  revenue: Number,
  grossProfit: Number,
  netIncome: Number,
  totalAssets: Number,
  totalDebt: Number,
  totalCash: Number,
  operatingCashFlow: Number,
  freeCashFlow: Number,
  ebitda: Number,
  debtToEquity: Number,
  returnOnEquity: Number,
  returnOnAssets: Number,
  profitMargin: Number,
  dataCompleteness: Number
}
```

## User Interface Guide

### Header
- Displays application name and API status
- Shows stock statistics (total, NYSE, NASDAQ)
- Indicates last data update time

### Filters Section
- Collapsible for better space management
- Categories:
  - Market Cap
  - Volume
  - Debt
  - Valuation
  - Profitability
  - Quality
  - Data Completeness
  - Presets

### View Controls
- Toggle between Table and Card views
- Export to CSV functionality
- Manual refresh option

### Stock Display
- Sortable columns in table view
- Visual indicators for data quality
- Color-coded performance metrics

## Optimization Features

### Data Import
- Parallel processing with controlled concurrency
- Intelligent rate limiting
- Progress tracking
- Efficient filtering (excludes ETFs)

### Performance
- Optimized database queries
- Efficient client-side filtering
- Responsive design techniques

## Troubleshooting

### Common Issues
1. **API Connection Failures**: Check Polygon.io API key and network connectivity
2. **Database Connection Issues**: Verify MongoDB connection string and whitelist IP addresses
3. **Missing Data**: Some stocks may have incomplete data from the API source

### Solutions
1. Refresh individual stocks to update data
2. Check API status indicator for connection issues
3. Verify MongoDB Atlas network access settings

## Future Enhancements
1. User authentication and saved filters
2. Advanced charting and technical analysis
3. Portfolio tracking functionality
4. Real-time price updates via WebSockets
5. Additional data sources for more comprehensive information

## Support
For issues or questions, please contact the development team.
