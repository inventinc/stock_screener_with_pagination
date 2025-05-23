/**
 * Direct Filter Fix for Stock Screener
 * 
 * This script directly attaches event listeners to filter buttons
 * and reloads the page with appropriate URL parameters when filters are clicked.
 * This approach bypasses any issues with the existing JavaScript architecture.
 */
(function() {
    console.log('Direct Filter Fix: Initializing');
    
    // Wait for DOM to be fully loaded
    document.addEventListener('DOMContentLoaded', function() {
        console.log('Direct Filter Fix: DOM loaded, setting up filter handlers');
        setupFilterHandlers();
    });
    
    // If DOM is already loaded, set up handlers immediately
    if (document.readyState === 'interactive' || document.readyState === 'complete') {
        console.log('Direct Filter Fix: DOM already loaded, setting up filter handlers now');
        setupFilterHandlers();
    }
    
    /**
     * Set up handlers for all filter buttons
     */
    function setupFilterHandlers() {
        // Get current filter state from URL
        const currentFilters = parseFiltersFromUrl();
        console.log('Current filters from URL:', currentFilters);
        
        // Update button states based on current filters
        updateButtonStates(currentFilters);
        
        // Set up market cap filter buttons
        setupFilterGroup('market-cap', 'marketCap');
        
        // Set up volume filter buttons
        setupFilterGroup('volume', 'volume');
        
        // Set up debt filter buttons
        setupFilterGroup('debt', 'debt');
        
        // Set up valuation filter buttons
        setupFilterGroup('valuation', 'valuation');
        
        // Set up preset buttons
        document.querySelectorAll('.preset-button').forEach(button => {
            button.addEventListener('click', function() {
                handlePresetClick(this);
            });
        });
        
        // Set up reset button
        const resetButton = document.querySelector('button[data-action="reset-filters"]');
        if (resetButton) {
            resetButton.addEventListener('click', function() {
                resetAllFilters();
            });
        }
        
        // Set up search input
        setupSearchInput();
    }
    
    /**
     * Set up a group of related filter buttons
     * @param {String} groupName - Name of the filter group
     * @param {String} filterKey - Key to use in filter object
     */
    function setupFilterGroup(groupName, filterKey) {
        document.querySelectorAll(`button[data-filter="${groupName}"]`).forEach(button => {
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
        // Get current filters from URL
        const filters = parseFiltersFromUrl();
        
        // Get filter value
        const value = button.dataset.value;
        
        // Toggle filter state
        if (!filters[filterKey]) {
            filters[filterKey] = [];
        }
        
        const valueIndex = filters[filterKey].indexOf(value);
        if (valueIndex === -1) {
            // Add value
            filters[filterKey].push(value);
        } else {
            // Remove value
            filters[filterKey].splice(valueIndex, 1);
            
            // Remove empty filter
            if (filters[filterKey].length === 0) {
                delete filters[filterKey];
            }
        }
        
        console.log(`Direct Filter Fix: Applied ${filterKey} filter:`, filters[filterKey]);
        
        // Reload page with updated filters
        reloadWithFilters(filters);
    }
    
    /**
     * Handle preset button click
     * @param {HTMLElement} button - The clicked button
     */
    function handlePresetClick(button) {
        // Get current filters from URL
        const filters = parseFiltersFromUrl();
        
        // Get preset value
        const preset = button.dataset.preset;
        
        // Toggle preset state
        if (filters.preset === preset) {
            // Remove preset
            delete filters.preset;
        } else {
            // Set preset
            filters.preset = preset;
        }
        
        console.log(`Direct Filter Fix: Applied preset filter:`, preset);
        
        // Reload page with updated filters
        reloadWithFilters(filters);
    }
    
    /**
     * Reset all filters
     */
    function resetAllFilters() {
        console.log('Direct Filter Fix: Reset all filters');
        
        // Reload page with no filters
        reloadWithFilters({});
    }
    
    /**
     * Set up search input event handler
     */
    function setupSearchInput() {
        const searchInput = document.getElementById('search-input');
        if (!searchInput) return;
        
        // Initialize search input with value from URL
        const filters = parseFiltersFromUrl();
        if (filters.search) {
            searchInput.value = filters.search;
        }
        
        // Use debounce to avoid too many requests
        let debounceTimeout;
        
        searchInput.addEventListener('input', function() {
            clearTimeout(debounceTimeout);
            
            debounceTimeout = setTimeout(() => {
                const searchValue = searchInput.value.trim();
                
                // Get current filters from URL
                const filters = parseFiltersFromUrl();
                
                // Update search filter
                if (searchValue) {
                    filters.search = searchValue;
                } else {
                    delete filters.search;
                }
                
                console.log(`Direct Filter Fix: Applied search filter:`, searchValue);
                
                // Reload page with updated filters
                reloadWithFilters(filters);
            }, 500); // Longer debounce for search
        });
    }
    
    /**
     * Parse filters from URL parameters
     * @returns {Object} Filter object
     */
    function parseFiltersFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        const filters = {};
        
        // Parse market cap filters
        if (urlParams.has('marketCap')) {
            filters.marketCap = urlParams.getAll('marketCap');
        }
        
        // Parse volume filters
        if (urlParams.has('volume')) {
            filters.volume = urlParams.getAll('volume');
        }
        
        // Parse debt filters
        if (urlParams.has('debt')) {
            filters.debt = urlParams.getAll('debt');
        }
        
        // Parse valuation filters
        if (urlParams.has('valuation')) {
            filters.valuation = urlParams.getAll('valuation');
        }
        
        // Parse preset
        if (urlParams.has('preset')) {
            filters.preset = urlParams.get('preset');
        }
        
        // Parse search
        if (urlParams.has('search')) {
            filters.search = urlParams.get('search');
        }
        
        // Parse page
        if (urlParams.has('page')) {
            filters.page = urlParams.get('page');
        }
        
        return filters;
    }
    
    /**
     * Reload page with updated filters
     * @param {Object} filters - Filter object
     */
    function reloadWithFilters(filters) {
        // Build query parameters
        const params = new URLSearchParams();
        
        // Add filter parameters
        Object.entries(filters).forEach(([key, value]) => {
            if (Array.isArray(value)) {
                value.forEach(v => params.append(key, v));
            } else if (value) {
                params.append(key, value);
            }
        });
        
        // Preserve page parameter if not changing filters
        if (!filters.page && !hasFilterChanges(filters, parseFiltersFromUrl())) {
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.has('page')) {
                params.append('page', urlParams.get('page'));
            }
        } else if (!filters.page) {
            // Reset to page 1 when filters change
            params.append('page', '1');
        }
        
        // Build URL
        const newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
        
        // Navigate to new URL
        if (newUrl !== window.location.pathname + window.location.search) {
            console.log('Direct Filter Fix: Navigating to', newUrl);
            window.location.href = newUrl;
        } else {
            console.log('Direct Filter Fix: URL unchanged, not navigating');
        }
    }
    
    /**
     * Check if filters have changed
     * @param {Object} newFilters - New filter object
     * @param {Object} oldFilters - Old filter object
     * @returns {Boolean} Whether filters have changed
     */
    function hasFilterChanges(newFilters, oldFilters) {
        // Check for added or changed filters
        for (const key in newFilters) {
            if (key === 'page') continue; // Ignore page parameter
            
            if (!oldFilters[key]) {
                return true; // Filter added
            }
            
            if (Array.isArray(newFilters[key]) && Array.isArray(oldFilters[key])) {
                // Compare arrays
                if (newFilters[key].length !== oldFilters[key].length) {
                    return true; // Different number of values
                }
                
                for (const value of newFilters[key]) {
                    if (!oldFilters[key].includes(value)) {
                        return true; // Value added
                    }
                }
            } else if (newFilters[key] !== oldFilters[key]) {
                return true; // Value changed
            }
        }
        
        // Check for removed filters
        for (const key in oldFilters) {
            if (key === 'page') continue; // Ignore page parameter
            
            if (!newFilters[key]) {
                return true; // Filter removed
            }
        }
        
        return false; // No changes
    }
    
    /**
     * Update button states based on current filters
     * @param {Object} filters - Current filter object
     */
    function updateButtonStates(filters) {
        // Update market cap filter buttons
        if (filters.marketCap) {
            filters.marketCap.forEach(value => {
                const button = document.querySelector(`button[data-filter="market-cap"][data-value="${value}"]`);
                if (button) {
                    button.classList.add('active');
                }
            });
        }
        
        // Update volume filter buttons
        if (filters.volume) {
            filters.volume.forEach(value => {
                const button = document.querySelector(`button[data-filter="volume"][data-value="${value}"]`);
                if (button) {
                    button.classList.add('active');
                }
            });
        }
        
        // Update debt filter buttons
        if (filters.debt) {
            filters.debt.forEach(value => {
                const button = document.querySelector(`button[data-filter="debt"][data-value="${value}"]`);
                if (button) {
                    button.classList.add('active');
                }
            });
        }
        
        // Update valuation filter buttons
        if (filters.valuation) {
            filters.valuation.forEach(value => {
                const button = document.querySelector(`button[data-filter="valuation"][data-value="${value}"]`);
                if (button) {
                    button.classList.add('active');
                }
            });
        }
        
        // Update preset buttons
        if (filters.preset) {
            const presetButton = document.querySelector(`button[data-preset="${filters.preset}"]`);
            if (presetButton) {
                presetButton.classList.add('active');
            }
        }
    }
})();
