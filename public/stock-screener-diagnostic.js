/**
 * Stock Screener Diagnostic Script
 * 
 * This script helps diagnose issues with the stock screener application
 * by checking DOM elements, dependencies, and script loading.
 */
(function() {
    console.log('Diagnostic: Starting stock screener diagnostics...');
    
    // Wait for DOM to be fully loaded
    document.addEventListener('DOMContentLoaded', function() {
        console.log('Diagnostic: DOM loaded, running checks...');
        runDiagnostics();
    });
    
    /**
     * Run diagnostics on the stock screener
     */
    function runDiagnostics() {
        // Check DOM elements
        checkDomElements();
        
        // Check dependencies
        checkDependencies();
        
        // Check script loading
        checkScriptLoading();
        
        // Check API connectivity
        checkApiConnectivity();
        
        console.log('Diagnostic: All checks completed');
    }
    
    /**
     * Check if required DOM elements exist
     */
    function checkDomElements() {
        console.log('Diagnostic: Checking DOM elements...');
        
        const requiredElements = [
            { id: 'stock-cards-container', name: 'Stock Cards Container' },
            { id: 'stock-table-container', name: 'Stock Table Container' },
            { id: 'pagination-container', name: 'Pagination Container' },
            { id: 'filters-toggle', name: 'Filters Toggle' },
            { id: 'filters-content', name: 'Filters Content' },
            { id: 'search-input', name: 'Search Input' },
            { id: 'card-view-button', name: 'Card View Button' },
            { id: 'table-view-button', name: 'Table View Button' }
        ];
        
        let missingElements = [];
        
        requiredElements.forEach(element => {
            const el = document.getElementById(element.id);
            if (!el) {
                console.error(`Diagnostic: Missing required element: ${element.name} (ID: ${element.id})`);
                missingElements.push(element);
            } else {
                console.log(`Diagnostic: Found element: ${element.name} (ID: ${element.id})`);
            }
        });
        
        if (missingElements.length > 0) {
            console.error(`Diagnostic: Found ${missingElements.length} missing elements that may cause issues`);
        } else {
            console.log('Diagnostic: All required DOM elements are present');
        }
        
        // Check for filter buttons
        const filterButtons = document.querySelectorAll('.filter-button');
        console.log(`Diagnostic: Found ${filterButtons.length} filter buttons`);
        
        // Check for preset buttons
        const presetButtons = document.querySelectorAll('.preset-button');
        console.log(`Diagnostic: Found ${presetButtons.length} preset buttons`);
    }
    
    /**
     * Check if required dependencies exist
     */
    function checkDependencies() {
        console.log('Diagnostic: Checking dependencies...');
        
        const requiredDependencies = [
            { name: 'PaginationControls', check: () => typeof PaginationControls !== 'undefined' },
            { name: 'Tooltip', check: () => typeof Tooltip !== 'undefined' }
        ];
        
        let missingDependencies = [];
        
        requiredDependencies.forEach(dependency => {
            try {
                const exists = dependency.check();
                if (!exists) {
                    console.error(`Diagnostic: Missing required dependency: ${dependency.name}`);
                    missingDependencies.push(dependency);
                } else {
                    console.log(`Diagnostic: Found dependency: ${dependency.name}`);
                }
            } catch (error) {
                console.error(`Diagnostic: Error checking dependency ${dependency.name}:`, error);
                missingDependencies.push(dependency);
            }
        });
        
        if (missingDependencies.length > 0) {
            console.error(`Diagnostic: Found ${missingDependencies.length} missing dependencies that may cause issues`);
        } else {
            console.log('Diagnostic: All required dependencies are present');
        }
    }
    
    /**
     * Check script loading
     */
    function checkScriptLoading() {
        console.log('Diagnostic: Checking script loading...');
        
        const scripts = document.querySelectorAll('script');
        console.log(`Diagnostic: Found ${scripts.length} scripts loaded`);
        
        scripts.forEach(script => {
            if (script.src) {
                console.log(`Diagnostic: Loaded script: ${script.src}`);
            } else {
                console.log('Diagnostic: Loaded inline script');
            }
        });
        
        // Check for specific scripts
        const requiredScripts = [
            { name: 'paginatedApp.js', pattern: /paginatedApp\.js$/ },
            { name: 'pagination.js', pattern: /pagination\.js$/ },
            { name: 'tooltip.js', pattern: /tooltip\.js$/ }
        ];
        
        let missingScripts = [];
        
        requiredScripts.forEach(requiredScript => {
            let found = false;
            
            scripts.forEach(script => {
                if (script.src && requiredScript.pattern.test(script.src)) {
                    found = true;
                    console.log(`Diagnostic: Found required script: ${requiredScript.name}`);
                }
            });
            
            if (!found) {
                console.error(`Diagnostic: Missing required script: ${requiredScript.name}`);
                missingScripts.push(requiredScript);
            }
        });
        
        if (missingScripts.length > 0) {
            console.error(`Diagnostic: Found ${missingScripts.length} missing scripts that may cause issues`);
        } else {
            console.log('Diagnostic: All required scripts are present');
        }
    }
    
    /**
     * Check API connectivity
     */
    function checkApiConnectivity() {
        console.log('Diagnostic: Checking API connectivity...');
        
        // Try to fetch stats
        fetch('/api/stats')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`API error: ${response.status} ${response.statusText}`);
                }
                return response.json();
            })
            .then(stats => {
                console.log('Diagnostic: Successfully connected to API and fetched stats:', stats);
            })
            .catch(error => {
                console.error('Diagnostic: Error connecting to API:', error);
            });
        
        // Try to fetch first page of stocks
        fetch('/api/stocks?page=1&pageSize=10')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`API error: ${response.status} ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                if (!data || !data.stocks || !Array.isArray(data.stocks)) {
                    console.error('Diagnostic: Invalid API response format');
                } else {
                    console.log(`Diagnostic: Successfully fetched ${data.stocks.length} stocks from API`);
                }
            })
            .catch(error => {
                console.error('Diagnostic: Error fetching stocks from API:', error);
            });
    }
})();