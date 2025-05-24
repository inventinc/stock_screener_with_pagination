/**
 * Direct API Fix for Stock Screener
 * 
 * This script directly modifies the DataManager to use the correct API endpoint
 * and forces a reload of stock data.
 */

// Immediately execute when the script loads
(function() {
    console.log('Direct API Fix: Initializing');
    
    // Get the current host and protocol
    const currentProtocol = window.location.protocol;
    const currentHost = window.location.host;
    
    // Build the base API URL using the current host
    const apiBaseUrl = currentProtocol + '//' + currentHost;
    
    console.log('Direct API Fix: Setting API base URL to ' + apiBaseUrl);
    
    // Function to initialize a new data manager with the correct endpoint
    function createNewDataManager() {
        console.log('Direct API Fix: Creating new DataManager with correct endpoint');
        
        // Create a new data manager with the correct endpoint
        window.stockDataManager = new DataManager({
            apiEndpoint: apiBaseUrl + '/api/stocks',
            batchSize: 50, // Smaller batch size for faster initial load
            useCache: false, // Disable cache to force fresh data
            progressCallback: function(loaded, total, fromCache) {
                console.log(`Loading progress: ${loaded}/${total} stocks`);
                if (typeof updateLoadingProgress === 'function') {
                    updateLoadingProgress(loaded, total, fromCache);
                }
                
                // Update connection status
                const statusIndicator = document.getElementById('api-status-indicator');
                const statusText = document.getElementById('api-status-text');
                
                if (statusIndicator) {
                    statusIndicator.classList.remove('disconnected');
                    statusIndicator.classList.add('connected');
                }
                
                if (statusText) {
                    statusText.textContent = 'connected';
                }
            },
            completeCallback: function(stocks) {
                console.log(`Data loading complete: ${stocks.length} stocks loaded`);
                if (typeof onDataLoadComplete === 'function') {
                    onDataLoadComplete(stocks);
                }
            }
        });
        
        // Start loading data
        window.stockDataManager.loadAllStocks();
        
        // Show loading state
        if (typeof updateLoadingState === 'function') {
            updateLoadingState(true);
        } else {
            // Fallback loading indicator
            const loadingBar = document.getElementById('loading-progress-bar');
            const loadingText = document.getElementById('loading-progress-text');
            
            if (loadingBar) loadingBar.style.display = 'block';
            if (loadingText) {
                loadingText.style.display = 'block';
                loadingText.textContent = 'Loading stocks...';
            }
        }
        
        console.log('Direct API Fix: Data loading started');
    }
    
    // Wait for DOM and scripts to be fully loaded
    window.addEventListener('load', function() {
        console.log('Direct API Fix: Window loaded, waiting for scripts...');
        
        // Give time for other scripts to initialize
        setTimeout(function() {
            console.log('Direct API Fix: Checking if DataManager exists...');
            
            if (typeof DataManager === 'undefined') {
                console.error('Direct API Fix: DataManager not found, cannot fix');
                return;
            }
            
            // Create new data manager with correct endpoint
            createNewDataManager();
            
            console.log('Direct API Fix: Setup complete');
        }, 1000);
    });
    
    // Also try to initialize immediately if scripts are already loaded
    if (typeof DataManager !== 'undefined') {
        console.log('Direct API Fix: DataManager already available, initializing now');
        createNewDataManager();
    }
})();
