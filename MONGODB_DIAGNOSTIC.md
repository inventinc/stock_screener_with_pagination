# Quick MongoDB Connection Test

Add this diagnostic endpoint to your server.js to test MongoDB connection:

```javascript
// Add this route before your existing /api/v1/stocks route
app.get('/api/health', async (req, res) => {
  try {
    // Test MongoDB connection
    const dbState = mongoose.connection.readyState;
    const stateNames = {
      0: 'disconnected',
      1: 'connected', 
      2: 'connecting',
      3: 'disconnecting'
    };
    
    // Try to count documents
    const stockCount = await Stock.countDocuments();
    
    res.json({
      status: 'ok',
      mongodb: {
        state: stateNames[dbState],
        connected: dbState === 1,
        stockCount: stockCount
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({
      status: 'error',
      mongodb: {
        state: 'error',
        connected: false,
        error: error.message
      },
      timestamp: new Date().toISOString()
    });
  }
});
```

## Test the endpoint:
```bash
# Test locally or on Heroku
curl https://your-app.herokuapp.com/api/health

# Expected response when working:
{
  "status": "ok",
  "mongodb": {
    "state": "connected",
    "connected": true,
    "stockCount": 1000
  }
}

# Response when MongoDB connection fails:
{
  "status": "error", 
  "mongodb": {
    "state": "error",
    "connected": false,
    "error": "AtlasError: connection failed"
  }
}
```

This will help diagnose exactly what's happening with your MongoDB connection!

