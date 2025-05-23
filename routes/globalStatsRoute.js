/**
 * Global stats route for the Stock Screener application
 * Provides database-wide statistics for the header display
 */
const express = require('express');
const router = express.Router();
const Stock = require('../db/models/Stock');

/**
 * GET /api/globalStats
 * Returns global statistics about all stocks in the database
 */
router.get('/globalStats', async (req, res) => {
    try {
        // Get exclude ETFs parameter
        const excludeETFs = req.query.excludeETFs === 'true';
        
        // Base query
        let query = {};
        
        // Add ETF exclusion if requested
        if (excludeETFs) {
            query.type = { $ne: 'ETF' };
        }
        
        // Get total count
        const totalCount = await Stock.countDocuments(query);
        
        // Get NYSE count
        const nyseCount = await Stock.countDocuments({
            ...query,
            $or: [
                { primary_exchange: { $regex: /NYSE/i } },
                { primary_exchange: { $regex: /XNYS/i } },
                { exchange: { $regex: /NYSE/i } },
                { exchange: { $regex: /XNYS/i } }
            ]
        });
        
        // Get NASDAQ count
        const nasdaqCount = await Stock.countDocuments({
            ...query,
            $or: [
                { primary_exchange: { $regex: /NASDAQ/i } },
                { primary_exchange: { $regex: /XNAS/i } },
                { exchange: { $regex: /NASDAQ/i } },
                { exchange: { $regex: /XNAS/i } }
            ]
        });
        
        // Return stats
        res.json({
            total: totalCount,
            nyse: nyseCount,
            nasdaq: nasdaqCount,
            lastUpdated: new Date(),
            excludingETFs: excludeETFs
        });
    } catch (error) {
        console.error('Error fetching global stats:', error);
        res.status(500).json({ error: 'Failed to fetch global stats' });
    }
});

module.exports = router;
