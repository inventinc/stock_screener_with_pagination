// Stock Card View Redesign Implementation

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
    // Determine sector class for color coding
    const sectorClass = getSectorClass(stock.sector || 'Other');
    
    // Determine score class
    const scoreClass = getScoreClass(stock.score);
    
    const card = document.createElement('div');
    card.className = `stock-card ${sectorClass}`;
    card.dataset.symbol = stock.symbol;
    card.dataset.sector = stock.sector || 'Other';
    
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
    sectorEl.textContent = stock.sector || 'Other';
    
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
    
    // Add individual metrics
    const metrics = [
        { label: 'Debt/EBITDA', value: `${stock.debtEbitda}×` },
        { label: 'FCF/NI', value: stock.fcfNi },
        { label: 'EV/EBIT', value: `${stock.evEbit}×` },
        { label: 'ROTCE', value: `${stock.rotce}%` }
    ];
    
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
    
    // Update metrics grid
    const metricsGrid = document.getElementById('summary-metrics-grid');
    metricsGrid.innerHTML = '';
    
    const metrics = [
        { label: 'Debt/EBITDA', value: `${stock.debtEbitda}×` },
        { label: 'FCF/NI', value: stock.fcfNi },
        { label: 'EV/EBIT', value: `${stock.evEbit}×` },
        { label: 'ROTCE', value: `${stock.rotce}%` },
        { label: 'Score', value: stock.score },
        { label: 'Sector', value: stock.sector || 'Other' }
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
 * Get the sector class for color coding
 */
function getSectorClass(sector) {
    const sectorMap = {
        'Technology': 'technology',
        'Healthcare': 'healthcare',
        'Financial Services': 'financial',
        'Consumer Cyclical': 'consumer',
        'Consumer Defensive': 'consumer',
        'Industrials': 'industrial',
        'Communication Services': 'technology',
        'Energy': 'industrial',
        'Basic Materials': 'industrial',
        'Real Estate': 'financial',
        'Utilities': 'industrial'
    };
    
    return sectorMap[sector] || 'other';
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
    // Add the redesigned styles
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'styles-card-redesign.css';
    document.head.appendChild(link);
    
    // Update the view toggle functionality
    const cardViewButton = document.getElementById('card-view-button');
    const tableViewButton = document.getElementById('table-view-button');
    const stockCards = document.getElementById('stock-cards');
    const stockTable = document.querySelector('.stock-table-container');
    
    cardViewButton.addEventListener('click', () => {
        cardViewButton.classList.add('active');
        tableViewButton.classList.remove('active');
        stockCards.style.display = 'grid';
        stockTable.style.display = 'none';
    });
    
    tableViewButton.addEventListener('click', () => {
        tableViewButton.classList.add('active');
        cardViewButton.classList.remove('active');
        stockTable.style.display = 'block';
        stockCards.style.display = 'none';
    });
}

// Initialize the card view when the DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // This will be called by the existing app.js
    initCardView();
});
