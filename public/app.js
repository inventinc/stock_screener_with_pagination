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
    
    // Load sample data
    loadSampleData();
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
    rankMomentumToggle.addEventListener('click', () => {
        rankMomentumToggle.classList.toggle('active');
        filterStocks();
    });
    
    // Initialize export buttons
    const exportCsvButton = document.getElementById('export-csv');
    const exportJsonButton = document.getElementById('export-json');
    
    exportCsvButton.addEventListener('click', () => {
        alert('CSV export functionality will be implemented with backend integration.');
    });
    
    exportJsonButton.addEventListener('click', () => {
        alert('JSON export functionality will be implemented with backend integration.');
    });
}

/**
 * Initialize search functionality
 */
function initSearch() {
    const searchInput = document.getElementById('search-input');
    
    // Sample stock data for search
    const allStocks = [
        { symbol: 'AAPL', name: 'Apple Inc.', sector: 'Technology', price: 198.45, debtEbitda: 0.32, fcfNi: 1.12, evEbit: 8.7, rotce: 42.3, score: 87 },
        { symbol: 'MSFT', name: 'Microsoft Corporation', sector: 'Technology', price: 412.78, debtEbitda: 0.45, fcfNi: 0.98, evEbit: 9.2, rotce: 38.7, score: 82 },
        { symbol: 'GOOG', name: 'Alphabet Inc.', sector: 'Technology', price: 176.32, debtEbitda: 0.28, fcfNi: 1.05, evEbit: 7.8, rotce: 35.2, score: 85 },
        { symbol: 'AMZN', name: 'Amazon.com Inc.', sector: 'Consumer Cyclical', price: 187.15, debtEbitda: 0.52, fcfNi: 0.92, evEbit: 9.8, rotce: 31.5, score: 78 },
        { symbol: 'BRK.B', name: 'Berkshire Hathaway Inc.', sector: 'Financial Services', price: 412.78, debtEbitda: 0.18, fcfNi: 1.21, evEbit: 6.5, rotce: 29.8, score: 91 },
        { symbol: 'JNJ', name: 'Johnson & Johnson', sector: 'Healthcare', price: 152.64, debtEbitda: 0.41, fcfNi: 1.08, evEbit: 10.2, rotce: 27.5, score: 79 },
        { symbol: 'PG', name: 'Procter & Gamble Co', sector: 'Consumer Defensive', price: 165.32, debtEbitda: 0.37, fcfNi: 0.95, evEbit: 11.4, rotce: 24.8, score: 76 },
        { symbol: 'V', name: 'Visa Inc.', sector: 'Financial Services', price: 278.45, debtEbitda: 0.22, fcfNi: 1.15, evEbit: 7.9, rotce: 45.2, score: 89 },
        { symbol: 'JPM', name: 'JPMorgan Chase & Co.', sector: 'Financial Services', price: 198.76, debtEbitda: 0.65, fcfNi: 0.88, evEbit: 12.5, rotce: 18.7, score: 72 },
        { symbol: 'WMT', name: 'Walmart Inc.', sector: 'Consumer Defensive', price: 67.89, debtEbitda: 0.48, fcfNi: 0.91, evEbit: 10.8, rotce: 22.3, score: 74 },
        { symbol: 'DIS', name: 'Walt Disney Co', sector: 'Communication Services', price: 112.34, debtEbitda: 0.56, fcfNi: 0.85, evEbit: 13.2, rotce: 19.5, score: 71 },
        { symbol: 'KO', name: 'Coca-Cola Co', sector: 'Consumer Defensive', price: 62.45, debtEbitda: 0.42, fcfNi: 0.97, evEbit: 11.7, rotce: 26.8, score: 75 },
        { symbol: 'PFE', name: 'Pfizer Inc.', sector: 'Healthcare', price: 34.56, debtEbitda: 0.39, fcfNi: 0.94, evEbit: 12.1, rotce: 23.4, score: 73 },
        { symbol: 'NVDA', name: 'NVIDIA Corporation', sector: 'Technology', price: 487.65, debtEbitda: 0.15, fcfNi: 1.18, evEbit: 8.3, rotce: 48.7, score: 92 },
        { symbol: 'HD', name: 'Home Depot Inc', sector: 'Consumer Cyclical', price: 345.67, debtEbitda: 0.35, fcfNi: 1.02, evEbit: 9.5, rotce: 32.6, score: 81 }
    ];
    
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
    
    // Make stock data available globally for search
    window.allStocks = allStocks;
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
        
        modal.classList.add('active');
    });
    
    // Close modal when clicking the close button
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
    
    // Cancel button
    const cancelButton = document.getElementById('cancel-metrics');
    cancelButton.addEventListener('click', () => {
        modal.classList.remove('active');
    });
    
    // Apply button
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
        
        // Limit to 5 metrics
        if (newSelectedMetrics.length > 5) {
            alert('Please select a maximum of 5 metrics.');
            return;
        }
        
        // Ensure at least 1 metric is selected
        if (newSelectedMetrics.length === 0) {
            alert('Please select at least 1 metric.');
            return;
        }
        
        // Update selected metrics
        selectedMetrics = newSelectedMetrics;
        
        // Update metrics display
        updateMetricsDisplay();
        
        // Close modal
        modal.classList.remove('active');
    });
    
    // Enforce maximum of 5 selected metrics
    const checkboxes = document.querySelectorAll('.metrics-list input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            const checkedCount = document.querySelectorAll('.metrics-list input[type="checkbox"]:checked').length;
            if (checkedCount > 5) {
                checkbox.checked = false;
                alert('You can select a maximum of 5 metrics.');
            }
        });
    });
    
    // Function to update metrics display
    function updateMetricsDisplay() {
        const statsGrid = document.querySelector('.stats-grid');
        statsGrid.innerHTML = '';
        
        // Add selected metrics
        selectedMetrics.forEach(metricId => {
            const metric = availableMetrics.find(m => m.id === metricId);
            
            // Create stat card
            const statCard = document.createElement('div');
            statCard.className = 'stat-card';
            
            // Get value for the metric (in a real app, this would come from actual data)
            let value;
            switch (metricId) {
                case 'total-stocks':
                    value = document.getElementById('total-stocks') ? 
                            document.getElementById('total-stocks').textContent : '42';
                    break;
                case 'avg-debt-ebitda':
                    value = '0.38×';
                    break;
                case 'avg-ev-ebit':
                    value = '8.4×';
                    break;
                case 'avg-fcf-ni':
                    value = '1.06';
                    break;
                case 'avg-rotce':
                    value = '35.5%';
                    break;
                case 'avg-pe':
                    value = '18.7×';
                    break;
                case 'avg-pb':
                    value = '2.4×';
                    break;
                case 'avg-dividend':
                    value = '1.8%';
                    break;
                case 'avg-roic':
                    value = '22.3%';
                    break;
                case 'avg-growth':
                    value = '12.5%';
                    break;
                default:
                    value = 'N/A';
            }
            
            statCard.innerHTML = `
                <div class="stat-value" id="${metricId}">${value}</div>
                <div class="stat-label">${metric.label}</div>
            `;
            
            statsGrid.appendChild(statCard);
        });
    }
}

/**
 * Update applied filters display
 */
function updateAppliedFilters() {
    const appliedFiltersContainer = document.getElementById('applied-filters');
    appliedFiltersContainer.innerHTML = '';
    
    const activeChips = document.querySelectorAll('.filters-panel .filter-chip.active');
    let activeCount = 0;
    
    activeChips.forEach(chip => {
        activeCount++;
        
        // Create applied filter element
        const appliedFilter = document.createElement('div');
        appliedFilter.className = 'applied-filter';
        
        const filterText = document.createElement('span');
        filterText.textContent = chip.textContent;
        
        const removeButton = document.createElement('span');
        removeButton.className = 'remove-filter';
        removeButton.textContent = '×';
        removeButton.addEventListener('click', (e) => {
            e.stopPropagation();
            chip.classList.remove('active');
            updateAppliedFilters();
            filterStocks();
        });
        
        appliedFilter.appendChild(filterText);
        appliedFilter.appendChild(removeButton);
        appliedFiltersContainer.appendChild(appliedFilter);
    });
    
    // Update mobile filter button count
    const activeFilterCount = document.getElementById('active-filter-count');
    activeFilterCount.textContent = activeCount;
}

/**
 * Initialize view controls (card view / table view)
 */
function initViewControls() {
    const cardViewButton = document.getElementById('card-view-button');
    const tableViewButton = document.getElementById('table-view-button');
    const stockCards = document.getElementById('stock-cards');
    const stockTableContainer = document.querySelector('.stock-table-container');
    
    cardViewButton.addEventListener('click', () => {
        cardViewButton.classList.add('active');
        tableViewButton.classList.remove('active');
        stockCards.style.display = 'grid';
        stockTableContainer.style.display = 'none';
    });
    
    tableViewButton.addEventListener('click', () => {
        tableViewButton.classList.add('active');
        cardViewButton.classList.remove('active');
        stockTableContainer.style.display = 'block';
        stockCards.style.display = 'none';
    });
}

/**
 * Initialize mobile bottom sheet
 */
function initMobileBottomSheet() {
    const mobileFilterButton = document.getElementById('mobile-filter-button');
    const bottomSheet = document.getElementById('filter-bottom-sheet');
    const closeButton = document.getElementById('close-bottom-sheet');
    const overlay = document.getElementById('bottom-sheet-overlay');
    const filterTabs = document.querySelectorAll('.filter-tab');
    const filterContents = document.querySelectorAll('.filter-content');
    const applyButton = document.getElementById('apply-filters');
    const resetButton = document.getElementById('reset-filters');
    
    // Clone desktop filter content for mobile tabs
    cloneFiltersForMobile();
    
    mobileFilterButton.addEventListener('click', () => {
        bottomSheet.classList.add('open');
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    });
    
    function closeBottomSheet() {
        bottomSheet.classList.remove('open');
        overlay.classList.remove('active');
        document.body.style.overflow = '';
    }
    
    closeButton.addEventListener('click', closeBottomSheet);
    overlay.addEventListener('click', closeBottomSheet);
    
    // Tab navigation
    filterTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabId = tab.getAttribute('data-tab');
            
            // Update active tab
            filterTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Show corresponding content
            filterContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === `mobile-${tabId}-filters` || 
                    content.id === `mobile-${tabId}-gates` || 
                    content.id === `mobile-${tabId}-system`) {
                    content.classList.add('active');
                }
            });
        });
    });
    
    // Apply button
    applyButton.addEventListener('click', () => {
        // Sync mobile filters with desktop filters
        syncMobileFiltersToDesktop();
        filterStocks();
        closeBottomSheet();
    });
    
    // Reset button
    resetButton.addEventListener('click', () => {
        const mobileActiveChips = document.querySelectorAll('#filter-bottom-sheet .filter-chip.active');
        mobileActiveChips.forEach(chip => {
            chip.classList.remove('active');
        });
    });
}

/**
 * Clone desktop filters for mobile bottom sheet
 */
function cloneFiltersForMobile() {
    // Basic filters
    const basicFilters = document.getElementById('basic-filters-content');
    const mobileBasicFilters = document.getElementById('mobile-basic-filters');
    mobileBasicFilters.innerHTML = basicFilters.innerHTML;
    
    // Numeric gates
    const numericGates = document.getElementById('numeric-gates-content');
    const mobileNumericGates = document.getElementById('mobile-numeric-gates');
    mobileNumericGates.innerHTML = numericGates.innerHTML;
    
    // Qualitative filters
    const qualitativeFilters = document.getElementById('qualitative-filters-content');
    const mobileQualitativeFilters = document.getElementById('mobile-qualitative-filters');
    mobileQualitativeFilters.innerHTML = qualitativeFilters.innerHTML;
    
    // Ranking system
    const rankingSystem = document.getElementById('ranking-system-content');
    const mobileRankingSystem = document.getElementById('mobile-ranking-system');
    mobileRankingSystem.innerHTML = rankingSystem.innerHTML;
    
    // Initialize filter chips in mobile view
    const mobileFilterChips = document.querySelectorAll('#filter-bottom-sheet .filter-chip');
    mobileFilterChips.forEach(chip => {
        chip.addEventListener('click', () => {
            chip.classList.toggle('active');
        });
    });
    
    // Initialize ranking cards in mobile view
    const mobileRankingCards = document.querySelectorAll('#mobile-ranking-system .ranking-card');
    mobileRankingCards.forEach(card => {
        card.addEventListener('click', () => {
            // Remove active class from all cards
            mobileRankingCards.forEach(c => c.classList.remove('active'));
            
            // Add active class to clicked card
            card.classList.add('active');
        });
    });
    
    // Initialize rank momentum toggle in mobile view
    const mobileRankMomentumToggle = document.querySelector('#mobile-ranking-system .toggle');
    if (mobileRankMomentumToggle) {
        mobileRankMomentumToggle.addEventListener('click', () => {
            mobileRankMomentumToggle.classList.toggle('active');
        });
    }
    
    // Initialize tooltips for mobile filter elements
    initTooltips();
}

/**
 * Sync mobile filters to desktop filters
 */
function syncMobileFiltersToDesktop() {
    // Get all filter types and values
    const filterTypes = ['market-cap', 'volume', 'debt', 'valuation', 'rotce', 
                         'debt-ebitda', 'fcf-ni', 'share-cagr', 'ev-ebit', 'deep-value',
                         'moat-keywords', 'insider-ownership', 'insider-buys', 'margin-trend', 
                         'inc-roic', 'exclude-flags'];
    
    // Clear all desktop filters first
    const desktopActiveChips = document.querySelectorAll('.filters-panel .filter-chip.active');
    desktopActiveChips.forEach(chip => {
        chip.classList.remove('active');
    });
    
    // Apply mobile filters to desktop
    const mobileActiveChips = document.querySelectorAll('#filter-bottom-sheet .filter-chip.active');
    mobileActiveChips.forEach(mobileChip => {
        const filterType = mobileChip.getAttribute('data-filter');
        const filterValue = mobileChip.getAttribute('data-value');
        
        if (filterType && filterValue) {
            const desktopChip = document.querySelector(`.filters-panel .filter-chip[data-filter="${filterType}"][data-value="${filterValue}"]`);
            if (desktopChip) {
                desktopChip.classList.add('active');
            }
        }
    });
    
    // Sync ranking cards
    const mobileActiveRankingCard = document.querySelector('#mobile-ranking-system .ranking-card.active');
    if (mobileActiveRankingCard) {
        const rankingType = mobileActiveRankingCard.getAttribute('data-ranking');
        const desktopRankingCard = document.querySelector(`.filters-panel .ranking-card[data-ranking="${rankingType}"]`);
        if (desktopRankingCard) {
            document.querySelectorAll('.filters-panel .ranking-card').forEach(card => card.classList.remove('active'));
            desktopRankingCard.classList.add('active');
        }
    }
    
    // Sync rank momentum toggle
    const mobileRankMomentumToggle = document.querySelector('#mobile-ranking-system .toggle');
    const desktopRankMomentumToggle = document.getElementById('rank-momentum-toggle');
    if (mobileRankMomentumToggle && desktopRankMomentumToggle) {
        if (mobileRankMomentumToggle.classList.contains('active')) {
            desktopRankMomentumToggle.classList.add('active');
        } else {
            desktopRankMomentumToggle.classList.remove('active');
        }
    }
    
    // Update applied filters
    updateAppliedFilters();
}

/**
 * Initialize theme toggle
 */
function initThemeToggle() {
    const themeToggle = document.getElementById('theme-toggle');
    const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');
    
    // Check for saved theme preference or use system preference
    const savedTheme = localStorage.getItem('theme');
    const isDarkMode = savedTheme === 'dark' || (savedTheme === null && prefersDarkScheme.matches);
    
    // Apply initial theme
    if (isDarkMode) {
        document.body.classList.add('dark-mode');
        themeToggle.classList.add('active');
    }
    
    // Toggle theme on click
    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        themeToggle.classList.toggle('active');
        
        // Save preference
        const currentTheme = document.body.classList.contains('dark-mode') ? 'dark' : 'light';
        localStorage.setItem('theme', currentTheme);
    });
}

/**
 * Filter stocks based on selected filters and search term
 */
function filterStocks() {
    // Get all stocks
    let stocks = window.allStocks || [];
    
    // Apply search filter first
    if (window.filterStocksBySearch) {
        stocks = window.filterStocksBySearch(stocks);
    }
    
    // In a real implementation, this would apply the filters to the actual data
    // For this demo, we'll just update the count and display filtered stocks
    const activeFilters = document.querySelectorAll('.filter-chip.active');
    const totalStocks = document.getElementById('total-stocks');
    
    // Simulate filtering by reducing the count based on active filters
    const filteredCount = Math.max(5, stocks.length - (activeFilters.length * 2));
    
    totalStocks.textContent = filteredCount;
    
    // Update pagination
    updatePagination(filteredCount);
    
    // Display filtered stocks
    displayStocks(stocks.slice(0, filteredCount));
    
    // Show no results message if needed
    const noResultsMessage = document.getElementById('no-results-message');
    if (filteredCount === 0) {
        if (!noResultsMessage) {
            const message = document.createElement('div');
            message.id = 'no-results-message';
            message.className = 'no-results';
            message.textContent = 'No stocks match your search criteria. Try adjusting your filters or search term.';
            
            const mainContent = document.querySelector('.main-content .card-content');
            mainContent.appendChild(message);
        }
    } else if (noResultsMessage) {
        noResultsMessage.remove();
    }
}

/**
 * Update pagination based on filtered count
 */
function updatePagination(totalCount) {
    const paginationContainer = document.getElementById('pagination');
    paginationContainer.innerHTML = '';
    
    const itemsPerPage = 20;
    const totalPages = Math.ceil(totalCount / itemsPerPage);
    
    // Only show pagination if we have more than one page
    if (totalPages <= 1) return;
    
    // Create pagination buttons
    for (let i = 1; i <= Math.min(5, totalPages); i++) {
        const pageButton = document.createElement('div');
        pageButton.className = 'page-button';
        if (i === 1) pageButton.classList.add('active');
        pageButton.textContent = i;
        
        pageButton.addEventListener('click', () => {
            // Update active state
            document.querySelectorAll('.page-button').forEach(btn => {
                btn.classList.remove('active');
            });
            pageButton.classList.add('active');
            
            // In a real implementation, this would load the corresponding page of data
        });
        
        paginationContainer.appendChild(pageButton);
    }
    
    // Add ellipsis and last page if needed
    if (totalPages > 5) {
        const ellipsis = document.createElement('div');
        ellipsis.className = 'page-button';
        ellipsis.textContent = '...';
        ellipsis.style.cursor = 'default';
        
        const lastPage = document.createElement('div');
        lastPage.className = 'page-button';
        lastPage.textContent = totalPages;
        
        paginationContainer.appendChild(ellipsis);
        paginationContainer.appendChild(lastPage);
    }
}

/**
 * Display stocks based on filtered data
 */
function displayStocks(stocks) {
    const tableBody = document.getElementById('stock-table-body');
    const cardsContainer = document.getElementById('stock-cards');
    
    // Clear existing content
    tableBody.innerHTML = '';
    cardsContainer.innerHTML = '';
    
    // If no stocks to display, return early
    if (!stocks || stocks.length === 0) return;
    
    // Display in table view
    stocks.forEach(stock => {
        // Create table row
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${stock.symbol}</td>
            <td>${stock.name}</td>
            <td>$${stock.price}</td>
            <td>${stock.debtEbitda}×</td>
            <td>${stock.fcfNi}</td>
            <td>${stock.evEbit}×</td>
            <td>${stock.rotce}%</td>
            <td>${stock.score}</td>
        `;
        tableBody.appendChild(row);
        
        // Create card
        const card = document.createElement('div');
        card.className = 'stock-card';
        card.innerHTML = `
            <div class="stock-header">
                <div class="stock-symbol">${stock.symbol}</div>
                <div class="stock-price">$${stock.price}</div>
            </div>
            <div class="stock-name">${stock.name}</div>
            <div class="stock-sector">${stock.sector}</div>
            <div class="stock-metrics">
                <div class="metric">
                    <div class="metric-label">Debt/EBITDA</div>
                    <div class="metric-value">${stock.debtEbitda}×</div>
                </div>
                <div class="metric">
                    <div class="metric-label">FCF/NI</div>
                    <div class="metric-value">${stock.fcfNi}</div>
                </div>
                <div class="metric">
                    <div class="metric-label">EV/EBIT</div>
                    <div class="metric-value">${stock.evEbit}×</div>
                </div>
                <div class="metric">
                    <div class="metric-label">Score</div>
                    <div class="metric-value">${stock.score}</div>
                </div>
            </div>
        `;
        cardsContainer.appendChild(card);
    });
}

/**
 * Load sample data
 */
function loadSampleData() {
    // Initialize with some active filters
    document.querySelector('.filter-chip[data-filter="market-cap"][data-value="large"]').classList.add('active');
    document.querySelector('.filter-chip[data-filter="debt"][data-value="low"]').classList.add('active');
    document.querySelector('.filter-chip[data-filter="debt-ebitda"][data-value="1"]').classList.add('active');
    
    // Update applied filters
    updateAppliedFilters();
    
    // Filter stocks
    filterStocks();
    
    // Set a ranking method
    document.querySelector('.ranking-card[data-ranking="combined"]').classList.add('active');
    
    // Activate rank momentum toggle
    document.getElementById('rank-momentum-toggle').classList.add('active');
}


async function fetchRanking(method) {
  try {
    const response = await fetch(`/api/filters/ranking/${method}`);
    const data = await response.json();

    const resultsContainer = document.getElementById('results');
    resultsContainer.innerHTML = '';

    data.forEach(stock => {
      const card = document.createElement('div');
      card.className = 'stock-card';
      card.style = 'border: 1px solid #ccc; padding: 10px; width: 300px;';
      card.innerHTML = `
        <h3>${stock.companyName} (${stock.symbol})</h3>
        <p><strong>Sector:</strong> ${stock.sector}</p>
        <p><strong>Price:</strong> $${stock.price?.toFixed(2) ?? 'N/A'}</p>
        <p><strong>Market Cap:</strong> $${stock.marketCap ? (stock.marketCap / 1e9).toFixed(2) + 'B' : 'N/A'}</p>
      `;
      resultsContainer.appendChild(card);
    });
  } catch (err) {
    console.error('Error fetching ranking:', err);
  }
}
