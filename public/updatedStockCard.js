/**
 * Updated Advanced Stock Card component with data field mapping
 * Shows all required data points for comprehensive stock analysis
 */
class AdvancedStockCard {
    constructor() {
        // Initialize formatter for human-readable numbers
        this.formatter = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        });
        
        this.percentFormatter = new Intl.NumberFormat('en-US', {
            style: 'percent',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }
    
    /**
     * Format number to human-readable format
     * @param {Number} value - Number to format
     * @param {Boolean} isCurrency - Whether value is currency
     * @param {Boolean} isPercent - Whether value is percentage
     * @returns {String} Formatted number
     */
    formatNumber(value, isCurrency = false, isPercent = false) {
        if (value === undefined || value === null) return 'N/A';
        
        if (isPercent) {
            return this.percentFormatter.format(value / 100);
        }
        
        if (isCurrency) {
            // Format large numbers with abbreviations
            if (Math.abs(value) >= 1e12) {
                return this.formatter.format(value / 1e12) + 'T';
            } else if (Math.abs(value) >= 1e9) {
                return this.formatter.format(value / 1e9) + 'B';
            } else if (Math.abs(value) >= 1e6) {
                return this.formatter.format(value / 1e6) + 'M';
            } else if (Math.abs(value) >= 1e3) {
                return this.formatter.format(value / 1e3) + 'K';
            } else {
                return this.formatter.format(value);
            }
        }
        
        // Format regular numbers
        return value.toLocaleString('en-US');
    }
    
    /**
     * Generate HTML for stock card
     * @param {Object} stock - Stock data
     * @returns {String} HTML for stock card
     */
    generateCardHTML(stock) {
        // Map stock data to ensure all fields are available
        const mappedStock = DataFieldMapper.mapToFrontend(stock);
        
        // Check if stock has incomplete data
        const hasIncompleteData = this.checkIncompleteData(mappedStock);
        const missingDataPoints = DataFieldMapper.getMissingDataPoints(mappedStock);
        
        // Get score class
        const scoreClass = this.getScoreClass(mappedStock.score || 0);
        
        // Get moat status
        const hasMoat = mappedStock.moat || false;
        
        return `
            <div class="stock-card ${hasIncompleteData ? 'incomplete-data' : ''}">
                <div class="stock-header">
                    <div class="stock-symbol">${mappedStock.symbol || 'N/A'}</div>
                    <div class="stock-exchange">${mappedStock.exchange || 'N/A'}</div>
                </div>
                <div class="stock-name">${mappedStock.name || 'N/A'}</div>
                <div class="stock-metrics">
                    <div class="metric">
                        <div class="metric-label">Price</div>
                        <div class="metric-value">${this.formatNumber(mappedStock.price || 0, true)}</div>
                    </div>
                    <div class="metric">
                        <div class="metric-label">Market Cap</div>
                        <div class="metric-value">${this.formatNumber(mappedStock.market_cap || 0, true)}</div>
                    </div>
                    <div class="metric">
                        <div class="metric-label">P/E Ratio</div>
                        <div class="metric-value">${this.formatNumber(mappedStock.pe_ratio || 0)}</div>
                    </div>
                    <div class="metric">
                        <div class="metric-label">Dividend Yield</div>
                        <div class="metric-value">${this.formatNumber(mappedStock.dividend_yield || 0, false, true)}</div>
                    </div>
                    <div class="metric">
                        <div class="metric-label">52W High</div>
                        <div class="metric-value">${this.formatNumber(mappedStock.fifty_two_week_high || 0, true)}</div>
                    </div>
                    <div class="metric">
                        <div class="metric-label">Score</div>
                        <div class="metric-value"><span class="score ${scoreClass}">${Math.round(mappedStock.score || 0)}</span></div>
                    </div>
                    <div class="metric">
                        <div class="metric-label">Debt/EBITDA</div>
                        <div class="metric-value">${this.formatNumber(mappedStock.financials.debt_to_ebitda || 0)}×</div>
                    </div>
                    <div class="metric">
                        <div class="metric-label">ROTCE</div>
                        <div class="metric-value">${this.formatNumber(mappedStock.financials.rotce || 0, false, true)}</div>
                    </div>
                    ${hasMoat ? `
                    <div class="metric moat-indicator">
                        <div class="metric-label">Moat</div>
                        <div class="metric-value"><span class="moat-badge">✓</span></div>
                    </div>
                    ` : ''}
                </div>
                ${hasIncompleteData ? `
                <div class="incomplete-data-warning">
                    <span class="warning-icon">⚠️</span> Missing: ${missingDataPoints.slice(0, 3).join(', ')}${missingDataPoints.length > 3 ? '...' : ''}
                </div>
                ` : ''}
            </div>
        `;
    }
    
    /**
     * Generate HTML for stock table row
     * @param {Object} stock - Stock data
     * @returns {String} HTML for stock table row
     */
    generateTableRowHTML(stock) {
        // Map stock data to ensure all fields are available
        const mappedStock = DataFieldMapper.mapToFrontend(stock);
        
        // Check if stock has incomplete data
        const hasIncompleteData = this.checkIncompleteData(mappedStock);
        
        // Get score class
        const scoreClass = this.getScoreClass(mappedStock.score || 0);
        
        // Get moat status
        const hasMoat = mappedStock.moat || false;
        
        return `
            <tr class="${hasIncompleteData ? 'incomplete-data-row' : ''}">
                <td>${mappedStock.symbol || 'N/A'}</td>
                <td>${mappedStock.name || 'N/A'}</td>
                <td>${mappedStock.exchange || 'N/A'}</td>
                <td>${this.formatNumber(mappedStock.price || 0, true)}</td>
                <td>${this.formatNumber(mappedStock.change_percent || 0, false, true)}</td>
                <td>${this.formatNumber(mappedStock.market_cap || 0, true)}</td>
                <td>${this.formatNumber(mappedStock.pe_ratio || 0)}</td>
                <td>${this.formatNumber(mappedStock.dividend_yield || 0, false, true)}</td>
                <td>${this.formatNumber(mappedStock.financials.debt_to_ebitda || 0)}×</td>
                <td>${this.formatNumber(mappedStock.financials.rotce || 0, false, true)}</td>
                <td><span class="score ${scoreClass}">${Math.round(mappedStock.score || 0)}</span></td>
                <td>${hasMoat ? '<span class="moat-badge">✓</span>' : ''}</td>
            </tr>
        `;
    }
    
    /**
     * Check if stock has incomplete data
     * @param {Object} stock - Stock data
     * @returns {Boolean} Whether stock has incomplete data
     */
    checkIncompleteData(stock) {
        return !DataFieldMapper.hasCompleteData(stock);
    }
    
    /**
     * Get score class based on score value
     * @param {Number} score - Score value
     * @returns {String} Score class
     */
    getScoreClass(score) {
        if (score >= 80) return 'excellent';
        if (score >= 60) return 'good';
        if (score >= 40) return 'average';
        if (score >= 20) return 'below-average';
        return 'poor';
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AdvancedStockCard;
}
