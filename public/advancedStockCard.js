/**
 * AdvancedStockCard - Generates HTML for stock cards and table rows
 */
class AdvancedStockCard {
    /**
     * Generate HTML for a stock card
     * @param {Object} stock - Stock data
     * @returns {String} HTML for stock card
     */
    generateCardHTML(stock) {
        if (!stock) {
            console.error('Stock data is undefined or null');
            return '';
        }
        
        console.log('Generating card for stock:', stock.symbol);
        
        // Check if stock has complete data
        const hasCompleteData = typeof DataFieldMapper !== 'undefined' 
            ? DataFieldMapper.hasCompleteData(stock) 
            : this._hasRequiredFields(stock);
        
        // Get missing fields
        const missingFields = typeof DataFieldMapper !== 'undefined'
            ? DataFieldMapper.getMissingFields(stock)
            : this._getMissingFields(stock);
        
        // Format values for display
        const formattedMarketCap = this._formatMarketCap(stock.market_cap || stock.marketCap);
        const formattedPrice = this._formatPrice(stock.price);
        const formattedPERatio = this._formatRatio(stock.pe_ratio || stock.peRatio);
        const formattedDividendYield = this._formatPercentage(stock.dividend_yield || stock.dividendYield);
        
        // Get score class
        const scoreClass = this._getScoreClass(stock.score);
        
        // Generate HTML
        return `
            <div class="stock-card ${!hasCompleteData ? 'incomplete-data' : ''}" data-symbol="${stock.symbol}">
                <div class="stock-header">
                    <div class="stock-symbol">${stock.symbol}</div>
                    <div class="stock-exchange">${stock.exchange || stock.primary_exchange || 'N/A'}</div>
                </div>
                <div class="stock-name">${stock.name || 'Unknown Company'}</div>
                <div class="stock-metrics">
                    <div class="metric">
                        <div class="metric-label">Price</div>
                        <div class="metric-value">${formattedPrice}</div>
                    </div>
                    <div class="metric">
                        <div class="metric-label">Market Cap</div>
                        <div class="metric-value">${formattedMarketCap}</div>
                    </div>
                    <div class="metric">
                        <div class="metric-label">P/E Ratio</div>
                        <div class="metric-value">${formattedPERatio}</div>
                    </div>
                    <div class="metric">
                        <div class="metric-label">Dividend Yield</div>
                        <div class="metric-value">${formattedDividendYield}</div>
                    </div>
                    <div class="metric">
                        <div class="metric-label">52W High</div>
                        <div class="metric-value">${this._formatPrice(stock.week_high_52 || stock.weekHigh52)}</div>
                    </div>
                    <div class="metric">
                        <div class="metric-label">Score</div>
                        <div class="metric-value">
                            <span class="score ${scoreClass}">${stock.score ? stock.score : 'N/A'}</span>
                        </div>
                    </div>
                </div>
                ${!hasCompleteData ? `
                <div class="missing-data" style="margin-top: 10px; font-size: 12px; color: #f9a825;">
                    <div>Missing data: ${missingFields.join(', ')}</div>
                </div>
                ` : ''}
            </div>
        `;
    }
    
    /**
     * Generate HTML for a table row
     * @param {Object} stock - Stock data
     * @returns {String} HTML for table row
     */
    generateTableRowHTML(stock) {
        if (!stock) {
            console.error('Stock data is undefined or null');
            return '';
        }
        
        console.log('Generating table row for stock:', stock.symbol);
        
        // Check if stock has complete data
        const hasCompleteData = typeof DataFieldMapper !== 'undefined'
            ? DataFieldMapper.hasCompleteData(stock)
            : this._hasRequiredFields(stock);
        
        // Format values for display
        const formattedMarketCap = this._formatMarketCap(stock.market_cap || stock.marketCap);
        const formattedPrice = this._formatPrice(stock.price);
        const formattedPERatio = this._formatRatio(stock.pe_ratio || stock.peRatio);
        const formattedDividendYield = this._formatPercentage(stock.dividend_yield || stock.dividendYield);
        
        // Get score class
        const scoreClass = this._getScoreClass(stock.score);
        
        // Generate HTML
        return `
            <tr class="${!hasCompleteData ? 'incomplete-data' : ''}" data-symbol="${stock.symbol}">
                <td>${stock.symbol}</td>
                <td>${stock.name || 'Unknown Company'}</td>
                <td>${stock.exchange || stock.primary_exchange || 'N/A'}</td>
                <td>${formattedPrice}</td>
                <td>${formattedMarketCap}</td>
                <td>${formattedPERatio}</td>
                <td>${formattedDividendYield}</td>
                <td>${this._formatPrice(stock.week_high_52 || stock.weekHigh52)}</td>
                <td><span class="score ${scoreClass}">${stock.score ? stock.score : 'N/A'}</span></td>
            </tr>
        `;
    }
    
    /**
     * Format market cap for display
     * @param {Number} marketCap - Market cap value
     * @returns {String} Formatted market cap
     */
    _formatMarketCap(marketCap) {
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
    _formatPrice(price) {
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
    _formatRatio(ratio) {
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
    _formatPercentage(percentage) {
        if (percentage === undefined || percentage === null) {
            return 'N/A';
        }
        
        return (parseFloat(percentage) * 100).toFixed(2) + '%';
    }
    
    /**
     * Get score class based on score value
     * @param {Number} score - Score value
     * @returns {String} Score class
     */
    _getScoreClass(score) {
        if (score === undefined || score === null) {
            return '';
        }
        
        if (score >= 80) {
            return 'excellent';
        } else if (score >= 60) {
            return 'good';
        } else if (score >= 40) {
            return 'average';
        } else if (score >= 20) {
            return 'below-average';
        } else {
            return 'poor';
        }
    }
    
    /**
     * Check if stock has required fields
     * @param {Object} stock - Stock data
     * @returns {Boolean} Whether stock has required fields
     */
    _hasRequiredFields(stock) {
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
    _getMissingFields(stock) {
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
    module.exports = AdvancedStockCard;
}
