/**
 * Debug version of getAllTickers function with detailed logging
 */
async function getAllTickersDebug() {
  try {
    console.log('DEBUG: Starting getAllTickersDebug function');
    
    // Check cache first
    console.log('DEBUG: Checking cache for all_tickers');
    const cachedData = getCachedData('all_tickers');
    if (cachedData) {
      console.log('DEBUG: Found cached ticker data, returning');
      return cachedData;
    }
    
    console.log('DEBUG: No cache found, proceeding with API request');
    
    // Initialize results array
    let allTickers = [];
    let hasMore = true;
    let nextUrl = null;
    let pageCount = 0;
    
    console.log('DEBUG: Starting ticker pagination loop');
    
    // Fetch first page with timeout
    try {
      // Build params for first page
      const params = {
        market: 'stocks',
        active: true,
        limit: 100 // Reduced from 1000 to 100 for testing
      };
      
      console.log('DEBUG: Making first API request with params:', JSON.stringify(params));
      
      // Make request with timeout
      const endpoint = '/v3/reference/tickers';
      
      // Create a promise that rejects after timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('API request timed out after 30 seconds')), 30000);
      });
      
      // Race the API request against the timeout
      const response = await Promise.race([
        makeApiRequest(endpoint, params),
        timeoutPromise
      ]);
      
      console.log(`DEBUG: First page response received, status: ${response.status}, count: ${response.count}`);
      
      if (response.results && response.results.length > 0) {
        console.log(`DEBUG: Adding ${response.results.length} tickers from first page`);
        allTickers = [...allTickers, ...response.results];
        pageCount++;
        
        // Check if there are more pages
        if (response.next_url) {
          console.log('DEBUG: More pages available, next_url found');
          nextUrl = response.next_url;
        } else {
          console.log('DEBUG: No more pages available');
          hasMore = false;
        }
      } else {
        console.log('DEBUG: No results found in first page response');
        hasMore = false;
      }
      
      console.log(`DEBUG: First page processed, hasMore: ${hasMore}, ticker count: ${allTickers.length}`);
      
    } catch (error) {
      console.error('DEBUG ERROR in first page request:', error.message);
      throw error;
    }
    
    console.log('DEBUG: Completed first page fetch, proceeding with remaining pages');
    
    // Filter for NYSE and NASDAQ only
    console.log('DEBUG: Filtering tickers for NYSE and NASDAQ only');
    const filteredTickers = allTickers.filter(ticker => 
      (ticker.market === 'stocks' && (ticker.primary_exchange === 'XNYS' || ticker.primary_exchange === 'XNAS'))
    );
    
    console.log(`DEBUG: Filtered to ${filteredTickers.length} NYSE/NASDAQ tickers from ${allTickers.length} total`);
    
    // Save to cache
    console.log('DEBUG: Saving filtered tickers to cache');
    saveToCache('all_tickers', filteredTickers);
    
    console.log('DEBUG: getAllTickersDebug function completed successfully');
    return filteredTickers;
  } catch (error) {
    console.error('DEBUG CRITICAL ERROR in getAllTickersDebug:', error.message, error.stack);
    errorLogger.logError(error, 'getAllTickersDebug');
    throw error;
  }
}
