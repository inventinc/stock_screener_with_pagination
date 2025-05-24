/**
 * Advanced filters route for the Stock Screener application
 * Implements detailed filtering criteria as specified by the user
 */
const express = require('express');
const router = express.Router();
const Stock = require('../db/models/Stock');

/**
 * GET /api/advancedFilters
 * Returns stocks that match advanced filtering criteria
 */
router.get('/advancedFilters', async (req, res) => {
    try {
        // Parse query parameters
        const {
            marketCapMin = 15000000,       // $15M minimum
            marketCapMax = 5000000000000,  // $5T maximum
            tradingVolumeMin = 50000,      // $50K minimum
            debtToEbitdaMax = 1,           // ≤ 1×
            rotceMin = 12,                 // ≥ 12%
            fcfToIncomeMin = 80,           // ≥ 80%
            shareCountCagrMax = 0,         // ≤ 0%
            evToEbitMax = 10,              // ≤ 10×
            deepValueFlag = false,         // Optional deep value flag
            moatTagging = false,           // Moat tagging
            insiderOwnershipMin = 8,       // ≥ 8%
            insiderBuyers = false,         // Net buyers in past 12 months
            grossMarginDecline = false,    // No gross margin decline
            incrementalRoicMin = 15,       // ≥ 15%
            auditWarnings = false,         // No audit warnings
            cSuiteDepartures = 1,          // Max 1 C-suite departure
            page = 1,
            limit = 50,
            sortBy = 'score',
            sortOrder = 'desc'
        } = req.query;

        // Convert string parameters to appropriate types
        const parsedParams = {
            marketCapMin: Number(marketCapMin),
            marketCapMax: Number(marketCapMax),
            tradingVolumeMin: Number(tradingVolumeMin),
            debtToEbitdaMax: Number(debtToEbitdaMax),
            rotceMin: Number(rotceMin),
            fcfToIncomeMin: Number(fcfToIncomeMin),
            shareCountCagrMax: Number(shareCountCagrMax),
            evToEbitMax: Number(evToEbitMax),
            deepValueFlag: deepValueFlag === 'true',
            moatTagging: moatTagging === 'true',
            insiderOwnershipMin: Number(insiderOwnershipMin),
            insiderBuyers: insiderBuyers === 'true',
            grossMarginDecline: grossMarginDecline === 'true',
            incrementalRoicMin: Number(incrementalRoicMin),
            auditWarnings: auditWarnings === 'true',
            cSuiteDepartures: Number(cSuiteDepartures),
            page: Number(page),
            limit: Number(limit)
        };

        // Build query
        const query = {
            // Hard Pass Filters
            market_cap: { 
                $gte: parsedParams.marketCapMin, 
                $lte: parsedParams.marketCapMax 
            },
            avg_volume_30d: { $gte: parsedParams.tradingVolumeMin },
            'financials.debt_to_ebitda': { $lte: parsedParams.debtToEbitdaMax },
            
            // Additional filters based on availability of data
            type: { $ne: 'ETF' } // Exclude ETFs
        };

        // Add ROTCE filter if requested
        if (parsedParams.rotceMin > 0) {
            query['financials.rotce_3yr'] = { $gte: parsedParams.rotceMin };
        }

        // Add FCF to Income filter if requested
        if (parsedParams.fcfToIncomeMin > 0) {
            query['financials.fcf_to_income_5yr'] = { $gte: parsedParams.fcfToIncomeMin };
        }

        // Add Share Count CAGR filter if requested
        if (parsedParams.shareCountCagrMax !== null) {
            query['financials.share_count_cagr_5yr'] = { $lte: parsedParams.shareCountCagrMax };
        }

        // Add EV/EBIT filter if requested
        if (parsedParams.evToEbitMax > 0) {
            query['financials.ev_to_ebit'] = { $lte: parsedParams.evToEbitMax };
        }

        // Add Deep Value flag if requested
        if (parsedParams.deepValueFlag) {
            query['financials.price_to_ncav'] = { $lte: 0.66 };
        }

        // Add Insider Ownership filter if requested
        if (parsedParams.insiderOwnershipMin > 0) {
            query['financials.insider_ownership'] = { $gte: parsedParams.insiderOwnershipMin };
        }

        // Add Insider Buyers filter if requested
        if (parsedParams.insiderBuyers) {
            query['financials.insider_net_buyers'] = true;
        }

        // Add Gross Margin Decline filter if requested
        if (!parsedParams.grossMarginDecline) {
            query['financials.gross_margin_decline'] = false;
        }

        // Add Incremental ROIC filter if requested
        if (parsedParams.incrementalRoicMin > 0) {
            query['financials.incremental_roic'] = { $gte: parsedParams.incrementalRoicMin };
        }

        // Add Audit Warnings filter if requested
        if (!parsedParams.auditWarnings) {
            query['financials.audit_warnings'] = false;
        }

        // Add C-Suite Departures filter if requested
        if (parsedParams.cSuiteDepartures >= 0) {
            query['financials.csuite_departures'] = { $lte: parsedParams.cSuiteDepartures };
        }

        // Determine sort options
        const sortOptions = {};
        if (sortBy) {
            sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;
        }

        // Calculate pagination
        const skip = (parsedParams.page - 1) * parsedParams.limit;

        // Execute query with pagination
        const stocks = await Stock.find(query)
            .sort(sortOptions)
            .skip(skip)
            .limit(parsedParams.limit)
            .lean();

        // Get total count for pagination
        const totalCount = await Stock.countDocuments(query);

        // Return results
        res.json({
            stocks,
            pagination: {
                total: totalCount,
                page: parsedParams.page,
                limit: parsedParams.limit,
                pages: Math.ceil(totalCount / parsedParams.limit)
            },
            filters: parsedParams
        });
    } catch (error) {
        console.error('Error applying advanced filters:', error);
        res.status(500).json({ error: 'Failed to apply advanced filters' });
    }
});

/**
 * GET /api/moatTagging
 * Performs NLP scan for moat indicators in company descriptions
 */
router.get('/moatTagging', async (req, res) => {
    try {
        const { symbol } = req.query;
        
        if (!symbol) {
            return res.status(400).json({ error: 'Symbol parameter is required' });
        }
        
        // Get stock data
        const stock = await Stock.findOne({ 
            $or: [
                { symbol: symbol.toUpperCase() },
                { ticker: symbol.toUpperCase() }
            ]
        }).lean();
        
        if (!stock) {
            return res.status(404).json({ error: 'Stock not found' });
        }
        
        // Moat categories and terms
        const moatCategories = {
            'Niche / Cost Edge': ['sole supplier', 'patented', 'low-cost producer'],
            'Switching Costs': ['long-term contract', 'low churn'],
            'Brand': ['premium pricing', 'loyal customer base']
        };
        
        // Get company description and recent earnings calls
        const textToAnalyze = [
            stock.description || '',
            stock.recent_filings?.annual_report || '',
            ...(stock.earnings_calls || []).map(call => call.transcript || '')
        ].join(' ').toLowerCase();
        
        // Check for moat terms
        const moatResults = {};
        let totalMatches = 0;
        
        Object.entries(moatCategories).forEach(([category, terms]) => {
            const matches = terms.filter(term => textToAnalyze.includes(term));
            moatResults[category] = {
                matches,
                count: matches.length
            };
            totalMatches += matches.length;
        });
        
        // Determine if stock has moat
        const hasMoat = totalMatches >= 3;
        
        res.json({
            symbol: stock.symbol || stock.ticker,
            name: stock.name,
            hasMoat,
            moatScore: totalMatches,
            categories: moatResults
        });
    } catch (error) {
        console.error('Error performing moat tagging:', error);
        res.status(500).json({ error: 'Failed to perform moat tagging' });
    }
});

/**
 * GET /api/scoreStock
 * Calculates comprehensive score based on weighted criteria
 */
router.get('/scoreStock', async (req, res) => {
    try {
        const { symbol } = req.query;
        
        if (!symbol) {
            return res.status(400).json({ error: 'Symbol parameter is required' });
        }
        
        // Get stock data
        const stock = await Stock.findOne({ 
            $or: [
                { symbol: symbol.toUpperCase() },
                { ticker: symbol.toUpperCase() }
            ]
        }).lean();
        
        if (!stock) {
            return res.status(404).json({ error: 'Stock not found' });
        }
        
        // Scoring weights
        const weights = {
            ownerEarningsYield: 0.35,
            rotce5Year: 0.20,
            netCashToMarketCap: 0.15,
            insiderBuys: 0.15,
            revenueCagr: 0.15
        };
        
        // Calculate individual scores (0-100 scale)
        const scores = {
            ownerEarningsYield: calculatePercentileScore(stock.financials?.owner_earnings_yield || 0, 0, 0.15),
            rotce5Year: calculatePercentileScore(stock.financials?.rotce_5yr || 0, 0, 30),
            netCashToMarketCap: calculatePercentileScore(stock.financials?.net_cash_to_market_cap || 0, -0.5, 0.5),
            insiderBuys: stock.financials?.insider_net_buyers ? 100 : 0,
            revenueCagr: calculatePercentileScore(stock.financials?.revenue_cagr_5yr || 0, -10, 30)
        };
        
        // Calculate weighted score
        let totalScore = 0;
        Object.entries(weights).forEach(([key, weight]) => {
            totalScore += scores[key] * weight;
        });
        
        // Round to 2 decimal places
        totalScore = Math.round(totalScore * 100) / 100;
        
        res.json({
            symbol: stock.symbol || stock.ticker,
            name: stock.name,
            totalScore,
            componentScores: scores,
            weights
        });
    } catch (error) {
        console.error('Error calculating stock score:', error);
        res.status(500).json({ error: 'Failed to calculate stock score' });
    }
});

/**
 * Helper function to calculate percentile score on a 0-100 scale
 * @param {Number} value - The value to score
 * @param {Number} min - Minimum value (0 score)
 * @param {Number} max - Maximum value (100 score)
 * @returns {Number} Score from 0-100
 */
function calculatePercentileScore(value, min, max) {
    if (value <= min) return 0;
    if (value >= max) return 100;
    return Math.round(((value - min) / (max - min)) * 100);
}

module.exports = router;
