// Stock Card View Redesign Implementation - Score-Based Colors

/**
 * Create and render the redesigned stock cards
 */
function renderStockCards(stocks) {
    const stockCardsContainer = document.getElementById('stock-cards');
    stockCardsContainer.innerHTML = '';
    
    // Create a modal for stock summary if it doesn't exist
    if (!document.getElementById('stock-summary-modal')) {
        createStockSummaryModal();
    }
    
    stocks.forEach(stock => {
        const card = createStockCard(stock);
        stockCardsContainer.appendChild(card);
    });
}

/**
 * Create a single stock card with modern design
 */
function createStockCard(stock) {
    // Add sector information if not present
    if (!stock.sector) {
        stock.sector = getSectorForSymbol(stock.symbol);
    }
    
    // Add description if not present
    if (!stock.description) {
        stock.description = getDescriptionForSymbol(stock.symbol);
    }
    
    // Determine score class for color coding
    const scoreClass = getScoreClass(stock.score);
    
    const card = document.createElement('div');
    card.className = `stock-card ${scoreClass}`;
    card.dataset.symbol = stock.symbol;
    card.dataset.sector = stock.sector;
    
    // Create card header with color band
    const cardHeader = document.createElement('div');
    cardHeader.className = 'stock-card-header';
    
    // Add symbol and price
    const symbolContainer = document.createElement('div');
    symbolContainer.className = 'stock-symbol-container';
    
    const symbolEl = document.createElement('div');
    symbolEl.className = 'stock-symbol';
    symbolEl.textContent = stock.symbol;
    
    const priceEl = document.createElement('div');
    priceEl.className = 'stock-price';
    priceEl.textContent = `$${stock.price}`;
    
    symbolContainer.appendChild(symbolEl);
    symbolContainer.appendChild(priceEl);
    
    // Add company name
    const nameEl = document.createElement('div');
    nameEl.className = 'stock-name';
    nameEl.textContent = stock.name;
    
    // Add sector badge
    const sectorEl = document.createElement('div');
    sectorEl.className = 'stock-sector';
    sectorEl.textContent = stock.sector;
    
    // Add score badge
    const scoreEl = document.createElement('div');
    scoreEl.className = `score-badge ${scoreClass}`;
    scoreEl.textContent = stock.score;
    
    cardHeader.appendChild(symbolContainer);
    cardHeader.appendChild(nameEl);
    cardHeader.appendChild(sectorEl);
    cardHeader.appendChild(scoreEl);
    
    // Create card content
    const cardContent = document.createElement('div');
    cardContent.className = 'stock-card-content';
    
    // Add metrics grid
    const metricsGrid = document.createElement('div');
    metricsGrid.className = 'stock-metrics';
    
    // Get selected metrics from global state if available
    let metrics = [
        { label: 'Debt/EBITDA', value: `${stock.debtEbitda || '0.00'}×` },
        { label: 'FCF/NI', value: stock.fcfNi || '0.00' },
        { label: 'EV/EBIT', value: `${stock.evEbit || '0.00'}×` },
        { label: 'ROTCE', value: `${stock.rotce || '0.00'}%` }
    ];
    
    // Check if custom metrics are selected
    if (window.selectedMetrics && window.selectedMetrics.length > 0) {
        metrics = [];
        
        // Map metric IDs to stock properties
        const metricMap = {
            'avg-debt-ebitda': { label: 'Debt/EBITDA', value: `${stock.debtEbitda || '0.00'}×` },
            'avg-fcf-ni': { label: 'FCF/NI', value: stock.fcfNi || '0.00' },
            'avg-ev-ebit': { label: 'EV/EBIT', value: `${stock.evEbit || '0.00'}×` },
            'avg-rotce': { label: 'ROTCE', value: `${stock.rotce || '0.00'}%` },
            'avg-pe': { label: 'P/E', value: stock.pe ? `${stock.pe}×` : 'N/A' },
            'avg-pb': { label: 'P/B', value: stock.pb ? `${stock.pb}×` : 'N/A' },
            'avg-dividend': { label: 'Div Yield', value: stock.dividend ? `${stock.dividend}%` : 'N/A' },
            'avg-roic': { label: 'ROIC', value: stock.roic ? `${stock.roic}%` : 'N/A' },
            'avg-growth': { label: 'Rev Growth', value: stock.growth ? `${stock.growth}%` : 'N/A' }
        };
        
        // Add metrics based on selection
        window.selectedMetrics.forEach(metricId => {
            if (metricId !== 'total-stocks' && metricMap[metricId]) {
                metrics.push(metricMap[metricId]);
            }
        });
        
        // If no metrics were added (only total-stocks was selected), add default metrics
        if (metrics.length === 0) {
            metrics = [
                { label: 'Debt/EBITDA', value: `${stock.debtEbitda || '0.00'}×` },
                { label: 'FCF/NI', value: stock.fcfNi || '0.00' },
                { label: 'EV/EBIT', value: `${stock.evEbit || '0.00'}×` },
                { label: 'ROTCE', value: `${stock.rotce || '0.00'}%` }
            ];
        }
    }
    
    // Limit to 4 metrics for card view
    metrics = metrics.slice(0, 4);
    
    metrics.forEach(metric => {
        const metricEl = document.createElement('div');
        metricEl.className = 'metric';
        
        const labelEl = document.createElement('div');
        labelEl.className = 'metric-label';
        labelEl.textContent = metric.label;
        
        const valueEl = document.createElement('div');
        valueEl.className = 'metric-value';
        valueEl.textContent = metric.value;
        
        metricEl.appendChild(labelEl);
        metricEl.appendChild(valueEl);
        metricsGrid.appendChild(metricEl);
    });
    
    cardContent.appendChild(metricsGrid);
    
    // Assemble the card
    card.appendChild(cardHeader);
    card.appendChild(cardContent);
    
    // Add click event to show summary modal
    card.addEventListener('click', () => {
        showStockSummary(stock);
    });
    
    return card;
}

/**
 * Create the stock summary modal
 */
function createStockSummaryModal() {
    const modal = document.createElement('div');
    modal.className = 'stock-summary-modal';
    modal.id = 'stock-summary-modal';
    
    modal.innerHTML = `
        <div class="summary-modal-content">
            <div class="summary-modal-header">
                <div class="summary-company-info">
                    <div class="summary-symbol-price">
                        <div class="summary-symbol" id="summary-symbol"></div>
                        <div class="summary-price" id="summary-price"></div>
                    </div>
                    <div class="summary-company-name" id="summary-company-name"></div>
                </div>
                <div class="close-summary-modal">&times;</div>
            </div>
            <div class="summary-modal-body">
                <div class="summary-section">
                    <div class="summary-section-title">Company Description</div>
                    <div class="company-description" id="company-description">
                        <!-- Company description will be added here dynamically -->
                    </div>
                </div>
                <div class="summary-section">
                    <div class="summary-section-title">Key Metrics</div>
                    <div class="summary-metrics-grid" id="summary-metrics-grid">
                        <!-- Metrics will be added here dynamically -->
                    </div>
                </div>
                <div class="summary-section">
                    <div class="summary-section-title">Performance</div>
                    <div class="summary-chart-container">
                        <div class="summary-chart-placeholder">Stock performance chart would appear here</div>
                    </div>
                </div>
            </div>
            <div class="summary-modal-footer">
                <button class="summary-action-button secondary" id="close-summary">Close</button>
                <button class="summary-action-button primary" id="view-details">View Full Details</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add event listeners for closing the modal
    const closeButtons = [
        modal.querySelector('.close-summary-modal'),
        modal.querySelector('#close-summary')
    ];
    
    closeButtons.forEach(button => {
        button.addEventListener('click', () => {
            modal.classList.remove('active');
        });
    });
    
    // Close when clicking outside the content
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
        }
    });
    
    // View details button (placeholder functionality)
    const viewDetailsButton = modal.querySelector('#view-details');
    viewDetailsButton.addEventListener('click', () => {
        alert('Full details view would open here');
        modal.classList.remove('active');
    });
}

/**
 * Show the stock summary modal with the selected stock's data
 */
function showStockSummary(stock) {
    const modal = document.getElementById('stock-summary-modal');
    
    // Update header information
    document.getElementById('summary-symbol').textContent = stock.symbol;
    document.getElementById('summary-price').textContent = `$${stock.price}`;
    document.getElementById('summary-company-name').textContent = stock.name;
    
    // Update company description
    const descriptionEl = document.getElementById('company-description');
    descriptionEl.textContent = stock.description || getDescriptionForSymbol(stock.symbol);
    
    // Update metrics grid
    const metricsGrid = document.getElementById('summary-metrics-grid');
    metricsGrid.innerHTML = '';
    
    const metrics = [
        { label: 'Debt/EBITDA', value: `${stock.debtEbitda || '0.00'}×` },
        { label: 'FCF/NI', value: stock.fcfNi || '0.00' },
        { label: 'EV/EBIT', value: `${stock.evEbit || '0.00'}×` },
        { label: 'ROTCE', value: `${stock.rotce || '0.00'}%` },
        { label: 'Score', value: stock.score },
        { label: 'Sector', value: stock.sector }
    ];
    
    metrics.forEach(metric => {
        const metricEl = document.createElement('div');
        metricEl.className = 'summary-metric';
        
        const labelEl = document.createElement('div');
        labelEl.className = 'summary-metric-label';
        labelEl.textContent = metric.label;
        
        const valueEl = document.createElement('div');
        valueEl.className = 'summary-metric-value';
        valueEl.textContent = metric.value;
        
        metricEl.appendChild(labelEl);
        metricEl.appendChild(valueEl);
        metricsGrid.appendChild(metricEl);
    });
    
    // Show the modal
    modal.classList.add('active');
}

/**
 * Helper function to get sector for a symbol
 */
function getSectorForSymbol(symbol) {
    const sectorMap = {
        'AAPL': 'Technology',
        'MSFT': 'Technology',
        'GOOG': 'Technology',
        'AMZN': 'Consumer Cyclical',
        'BRK.B': 'Financial Services',
        'JNJ': 'Healthcare',
        'PG': 'Consumer Defensive',
        'V': 'Financial Services',
        'JPM': 'Financial Services'
    };
    
    return sectorMap[symbol] || 'Other';
}

/**
 * Helper function to get description for a symbol
 */
function getDescriptionForSymbol(symbol) {
    const descriptionMap = {
        'AAPL': 'Apple Inc. designs, manufactures, and markets smartphones, personal computers, tablets, wearables, and accessories worldwide. The company offers iPhone, Mac, iPad, and wearables, home, and accessories. It also provides AppleCare support and cloud services, and operates various platforms, including the App Store.',
        'MSFT': 'Microsoft Corporation develops, licenses, and supports software, services, devices, and solutions worldwide. The company operates through three segments: Productivity and Business Processes, Intelligent Cloud, and More Personal Computing.',
        'GOOG': 'Alphabet Inc. provides various products and platforms in the United States, Europe, the Middle East, Africa, the Asia-Pacific, Canada, and Latin America. It operates through Google Services, Google Cloud, and Other Bets segments.',
        'AMZN': 'Amazon.com, Inc. engages in the retail sale of consumer products and subscriptions through online and physical stores in North America and internationally. It operates through three segments: North America, International, and Amazon Web Services (AWS).',
        'BRK.B': 'Berkshire Hathaway Inc. engages in the insurance, freight rail transportation, and utility businesses worldwide. It provides property, casualty, life, accident, and health insurance and reinsurance; and operates railroad systems in North America.',
        'JNJ': 'Johnson & Johnson researches, develops, manufactures, and sells various products in the healthcare field worldwide. It operates through three segments: Consumer Health, Pharmaceutical, and Medical Devices.',
        'PG': 'The Procter & Gamble Company provides branded consumer packaged goods worldwide. It operates through five segments: Beauty; Grooming; Health Care; Fabric & Home Care; and Baby, Feminine & Family Care.',
        'V': 'Visa Inc. operates as a payment technology company worldwide. The company facilitates digital payments among consumers, merchants, financial institutions, businesses, strategic partners, and government entities.',
        'JPM': 'JPMorgan Chase & Co. operates as a financial services company worldwide. It operates through four segments: Consumer & Community Banking, Corporate & Investment Bank, Commercial Banking, and Asset & Wealth Management.'
    };
    
    return descriptionMap[symbol] || `${symbol} is a publicly traded company. Detailed description not available.`;
}

/**
 * Get the score class for color coding
 */
function getScoreClass(score) {
    if (score >= 85) return 'score-excellent';
    if (score >= 70) return 'score-good';
    if (score >= 50) return 'score-average';
    return 'score-poor';
}

/**
 * Initialize the card view with the redesigned cards
 */
function initCardView() {
    console.log('Initializing redesigned card view');
    
    // Add the redesigned styles
    if (!document.querySelector('link[href="styles-card-redesign-fix.css"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'styles-card-redesign-fix.css';
        document.head.appendChild(link);
    }
    
    // Update the view toggle functionality
    const cardViewButton = document.getElementById('card-view-button');
    const tableViewButton = document.getElementById('table-view-button');
    const stockCards = document.getElementById('stock-cards');
    const stockTable = document.querySelector('.stock-table-container');
    
    // Set card view as default on page load
    setTimeout(() => {
        if (cardViewButton && tableViewButton && stockCards && stockTable) {
            cardViewButton.classList.add('active');
            tableViewButton.classList.remove('active');
            stockCards.style.display = 'grid';
            stockTable.style.display = 'none';
        }
    }, 100);
    
    // Hook into the customize metrics functionality
    if (typeof window.initCustomizeMetrics === 'function') {
        const originalInitCustomizeMetrics = window.initCustomizeMetrics;
        
        window.initCustomizeMetrics = function() {
            const result = originalInitCustomizeMetrics.apply(this, arguments);
            
            // Hook into the apply button click event
            const applyButton = document.getElementById('apply-metrics');
            if (applyButton) {
                const originalClickHandler = applyButton.onclick;
                
                applyButton.onclick = function(e) {
                    if (originalClickHandler) {
                        originalClickHandler.call(this, e);
                    }
                    
                    // After metrics are updated, refresh the card view
                    setTimeout(() => {
                        if (cardViewButton && cardViewButton.classList.contains('active')) {
                            renderCardsFromTable();
                        }
                    }, 100);
                };
            }
            
            return result;
        };
    }
    
    // Hook into filter-related functions to ensure our card view is maintained
    hookIntoFilterFunctions();
    
    // Override the loadSampleData function to use our card creation
    if (typeof window.loadSampleData === 'function') {
        console.log('Overriding loadSampleData function');
        
        // Store original function reference
        const originalLoadSampleData = window.loadSampleData;
        
        // Override with our implementation
        window.loadSampleData = function() {
            console.log('Custom loadSampleData called');
            const result = originalLoadSampleData.apply(this, arguments);
            
            // After original function runs, replace the cards with our version
            console.log('Calling our renderStockCards function');
            
            // Get the stocks data from the table
            renderCardsFromTable();
            
            // Set card view as default
            if (cardViewButton) {
                cardViewButton.click();
            }
            
            return result;
        };
    }
    
    // Preserve original click handlers while adding our functionality
    if (cardViewButton) {
        const originalCardViewClick = cardViewButton.onclick;
        
        cardViewButton.onclick = function(e) {
            console.log('Card view button clicked');
            
            // Call original handler if it exists
            if (typeof originalCardViewClick === 'function') {
                originalCardViewClick.call(this, e);
            } else {
                // Default behavior if no original handler
                cardViewButton.classList.add('active');
                if (tableViewButton) tableViewButton.classList.remove('active');
                if (stockCards) stockCards.style.display = 'grid';
                if (stockTable) stockTable.style.display = 'none';
            }
            
            // Render our cards from the table data
            renderCardsFromTable();
            
            // Don't prevent default or stop propagation
            return true;
        };
    }
    
    if (tableViewButton) {
        const originalTableViewClick = tableViewButton.onclick;
        
        tableViewButton.onclick = function(e) {
            console.log('Table view button clicked');
            
            // Call original handler if it exists
            if (typeof originalTableViewClick === 'function') {
                originalTableViewClick.call(this, e);
            } else {
                // Default behavior if no original handler
                tableViewButton.classList.add('active');
                if (cardViewButton) cardViewButton.classList.remove('active');
                if (stockTable) stockTable.style.display = 'block';
                if (stockCards) stockCards.style.display = 'none';
            }
            
            // Don't prevent default or stop propagation
            return true;
        };
    }
    
    // Trigger card view if it's already active
    if (cardViewButton && cardViewButton.classList.contains('active')) {
        console.log('Card view is active, triggering render');
        renderCardsFromTable();
    }
    
    // Create a MutationObserver to watch for DOM changes
    setupMutationObserver();
}

/**
 * Helper function to render cards from table data
 */
function renderCardsFromTable() {
    // Get the stocks data from the table
    const stocks = [];
    const rows = document.querySelectorAll('#stock-table tbody tr');
    
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 8) {
            const stock = {
                symbol: cells[0].textContent.trim(),
                name: cells[1].textContent.trim(),
                price: parseFloat(cells[2].textContent.trim().replace('$', '')),
                debtEbitda: parseFloat(cells[3].textContent.trim().replace('×', '')),
                fcfNi: parseFloat(cells[4].textContent.trim()),
                evEbit: parseFloat(cells[5].textContent.trim().replace('×', '')),
                rotce: parseFloat(cells[6].textContent.trim().replace('%', '')),
                score: parseInt(cells[7].textContent.trim()),
                sector: getSectorForSymbol(cells[0].textContent.trim()),
                description: getDescriptionForSymbol(cells[0].textContent.trim())
            };
            stocks.push(stock);
        }
    });
    
    // Render our cards
    renderStockCards(stocks);
}

/**
 * Hook into filter-related functions to ensure our card view is maintained
 */
function hookIntoFilterFunctions() {
    // Hook into applyFilters function
    if (typeof window.applyFilters === 'function') {
        const originalApplyFilters = window.applyFilters;
        
        window.applyFilters = function() {
            const result = originalApplyFilters.apply(this, arguments);
            
            // After filters are applied, check if card view is active and re-render
            setTimeout(() => {
                const cardViewButton = document.getElementById('card-view-button');
                if (cardViewButton && cardViewButton.classList.contains('active')) {
                    renderCardsFromTable();
                }
            }, 100);
            
            return result;
        };
    }
    
    // Hook into clearFilters function
    if (typeof window.clearFilters === 'function') {
        const originalClearFilters = window.clearFilters;
        
        window.clearFilters = function() {
            const result = originalClearFilters.apply(this, arguments);
            
            // After filters are cleared, check if card view is active and re-render
            setTimeout(() => {
                const cardViewButton = document.getElementById('card-view-button');
                if (cardViewButton && cardViewButton.classList.contains('active')) {
                    renderCardsFromTable();
                }
            }, 100);
            
            return result;
        };
    }
    
    // Hook into search function
    if (typeof window.searchStocks === 'function') {
        const originalSearchStocks = window.searchStocks;
        
        window.searchStocks = function() {
            const result = originalSearchStocks.apply(this, arguments);
            
            // After search is performed, check if card view is active and re-render
            setTimeout(() => {
                const cardViewButton = document.getElementById('card-view-button');
                if (cardViewButton && cardViewButton.classList.contains('active')) {
                    renderCardsFromTable();
                }
            }, 100);
            
            return result;
        };
    }
}

/**
 * Set up a MutationObserver to watch for DOM changes
 */
function setupMutationObserver() {
    // Create an observer instance
    const observer = new MutationObserver((mutations) => {
        let shouldRerender = false;
        
        mutations.forEach((mutation) => {
            // Check if the mutation is relevant to our card view
            if (mutation.type === 'childList' && 
                (mutation.target.id === 'stock-table' || 
                 mutation.target.classList.contains('stock-table-container') ||
                 mutation.target.tagName === 'TBODY')) {
                shouldRerender = true;
            }
        });
        
        if (shouldRerender) {
            // Check if card view is active and re-render
            const cardViewButton = document.getElementById('card-view-button');
            if (cardViewButton && cardViewButton.classList.contains('active')) {
                renderCardsFromTable();
            }
        }
    });
    
    // Start observing the document with the configured parameters
    observer.observe(document.body, { 
        childList: true, 
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style']
    });
}

// Add a global function to force card view refresh
window.refreshCardView = function() {
    const cardViewButton = document.getElementById('card-view-button');
    if (cardViewButton && cardViewButton.classList.contains('active')) {
        renderCardsFromTable();
    }
};

// Initialize the card view when the DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing card view');
    initCardView();
    
    // Trigger loadSampleData if it exists
    if (typeof window.loadSampleData === 'function') {
        console.log('Triggering loadSampleData');
        window.loadSampleData();
    }
    
    // Hook into the global selectedMetrics variable
    if (typeof window.selectedMetrics === 'undefined') {
        // Create a global variable to store selected metrics
        window.selectedMetrics = [
            'total-stocks',
            'avg-debt-ebitda',
            'avg-ev-ebit',
            'avg-fcf-ni',
            'avg-rotce'
        ];
    }
});

// Execute immediately if DOM is already loaded
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    console.log('DOM already loaded, initializing card view immediately');
    initCardView();
    
    // Trigger the card view
    const cardViewButton = document.getElementById('card-view-button');
    if (cardViewButton) {
        console.log('Clicking card view button');
        setTimeout(() => {
            renderCardsFromTable();
        }, 500);
    }
}
