// ... keep top unchanged (imports, API key, BASE_URL)

const RATE_CONFIG = {
  concurrency: 25,          // More parallelism
  requestSpacing: 20,       // 20ms = 50 requests/sec
  batchSize: 250,           // Bigger batches
  batchDelay: 3000,         // Shorter wait between batches
  retryDelay: 1000,
  maxRetries: 2
};

let totalRequests = 0;
let successfulRequests = 0;
let failedRequests = 0;
let rateLimitedRequests = 0;
let lastRequestTime = 0;

// ✅ UPDATED makeApiRequest
async function makeApiRequest(endpoint, params = {}, retryCount = 0) {
  params.apikey = API_KEY;

  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < RATE_CONFIG.requestSpacing) {
    await new Promise(resolve => setTimeout(resolve, RATE_CONFIG.requestSpacing - timeSinceLastRequest));
  }

  lastRequestTime = Date.now();
  totalRequests++;

  try {
    const url = `${BASE_URL}${endpoint}`;
    console.log(`Requesting: ${endpoint}`);
    const response = await axios.get(url, { params, timeout: 10000 });
    successfulRequests++;
    return response.data;
  } catch (error) {
    if ((error.response?.status === 429 || error.response?.status === 403) && retryCount < RATE_CONFIG.maxRetries) {
      rateLimitedRequests++;
      console.warn(`[API] Rate limited: ${endpoint}. Retrying (${retryCount + 1}/${RATE_CONFIG.maxRetries})...`);
      await new Promise(resolve => setTimeout(resolve, RATE_CONFIG.retryDelay));
      return makeApiRequest(endpoint, params, retryCount + 1);
    }

    failedRequests++;
    console.error(`[ERROR] makeApiRequest(${endpoint}): ${error.message}`);
    throw error;
  }
}

// ✅ KEEP REMAINDER UNCHANGED
// All your other logic (getAllStockSymbols, getCompanyProfile, importStock, processBatch, importAllStocks, etc.)
// can remain as-is because we’ve just increased the throughput without altering the overall data model or batch logic

// ✅ Mongoose bootstrapping (same as before)
console.log('Starting full stock import process...');
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/stocksDB')
  .then(() => {
    console.log('Connected to MongoDB');
    return importAllStocks();
  })
  .then((result) => {
    console.log('Import completed with results:', result);
    mongoose.disconnect();
  })
  .catch(error => {
    console.error('Error:', error);
    mongoose.disconnect();
  });
