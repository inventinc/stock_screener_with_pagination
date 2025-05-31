/**
 * Stock Screener - Modern UX
 * Main JavaScript for interactive functionality
 */

document.addEventListener('DOMContentLoaded', function() {
    // Initialize tooltips
    initTooltips();
    
    // Initialize filter sections
    initFilterSections();
    
    // Initialize filter chips
    initFilterChips();
    
    // Initialize ranking cards
    initRankingCards();
    
    // Initialize view controls
    initViewControls();
    
    // Initialize mobile bottom sheet
    initMobileBottomSheet();
    
    // Initialize theme toggle
    initThemeToggle();
    
    // Initialize customize metrics
    initCustomizeMetrics();
    
    // Initialize search functionality
    initSearch();
    
    // Load sample data initially to ensure UI is populated
    loadSampleData();
    
    // Then try to load live data
    loadLiveData();
});

/**
 * Initialize tooltips
 */
function initTooltips() {
    const tooltip = document.getElementById('tooltip');
    // Only select info icons for tooltips, not all elements with data-tooltip
    const infoIcons = document.querySelectorAll('.info-icon');
    
    infoIcons.forEach(element => {
        element.addEventListener('mouseenter', e => {
            const tooltipText = e.target.getAttribute('data-tooltip');
            tooltip.textContent = tooltipText;
            tooltip.style.display = 'block';
            tooltip.style.opacity = '1';
            
            // Position the tooltip
            const rect = e.target.getBoundingClientRect();
            const tooltipRect = tooltip.getBoundingClientRect();
            
            let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
            let top = rect.top - tooltipRect.height - 10;
            
            // Ensure tooltip stays within viewport
            if (left < 10) left = 10;
            if (left + tooltipRect.width > window.innerWidth - 10) {
                left = window.innerWidth - tooltipRect.width - 10;
            }
            
            // If tooltip would go above viewport, show it below the element
            if (top < 10) {
                top = rect.bottom + 10;
            }
            
            tooltip.style.left = `${left}px`;
            tooltip.style.top = `${top}px`;
        });
        
        element.addEventListener('mouseleave', () => {
            tooltip.style.opacity = '0';
            setTimeout(() => {
                tooltip.style.display = 'none';
            }, 200);
        });
        
        // For mobile/touch devices
        element.addEventListener('touchstart', e => {
            e.preventDefault();
            const tooltipText = e.target.getAttribute('data-tooltip');
            tooltip.textContent = tooltipText;
            tooltip.style.display = 'block';
            tooltip.style.opacity = '1';
            
            // Position the tooltip
            const rect = e.target.getBoundingClientRect();
            const tooltipWidth = tooltip.offsetWidth || 200; // Estimate if not yet rendered
            
            let left = rect.left + (rect.width / 2) - (tooltipWidth / 2);
            let top = rect.bottom + 10;
            
            // Ensure tooltip stays within viewport
            if (left < 10) left = 10;
            if (left + tooltipWidth > window.innerWidth - 10) {
                left = window.innerWidth - tooltipWidth - 10;
            }
            
            tooltip.style.left = `${left}px`;
            tooltip.style.top = `${top}px`;
            
            // Hide tooltip after 3 seconds on touch devices
            setTimeout(() => {
                tooltip.style.opacity = '0';
                setTimeout(() => {
                    tooltip.style.display = 'none';
                }, 200);
            }, 3000);
        });
    });
}

/**
 * Initialize collapsible filter sections
 */
function initFilterSections() {
    const filterHeaders = document.querySelectorAll('.filter-section-header');
    
    filterHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const content = header.nextElementSibling;
            const toggleIcon = header.querySelector('.toggle-icon');
            
            // Toggle content visibility with animation
            if (content.style.maxHeight && content.style.maxHeight !== '0px') {
                // Collapse
                content.style.maxHeight = '0px';
                toggleIcon.textContent = '▼';
                content.classList.remove('expanded');
            } else {
                // Expand
                content.style.maxHeight = content.scrollHeight + 'px';
                toggleIcon.textContent = '▲';
                content.classList.add('expanded');
            }
        });
        
        // Collapse all sections by default
        const content = header.nextElementSibling;
        const toggleIcon = header.querySelector('.toggle-icon');
        content.style.maxHeight = '0px';
        toggleIcon.textContent = '▼';
        content.classList.remove('expanded');
    });
}

/**
 * Initialize filter chips
 */
function initFilterChips() {
    const filterChips = document.querySelectorAll('.filter-chip');
    
    filterChips.forEach(chip => {
        chip.addEventListener('click', () => {
            // Toggle active state
            chip.classList.toggle('active');
            
            // Update applied filters
            updateAppliedFilters();
            
            // Update filtered stocks
            filterStocks();
        });
    });
    
    // Clear all filters button
    const clearAllButton = document.getElementById('clear-all-filters');
    clearAllButton.addEventListener('click', () => {
        const activeChips = document.querySelectorAll('.filter-chip.active');
        activeChips.forEach(chip => {
            chip.classList.remove('active');
        });
        
        // Update applied filters
        updateAppliedFilters();
        
        // Update filtered stocks
        filterStocks();
    });
}

/**
 * Initialize ranking cards
 */
function initRankingCards() {
    const rankingCards = document.querySelectorAll('.ranking-card');
    
    rankingCards.forEach(card => {
        card.addEventListener('click', () => {
            // Remove active class from all cards
            rankingCards.forEach(c => c.classList.remove('active'));
            
            // Add active class to clicked card
            card.classList.add('active');
            
            // Update filtered stocks
            filterStocks();
        });
    });
    
    // Initialize rank momentum toggle
    const rankMomentumToggle = document.getElementById('rank-momentum-toggle');
    if (rankMomentumToggle) {
        rankMomentumToggle.addEventListener('click', () => {
            rankMomentumToggle.classList.toggle('active');
            filterStocks();
        });
    }
    
    // Initialize export buttons
    const exportCsvButton = document.getElementById('export-csv');
    const exportJsonButton = document.getElementById('export-json');
    
    if (exportCsvButton) {
        exportCsvButton.addEventListener('click', () => {
            alert('CSV export functionality will be implemented with backend integration.');
        });
    }
    
    if (exportJsonButton) {
        exportJsonButton.addEventListener('click', () => {
            alert('JSON export functionality will be implemented with backend integration.');
        });
    }
}

/**
 * Initialize search functionality
 */
function initSearch() {
    const searchInput = document.getElementById('search-input');
    
    // Store the current search term
    let currentSearchTerm = '';
    
    // Add event listener for input changes
    searchInput.addEventListener('input', (e) => {
        currentSearchTerm = e.target.value.trim().toLowerCase();
        filterStocks();
    });
    
    // Add event listener for Enter key
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            filterStocks();
        }
    });
    
    // Clear search when clicking the X button (for browsers that support it)
    searchInput.addEventListener('search', (e) => {
        currentSearchTerm = e.target.value.trim().toLowerCase();
        filterStocks();
    });
    
    // Function to filter stocks based on search term
    window.filterStocksBySearch = function(stocks) {
        if (!currentSearchTerm) return stocks;
        
        return stocks.filter(stock => {
            return stock.symbol.toLowerCase().includes(currentSearchTerm) ||
                   stock.name.toLowerCase().includes(currentSearchTerm) ||
                   stock.sector.toLowerCase().includes(currentSearchTerm);
        });
    };
}

/**
 * Initialize customize metrics functionality
 */
function initCustomizeMetrics() {
    const customizeButton = document.getElementById('customize-metrics');
    
    // Available metrics for customization
    const availableMetrics = [
        { id: 'total-stocks', label: 'Stocks Passing Filters', default: true },
        { id: 'avg-debt-ebitda', label: 'Avg. Debt/EBITDA', default: true },
        { id: 'avg-ev-ebit', label: 'Avg. EV/EBIT', default: true },
        { id: 'avg-fcf-ni', label: 'Avg. FCF/NI', default: true },
        { id: 'avg-rotce', label: 'Avg. ROTCE', default: true },
        { id: 'avg-pe', label: 'Avg. P/E Ratio', default: false },
        { id: 'avg-pb', label: 'Avg. P/B Ratio', default: false },
        { id: 'avg-dividend', label: 'Avg. Dividend Yield', default: false },
        { id: 'avg-roic', label: 'Avg. ROIC', default: false },
        { id: 'avg-growth', label: 'Avg. Revenue Growth', default: false }
    ];
    
    // User's selected metrics (start with defaults)
    let selectedMetrics = availableMetrics.filter(metric => metric.default).map(metric => metric.id);
    
    // Create modal for metric customization
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'metrics-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Customize Metrics</h3>
                <span class="close-modal">&times;</span>
            </div>
            <div class="modal-body">
                <p>Select up to 5 metrics to display in the Key Metrics panel:</p>
                <div class="metrics-list">
                    ${availableMetrics.map(metric => `
                        <div class="metric-option">
                            <label>
                                <input type="checkbox" id="metric-${metric.id}" value="${metric.id}" ${metric.default ? 'checked' : ''}>
                                ${metric.label}
                            </label>
                        </div>
                    `).join('')}
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline" id="cancel-metrics">Cancel</button>
                <button class="btn btn-primary" id="apply-metrics">Apply</button>
            </div>
        </div>
    `;
    
    // Add modal to the DOM
    document.body.appendChild(modal);
    
    // Add modal styles
    const style = document.createElement('style');
    style.textContent = `
        .modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(0, 0, 0, 0.5);
            z-index: 1000;
            align-items: center;
            justify-content: center;
        }
        
        .modal.active {
            display: flex;
        }
        
        .modal-content {
            background-color: var(--bg-secondary);
            border-radius: var(--radius-lg);
            width: 90%;
            max-width: 500px;
            max-height: 90vh;
            overflow-y: auto;
            box-shadow: 0 4px 6px var(--shadow-color);
            animation: slideUp 0.3s ease-out;
        }
        
        .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: var(--space-md);
            border-bottom: 1px solid var(--border-color);
        }
        
        .modal-header h3 {
            margin: 0;
            font-size: 1.25rem;
        }
        
        .close-modal {
            font-size: 1.5rem;
            cursor: pointer;
        }
        
        .modal-body {
            padding: var(--space-md);
        }
        
        .metrics-list {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: var(--space-sm);
            margin-top: var(--space-md);
        }
        
        .metric-option {
            padding: var(--space-sm);
        }
        
        .metric-option label {
            display: flex;
            align-items: center;
            gap: var(--space-sm);
            cursor: pointer;
        }
        
        .modal-footer {
            display: flex;
            justify-content: flex-end;
            gap: var(--space-md);
            padding: var(--space-md);
            border-top: 1px solid var(--border-color);
        }
        
        .btn-primary {
            background-color: var(--accent-primary);
            color: white;
            border: none;
        }
    `;
    document.head.appendChild(style);
    
    // Open modal when customize button is clicked
    customizeButton.addEventListener('click', () => {
        // Reset checkboxes to match current selection
        availableMetrics.forEach(metric => {
            const checkbox = document.getElementById(`metric-${metric.id}`);
            checkbox.checked = selectedMetrics.includes(metric.id);
        });
        
        // Show modal
        modal.classList.add('active');
    });
    
    // Close modal when clicking the X button
    const closeButton = modal.querySelector('.close-modal');
    closeButton.addEventListener('click', () => {
        modal.classList.remove('active');
    });
    
    // Close modal when clicking outside the content
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
        }
    });
    
    // Cancel button closes modal without saving
    const cancelButton = document.getElementById('cancel-metrics');
    cancelButton.addEventListener('click', () => {
        modal.classList.remove('active');
    });
    
    // Apply button saves selection and closes modal
    const applyButton = document.getElementById('apply-metrics');
    applyButton.addEventListener('click', () => {
        // Get selected metrics
        const newSelectedMetrics = [];
        availableMetrics.forEach(metric => {
            const checkbox = document.getElementById(`metric-${metric.id}`);
            if (checkbox.checked) {
                newSelectedMetrics.push(metric.id);
            }
        });
        
        // Validate selection (max 5)
        if (newSelectedMetrics.length > 5) {
            alert('Please select no more than 5 metrics.');
            return;
        }
        
        if (newSelectedMetrics.length === 0) {
            alert('Please select at least 1 metric.');
            return;
        }
        
        // Update selected metrics
        selectedMetrics = newSelectedMetrics;
        
        // Update UI
        updateKeyMetrics();
        
        // Close modal
        modal.classList.remove('active');
    });
    
    // Function to update key metrics display
    window.updateKeyMetrics = function() {
        const keyMetricsContainer = document.getElementById('key-metrics');
        
        // Clear current metrics
        keyMetricsContainer.innerHTML = '';
        
        // Get filtered stocks
        const filteredStocks = window.getFilteredStocks();
        
        // Calculate averages
        const totalStocks = filteredStocks.length;
        const avgDebtEbitda = calculateAverage(filteredStocks, 'debtEbitda');
        const avgEvEbit = calculateAverage(filteredStocks, 'evEbit');
        const avgFcfNi = calculateAverage(filteredStocks, 'fcfNi');
        const avgRotce = calculateAverage(filteredStocks, 'rotce');
        
        // Map of metric IDs to values
        const metricValues = {
            'total-stocks': { value: totalStocks, format: 'number', label: 'Stocks Passing Filters' },
            'avg-debt-ebitda': { value: avgDebtEbitda, format: 'decimal', label: 'Avg. Debt/EBITDA' },
            'avg-ev-ebit': { value: avgEvEbit, format: 'decimal', label: 'Avg. EV/EBIT' },
            'avg-fcf-ni': { value: avgFcfNi, format: 'decimal', label: 'Avg. FCF/NI' },
            'avg-rotce': { value: avgRotce, format: 'percent', label: 'Avg. ROTCE' }
        };
        
        // Add selected metrics to the container
        selectedMetrics.forEach(metricId => {
            const metric = metricValues[metricId];
            if (metric) {
                const metricElement = document.createElement('div');
                metricElement.className = 'key-metric';
                
                let formattedValue = '';
                if (metric.format === 'number') {
                    formattedValue = metric.value;
                } else if (metric.format === 'decimal') {
                    formattedValue = metric.value.toFixed(2) + 'x';
                } else if (metric.format === 'percent') {
                    formattedValue = metric.value.toFixed(1) + '%';
                }
                
                metricElement.innerHTML = `
                    <div class="metric-value">${formattedValue}</div>
                    <div class="metric-label">${metric.label}</div>
                `;
                
                keyMetricsContainer.appendChild(metricElement);
            }
        });
    };
    
    // Helper function to calculate average
    function calculateAverage(stocks, property) {
        if (stocks.length === 0) return 0;
        
        const sum = stocks.reduce((total, stock) => {
            return total + (stock[property] || 0);
        }, 0);
        
        return sum / stocks.length;
    }
}

/**
 * Initialize view controls
 */
function initViewControls() {
    const cardViewButton = document.getElementById('card-view-button');
    const tableViewButton = document.getElementById('table-view-button');
    const stocksContainer = document.getElementById('stocks-container');
    
    // Set card view as default
    stocksContainer.className = 'card-view';
    cardViewButton.classList.add('active');
    
    cardViewButton.addEventListener('click', () => {
        stocksContainer.className = 'card-view';
        cardViewButton.classList.add('active');
        tableViewButton.classList.remove('active');
    });
    
    tableViewButton.addEventListener('click', () => {
        stocksContainer.className = 'table-view';
        tableViewButton.classList.add('active');
        cardViewButton.classList.remove('active');
    });
}

/**
 * Initialize mobile bottom sheet
 */
function initMobileBottomSheet() {
    const filterButton = document.getElementById('mobile-filter-button');
    const bottomSheet = document.getElementById('filter-bottom-sheet');
    const closeButton = document.getElementById('close-bottom-sheet');
    const overlay = document.getElementById('bottom-sheet-overlay');
    
    if (!filterButton || !bottomSheet) return;
    
    // Update mobile filter tabs to use Presets instead of Ranking
    const rankingTab = document.querySelector('.filter-tab[data-tab="ranking"]');
    if (rankingTab) {
        rankingTab.setAttribute('data-tab', 'presets');
        rankingTab.textContent = 'Presets';
        rankingTab.setAttribute('data-tooltip', 'Predefined filter combinations for different investment strategies');
        
        // Also update the corresponding content div
        const rankingContent = document.getElementById('mobile-ranking-system');
        if (rankingContent) {
            rankingContent.id = 'mobile-presets';
        }
    }
    
    filterButton.addEventListener('click', () => {
        bottomSheet.classList.add('active');
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    });
    
    closeButton.addEventListener('click', () => {
        bottomSheet.classList.remove('active');
        overlay.classList.remove('active');
        document.body.style.overflow = '';
    });
    
    overlay.addEventListener('click', () => {
        bottomSheet.classList.remove('active');
        overlay.classList.remove('active');
        document.body.style.overflow = '';
    });
}

/**
 * Initialize theme toggle
 */
function initThemeToggle() {
    const themeToggle = document.getElementById('theme-toggle');
    
    if (!themeToggle) return;
    
    // Check for saved theme preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
        themeToggle.checked = true;
    }
    
    themeToggle.addEventListener('change', () => {
        if (themeToggle.checked) {
            document.body.classList.add('dark-theme');
            localStorage.setItem('theme', 'dark');
        } else {
            document.body.classList.remove('dark-theme');
            localStorage.setItem('theme', 'light');
        }
    });
}

/**
 * Update applied filters display
 */
function updateAppliedFilters() {
    const appliedFiltersContainer = document.getElementById('applied-filters');
    const activeChips = document.querySelectorAll('.filter-chip.active');
    
    // Clear current filters
    appliedFiltersContainer.innerHTML = '';
    
    // Add active filters
    activeChips.forEach(chip => {
        const filterType = chip.getAttribute('data-filter');
        const filterValue = chip.getAttribute('data-value');
        const filterText = chip.textContent.trim();
        
        const filterBadge = document.createElement('div');
        filterBadge.className = 'filter-badge';
        filterBadge.innerHTML = `
            <span>${filterText}</span>
            <button class="remove-filter" data-filter="${filterType}" data-value="${filterValue}">&times;</button>
        `;
        
        appliedFiltersContainer.appendChild(filterBadge);
    });
    
    // Add event listeners to remove buttons
    const removeButtons = document.querySelectorAll('.remove-filter');
    removeButtons.forEach(button => {
        button.addEventListener('click', () => {
            const filterType = button.getAttribute('data-filter');
            const filterValue = button.getAttribute('data-value');
            
            // Find and deactivate the corresponding chip
            const chip = document.querySelector(`.filter-chip[data-filter="${filterType}"][data-value="${filterValue}"]`);
            if (chip) {
                chip.classList.remove('active');
            }
            
            // Update applied filters
            updateAppliedFilters();
            
            // Update filtered stocks
            filterStocks();
        });
    });
}

/**
 * Load sample data for initial UI display
 */
function loadSampleData() {
    // Sample stock data
    window.allStocks = [
        { symbol: 'AAPL', name: 'Apple Inc.', sector: 'Technology', price: 198.45, debtEbitda: 0.32, fcfNi: 1.12, evEbit: 8.7, rotce: 42.3, score: 87 },
        { symbol: 'MSFT', name: 'Microsoft Corporation', sector: 'Technology', price: 412.78, debtEbitda: 0.45, fcfNi: 0.98, evEbit: 9.2, rotce: 38.7, score: 82 },
        { symbol: 'GOOG', name: 'Alphabet Inc.', sector: 'Technology', price: 176.32, debtEbitda: 0.28, fcfNi: 1.05, evEbit: 7.8, rotce: 35.2, score: 85 },
        { symbol: 'AMZN', name: 'Amazon.com Inc.', sector: 'Consumer Cyclical', price: 187.15, debtEbitda: 0.52, fcfNi: 0.92, evEbit: 9.8, rotce: 31.5, score: 78 },
        { symbol: 'BRK.B', name: 'Berkshire Hathaway Inc.', sector: 'Financial Services', price: 412.78, debtEbitda: 0.18, fcfNi: 1.21, evEbit: 6.5, rotce: 29.8, score: 91 },
        { symbol: 'JNJ', name: 'Johnson & Johnson', sector: 'Healthcare', price: 152.64, debtEbitda: 0.41, fcfNi: 1.08, evEbit: 10.2, rotce: 27.5, score: 79 },
        { symbol: 'PG', name: 'Procter & Gamble Co', sector: 'Consumer Defensive', price: 165.32, debtEbitda: 0.37, fcfNi: 0.95, evEbit: 11.4, rotce: 24.8, score: 76 },
        { symbol: 'V', name: 'Visa Inc.', sector: 'Financial Services', price: 278.45, debtEbitda: 0.22, fcfNi: 1.15, evEbit: 7.9, rotce: 45.2, score: 89 },
        { symbol: 'JPM', name: 'JPMorgan Chase & Co.', sector: 'Financial Services', price: 198.76, debtEbitda: 0.65, fcfNi: 0.88, evEbit: 12.5, rotce: 18.7, score: 72 }
    ];
    
    // Initialize with some active filters
    document.querySelector('.filter-chip[data-filter="market-cap"][data-value="large"]').classList.add('active');
    document.querySelector('.filter-chip[data-filter="debt"][data-value="low"]').classList.add('active');
    document.querySelector('.filter-chip[data-filter="debt-ebitda"][data-value="1"]').classList.add('active');
    
    // Update applied filters
    updateAppliedFilters();
    
    // Filter stocks
    filterStocks();
    
    // Set a ranking method if ranking cards exist
    const rankingCard = document.querySelector('.ranking-card[data-ranking="combined"]');
    if (rankingCard) {
        rankingCard.classList.add('active');
    }
    
    // Activate rank momentum toggle if it exists
    const rankMomentumToggle = document.getElementById('rank-momentum-toggle');
    if (rankMomentumToggle) {
        rankMomentumToggle.classList.add('active');
    }
}

/**
 * Load live data from API and refresh database
 */
function loadLiveData() {
    // Show loading indicator
    const stocksContainer = document.getElementById('stocks-container');
    stocksContainer.innerHTML = '<div class="loading-indicator">Loading stocks data...</div>';
    
    // First, try to refresh the database with live API data
    fetch('/api/stocks/refresh-all', {
        method: 'POST'
    })
    .then(response => {
        console.log('Refresh all stocks initiated');
        
        // Now fetch the stocks from the database
        return fetch('/api/stocks');
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(data => {
        console.log('Received data:', data);
        
        // Check if we have stocks data
        if (data.stocks && data.stocks.length > 0) {
            // Store stocks data globally
            window.allStocks = data.stocks.map(stock => ({
                symbol: stock.symbol,
                name: stock.companyName,
                sector: stock.sector || 'Unknown',
                price: stock.price || 0,
                marketCap: stock.marketCap || 0,
                debtEbitda: stock.financials?.debtToEbitda || 0,
                fcfNi: stock.financials?.fcfToNi || 0,
                evEbit: stock.financials?.evToEbit || 0,
                rotce: stock.financials?.rotce || 0,
                score: stock.ranking?.combinedScore || 0
            }));
            
            console.log('Mapped stocks:', window.allStocks);
            
            // Update applied filters
            updateAppliedFilters();
            
            // Filter stocks
            filterStocks();
        } else {
            console.warn('No stocks data received from API');
        }
    })
    .catch(error => {
        console.error('Error fetching stocks:', error);
        stocksContainer.innerHTML = `
            <div class="error-message">
                <h3>Error loading stocks data</h3>
                <p>${error.message}</p>
                <button id="retry-load" class="btn btn-primary">Retry</button>
            </div>
        `;
        
        // Add retry button functionality
        const retryButton = document.getElementById('retry-load');
        if (retryButton) {
            retryButton.addEventListener('click', loadLiveData);
        }
    });
}

/**
 * Filter stocks based on active filters
 */
function filterStocks() {
    // Get active filters
    const activeFilters = {};
    const activeChips = document.querySelectorAll('.filter-chip.active');
    
    activeChips.forEach(chip => {
        const filterType = chip.getAttribute('data-filter');
        const filterValue = chip.getAttribute('data-value');
        
        if (!activeFilters[filterType]) {
            activeFilters[filterType] = [];
        }
        
        activeFilters[filterType].push(filterValue);
    });
    
    // Get active ranking method
    const activeRankingCard = document.querySelector('.ranking-card.active');
    const rankingMethod = activeRankingCard ? activeRankingCard.getAttribute('data-ranking') : 'combined';
    
    // Get rank momentum toggle state
    const rankMomentumToggle = document.getElementById('rank-momentum-toggle');
    const rankMomentumActive = rankMomentumToggle ? rankMomentumToggle.classList.contains('active') : false;
    
    // Filter stocks
    let filteredStocks = window.allStocks || [];
    
    // Apply search filter
    filteredStocks = window.filterStocksBySearch(filteredStocks);
    
    // Apply active filters
    Object.keys(activeFilters).forEach(filterType => {
        const filterValues = activeFilters[filterType];
        
        switch (filterType) {
            case 'market-cap':
                filteredStocks = filteredStocks.filter(stock => {
                    if (filterValues.includes('large') && stock.marketCap >= 10000000000) return true;
                    if (filterValues.includes('mid') && stock.marketCap >= 2000000000 && stock.marketCap < 10000000000) return true;
                    if (filterValues.includes('small') && stock.marketCap >= 300000000 && stock.marketCap < 2000000000) return true;
                    if (filterValues.includes('micro') && stock.marketCap < 300000000) return true;
                    return false;
                });
                break;
                
            case 'sector':
                filteredStocks = filteredStocks.filter(stock => {
                    return filterValues.includes(stock.sector.toLowerCase());
                });
                break;
                
            case 'debt':
                filteredStocks = filteredStocks.filter(stock => {
                    if (filterValues.includes('low') && stock.debtEbitda < 1) return true;
                    if (filterValues.includes('medium') && stock.debtEbitda >= 1 && stock.debtEbitda < 2) return true;
                    if (filterValues.includes('high') && stock.debtEbitda >= 2) return true;
                    return false;
                });
                break;
                
            case 'debt-ebitda':
                filteredStocks = filteredStocks.filter(stock => {
                    if (filterValues.includes('1') && stock.debtEbitda < 1) return true;
                    if (filterValues.includes('2') && stock.debtEbitda < 2) return true;
                    if (filterValues.includes('3') && stock.debtEbitda < 3) return true;
                    return false;
                });
                break;
                
            case 'ev-ebit':
                filteredStocks = filteredStocks.filter(stock => {
                    if (filterValues.includes('10') && stock.evEbit < 10) return true;
                    if (filterValues.includes('15') && stock.evEbit < 15) return true;
                    if (filterValues.includes('20') && stock.evEbit < 20) return true;
                    return false;
                });
                break;
                
            case 'fcf-ni':
                filteredStocks = filteredStocks.filter(stock => {
                    if (filterValues.includes('1') && stock.fcfNi >= 1) return true;
                    if (filterValues.includes('0.8') && stock.fcfNi >= 0.8) return true;
                    if (filterValues.includes('0.5') && stock.fcfNi >= 0.5) return true;
                    return false;
                });
                break;
                
            case 'rotce':
                filteredStocks = filteredStocks.filter(stock => {
                    if (filterValues.includes('20') && stock.rotce >= 20) return true;
                    if (filterValues.includes('15') && stock.rotce >= 15) return true;
                    if (filterValues.includes('10') && stock.rotce >= 10) return true;
                    return false;
                });
                break;
        }
    });
    
    // Sort by ranking method
    filteredStocks.sort((a, b) => {
        if (rankingMethod === 'combined') {
            return b.score - a.score;
        } else if (rankingMethod === 'value') {
            return a.evEbit - b.evEbit;
        } else if (rankingMethod === 'quality') {
            return b.rotce - a.rotce;
        }
        return 0;
    });
    
    // Store filtered stocks for other functions to use
    window.filteredStocks = filteredStocks;
    
    // Update key metrics
    if (window.updateKeyMetrics) {
        window.updateKeyMetrics();
    }
    
    // Update stocks display
    updateStocksDisplay(filteredStocks);
}

/**
 * Get filtered stocks
 */
window.getFilteredStocks = function() {
    return window.filteredStocks || [];
};

/**
 * Update stocks display
 */
function updateStocksDisplay(stocks) {
    const stocksContainer = document.getElementById('stocks-container');
    
    // Clear current stocks
    stocksContainer.innerHTML = '';
    
    if (stocks.length === 0) {
        stocksContainer.innerHTML = '<div class="no-results">No stocks match your filters</div>';
        return;
    }
    
    // Check if we're in card view or table view
    const isCardView = stocksContainer.classList.contains('card-view');
    
    if (isCardView) {
        // Create cards
        stocks.forEach(stock => {
            const card = document.createElement('div');
            card.className = 'stock-card';
            card.setAttribute('data-symbol', stock.symbol);
            
            // Determine score color class
            let scoreColorClass = '';
            if (stock.score >= 85) {
                scoreColorClass = 'score-excellent';
                card.classList.add('score-excellent-bg');
            } else if (stock.score >= 70) {
                scoreColorClass = 'score-good';
                card.classList.add('score-good-bg');
            } else if (stock.score >= 50) {
                scoreColorClass = 'score-average';
                card.classList.add('score-average-bg');
            } else {
                scoreColorClass = 'score-poor';
                card.classList.add('score-poor-bg');
            }
            
            card.innerHTML = `
                <div class="card-header">
                    <div class="stock-symbol">${stock.symbol}</div>
                    <div class="stock-price">$${stock.price.toFixed(2)}</div>
                    <div class="stock-score ${scoreColorClass}">${Math.round(stock.score)}</div>
                </div>
                <div class="card-body">
                    <div class="stock-name">${stock.name}</div>
                    <div class="stock-sector">${stock.sector}</div>
                </div>
                <div class="card-footer">
                    <div class="metric">
                        <div class="metric-label">Debt/EBITDA</div>
                        <div class="metric-value">${stock.debtEbitda.toFixed(2)}x</div>
                    </div>
                    <div class="metric">
                        <div class="metric-label">EV/EBIT</div>
                        <div class="metric-value">${stock.evEbit.toFixed(1)}x</div>
                    </div>
                    <div class="metric">
                        <div class="metric-label">FCF/NI</div>
                        <div class="metric-value">${stock.fcfNi.toFixed(2)}</div>
                    </div>
                    <div class="metric">
                        <div class="metric-label">ROTCE</div>
                        <div class="metric-value">${stock.rotce.toFixed(1)}%</div>
                    </div>
                </div>
            `;
            
            // Add click event to show details
            card.addEventListener('click', () => {
                showStockDetails(stock);
            });
            
            stocksContainer.appendChild(card);
        });
    } else {
        // Create table
        const table = document.createElement('table');
        table.className = 'stocks-table';
        
        // Table header
        const thead = document.createElement('thead');
        thead.innerHTML = `
            <tr>
                <th>Symbol</th>
                <th>Name</th>
                <th>Sector</th>
                <th>Price</th>
                <th>Debt/EBITDA</th>
                <th>EV/EBIT</th>
                <th>FCF/NI</th>
                <th>ROTCE</th>
                <th>Score</th>
            </tr>
        `;
        table.appendChild(thead);
        
        // Table body
        const tbody = document.createElement('tbody');
        stocks.forEach(stock => {
            const row = document.createElement('tr');
            row.setAttribute('data-symbol', stock.symbol);
            
            // Determine score color class
            let scoreColorClass = '';
            if (stock.score >= 85) {
                scoreColorClass = 'score-excellent';
            } else if (stock.score >= 70) {
                scoreColorClass = 'score-good';
            } else if (stock.score >= 50) {
                scoreColorClass = 'score-average';
            } else {
                scoreColorClass = 'score-poor';
            }
            
            row.innerHTML = `
                <td>${stock.symbol}</td>
                <td>${stock.name}</td>
                <td>${stock.sector}</td>
                <td>$${stock.price.toFixed(2)}</td>
                <td>${stock.debtEbitda.toFixed(2)}x</td>
                <td>${stock.evEbit.toFixed(1)}x</td>
                <td>${stock.fcfNi.toFixed(2)}</td>
                <td>${stock.rotce.toFixed(1)}%</td>
                <td class="${scoreColorClass}">${Math.round(stock.score)}</td>
            `;
            
            // Add click event to show details
            row.addEventListener('click', () => {
                showStockDetails(stock);
            });
            
            tbody.appendChild(row);
        });
        table.appendChild(tbody);
        
        stocksContainer.appendChild(table);
    }
}

/**
 * Show stock details
 */
function showStockDetails(stock) {
    // Create modal for stock details
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'stock-details-modal';
    
    // Determine score color class
    let scoreColorClass = '';
    if (stock.score >= 85) {
        scoreColorClass = 'score-excellent';
    } else if (stock.score >= 70) {
        scoreColorClass = 'score-good';
    } else if (stock.score >= 50) {
        scoreColorClass = 'score-average';
    } else {
        scoreColorClass = 'score-poor';
    }
    
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <div class="stock-header">
                    <div class="stock-symbol">${stock.symbol}</div>
                    <div class="stock-name">${stock.name}</div>
                </div>
                <span class="close-modal">&times;</span>
            </div>
            <div class="modal-body">
                <div class="stock-details-grid">
                    <div class="detail-section">
                        <h4>Overview</h4>
                        <div class="detail-row">
                            <div class="detail-label">Sector</div>
                            <div class="detail-value">${stock.sector}</div>
                        </div>
                        <div class="detail-row">
                            <div class="detail-label">Price</div>
                            <div class="detail-value">$${stock.price.toFixed(2)}</div>
                        </div>
                        <div class="detail-row">
                            <div class="detail-label">Score</div>
                            <div class="detail-value ${scoreColorClass}">${Math.round(stock.score)}</div>
                        </div>
                    </div>
                    
                    <div class="detail-section">
                        <h4>Valuation</h4>
                        <div class="detail-row">
                            <div class="detail-label">EV/EBIT</div>
                            <div class="detail-value">${stock.evEbit.toFixed(1)}x</div>
                        </div>
                    </div>
                    
                    <div class="detail-section">
                        <h4>Quality</h4>
                        <div class="detail-row">
                            <div class="detail-label">ROTCE</div>
                            <div class="detail-value">${stock.rotce.toFixed(1)}%</div>
                        </div>
                        <div class="detail-row">
                            <div class="detail-label">FCF/NI</div>
                            <div class="detail-value">${stock.fcfNi.toFixed(2)}</div>
                        </div>
                    </div>
                    
                    <div class="detail-section">
                        <h4>Financial Health</h4>
                        <div class="detail-row">
                            <div class="detail-label">Debt/EBITDA</div>
                            <div class="detail-value">${stock.debtEbitda.toFixed(2)}x</div>
                        </div>
                    </div>
                </div>
                
                <div class="stock-description">
                    <h4>About ${stock.name}</h4>
                    <p>Loading company description...</p>
                </div>
                
                <div class="stock-chart">
                    <h4>Performance</h4>
                    <div class="chart-placeholder">Chart loading...</div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline" id="close-details">Close</button>
                <a href="#" class="btn btn-primary" id="view-full-analysis" target="_blank">View Full Analysis</a>
            </div>
        </div>
    `;
    
    // Add modal to the DOM
    document.body.appendChild(modal);
    
    // Show modal
    modal.classList.add('active');
    
    // Fetch additional stock details
    fetch(`/api/stocks/${stock.symbol}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            // Update description
            const descriptionElement = modal.querySelector('.stock-description p');
            if (descriptionElement && data.description) {
                descriptionElement.textContent = data.description;
            } else if (descriptionElement) {
                descriptionElement.textContent = 'No description available.';
            }
            
            // Update chart (placeholder for now)
            const chartElement = modal.querySelector('.chart-placeholder');
            if (chartElement) {
                chartElement.textContent = 'Chart functionality will be implemented in a future update.';
            }
            
            // Update view full analysis link
            const viewFullAnalysisButton = document.getElementById('view-full-analysis');
            if (viewFullAnalysisButton) {
                viewFullAnalysisButton.href = `/analysis/${stock.symbol}`;
            }
        })
        .catch(error => {
            console.error('Error fetching stock details:', error);
            
            // Update description with error
            const descriptionElement = modal.querySelector('.stock-description p');
            if (descriptionElement) {
                descriptionElement.textContent = 'Error loading company description.';
            }
            
            // Update chart with error
            const chartElement = modal.querySelector('.chart-placeholder');
            if (chartElement) {
                chartElement.textContent = 'Error loading chart data.';
            }
        });
    
    // Close modal when clicking the X button
    const closeButton = modal.querySelector('.close-modal');
    closeButton.addEventListener('click', () => {
        modal.classList.remove('active');
        setTimeout(() => {
            modal.remove();
        }, 300);
    });
    
    // Close modal when clicking outside the content
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
            setTimeout(() => {
                modal.remove();
            }, 300);
        }
    });
    
    // Close button in footer
    const closeDetailsButton = document.getElementById('close-details');
    closeDetailsButton.addEventListener('click', () => {
        modal.classList.remove('active');
        setTimeout(() => {
            modal.remove();
        }, 300);
    });
}
