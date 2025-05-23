# Stock Screener Application

This is a complete stock screener application with frontend and backend components that allows users to browse, filter, and analyze stock data.

## Features

- Browse and search through NYSE and NASDAQ equities
- Filter stocks by market cap, volume, debt, and valuation
- View detailed metrics including P/E ratio and dividend yield
- Export filtered results to CSV
- Responsive design that works on all devices

## Installation

1. Install dependencies:
```
npm install
```

2. Configure MongoDB connection:
Create a `.env` file in the root directory with the following content:
```
MONGODB_URI=your_mongodb_connection_string
PORT=3001
```

3. Start the server:
```
node optimized_server.js
```

4. Access the application at http://localhost:3001

## Database Structure

The application uses MongoDB to store stock data. The main collection is `stocks` with the following schema:

- `symbol`: Stock ticker symbol
- `name`: Company name
- `exchange`: Stock exchange (NYSE or NASDAQ)
- `price`: Current stock price
- `marketCap`: Market capitalization
- `peRatio`: Price to Earnings ratio
- `dividendYield`: Dividend yield as decimal

## API Endpoints

- `GET /api/stocks`: Get paginated stocks with optional filtering
- `GET /api/health`: Health check endpoint
- `GET /api/stats`: Get statistics about the stock database
- `GET /api/top-stocks`: Get top stocks by market cap

## Frontend

The frontend is built with vanilla JavaScript and includes:
- Responsive card and table views
- Filtering and search functionality
- Export to CSV capability
- Loading indicators and connection status

## Maintenance

To clean the database and remove non-equity securities:
```
node clean_stock_database.js
```

To validate the data quality:
```
node validate_cleaned_data.js
```

## Credits

This application was developed by Manus AI.
