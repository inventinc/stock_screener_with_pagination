/**
 * Filter Connector for Stock Screener
 * 
 * This script connects the filter UI elements to the API endpoints
 * to enable filtering functionality.
 */
(function() {
    console.log('Filter Connector: Initializing');
    
    // Track active filters
    const activeFilters = {};
    
    // Wait for DOM to be fully loaded
    document.addEventListener('DOMContentLoaded', function() {
        console.log('Filter Connector: DOM loaded, setting up filter handlers');
        setupFilterHandlers();
    });
    
    // If DOM is already loaded, set up handlers immediately
    if (document.readyState === 'interactive' || document.readyState === 'complete') {
        console.log('Filter Connector: DOM already loaded, setting up filter handlers now');
        setupFilterHandlers();
    }
    
    /**
     * Set up handlers for all filter buttons
     */
    function setupFilterHandlers() {
        // Set up market cap filter buttons
        setupFilterGroup('market_cap');
        
        // Set up volume filter buttons
        setupFilterGroup('volume');
        
        // Set up debt filter buttons
        setupFilterGroup('debt');
        
        // Set up valuation filter buttons
        setupFilterGroup('valuation');
        
        // Set up preset buttons
        document.querySelectorAll('button[data-preset]').forEach(button => {
            button.addEventListener('click', function() {
                handlePresetClick(this);
            });
        });
        
        // Set up reset button
        const resetButton = document.querySelector('button:contains("Reset Filters")');
        if (resetButton) {
            resetButton.addEventListener('click', function() {
                resetAllFilters();
            });
        }
        
        // Set up search input
        setupSearchInput();
        
        console.log('Filter Connector: All filter handlers set up');
    }
    
    /**
     * Set up a group of related filter buttons
     * @param {String} filterType - Type of filter (market_cap, volume, etc.)
     */
    function setupFilterGroup(filterType) {
        document.querySelectorAll(`button[data-filter="${filterType}"]`).forEach(button => {
            button.addEventListener('click', function() {
                handleFilterClick(this, filterType);
            });
        });
    }
    
    /**
     * Handle filter button click
     * @param {HTMLElement} button - The clicked button
     * @param {String} filterType - Type of filter
     */
    function handleFilterClick(button, filterType) {
        // Toggle active state
        button.classList.toggle('active');
        const isActive = button.classList.contains('active');
        
        // Get filter value
        const value = button.dataset.value;
        
        // Update active filters
        if (!activeFilters[filterType]) {
            activeFilters[filterType] = [];
        }
        
        if (isActive) {
            // Add filter value if not already present
            if (!activeFilters[filterType].includes(value)) {
                activeFilters[filterType].push(value);
            }
        } else {
            // Remove filter value
            const index = activeFilters[filterType].indexOf(value);
            if (index !== -1) {
                activeFilters[filterType].splice(index, 1);
            }
            
            // Remove empty filter
            if (activeFilters[filterType].length === 0) {
                delete activeFilters[filterType];
            }
        }
        
        console.log(`Filter Connector: Applied ${filterType} filter:`, activeFilters[filterType]);
        
        // Apply filters
        applyFilters();
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
        
        // Update active filters
        if (isActive) {
            // Add preset
            activeFilters.preset = preset;
            
            // Deactivate other presets
            document.querySelectorAll('button[data-preset]').forEach(btn => {
                if (btn !== button) {
                    btn.classList.remove('active');
                }
            });
        } else {
            // Remove preset
            delete activeFilters.preset;
        }
        
        console.log(`Filter Connector: Applied preset filter:`, preset);
        
        // Apply filters
        applyFilters();
    }
    
    /**
     * Reset all filters
     */
    function resetAllFilters() {
        // Clear all active states
        document.querySelectorAll('.filter-button, button[data-filter], button[data-preset]').forEach(button => {
            button.classList.remove('active');
        });
        
        // Clear search input
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.value = '';
        }
        
        // Clear active filters
        Object.keys(activeFilters).forEach(key => {
            delete activeFilters[key];
        });
        
        console.log('Filter Connector: Reset all filters');
        
        // Apply filters (empty)
        applyFilters();
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
                
                // Update search filter
                if (searchValue) {
                    activeFilters.search = searchValue;
                } else {
                    delete activeFilters.search;
                }
                
                console.log(`Filter Connector: Applied search filter:`, searchValue);
                
                // Apply filters
                applyFilters();
            }, 500);
        });
    }
    
    /**
     * Apply all active filters
     */
    function applyFilters() {
        // Build query parameters
        const params = new URLSearchParams(window.location.search);
        
        // Clear existing filter parameters
        ['market_cap', 'volume', 'debt', 'valuation', 'preset', 'search'].forEach(param => {
            params.delete(param);
        });
        
        // Add current filter parameters
        Object.entries(activeFilters).forEach(([key, value]) => {
            if (Array.isArray(value)) {
                value.forEach(v => params.append(key, v));
            } else if (value) {
                params.append(key, value);
            }
        });
        
        // Reset to page 1 when filters change
        params.set('page', '1');
        
        // Build URL
        const newUrl = window.location.pathname + '?' + params.toString();
        
        // Navigate to new URL
        if (newUrl !== window.location.pathname + window.location.search) {
            console.log('Filter Connector: Navigating to', newUrl);
            window.location.href = newUrl;
        } else {
            console.log('Filter Connector: URL unchanged, not navigating');
        }
    }
})();
