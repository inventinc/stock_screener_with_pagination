/**
 * Frontend API Configuration Fix
 * 
 * This script fixes the frontend-backend connectivity by:
 * 1. Detecting the current deployment URL
 * 2. Dynamically setting the API endpoint to match the current host
 * 3. Ensuring proper protocol (http/https) is used
 */

// Create a script element to inject the API configuration fix
const apiFixScript = document.createElement('script');
apiFixScript.type = 'text/javascript';
apiFixScript.innerHTML = `
// Execute immediately when the script loads
(function() {
    console.log('API Configuration Fix: Initializing');
    
    // Get the current host and protocol
    const currentProtocol = window.location.protocol;
    const currentHost = window.location.host;
    
    // Build the base API URL using the current host
    const apiBaseUrl = currentProtocol + '//' + currentHost;
    
    console.log('API Configuration Fix: Setting API base URL to ' + apiBaseUrl);
    
    // Override DataManager constructor to use the correct API endpoint
    if (typeof DataManager !== 'undefined') {
        const originalDataManagerConstructor = DataManager;
        
        // Replace the DataManager constructor
        window.DataManager = function(options) {
            console.log('API Configuration Fix: Intercepting DataManager constructor');
            
            // Override the apiEndpoint to use the current host
            const newOptions = {
                ...options,
                apiEndpoint: apiBaseUrl + '/api/stocks'
            };
            
            console.log('API Configuration Fix: Setting apiEndpoint to ' + newOptions.apiEndpoint);
            
            // Call the original constructor with the fixed options
            return new originalDataManagerConstructor(newOptions);
        };
        
        // Copy prototype and static properties
        window.DataManager.prototype = originalDataManagerConstructor.prototype;
        Object.setPrototypeOf(window.DataManager, originalDataManagerConstructor);
        
        console.log('API Configuration Fix: DataManager constructor patched');
    } else {
        console.error('API Configuration Fix: DataManager not found, cannot patch');
    }
    
    // Add a global function to manually initialize with the correct endpoint
    window.reinitializeDataManager = function() {
        console.log('API Configuration Fix: Manually reinitializing DataManager');
        
        if (typeof stockDataManager !== 'undefined' && stockDataManager) {
            // Create a new data manager with the correct endpoint
            stockDataManager = new DataManager({
                apiEndpoint: apiBaseUrl + '/api/stocks',
                batchSize: 500,
                useCache: true,
                progressCallback: typeof updateLoadingProgress === 'function' ? updateLoadingProgress : function() {},
                completeCallback: typeof onDataLoadComplete === 'function' ? onDataLoadComplete : function() {}
            });
            
            // Start loading data
            stockDataManager.loadAllStocks();
            
            // Show loading state if the function exists
            if (typeof updateLoadingState === 'function') {
                updateLoadingState(true);
            }
            
            console.log('API Configuration Fix: DataManager reinitialized with endpoint ' + apiBaseUrl + '/api/stocks');
            return true;
        } else {
            console.error('API Configuration Fix: stockDataManager not found, cannot reinitialize');
            return false;
        }
    };
    
    // Add a connection retry button to the UI
    const addRetryButton = function() {
        console.log('API Configuration Fix: Adding retry connection button');
        
        // Check if the API status element exists
        const apiStatusContainer = document.querySelector('.api-status');
        if (!apiStatusContainer) {
            console.error('API Configuration Fix: API status container not found');
            return;
        }
        
        // Create retry button
        const retryButton = document.createElement('button');
        retryButton.textContent = 'Retry Connection';
        retryButton.style.marginLeft = '10px';
        retryButton.style.padding = '4px 8px';
        retryButton.style.backgroundColor = '#0066ff';
        retryButton.style.color = 'white';
        retryButton.style.border = 'none';
        retryButton.style.borderRadius = '4px';
        retryButton.style.cursor = 'pointer';
        
        // Add click handler
        retryButton.addEventListener('click', function() {
            console.log('API Configuration Fix: Retry button clicked');
            window.reinitializeDataManager();
        });
        
        // Add to the DOM
        apiStatusContainer.appendChild(retryButton);
        console.log('API Configuration Fix: Retry button added');
    };
    
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', addRetryButton);
    } else {
        addRetryButton();
    }
    
    // Try to reinitialize after a short delay to ensure all scripts are loaded
    setTimeout(function() {
        window.reinitializeDataManager();
    }, 1000);
    
    console.log('API Configuration Fix: Initialization complete');
})();
`;

// Add the script to the document head
document.head.appendChild(apiFixScript);

// Also trigger a manual reinitialize if the page is already loaded
if (window.reinitializeDataManager) {
    window.reinitializeDataManager();
}
