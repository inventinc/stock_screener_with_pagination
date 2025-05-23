/**
 * Filter Connector for Stock Screener
 * 
 * This script connects the filter UI with the data manager to ensure
 * that when filters are toggled, the data is reloaded with the new filters.
 */

// Execute when the document is fully loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('Filter Connector: Initializing');
    
    // Wait for both the filter UI and data manager to be available
    const initInterval = setInterval(function() {
        if (typeof window.stockDataManager !== 'undefined') {
            clearInterval(initInterval);
            connectFiltersToDataManager();
        }
    }, 500);
    
    // Maximum wait time of 10 seconds
    setTimeout(function() {
        clearInterval(initInterval);
        console.log('Filter Connector: Timed out waiting for data manager');
    }, 10000);
});

/**
 * Connect filter UI to data manager
 */
function connectFiltersToDataManager() {
    console.log('Filter Connector: Connecting filters to data manager');
    
    // Get all filter buttons
    const filterButtons = document.querySelectorAll('.filter-button');
    const presetButtons = document.querySelectorAll('.preset-button');
    const resetButton = document.querySelector('button[data-action="reset-filters"]');
    const searchInput = document.querySelector('input[type="search"]');
    
    // Track active filters
    const activeFilters = {};
    
    // Connect filter buttons
    filterButtons.forEach(button => {
        // Keep the original click handler
        const originalClickHandler = button.onclick;
        
        // Replace with new handler that also triggers data reload
        button.onclick = function(event) {
            // Call original handler if it exists
            if (typeof originalClickHandler === 'function') {
                originalClickHandler.call(this, event);
            }
            
            // Get filter data
            const filter = button.dataset.filter;
            const value = button.dataset.value;
            const isActive = button.classList.contains('active');
            
            // Update active filters
            if (!activeFilters[filter]) {
                activeFilters[filter] = [];
            }
            
            if (isActive) {
                // Add filter
                if (!activeFilters[filter].includes(value)) {
                    activeFilters[filter].push(value);
                }
            } else {
                // Remove filter
                activeFilters[filter] = activeFilters[filter].filter(v => v !== value);
                
                // Remove empty filter
                if (activeFilters[filter].length === 0) {
                    delete activeFilters[filter];
                }
            }
            
            // Reload data with active filters
            reloadDataWithFilters();
        };
    });
    
    // Connect preset buttons
    presetButtons.forEach(button => {
        // Keep the original click handler
        const originalClickHandler = button.onclick;
        
        // Replace with new handler that also triggers data reload
        button.onclick = function(event) {
            // Call original handler if it exists
            if (typeof originalClickHandler === 'function') {
                originalClickHandler.call(this, event);
            }
            
            // Get preset data
            const preset = button.dataset.preset;
            const isActive = button.classList.contains('active');
            
            // Update active filters
            if (!activeFilters.preset) {
                activeFilters.preset = [];
            }
            
            if (isActive) {
                // Add preset
                if (!activeFilters.preset.includes(preset)) {
                    activeFilters.preset.push(preset);
                }
            } else {
                // Remove preset
                activeFilters.preset = activeFilters.preset.filter(p => p !== preset);
                
                // Remove empty preset
                if (activeFilters.preset.length === 0) {
                    delete activeFilters.preset;
                }
            }
            
            // Reload data with active filters
            reloadDataWithFilters();
        };
    });
    
    // Connect reset button
    if (resetButton) {
        // Keep the original click handler
        const originalClickHandler = resetButton.onclick;
        
        // Replace with new handler that also triggers data reload
        resetButton.onclick = function(event) {
            // Call original handler if it exists
            if (typeof originalClickHandler === 'function') {
                originalClickHandler.call(this, event);
            }
            
            // Clear active filters
            Object.keys(activeFilters).forEach(key => {
                delete activeFilters[key];
            });
            
            // Reload data with no filters
            reloadDataWithFilters();
        };
    }
    
    // Connect search input
    if (searchInput) {
        // Debounce search input
        let searchTimeout;
        searchInput.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(function() {
                const searchValue = searchInput.value.trim();
                
                // Update active filters
                if (searchValue) {
                    activeFilters.search = searchValue;
                } else {
                    delete activeFilters.search;
                }
                
                // Reload data with active filters
                reloadDataWithFilters();
            }, 300);
        });
    }
    
    /**
     * Reload data with active filters
     */
    function reloadDataWithFilters() {
        console.log('Filter Connector: Reloading data with filters', activeFilters);
        
        // Check if data manager is available
        if (typeof window.stockDataManager !== 'undefined' && 
            typeof window.stockDataManager.loadPage === 'function') {
            
            // Load first page with active filters
            window.stockDataManager.loadPage(1, activeFilters);
        } else {
            console.error('Filter Connector: Data manager not available');
        }
    }
    
    console.log('Filter Connector: Setup complete');
}
