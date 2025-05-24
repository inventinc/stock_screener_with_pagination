/**
 * Enhanced Stock API Routes
 * 
 * Provides backend support for enhanced filter categories including
 * P/E Ratio, Dividend Yield, and Debt Level filters.
 */
const express = require('express');
const router = express.Router();
const Stock = require('../db/models/Stock');

/**
 * Get stocks with enhanced filtering
 * 
 * Supports filtering by:
 * - Market Cap (large, mid, small, micro)
 * - Exchange (XNAS, XNYS)
 * - Volume (high, medium, low)
 * - P/E Ratio (low, medium, high, negative)
 * - Dividend Yield (high, medium, low, none)
 * - Debt Level (none, low, medium, high)
 * - Presets (value, growth, dividend, quality)
 */
router.get('/enhanced-stocks', async (req, res) => {
    try {
        // Parse pagination parameters
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 50;
        const skip = (page - 1) * pageSize;
        
        // Build filter query
        const query = buildFilterQuery(req.query);
        
        // Execute query with pagination
        const stocks = await Stock.find(query)
            .sort({ symbol: 1 })
            .skip(skip)
            .limit(pageSize);
        
        // Get total count for pagination
        const total = await Stock.countDocuments(query);
        
        // Return paginated results
        res.json({
            stocks: stocks,
            pagination: {
                total: total,
                page: page,
                pageSize: pageSize,
                pages: Math.ceil(total / pageSize)
            }
        });
    } catch (error) {
        console.error('Error fetching stocks:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Build filter query based on request parameters
 * @param {Object} params - Request query parameters
 * @returns {Object} MongoDB query object
 */
function buildFilterQuery(params) {
    const query = {};
    const conditions = [];
    
    // Market Cap filter
    if (params.market_cap) {
        const marketCapFilter = getMarketCapFilter(params.market_cap);
        if (marketCapFilter) {
            conditions.push(marketCapFilter);
        }
    }
    
    // Exchange filter
    if (params.exchange) {
        conditions.push({ exchange: params.exchange });
    }
    
    // Volume filter
    if (params.volume) {
        const volumeFilter = getVolumeFilter(params.volume);
        if (volumeFilter) {
            conditions.push(volumeFilter);
        }
    }
    
    // P/E Ratio filter
    if (params.pe_ratio) {
        const peRatioFilter = getPERatioFilter(params.pe_ratio);
        if (peRatioFilter) {
            conditions.push(peRatioFilter);
        }
    }
    
    // Dividend Yield filter
    if (params.dividend_yield) {
        const dividendYieldFilter = getDividendYieldFilter(params.dividend_yield);
        if (dividendYieldFilter) {
            conditions.push(dividendYieldFilter);
        }
    }
    
    // Debt Level filter
    if (params.debt_level) {
        const debtLevelFilter = getDebtLevelFilter(params.debt_level);
        if (debtLevelFilter) {
            conditions.push(debtLevelFilter);
        }
    }
    
    // Preset filter
    if (params.preset) {
        const presetFilter = getPresetFilter(params.preset);
        if (presetFilter) {
            conditions.push(presetFilter);
        }
    }
    
    // Search filter
    if (params.search) {
        const searchFilter = getSearchFilter(params.search);
        if (searchFilter) {
            conditions.push(searchFilter);
        }
    }
    
    // Combine all conditions with AND
    if (conditions.length > 0) {
        query.$and = conditions;
    }
    
    return query;
}

/**
 * Get market cap filter
 * @param {string} value - Market cap filter value
 * @returns {Object} MongoDB query condition
 */
function getMarketCapFilter(value) {
    switch (value) {
        case 'large':
            return { marketCap: { $gte: 10000000000 } }; // $10B+
        case 'mid':
            return { 
                marketCap: { 
                    $gte: 2000000000,
                    $lt: 10000000000 
                } 
            }; // $2-10B
        case 'small':
            return { 
                marketCap: { 
                    $gte: 300000000,
                    $lt: 2000000000 
                } 
            }; // $300M-2B
        case 'micro':
            return { marketCap: { $lt: 300000000 } }; // <$300M
        default:
            return null;
    }
}

/**
 * Get volume filter
 * @param {string} value - Volume filter value
 * @returns {Object} MongoDB query condition
 */
function getVolumeFilter(value) {
    switch (value) {
        case 'high':
            return { avgDollarVolume: { $gte: 5000000 } }; // $5M+
        case 'medium':
            return { 
                avgDollarVolume: { 
                    $gte: 1000000,
                    $lt: 5000000 
                } 
            }; // $1-5M
        case 'low':
            return { avgDollarVolume: { $lt: 1000000 } }; // <$1M
        default:
            return null;
    }
}

/**
 * Get P/E Ratio filter
 * @param {string} value - P/E Ratio filter value
 * @returns {Object} MongoDB query condition
 */
function getPERatioFilter(value) {
    switch (value) {
        case 'low':
            return { 
                peRatio: { 
                    $gte: 0,
                    $lt: 10 
                } 
            }; // 0-10
        case 'medium':
            return { 
                peRatio: { 
                    $gte: 10,
                    $lt: 20 
                } 
            }; // 10-20
        case 'high':
            return { peRatio: { $gte: 20 } }; // 20+
        case 'negative':
            return { peRatio: { $lt: 0 } }; // Negative
        default:
            return null;
    }
}

/**
 * Get Dividend Yield filter
 * @param {string} value - Dividend Yield filter value
 * @returns {Object} MongoDB query condition
 */
function getDividendYieldFilter(value) {
    switch (value) {
        case 'high':
            return { dividendYield: { $gte: 0.04 } }; // 4%+
        case 'medium':
            return { 
                dividendYield: { 
                    $gte: 0.02,
                    $lt: 0.04 
                } 
            }; // 2-4%
        case 'low':
            return { 
                dividendYield: { 
                    $gt: 0,
                    $lt: 0.02 
                } 
            }; // 0-2%
        case 'none':
            return { 
                $or: [
                    { dividendYield: 0 },
                    { dividendYield: { $exists: false } }
                ]
            }; // No dividend
        default:
            return null;
    }
}

/**
 * Get Debt Level filter
 * @param {string} value - Debt Level filter value
 * @returns {Object} MongoDB query condition
 */
function getDebtLevelFilter(value) {
    switch (value) {
        case 'none':
            return { 
                $or: [
                    { netDebtToEBITDA: 0 },
                    { netDebtToEBITDA: { $exists: false } }
                ]
            }; // No debt
        case 'low':
            return { 
                netDebtToEBITDA: { 
                    $gt: 0,
                    $lt: 1 
                } 
            }; // 0-1
        case 'medium':
            return { 
                netDebtToEBITDA: { 
                    $gte: 1,
                    $lt: 3 
                } 
            }; // 1-3
        case 'high':
            return { netDebtToEBITDA: { $gte: 3 } }; // 3+
        default:
            return null;
    }
}

/**
 * Get preset filter
 * @param {string} value - Preset filter value
 * @returns {Object} MongoDB query condition
 */
function getPresetFilter(value) {
    switch (value) {
        case 'value':
            return {
                $and: [
                    { peRatio: { $gt: 0, $lt: 15 } },
                    { dividendYield: { $gt: 0.02 } }
                ]
            };
        case 'growth':
            return {
                $and: [
                    { revenueGrowth: { $gt: 0.15 } },
                    { peRatio: { $gt: 20 } }
                ]
            };
        case 'dividend':
            return { dividendYield: { $gt: 0.03 } };
        case 'quality':
            return {
                $and: [
                    { netDebtToEBITDA: { $lt: 2 } },
                    { returnOnEquity: { $gt: 0.15 } }
                ]
            };
        default:
            return null;
    }
}

/**
 * Get search filter
 * @param {string} value - Search query
 * @returns {Object} MongoDB query condition
 */
function getSearchFilter(value) {
    if (!value || value.trim() === '') {
        return null;
    }
    
    const searchRegex = new RegExp(value, 'i');
    return {
        $or: [
            { symbol: searchRegex },
            { name: searchRegex }
        ]
    };
}

module.exports = router;
