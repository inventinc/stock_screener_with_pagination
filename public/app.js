/**
 * Stock Screener - Modern UX
 * Main JavaScript for interactive functionality
 */

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM content loaded, initializing application...');
    
    // Ensure stocks container exists
    ensureStocksContainerExists();
    
    // Initialize tooltips
    initTooltips();
    
    // Initialize filter sections
    initFilterSections();
    
    // Initialize filter chips
    initFilterChips();
    
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
    
    // Define filterStocksBySearch function globally
    window.filterStocksBySearch = function(stocks) {
        const searchInput = document.getElementById('search-input');
        if (!searchInput || !searchInput.value.trim()) return stocks;
        
        const searchTerm = searchInput.value.trim().toLowerCase();
        return stocks.filter(stock => 
            stock.symbol.toLowerCase().includes(searchTerm) || 
            (stock.name && stock.name.toLowerCase().includes(searchTerm)) ||
            (stock.sector && stock.sector.toLowerCase().includes(searchTerm))
        );
    };
    
    // Load sample data initially to ensure UI is populated
    loadSampleData();
    
    // Then try to load live data
    setTimeout(() => {
        console.log('Attempting to load live data...');
        loadLiveData();
    }, 1000);
});

/**
 * Ensure stocks container exists
 */
function ensureStocksContainerExists() {
    console.log('Ensuring stocks container exists...');
    
    // Check if stocks container already exists
    let stocksContainer = document.getElementById('stocks-container');
    
    if (!stocksContainer) {
        console.log('Stocks container not found, creating it...');
        
        // Create the stocks container
        stocksContainer = document.createElement('div');
        stocksContainer.id = 'stocks-container';
        stocksContainer.className = 'table-view'; // Default to table view
        
        // Find the appropriate place to insert it
        const mainContent = document.querySelector('.main-content .card-content');
        if (mainContent) {
            // Try to insert after the applied filters
            const appliedFilters = document.getElementById('applied-filters');
            if (appliedFilters) {
                appliedFilters.after(stocksContainer);
            } else {
                // Or after the search bar
                const searchBar = document.querySelector('.search-bar');
                if (searchBar) {
                    searchBar.after(stocksContainer);
                } else {
                    // Or just append to main content
                    mainContent.appendChild(stocksContainer);
                }
            }
            console.log('Stocks container created and inserted into main content');
        } else {
            // If main content not found, try to find stock cards or table
            const stockCards = document.getElementById('stock-cards');
            if (stockCards) {
                stockCards.parentNode.insertBefore(stocksContainer, stockCards);
                console.log('Stocks container created and inserted before stock cards');
            } else {
                const stockTable = document.querySelector('.stock-table-container');
                if (stockTable) {
                    stockTable.parentNode.insertBefore(stocksContainer, stockTable);
                    console.log('Stocks container created and inserted before stock table');
                } else {
                    // Last resort: append to body
                    document.body.appendChild(stocksContainer);
                    console.log('Stocks container created and appended to body');
                }
            }
        }
    } else {
        console.log('Stocks container already exists');
    }
    
    return stocksContainer;
}

/**
 * Initialize tooltips
 */
function initTooltips() {
    const tooltip = document.getElementById('tooltip');
    if (!tooltip) {
        console.log('Tooltip element not found');
        return;
    }
    
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
            if (!content) return;
            
            const toggleIcon = header.querySelector('.toggle-icon');
            if (!toggleIcon) return;
            
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
        if (!content) return;
        
        const toggleIcon = header.querySelector('.toggle-icon');
        if (!toggleIcon) return;
        
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
    if (clearAllButton) {
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
}

/**
 * Initialize view controls
 */
function initViewControls() {
    const cardViewButton = document.getElementById('card-view-button');
    const tableViewButton = document.getElementById('table-view-button');
    const stocksContainer = document.getElementById('stocks-container');
    
    // Check if elements exist before using them
    if (!cardViewButton || !tableViewButton) {
        console.log('View control elements not found');
        return;
    }
    
    // Ensure stocks container exists
    if (!stocksContainer) {
        console.log('Stocks container not found in initViewControls, creating it');
        ensureStocksContainerExists();
    }
    
    // Set card view as default
    const container = document.getElementById('stocks-container');
    if (container) {
        container.className = 'card-view';
        if (cardViewButton) cardViewButton.classList.add('active');
        if (tableViewButton) tableViewButton.classList.remove('active');
    }
    
    if (cardViewButton) {
        cardViewButton.addEventListener('click', () => {
            console.log('Card view button clicked');
            const container = document.getElementById('stocks-container');
            if (container) {
                container.className = 'card-view';
            }
            cardViewButton.classList.add('active');
            tableViewButton.classList.remove('active');
        });
    }
    
    if (tableViewButton) {
        tableViewButton.addEventListener('click', () => {
            console.log('Table view button clicked');
            const container = document.getElementById('stocks-container');
            if (container) {
                container.className = 'table-view';
            }
            tableViewButton.classList.add('active');
            cardViewButton.classList.remove('active');
        });
    }
}

/**
 * Initialize mobile bottom sheet
 */
function initMobileBottomSheet() {
    const filterButton = document.getElementById('filter-button');
    const mobileBottomSheet = document.querySelector('.mobile-bottom-sheet');
    const mobileBottomSheetOverlay = document.querySelector('.mobile-bottom-sheet-overlay');
    const mobileFilterTabs = document.querySelectorAll('.filter-tab');
    const mobileFilterSections = document.querySelectorAll('.mobile-filter-section');
    
    // Check if elements exist
    if (!filterButton || !mobileBottomSheet || !mobileBottomSheetOverlay) {
        console.log('Mobile bottom sheet elements not found');
        return;
    }
    
    // Open bottom sheet when filter button is clicked
    filterButton.addEventListener('click', () => {
        mobileBottomSheet.classList.add('open');
        mobileBottomSheetOverlay.style.display = 'block';
        document.body.style.overflow = 'hidden'; // Prevent scrolling
    });
    
    // Close bottom sheet when overlay is clicked
    mobileBottomSheetOverlay.addEventListener('click', () => {
        mobileBottomSheet.classList.remove('open');
        mobileBottomSheetOverlay.style.display = 'none';
        document.body.style.overflow = ''; // Allow scrolling
    });
    
    // Handle filter tab clicks
    mobileFilterTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabType = tab.getAttribute('data-tab');
            
            // Remove active class from all tabs
            mobileFilterTabs.forEach(t => t.classList.remove('active'));
            
            // Add active class to clicked tab
            tab.classList.add('active');
            
            // Hide all filter sections
            mobileFilterSections.forEach(section => {
                section.style.display = 'none';
            });
            
            // Show selected filter section
            const selectedSection = document.querySelector(`.mobile-filter-section[data-section="${tabType}"]`);
            if (selectedSection) {
                selectedSection.style.display = 'block';
            }
        });
    });
    
    // Set first tab as active by default
    if (mobileFilterTabs.length > 0) {
        mobileFilterTabs[0].click();
    }
}

/**
 * Initialize theme toggle
 */
function initThemeToggle() {
    const themeToggle = document.getElementById('theme-toggle');
    if (!themeToggle) {
        console.log('Theme toggle element not found');
        return;
    }
    
    // Check if user has a saved preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
        themeToggle.classList.add('active');
    }
    
    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark-theme');
        themeToggle.classList.toggle('active');
        
        // Save preference
        const isDarkTheme = document.body.classList.contains('dark-theme');
        localStorage.setItem('theme', isDarkTheme ? 'dark' : 'light');
    });
}

/**
 * Initialize customize metrics
 */
function initCustomizeMetrics() {
    const customizeButton = document.getElementById('customize-metrics-button');
    const customizeModal = document.getElementById('customize-metrics-modal');
    const customizeModalOverlay = document.getElementById('customize-modal-overlay');
    const customizeModalClose = document.getElementById('customize-modal-close');
    const customizeForm = document.getElementById('customize-metrics-form');
    
    // Check if elements exist
    if (!customizeButton || !customizeModal || !customizeModalOverlay || !customizeModalClose || !customizeForm) {
        console.log('Customize metrics elements not found');
        return;
    }
    
    // Open modal when customize button is clicked
    customizeButton.addEventListener('click', () => {
        customizeModal.style.display = 'block';
        customizeModalOverlay.style.display = 'block';
    });
    
    // Close modal when close button is clicked
    customizeModalClose.addEventListener('click', () => {
        customizeModal.style.display = 'none';
        customizeModalOverlay.style.display = 'none';
    });
    
    // Close modal when overlay is clicked
    customizeModalOverlay.addEventListener('click', () => {
        customizeModal.style.display = 'none';
        customizeModalOverlay.style.display = 'none';
    });
    
    // Handle form submission
    customizeForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        // Get selected metrics
        const selectedMetrics = Array.from(customizeForm.querySelectorAll('input[type="checkbox"]:checked')).map(checkbox => checkbox.value);
        
        // Save selected metrics
        localStorage.setItem('selectedMetrics', JSON.stringify(selectedMetrics));
        
        // Update UI
        updateMetricsDisplay(selectedMetrics);
        
        // Close modal
        customizeModal.style.display = 'none';
        customizeModalOverlay.style.display = 'none';
    });
    
    // Load saved metrics
    const savedMetrics = JSON.parse(localStorage.getItem('selectedMetrics')) || ['price', 'debtEbitda', 'fcfNi', 'evEbit', 'rotce', 'score'];
    
    // Update checkboxes
    savedMetrics.forEach(metric => {
        const checkbox = customizeForm.querySelector(`input[value="${metric}"]`);
        if (checkbox) {
            checkbox.checked = true;
        }
    });
    
    // Update UI
    updateMetricsDisplay(savedMetrics);
}

/**
 * Update metrics display based on selected metrics
 * @param {Array} selectedMetrics - Array of selected metric keys
 */
function updateMetricsDisplay(selectedMetrics) {
    // Update table headers
    const tableHeaders = document.querySelectorAll('.stock-table th[data-metric]');
    tableHeaders.forEach(header => {
        const metric = header.getAttribute('data-metric');
        header.style.display = selectedMetrics.includes(metric) ? 'table-cell' : 'none';
    });
    
    // Update table cells
    const tableCells = document.querySelectorAll('.stock-table td[data-metric]');
    tableCells.forEach(cell => {
        const metric = cell.getAttribute('data-metric');
        cell.style.display = selectedMetrics.includes(metric) ? 'table-cell' : 'none';
    });
    
    // Update card metrics
    const cardMetrics = document.querySelectorAll('.stock-card .metric[data-metric]');
    cardMetrics.forEach(metric => {
        const metricKey = metric.getAttribute('data-metric');
        metric.style.display = selectedMetrics.includes(metricKey) ? 'flex' : 'none';
    });
}

/**
 * Initialize search functionality
 */
function initSearch() {
    const searchInput = document.getElementById('search-input');
    const searchClear = document.getElementById('search-clear');
    
    // Check if elements exist
    if (!searchInput) {
        console.log('Search elements not found');
        return;
    }
    
    // Handle input changes
    searchInput.addEventListener('input', () => {
        // Show/hide clear button
        if (searchClear) {
            searchClear.style.display = searchInput.value ? 'block' : 'none';
        }
        
        // Filter stocks
        filterStocks();
    });
    
    // Handle clear button
    if (searchClear) {
        searchClear.addEventListener('click', () => {
            searchInput.value = '';
            searchClear.style.display = 'none';
            
            // Filter stocks
            filterStocks();
        });
    }
}

// Store active filters
const activeFilters = {};

/**
 * Update applied filters based on active filter chips
 */
function updateAppliedFilters() {
    // Reset active filters
    Object.keys(activeFilters).forEach(key => {
        delete activeFilters[key];
    });
    
    // Get all active filter chips
    const activeChips = document.querySelectorAll('.filter-chip.active');
    
    // Group by filter type
    activeChips.forEach(chip => {
        const filterType = chip.getAttribute('data-filter');
        const filterValue = chip.getAttribute('data-value');
        
        if (!activeFilters[filterType]) {
            activeFilters[filterType] = [];
        }
        
        activeFilters[filterType].push(filterValue);
    });
    
    // Update applied filters display
    updateAppliedFiltersDisplay();
}

/**
 * Update applied filters display
 */
function updateAppliedFiltersDisplay() {
    const appliedFiltersContainer = document.getElementById('applied-filters');
    if (!appliedFiltersContainer) {
        console.log('Applied filters container not found');
        return;
    }
    
    // Clear container
    appliedFiltersContainer.innerHTML = '';
    
    // Check if any filters are applied
    const hasFilters = Object.keys(activeFilters).length > 0;
    
    // Show/hide container
    appliedFiltersContainer.style.display = hasFilters ? 'flex' : 'none';
    
    // Add filter chips
    Object.keys(activeFilters).forEach(filterType => {
        const filterValues = activeFilters[filterType];
        
        filterValues.forEach(value => {
            const chip = document.createElement('div');
            chip.className = 'applied-filter-chip';
            
            // Format filter type and value for display
            const formattedType = formatFilterType(filterType);
            const formattedValue = formatFilterValue(filterType, value);
            
            chip.innerHTML = `
                <span>${formattedType}: ${formattedValue}</span>
                <span class="remove-filter" data-filter="${filterType}" data-value="${value}">×</span>
            `;
            
            appliedFiltersContainer.appendChild(chip);
        });
    });
    
    // Add event listeners to remove buttons
    const removeButtons = document.querySelectorAll('.remove-filter');
    removeButtons.forEach(button => {
        button.addEventListener('click', () => {
            const filterType = button.getAttribute('data-filter');
            const filterValue = button.getAttribute('data-value');
            
            // Find and deactivate the corresponding filter chip
            const filterChip = document.querySelector(`.filter-chip[data-filter="${filterType}"][data-value="${filterValue}"]`);
            if (filterChip) {
                filterChip.classList.remove('active');
            }
            
            // Update applied filters
            updateAppliedFilters();
            
            // Update filtered stocks
            filterStocks();
        });
    });
}

/**
 * Format filter type for display
 * @param {string} filterType - Filter type key
 * @returns {string} - Formatted filter type
 */
function formatFilterType(filterType) {
    const formatMap = {
        'market-cap': 'Market Cap',
        'sector': 'Sector',
        'debt': 'Debt',
        'debt-ebitda': 'Debt/EBITDA',
        'fcf-ni': 'FCF/NI',
        'ev-ebit': 'EV/EBIT',
        'rotce': 'ROTCE'
    };
    
    return formatMap[filterType] || filterType;
}

/**
 * Format filter value for display
 * @param {string} filterType - Filter type key
 * @param {string} value - Filter value
 * @returns {string} - Formatted filter value
 */
function formatFilterValue(filterType, value) {
    if (filterType === 'market-cap') {
        const formatMap = {
            'large': 'Large Cap (>$10B)',
            'mid': 'Mid Cap ($2-10B)',
            'small': 'Small Cap ($300M-2B)',
            'micro': 'Micro Cap (<$300M)'
        };
        return formatMap[value] || value;
    }
    
    if (filterType === 'debt') {
        const formatMap = {
            'low': 'Low',
            'medium': 'Medium',
            'high': 'High'
        };
        return formatMap[value] || value;
    }
    
    return value;
}

/**
 * Filter stocks based on active filters and search
 */
function filterStocks() {
    // Ensure stocks container exists
    ensureStocksContainerExists();
    
    // Get active ranking method
    const activeRankingCard = document.querySelector('.ranking-card.active');
    const rankingMethod = activeRankingCard ? activeRankingCard.getAttribute('data-ranking') : 'combined';
    
    // Get rank momentum toggle state
    const rankMomentumToggle = document.getElementById('rank-momentum-toggle');
    const rankMomentumActive = rankMomentumToggle ? rankMomentumToggle.classList.contains('active') : false;
    
    // Filter stocks
    let filteredStocks = window.allStocks || [];
    
    // Apply search filter if the function exists
    if (typeof window.filterStocksBySearch === 'function') {
        filteredStocks = window.filterStocksBySearch(filteredStocks);
    } else {
        console.log('filterStocksBySearch function not found');
        // Fallback search implementation
        const searchInput = document.getElementById('search-input');
        if (searchInput && searchInput.value.trim()) {
            const searchTerm = searchInput.value.trim().toLowerCase();
            filteredStocks = filteredStocks.filter(stock => 
                stock.symbol.toLowerCase().includes(searchTerm) || 
                (stock.name && stock.name.toLowerCase().includes(searchTerm)) ||
                (stock.sector && stock.sector.toLowerCase().includes(searchTerm))
            );
        }
    }
    
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
                    return filterValues.includes(stock.sector);
                });
                break;
                
            case 'debt':
                filteredStocks = filteredStocks.filter(stock => {
                    if (filterValues.includes('low') && stock.debtEbitda < 1.0) return true;
                    if (filterValues.includes('medium') && stock.debtEbitda >= 1.0 && stock.debtEbitda < 3.0) return true;
                    if (filterValues.includes('high') && stock.debtEbitda >= 3.0) return true;
                    return false;
                });
                break;
                
            case 'debt-ebitda':
                filteredStocks = filteredStocks.filter(stock => {
                    if (filterValues.includes('1') && stock.debtEbitda <= 1.0) return true;
                    if (filterValues.includes('2') && stock.debtEbitda <= 2.0) return true;
                    if (filterValues.includes('3') && stock.debtEbitda <= 3.0) return true;
                    return false;
                });
                break;
                
            case 'fcf-ni':
                filteredStocks = filteredStocks.filter(stock => {
                    if (filterValues.includes('0.8') && stock.fcfNi >= 0.8) return true;
                    if (filterValues.includes('1.0') && stock.fcfNi >= 1.0) return true;
                    if (filterValues.includes('1.2') && stock.fcfNi >= 1.2) return true;
                    return false;
                });
                break;
                
            case 'ev-ebit':
                filteredStocks = filteredStocks.filter(stock => {
                    if (filterValues.includes('10') && stock.evEbit <= 10.0) return true;
                    if (filterValues.includes('15') && stock.evEbit <= 15.0) return true;
                    if (filterValues.includes('20') && stock.evEbit <= 20.0) return true;
                    return false;
                });
                break;
                
            case 'rotce':
                filteredStocks = filteredStocks.filter(stock => {
                    if (filterValues.includes('15') && stock.rotce >= 15.0) return true;
                    if (filterValues.includes('20') && stock.rotce >= 20.0) return true;
                    if (filterValues.includes('25') && stock.rotce >= 25.0) return true;
                    return false;
                });
                break;
        }
    });
    
    // Sort stocks by ranking
    filteredStocks.sort((a, b) => b.score - a.score);
    
    // Render stocks
    renderStocks(filteredStocks);
    
    // Update filter counts
    updateFilterCounts(window.allStocks || []);
}

/**
 * Render stocks in the container
 * @param {Array} stocks - Array of stock objects
 */
function renderStocks(stocks) {
    // Ensure stocks container exists
    const stocksContainer = ensureStocksContainerExists();
    if (!stocksContainer) {
        console.log('Stocks container not found in renderStocks');
        return;
    }
    
    console.log(`Rendering ${stocks.length} stocks`);
    
    // Clear container
    stocksContainer.innerHTML = '';
    
    // Check if there are any stocks
    if (stocks.length === 0) {
        stocksContainer.innerHTML = '<div class="no-results">No stocks match your filters. Try adjusting your criteria.</div>';
        return;
    }
    
    // Create table
    const table = document.createElement('table');
    table.className = 'stock-table';
    
    // Create table header
    const thead = document.createElement('thead');
    thead.innerHTML = `
        <tr>
            <th>Symbol</th>
            <th>Name</th>
            <th>Sector</th>
            <th data-metric="price">Price</th>
            <th data-metric="debtEbitda">Debt/EBITDA</th>
            <th data-metric="fcfNi">FCF/NI</th>
            <th data-metric="evEbit">EV/EBIT</th>
            <th data-metric="rotce">ROTCE</th>
            <th data-metric="score">Score</th>
        </tr>
    `;
    table.appendChild(thead);
    
    // Create table body
    const tbody = document.createElement('tbody');
    
    // Add rows
    stocks.forEach(stock => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${stock.symbol}</td>
            <td>${stock.name || 'N/A'}</td>
            <td>${stock.sector || 'N/A'}</td>
            <td data-metric="price">$${stock.price ? stock.price.toFixed(2) : 'N/A'}</td>
            <td data-metric="debtEbitda">${stock.debtEbitda ? stock.debtEbitda.toFixed(2) : 'N/A'}</td>
            <td data-metric="fcfNi">${stock.fcfNi ? stock.fcfNi.toFixed(2) : 'N/A'}</td>
            <td data-metric="evEbit">${stock.evEbit ? stock.evEbit.toFixed(1) : 'N/A'}</td>
            <td data-metric="rotce">${stock.rotce ? stock.rotce.toFixed(1) + '%' : 'N/A'}</td>
            <td data-metric="score" class="score">${stock.score ? stock.score.toFixed(0) : 'N/A'}</td>
        `;
        tbody.appendChild(row);
    });
    
    table.appendChild(tbody);
    
    // Create cards
    const cardsContainer = document.createElement('div');
    cardsContainer.className = 'stock-cards';
    
    // Add cards
    stocks.forEach(stock => {
        // Determine score color
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
        
        const card = document.createElement('div');
        card.className = `stock-card ${scoreColorClass}`;
        card.innerHTML = `
            <div class="card-header">
                <div class="symbol">${stock.symbol}</div>
                <div class="score">${stock.score ? stock.score.toFixed(0) : 'N/A'}</div>
            </div>
            <div class="name">${stock.name || 'N/A'}</div>
            <div class="sector">${stock.sector || 'N/A'}</div>
            <div class="price">$${stock.price ? stock.price.toFixed(2) : 'N/A'}</div>
            <div class="metrics">
                <div class="metric" data-metric="debtEbitda">
                    <div class="metric-label">Debt/EBITDA</div>
                    <div class="metric-value">${stock.debtEbitda ? stock.debtEbitda.toFixed(2) : 'N/A'}</div>
                </div>
                <div class="metric" data-metric="fcfNi">
                    <div class="metric-label">FCF/NI</div>
                    <div class="metric-value">${stock.fcfNi ? stock.fcfNi.toFixed(2) : 'N/A'}</div>
                </div>
                <div class="metric" data-metric="evEbit">
                    <div class="metric-label">EV/EBIT</div>
                    <div class="metric-value">${stock.evEbit ? stock.evEbit.toFixed(1) : 'N/A'}</div>
                </div>
                <div class="metric" data-metric="rotce">
                    <div class="metric-label">ROTCE</div>
                    <div class="metric-value">${stock.rotce ? stock.rotce.toFixed(1) + '%' : 'N/A'}</div>
                </div>
            </div>
        `;
        cardsContainer.appendChild(card);
    });
    
    // Add table and cards to container
    stocksContainer.appendChild(table);
    stocksContainer.appendChild(cardsContainer);
    
    // Update metrics display
    const savedMetrics = JSON.parse(localStorage.getItem('selectedMetrics')) || ['price', 'debtEbitda', 'fcfNi', 'evEbit', 'rotce', 'score'];
    updateMetricsDisplay(savedMetrics);
    
    console.log('Stocks rendered successfully');
}

/**
 * Update filter counts
 * @param {Array} stocks - Array of all stock objects
 */
function updateFilterCounts(stocks) {
    // Update market cap filter counts
    updateFilterCount('market-cap', 'large', stocks.filter(s => s.marketCap >= 10000000000).length);
    updateFilterCount('market-cap', 'mid', stocks.filter(s => s.marketCap >= 2000000000 && s.marketCap < 10000000000).length);
    updateFilterCount('market-cap', 'small', stocks.filter(s => s.marketCap >= 300000000 && s.marketCap < 2000000000).length);
    updateFilterCount('market-cap', 'micro', stocks.filter(s => s.marketCap < 300000000).length);
    
    // Update sector filter counts
    const sectors = {};
    stocks.forEach(stock => {
        if (stock.sector) {
            sectors[stock.sector] = (sectors[stock.sector] || 0) + 1;
        }
    });
    
    Object.keys(sectors).forEach(sector => {
        updateFilterCount('sector', sector, sectors[sector]);
    });
    
    // Update debt filter counts
    updateFilterCount('debt', 'low', stocks.filter(s => s.debtEbitda < 1.0).length);
    updateFilterCount('debt', 'medium', stocks.filter(s => s.debtEbitda >= 1.0 && s.debtEbitda < 3.0).length);
    updateFilterCount('debt', 'high', stocks.filter(s => s.debtEbitda >= 3.0).length);
    
    // Update debt-ebitda filter counts
    updateFilterCount('debt-ebitda', '1', stocks.filter(s => s.debtEbitda <= 1.0).length);
    updateFilterCount('debt-ebitda', '2', stocks.filter(s => s.debtEbitda <= 2.0).length);
    updateFilterCount('debt-ebitda', '3', stocks.filter(s => s.debtEbitda <= 3.0).length);
    
    // Update fcf-ni filter counts
    updateFilterCount('fcf-ni', '0.8', stocks.filter(s => s.fcfNi >= 0.8).length);
    updateFilterCount('fcf-ni', '1.0', stocks.filter(s => s.fcfNi >= 1.0).length);
    updateFilterCount('fcf-ni', '1.2', stocks.filter(s => s.fcfNi >= 1.2).length);
    
    // Update ev-ebit filter counts
    updateFilterCount('ev-ebit', '10', stocks.filter(s => s.evEbit <= 10.0).length);
    updateFilterCount('ev-ebit', '15', stocks.filter(s => s.evEbit <= 15.0).length);
    updateFilterCount('ev-ebit', '20', stocks.filter(s => s.evEbit <= 20.0).length);
    
    // Update rotce filter counts
    updateFilterCount('rotce', '15', stocks.filter(s => s.rotce >= 15.0).length);
    updateFilterCount('rotce', '20', stocks.filter(s => s.rotce >= 20.0).length);
    updateFilterCount('rotce', '25', stocks.filter(s => s.rotce >= 25.0).length);
}

/**
 * Update filter count
 * @param {string} filterType - Filter type
 * @param {string} filterValue - Filter value
 * @param {number} count - Count
 */
function updateFilterCount(filterType, filterValue, count) {
    const filterChip = document.querySelector(`.filter-chip[data-filter="${filterType}"][data-value="${filterValue}"]`);
    if (!filterChip) return;
    
    const countElement = filterChip.querySelector('.count');
    if (countElement) {
        countElement.textContent = `(${count})`;
    }
}

/**
 * Calculate average score
 * @param {Array} stocks - Array of stock objects
 * @returns {number} - Average score
 */
function calculateAverageScore(stocks) {
    if (stocks.length === 0) return 0;
    
    const sum = stocks.reduce((total, stock) => {
        return total + (stock.score || 0);
    }, 0);
    
    return sum / stocks.length;
}

/**
 * Load sample data
 */
function loadSampleData() {
    console.log('Loading sample data...');
    
    // Sample stock data
    window.allStocks = [
        { symbol: 'AAPL', name: 'Apple Inc.', sector: 'Technology', price: 198.45, marketCap: 3200000000000, debtEbitda: 0.32, fcfNi: 1.12, evEbit: 8.7, rotce: 42.3, score: 87 },
        { symbol: 'MSFT', name: 'Microsoft Corporation', sector: 'Technology', price: 412.78, marketCap: 3100000000000, debtEbitda: 0.45, fcfNi: 0.98, evEbit: 9.2, rotce: 38.7, score: 82 },
        { symbol: 'GOOG', name: 'Alphabet Inc.', sector: 'Technology', price: 176.32, marketCap: 2200000000000, debtEbitda: 0.28, fcfNi: 1.05, evEbit: 7.8, rotce: 35.2, score: 85 },
        { symbol: 'AMZN', name: 'Amazon.com Inc.', sector: 'Consumer Cyclical', price: 187.63, marketCap: 1900000000000, debtEbitda: 0.52, fcfNi: 0.87, evEbit: 12.3, rotce: 28.6, score: 78 },
        { symbol: 'NVDA', name: 'NVIDIA Corporation', sector: 'Technology', price: 924.67, marketCap: 2300000000000, debtEbitda: 0.18, fcfNi: 1.21, evEbit: 6.5, rotce: 52.1, score: 92 },
        { symbol: 'META', name: 'Meta Platforms Inc.', sector: 'Communication Services', price: 478.22, marketCap: 1200000000000, debtEbitda: 0.21, fcfNi: 1.18, evEbit: 7.2, rotce: 47.3, score: 90 },
        { symbol: 'TSLA', name: 'Tesla Inc.', sector: 'Consumer Cyclical', price: 176.75, marketCap: 560000000000, debtEbitda: 0.42, fcfNi: 0.92, evEbit: 15.8, rotce: 32.5, score: 74 },
        { symbol: 'BRK.B', name: 'Berkshire Hathaway Inc.', sector: 'Financial Services', price: 412.32, marketCap: 950000000000, debtEbitda: 0.35, fcfNi: 0.88, evEbit: 10.2, rotce: 22.1, score: 79 },
        { symbol: 'JNJ', name: 'Johnson & Johnson', sector: 'Healthcare', price: 152.78, marketCap: 370000000000, debtEbitda: 0.48, fcfNi: 0.95, evEbit: 11.8, rotce: 26.4, score: 77 },
        { symbol: 'PG', name: 'Procter & Gamble Co', sector: 'Consumer Defensive', price: 165.32, marketCap: 390000000000, debtEbitda: 0.37, fcfNi: 0.95, evEbit: 11.4, rotce: 24.8, score: 76 },
        { symbol: 'V', name: 'Visa Inc.', sector: 'Financial Services', price: 278.45, marketCap: 580000000000, debtEbitda: 0.22, fcfNi: 1.15, evEbit: 7.9, rotce: 45.2, score: 89 },
        { symbol: 'JPM', name: 'JPMorgan Chase & Co.', sector: 'Financial Services', price: 198.76, marketCap: 570000000000, debtEbitda: 0.65, fcfNi: 0.88, evEbit: 12.5, rotce: 18.7, score: 72 }
    ];
    
    console.log(`Loaded ${window.allStocks.length} sample stocks`);
    
    // Initialize with some active filters
    const largeCapChip = document.querySelector('.filter-chip[data-filter="market-cap"][data-value="large"]');
    if (largeCapChip) largeCapChip.classList.add('active');
    
    const lowDebtChip = document.querySelector('.filter-chip[data-filter="debt"][data-value="low"]');
    if (lowDebtChip) lowDebtChip.classList.add('active');
    
    const debtEbitdaChip = document.querySelector('.filter-chip[data-filter="debt-ebitda"][data-value="1"]');
    if (debtEbitdaChip) debtEbitdaChip.classList.add('active');
    
    // Update applied filters
    updateAppliedFilters();
    
    // Filter stocks
    filterStocks();
}

/**
 * Load live data from API and refresh database
 */
function loadLiveData() {
    console.log('Attempting to load live data from API...');
    
    // Ensure stocks container exists
    const stocksContainer = ensureStocksContainerExists();
    if (!stocksContainer) {
        console.log('Stocks container not found in loadLiveData');
        return;
    }
    
    // Show loading indicator
    stocksContainer.innerHTML = '<div class="loading-indicator">Loading stocks data...</div>';
    
    // Get the current URL to determine API base URL
    const currentUrl = window.location.origin;
    console.log(`Current URL: ${currentUrl}`);
    
    // First, try to refresh the database with live API data
    console.log('Initiating database refresh...');
    
    // Use XMLHttpRequest instead of fetch for better compatibility
    const refreshXhr = new XMLHttpRequest();
    refreshXhr.open('POST', `${currentUrl}/api/stocks/refresh-all`, true);
    refreshXhr.setRequestHeader('Content-Type', 'application/json');
    
    refreshXhr.onload = function() {
        if (this.status >= 200 && this.status < 300) {
            console.log('Refresh all stocks initiated successfully');
            console.log('Response:', this.responseText);
            
            // Now fetch the stocks from the database
            fetchStocksData(currentUrl);
        } else {
            console.error('Error refreshing stocks:', this.status, this.statusText);
            console.log('Response:', this.responseText);
            
            // Try to fetch stocks anyway
            fetchStocksData(currentUrl);
        }
    };
    
    refreshXhr.onerror = function() {
        console.error('Network error during refresh');
        
        // Try to fetch stocks anyway
        fetchStocksData(currentUrl);
    };
    
    refreshXhr.send();
}

/**
 * Fetch stocks data from API
 * @param {string} baseUrl - API base URL
 */
function fetchStocksData(baseUrl) {
    console.log(`Fetching stocks data from ${baseUrl}/api/stocks`);
    
    // Use XMLHttpRequest instead of fetch for better compatibility
    const xhr = new XMLHttpRequest();
    xhr.open('GET', `${baseUrl}/api/stocks`, true);
    
    xhr.onload = function() {
        if (this.status >= 200 && this.status < 300) {
            console.log('Successfully fetched stocks data');
            
            try {
                const data = JSON.parse(this.responseText);
                console.log('Received data:', data);
                
                // Check if we have stocks data
                if (data.stocks && data.stocks.length > 0) {
                    console.log(`Received ${data.stocks.length} stocks from API`);
                    
                    // Store stocks data globally
                    window.allStocks = data.stocks.map(stock => ({
                        symbol: stock.symbol,
                        name: stock.companyName || stock.symbol,
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
                    showApiError('No stocks data received from API');
                }
            } catch (error) {
                console.error('Error parsing JSON response:', error);
                showApiError(`Error parsing API response: ${error.message}`);
            }
        } else {
            console.error('Error fetching stocks:', this.status, this.statusText);
            showApiError(`Error fetching stocks: ${this.status} ${this.statusText}`);
        }
    };
    
    xhr.onerror = function() {
        console.error('Network error during fetch');
        showApiError('Network error while fetching stocks data');
    };
    
    xhr.send();
}

/**
 * Show API error message
 * @param {string} message - Error message
 */
function showApiError(message) {
    // Ensure stocks container exists
    const stocksContainer = ensureStocksContainerExists();
    if (!stocksContainer) return;
    
    stocksContainer.innerHTML = `
        <div class="error-message">
            <h3>Error loading stocks data</h3>
            <p>${message}</p>
            <p>Using sample data instead.</p>
            <button id="retry-load" class="btn btn-primary">Retry Live Data</button>
        </div>
    `;
    
    // Add retry button functionality
    const retryButton = document.getElementById('retry-load');
    if (retryButton) {
        retryButton.addEventListener('click', loadLiveData);
    }
    
    // Load sample data as fallback
    loadSampleData();
}

// Ensure stocks container exists on window load
window.addEventListener('load', function() {
    console.log('Window loaded, ensuring stocks container exists');
    ensureStocksContainerExists();
});
