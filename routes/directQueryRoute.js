/**
 * Direct Query Route - Bypasses model layer to directly query MongoDB
 */
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Get all stocks with direct MongoDB query
router.get('/direct-stocks', async (req, res) => {
  try {
    console.log('Direct query API request received');
    
    // Parse pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    
    console.log('Pagination:', { page, limit, skip });
    
    // Get direct reference to the collection
    const stocksCollection = mongoose.connection.db.collection('stocks');
    
    // Log collection details
    console.log('Collection name:', stocksCollection.collectionName);
    console.log('Database name:', mongoose.connection.db.databaseName);
    
    // Execute direct query with pagination
    console.log('Executing direct find() query...');
    const stocks = await stocksCollection.find({})
      .sort({ marketCap: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();
    
    console.log(`Found ${stocks.length} stocks with direct query`);
    
    // Get total count
    const total = await stocksCollection.countDocuments({});
    console.log(`Total count: ${total}`);
    
    // Return data with pagination info
    res.json({
      stocks,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        limit
      },
      stats: {
        total,
        lastUpdated: new Date()
      }
    });
  } catch (error) {
    console.error('Error in direct query:', error);
    res.status(500).json({ error: 'Failed to fetch stocks', details: error.message });
  }
});

module.exports = router;
