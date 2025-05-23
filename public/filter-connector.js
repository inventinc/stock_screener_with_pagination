/**
 * Filter Connector for Stock Screener
 * 
 * This script connects the filter UI elements to the EnhancedDataManager
 * to enable filtering functionality.
 */
(function() {
    console.log('Filter Connector: Initializing');
    
    // Wait for DOM and scripts to be fully loaded
    window.addEventListener('load', function() {
        console.log('Filter Connector: Window loaded, waiting for scripts...');
        
        // Give time for other scripts to initialize
        setTimeout(function() {
            initializeFilterConnector();
        }, 1000);
    });
    
    // Also try to initialize immediately if scripts are already loaded
    if (document.readyState === 'complete') {
        console.log('Filter Connector: Document already loaded, initializing now');
        initializeFilterConnector();
    }
    
    /**
     * Initialize the filter connector
     */
    function initializeFilterConnector() {
        console.log('Filter Connector: Setting up filter event handlers');
        
        // Check if stockDataManager exists
        if (!window.stockDataManager) {
            console.error('Filter Connector: stockDataManager not found, cannot connect filters');
            return;
        }
        
        // Set up filter button event handlers
        setupFilterButtons();
        
        // Set up search input event handler
        setupSearchInput();
        
        console.log('Filter Connector: Setup complete');
    }
    
    /**
     * Set up filter button event handlers
     */
    function setupFilterButtons() {
        // Market cap filter buttons
        setupFilterGroup('market-cap', 'marketCap');
        
        // Volume filter buttons
        setupFilterGroup('volume', 'volume');
        
        // Debt filter buttons
        setupFilterGroup('debt', 'debt');
        
        // Valuation filter buttons
        setupFilterGroup('valuation', 'valuation');
        
        // Preset buttons
        document.querySelectorAll('.preset-button').forEach(button => {
            button.addEventListener('click', function() {
                handlePresetClick(this);
            });
        });
        
        // Reset button
        const resetButton = document.querySelector('button[data-action="reset-filters"]');
        if (resetButton) {
            resetButton.addEventListener('click', function() {
                resetAllFilters();
            });
        }
    }
    
    /**
     * Set up a group of related filter buttons
     * @param {String} groupName - Name of the filter group
     * @param {String} filterKey - Key to use in filter object
     */
    function setupFilterGroup(groupName, filterKey) {
        document.querySelectorAll(`.filter-button[data-filter="${groupName}"]`).forEach(button => {
            button.addEventListener('click', function() {
                handleFilterClick(this, filterKey);
            });
        });
    }
    
    /**
     * Handle filter button click
     * @param {HTMLElement} button - The clicked button
     * @param {String} filterKey - Key to use in filter object
     */
    function handleFilterClick(button, filterKey) {
        // Toggle active state
        button.classList.toggle('active');
        const isActive = button.classList.contains('active');
        
        // Get filter value
        const value = button.dataset.value;
        
        // Get current filters
        const filters = window.stockDataManager.activeFilters || {};
        
        // Initialize filter array if needed
        if (!filters[filterKey]) {
            filters[filterKey] = [];
        }
        
        if (isActive) {
            // Add filter value if not already present
            if (!filters[filterKey].includes(value)) {
                filters[filterKey].push(value);
            }
        } else {
            // Remove filter value
            filters[filterKey] = filters[filterKey].filter(v => v !== value);
            
            // Remove empty filter
            if (filters[filterKey].length === 0) {
                delete filters[filterKey];
            }
        }
        
        console.log(`Filter Connector: Applied ${filterKey} filter:`, filters[filterKey]);
        
        // Reload data with updated filters
        window.stockDataManager.loadPage(1, filters);
    }
    
    /**
     * Handle preset button click
     * @param {HTMLElement} button - The clicked button
     */
    function handlePresetClick(button) {
        // Toggle active state
        button.classList.toggle('active');
        const isActive = button.classList.contains('active');
        
        // Get preset value
        const preset = button.dataset.preset;
        
        // Get current filters
        const filters = window.stockDataManager.activeFilters || {};
        
        if (isActive) {
            // Add preset
            filters.preset = preset;
            
            // Deactivate other presets
            document.querySelectorAll('.preset-button').forEach(btn => {
                if (btn !== button) {
                    btn.classList.remove('active');
                }
            });
        } else {
            // Remove preset
            delete filters.preset;
        }
        
        console.log(`Filter Connector: Applied preset filter:`, preset);
        
        // Reload data with updated filters
        window.stockDataManager.loadPage(1, filters);
    }
    
    /**
     * Reset all filters
     */
    function resetAllFilters() {
        // Clear all active states
        document.querySelectorAll('.filter-button, .preset-button').forEach(button => {
            button.classList.remove('active');
        });
        
        // Clear search input
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.value = '';
        }
        
        console.log('Filter Connector: Reset all filters');
        
        // Reload data with empty filters
        window.stockDataManager.loadPage(1, {});
    }
    
    /**
     * Set up search input event handler
     */
    function setupSearchInput() {
        const searchInput = document.getElementById('search-input');
        if (!searchInput) return;
        
        // Use debounce to avoid too many requests
        let debounceTimeout;
        
        searchInput.addEventListener('input', function() {
            clearTimeout(debounceTimeout);
            
            debounceTimeout = setTimeout(() => {
                const searchValue = searchInput.value.trim();
                
                // Get current filters
                const filters = window.stockDataManager.activeFilters || {};
                
                // Update search filter
                if (searchValue) {
                    filters.search = searchValue;
                } else {
                    delete filters.search;
                }
                
                console.log(`Filter Connector: Applied search filter:`, searchValue);
                
                // Reload data with updated filters
                window.stockDataManager.loadPage(1, filters);
            }, 300);
        });
    }
})();
