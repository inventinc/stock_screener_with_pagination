/**
 * DataFieldMapper - Handles mapping between backend and frontend data models
 * Resolves naming inconsistencies between camelCase and snake_case fields
 */
class DataFieldMapper {
    /**
     * Map backend stock data to frontend format
     * @param {Object} stock - Stock data from backend
     * @returns {Object} Mapped stock data for frontend
     */
    static mapToFrontend(stock) {
        if (!stock) return {};
        
        // Create a new object with all original properties
        const mappedStock = { ...stock };
        
        // Ensure consistent field access regardless of naming convention
        // Handle camelCase to snake_case mapping
        if (stock.marketCap !== undefined && stock.market_cap === undefined) {
            mappedStock.market_cap = stock.marketCap;
        }
        
        if (stock.peRatio !== undefined && stock.pe_ratio === undefined) {
            mappedStock.pe_ratio = stock.peRatio;
        }
        
        if (stock.dividendYield !== undefined && stock.dividend_yield === undefined) {
            mappedStock.dividend_yield = stock.dividendYield;
        }
        
        if (stock.avgDollarVolume !== undefined && stock.avg_dollar_volume === undefined) {
            mappedStock.avg_dollar_volume = stock.avgDollarVolume;
        }
        
        if (stock.weekHigh52 !== undefined && stock.week_high_52 === undefined) {
            mappedStock.week_high_52 = stock.weekHigh52;
        }
        
        // Handle snake_case to camelCase mapping
        if (stock.market_cap !== undefined && stock.marketCap === undefined) {
            mappedStock.marketCap = stock.market_cap;
        }
        
        if (stock.pe_ratio !== undefined && stock.peRatio === undefined) {
            mappedStock.peRatio = stock.pe_ratio;
        }
        
        if (stock.dividend_yield !== undefined && stock.dividendYield === undefined) {
            mappedStock.dividendYield = stock.dividend_yield;
        }
        
        if (stock.avg_dollar_volume !== undefined && stock.avgDollarVolume === undefined) {
            mappedStock.avgDollarVolume = stock.avg_dollar_volume;
        }
        
        if (stock.week_high_52 !== undefined && stock.weekHigh52 === undefined) {
            mappedStock.weekHigh52 = stock.week_high_52;
        }
        
        // Handle nested financial data
        if (stock.financials) {
            if (!mappedStock.financials) {
                mappedStock.financials = {};
            }
            
            // Map debt to EBITDA ratio
            if (stock.financials.debt_to_ebitda !== undefined) {
                mappedStock.netDebtToEBITDA = stock.financials.debt_to_ebitda;
            } else if (stock.netDebtToEBITDA !== undefined) {
                mappedStock.financials.debt_to_ebitda = stock.netDebtToEBITDA;
            }
            
            // Map EV to EBIT ratio
            if (stock.financials.ev_to_ebit !== undefined) {
                mappedStock.evToEBIT = stock.financials.ev_to_ebit;
            } else if (stock.evToEBIT !== undefined) {
                mappedStock.financials.ev_to_ebit = stock.evToEBIT;
            }
            
            // Map ROTCE
            if (stock.financials.rotce !== undefined) {
                mappedStock.rotce = stock.financials.rotce;
            } else if (stock.rotce !== undefined) {
                mappedStock.financials.rotce = stock.rotce;
            }
            
            // Map revenue growth
            if (stock.financials.revenue_growth !== undefined) {
                mappedStock.revenueGrowth = stock.financials.revenue_growth;
            } else if (stock.revenueGrowth !== undefined) {
                mappedStock.financials.revenue_growth = stock.revenueGrowth;
            }
        }
        
        // Format numbers for display
        mappedStock.formattedMarketCap = DataFieldMapper.formatMarketCap(mappedStock.market_cap || mappedStock.marketCap);
        mappedStock.formattedPrice = DataFieldMapper.formatPrice(mappedStock.price);
        mappedStock.formattedPERatio = DataFieldMapper.formatRatio(mappedStock.pe_ratio || mappedStock.peRatio);
        mappedStock.formattedDividendYield = DataFieldMapper.formatPercentage(mappedStock.dividend_yield || mappedStock.dividendYield);
        
        return mappedStock;
    }
    
    /**
     * Format market cap for display
     * @param {Number} marketCap - Market cap value
     * @returns {String} Formatted market cap
     */
    static formatMarketCap(marketCap) {
        if (marketCap === undefined || marketCap === null) {
            return 'N/A';
        }
        
        if (marketCap >= 1000000000000) {
            return '$' + (marketCap / 1000000000000).toFixed(2) + 'T';
        } else if (marketCap >= 1000000000) {
            return '$' + (marketCap / 1000000000).toFixed(2) + 'B';
        } else if (marketCap >= 1000000) {
            return '$' + (marketCap / 1000000).toFixed(2) + 'M';
        } else if (marketCap >= 1000) {
            return '$' + (marketCap / 1000).toFixed(2) + 'K';
        } else {
            return '$' + marketCap.toFixed(2);
        }
    }
    
    /**
     * Format price for display
     * @param {Number} price - Price value
     * @returns {String} Formatted price
     */
    static formatPrice(price) {
        if (price === undefined || price === null) {
            return 'N/A';
        }
        
        return '$' + parseFloat(price).toFixed(2);
    }
    
    /**
     * Format ratio for display
     * @param {Number} ratio - Ratio value
     * @returns {String} Formatted ratio
     */
    static formatRatio(ratio) {
        if (ratio === undefined || ratio === null) {
            return 'N/A';
        }
        
        return parseFloat(ratio).toFixed(2) + 'x';
    }
    
    /**
     * Format percentage for display
     * @param {Number} percentage - Percentage value
     * @returns {String} Formatted percentage
     */
    static formatPercentage(percentage) {
        if (percentage === undefined || percentage === null) {
            return 'N/A';
        }
        
        return (parseFloat(percentage) * 100).toFixed(2) + '%';
    }
    
    /**
     * Check if stock has complete data
     * @param {Object} stock - Stock data
     * @returns {Boolean} Whether stock has complete data
     */
    static hasCompleteData(stock) {
        if (!stock) return false;
        
        // Check required fields
        const requiredFields = [
            'symbol',
            'name',
            'price',
            'market_cap',
            'pe_ratio',
            'dividend_yield'
        ];
        
        for (const field of requiredFields) {
            if (stock[field] === undefined && stock[field.replace(/_([a-z])/g, (g) => g[1].toUpperCase())] === undefined) {
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * Get missing fields for stock
     * @param {Object} stock - Stock data
     * @returns {Array} List of missing fields
     */
    static getMissingFields(stock) {
        if (!stock) return [];
        
        const missingFields = [];
        
        // Check required fields
        const requiredFields = [
            { name: 'symbol', label: 'Symbol' },
            { name: 'name', label: 'Name' },
            { name: 'price', label: 'Price' },
            { name: 'market_cap', label: 'Market Cap' },
            { name: 'pe_ratio', label: 'P/E Ratio' },
            { name: 'dividend_yield', label: 'Dividend Yield' }
        ];
        
        for (const field of requiredFields) {
            const camelCaseField = field.name.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
            
            if (stock[field.name] === undefined && stock[camelCaseField] === undefined) {
                missingFields.push(field.label);
            }
        }
        
        return missingFields;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DataFieldMapper;
}
