/**
 * Field Mapping Adapter for Stock Screener
 * 
 * This script creates a compatibility layer between the backend API response format
 * and the frontend expected field structure.
 */

// Create a script element to inject the adapter
const adapterScript = document.createElement('script');
adapterScript.type = 'text/javascript';
adapterScript.innerHTML = `
// Original DataManager.loadAllStocks method reference
if (typeof DataManager !== 'undefined') {
    const originalLoadAllStocks = DataManager.prototype.loadAllStocks;
    
    // Override the loadAllStocks method to add field mapping
    DataManager.prototype.loadAllStocks = async function() {
        // Call the original method
        const result = await originalLoadAllStocks.call(this);
        
        // Map fields for all loaded stocks
        if (this.stocks && Array.isArray(this.stocks)) {
            this.stocks = this.stocks.map(mapStockFields);
        }
        
        return result;
    };
    
    // Original getFilteredStocks method reference
    const originalGetFilteredStocks = DataManager.prototype.getFilteredStocks;
    
    // Override the getFilteredStocks method
    DataManager.prototype.getFilteredStocks = function(filters) {
        // Get filtered stocks using original method
        const filteredStocks = originalGetFilteredStocks.call(this, filters);
        
        // Ensure all stocks have properly mapped fields
        return filteredStocks.map(mapStockFields);
    };
}

// Field mapping function
function mapStockFields(stock) {
    if (!stock) return stock;
    
    // Create a new object with mapped fields
    return {
        ...stock,
        // Map backend camelCase to frontend expected fields
        ticker: stock.symbol || stock.ticker,
        symbol: stock.symbol || stock.ticker,
        primary_exchange: stock.exchange || stock.primary_exchange,
        exchange: stock.exchange || stock.primary_exchange,
        market_cap: stock.marketCap || stock.market_cap,
        marketCap: stock.marketCap || stock.market_cap,
        pe_ratio: stock.peRatio || stock.pe_ratio || 0,
        peRatio: stock.peRatio || stock.pe_ratio || 0,
        dividend_yield: stock.dividendYield ? stock.dividendYield / 100 : stock.dividend_yield || 0,
        dividendYield: stock.dividendYield || (stock.dividend_yield ? stock.dividend_yield * 100 : 0),
        year_high: stock.yearHigh || stock.year_high || stock.price * 1.1, // Fallback to current price + 10%
        custom_score: stock.score || stock.custom_score || 50 // Default score
    };
}

// Log that the adapter is loaded
console.log('Field mapping adapter loaded for Stock Screener');
`;

// Add the script to the document
document.head.appendChild(adapterScript);
