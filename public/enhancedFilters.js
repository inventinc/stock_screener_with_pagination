/**
 * Enhanced Filters Component
 * 
 * Provides an improved filter UI with icons and detailed value ranges
 * for the stock screener application.
 */
class EnhancedFilters {
    /**
     * Initialize the enhanced filters
     * @param {Object} options - Configuration options
     * @param {HTMLElement} options.container - Container element for filters
     * @param {Function} options.onFilterChange - Callback when filters change
     */
    constructor(options) {
        this.container = options.container;
        this.onFilterChange = options.onFilterChange;
        this.activeFilters = {};
        
        this.init();
    }
    
    /**
     * Initialize the filters
     */
    init() {
        this.renderFilters();
        this.setupEventListeners();
    }
    
    /**
     * Render the enhanced filters UI
     */
    renderFilters() {
        // Clear container
        this.container.innerHTML = '';
        
        // Create filter groups
        this.createMarketCapFilters();
        this.createExchangeFilters();
        this.createVolumeFilters();
        this.createPEFilters();
        this.createDividendFilters();
        this.createDebtFilters();
        this.createPresetFilters();
    }
    
    /**
     * Create Market Cap filter group
     */
    createMarketCapFilters() {
        const filterGroup = document.createElement('div');
        filterGroup.className = 'filter-group';
        filterGroup.setAttribute('data-multi-select', 'false');
        
        const heading = document.createElement('h3');
        heading.innerHTML = '<i class="filter-icon building-icon"></i> Market Cap';
        filterGroup.appendChild(heading);
        
        const buttonsContainer = document.createElement('div');
        buttonsContainer.className = 'filter-buttons';
        
        // Create filter buttons
        const filters = [
            { value: 'large', label: 'Large Cap', detail: '$10B+', icon: 'large-cap-icon' },
            { value: 'mid', label: 'Mid Cap', detail: '$2-10B', icon: 'mid-cap-icon' },
            { value: 'small', label: 'Small Cap', detail: '$300M-2B', icon: 'small-cap-icon' },
            { value: 'micro', label: 'Micro Cap', detail: '<$300M', icon: 'micro-cap-icon' }
        ];
        
        filters.forEach(filter => {
            const button = this.createFilterButton({
                type: 'market_cap',
                value: filter.value,
                label: filter.label,
                detail: filter.detail,
                icon: filter.icon
            });
            buttonsContainer.appendChild(button);
        });
        
        filterGroup.appendChild(buttonsContainer);
        this.container.appendChild(filterGroup);
    }
    
    /**
     * Create Exchange filter group
     */
    createExchangeFilters() {
        const filterGroup = document.createElement('div');
        filterGroup.className = 'filter-group';
        filterGroup.setAttribute('data-multi-select', 'false');
        
        const heading = document.createElement('h3');
        heading.innerHTML = '<i class="filter-icon globe-icon"></i> Exchange';
        filterGroup.appendChild(heading);
        
        const buttonsContainer = document.createElement('div');
        buttonsContainer.className = 'filter-buttons';
        
        // Create filter buttons
        const filters = [
            { value: 'XNAS', label: 'NASDAQ', detail: '3,159 stocks', icon: 'nasdaq-icon' },
            { value: 'XNYS', label: 'NYSE', detail: '2,541 stocks', icon: 'nyse-icon' }
        ];
        
        filters.forEach(filter => {
            const button = this.createFilterButton({
                type: 'exchange',
                value: filter.value,
                label: filter.label,
                detail: filter.detail,
                icon: filter.icon
            });
            buttonsContainer.appendChild(button);
        });
        
        filterGroup.appendChild(buttonsContainer);
        this.container.appendChild(filterGroup);
    }
    
    /**
     * Create Volume filter group
     */
    createVolumeFilters() {
        const filterGroup = document.createElement('div');
        filterGroup.className = 'filter-group';
        filterGroup.setAttribute('data-multi-select', 'false');
        
        const heading = document.createElement('h3');
        heading.innerHTML = '<i class="filter-icon wave-icon"></i> Trading Volume';
        filterGroup.appendChild(heading);
        
        const buttonsContainer = document.createElement('div');
        buttonsContainer.className = 'filter-buttons';
        
        // Create filter buttons
        const filters = [
            { value: 'high', label: 'High Volume', detail: '$5M+ daily', icon: 'high-volume-icon' },
            { value: 'medium', label: 'Medium Volume', detail: '$1-5M daily', icon: 'medium-volume-icon' },
            { value: 'low', label: 'Low Volume', detail: '<$1M daily', icon: 'low-volume-icon' }
        ];
        
        filters.forEach(filter => {
            const button = this.createFilterButton({
                type: 'volume',
                value: filter.value,
                label: filter.label,
                detail: filter.detail,
                icon: filter.icon
            });
            buttonsContainer.appendChild(button);
        });
        
        filterGroup.appendChild(buttonsContainer);
        this.container.appendChild(filterGroup);
    }
    
    /**
     * Create P/E Ratio filter group
     */
    createPEFilters() {
        const filterGroup = document.createElement('div');
        filterGroup.className = 'filter-group';
        filterGroup.setAttribute('data-multi-select', 'false');
        
        const heading = document.createElement('h3');
        heading.innerHTML = '<i class="filter-icon calculator-icon"></i> P/E Ratio';
        filterGroup.appendChild(heading);
        
        const buttonsContainer = document.createElement('div');
        buttonsContainer.className = 'filter-buttons';
        
        // Create filter buttons
        const filters = [
            { value: 'low', label: 'Low P/E', detail: '<10', icon: 'low-pe-icon' },
            { value: 'medium', label: 'Medium P/E', detail: '10-20', icon: 'medium-pe-icon' },
            { value: 'high', label: 'High P/E', detail: '>20', icon: 'high-pe-icon' },
            { value: 'negative', label: 'Negative P/E', detail: '<0', icon: 'negative-pe-icon' }
        ];
        
        filters.forEach(filter => {
            const button = this.createFilterButton({
                type: 'pe_ratio',
                value: filter.value,
                label: filter.label,
                detail: filter.detail,
                icon: filter.icon
            });
            buttonsContainer.appendChild(button);
        });
        
        filterGroup.appendChild(buttonsContainer);
        this.container.appendChild(filterGroup);
    }
    
    /**
     * Create Dividend Yield filter group
     */
    createDividendFilters() {
        const filterGroup = document.createElement('div');
        filterGroup.className = 'filter-group';
        filterGroup.setAttribute('data-multi-select', 'false');
        
        const heading = document.createElement('h3');
        heading.innerHTML = '<i class="filter-icon coin-icon"></i> Dividend Yield';
        filterGroup.appendChild(heading);
        
        const buttonsContainer = document.createElement('div');
        buttonsContainer.className = 'filter-buttons';
        
        // Create filter buttons
        const filters = [
            { value: 'high', label: 'High Yield', detail: '>4%', icon: 'high-dividend-icon' },
            { value: 'medium', label: 'Medium Yield', detail: '2-4%', icon: 'medium-dividend-icon' },
            { value: 'low', label: 'Low Yield', detail: '<2%', icon: 'low-dividend-icon' },
            { value: 'none', label: 'No Dividend', detail: '0%', icon: 'no-dividend-icon' }
        ];
        
        filters.forEach(filter => {
            const button = this.createFilterButton({
                type: 'dividend_yield',
                value: filter.value,
                label: filter.label,
                detail: filter.detail,
                icon: filter.icon
            });
            buttonsContainer.appendChild(button);
        });
        
        filterGroup.appendChild(buttonsContainer);
        this.container.appendChild(filterGroup);
    }
    
    /**
     * Create Debt Level filter group
     */
    createDebtFilters() {
        const filterGroup = document.createElement('div');
        filterGroup.className = 'filter-group';
        filterGroup.setAttribute('data-multi-select', 'false');
        
        const heading = document.createElement('h3');
        heading.innerHTML = '<i class="filter-icon balance-icon"></i> Debt Level';
        filterGroup.appendChild(heading);
        
        const buttonsContainer = document.createElement('div');
        buttonsContainer.className = 'filter-buttons';
        
        // Create filter buttons
        const filters = [
            { value: 'none', label: 'No Debt', detail: '0', icon: 'no-debt-icon' },
            { value: 'low', label: 'Low Debt', detail: 'D/E <1', icon: 'low-debt-icon' },
            { value: 'medium', label: 'Medium Debt', detail: 'D/E 1-3', icon: 'medium-debt-icon' },
            { value: 'high', label: 'High Debt', detail: 'D/E >3', icon: 'high-debt-icon' }
        ];
        
        filters.forEach(filter => {
            const button = this.createFilterButton({
                type: 'debt_level',
                value: filter.value,
                label: filter.label,
                detail: filter.detail,
                icon: filter.icon
            });
            buttonsContainer.appendChild(button);
        });
        
        filterGroup.appendChild(buttonsContainer);
        this.container.appendChild(filterGroup);
    }
    
    /**
     * Create Preset filter group
     */
    createPresetFilters() {
        const filterGroup = document.createElement('div');
        filterGroup.className = 'filter-group';
        filterGroup.setAttribute('data-multi-select', 'false');
        
        const heading = document.createElement('h3');
        heading.innerHTML = '<i class="filter-icon star-icon"></i> Presets';
        filterGroup.appendChild(heading);
        
        const buttonsContainer = document.createElement('div');
        buttonsContainer.className = 'filter-buttons';
        
        // Create filter buttons
        const filters = [
            { value: 'value', label: 'Value Stocks', detail: 'Low P/E, High Div', icon: 'value-icon' },
            { value: 'growth', label: 'Growth Stocks', detail: 'High Growth Rate', icon: 'growth-icon' },
            { value: 'dividend', label: 'Dividend Stocks', detail: 'Yield >3%', icon: 'dividend-icon' },
            { value: 'quality', label: 'Quality Stocks', detail: 'Strong Balance Sheet', icon: 'quality-icon' }
        ];
        
        filters.forEach(filter => {
            const button = this.createFilterButton({
                type: 'preset',
                value: filter.value,
                label: filter.label,
                detail: filter.detail,
                icon: filter.icon,
                isPreset: true
            });
            buttonsContainer.appendChild(button);
        });
        
        filterGroup.appendChild(buttonsContainer);
        this.container.appendChild(filterGroup);
    }
    
    /**
     * Create a filter button
     * @param {Object} options - Button options
     * @returns {HTMLElement} Button element
     */
    createFilterButton(options) {
        const button = document.createElement('button');
        button.className = 'filter-button enhanced';
        
        if (options.isPreset) {
            button.classList.add('preset-button');
            button.setAttribute('data-preset', options.value);
        } else {
            button.setAttribute('data-filter-type', options.type);
            button.setAttribute('data-filter-value', options.value);
        }
        
        // Create button content with icon and details
        button.innerHTML = `
            <i class="filter-icon ${options.icon}"></i>
            <span class="filter-content">
                <span class="filter-label">${options.label}</span>
                <span class="filter-detail">${options.detail}</span>
            </span>
        `;
        
        return button;
    }
    
    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Filter buttons
        this.container.querySelectorAll('.filter-button:not(.preset-button)').forEach(button => {
            button.addEventListener('click', () => this.handleFilterClick(button));
        });
        
        // Preset buttons
        this.container.querySelectorAll('.preset-button').forEach(button => {
            button.addEventListener('click', () => this.handlePresetClick(button));
        });
    }
    
    /**
     * Handle filter button click
     * @param {HTMLElement} button - Clicked button
     */
    handleFilterClick(button) {
        const filterType = button.getAttribute('data-filter-type');
        const filterValue = button.getAttribute('data-filter-value');
        const filterGroup = button.closest('.filter-group');
        const isMultiSelect = filterGroup.getAttribute('data-multi-select') === 'true';
        
        // Toggle active state
        if (button.classList.contains('active')) {
            // Remove filter
            button.classList.remove('active');
            
            if (isMultiSelect) {
                // Remove from array
                if (Array.isArray(this.activeFilters[filterType])) {
                    this.activeFilters[filterType] = this.activeFilters[filterType].filter(v => v !== filterValue);
                    if (this.activeFilters[filterType].length === 0) {
                        delete this.activeFilters[filterType];
                    }
                }
            } else {
                // Remove single value
                delete this.activeFilters[filterType];
            }
        } else {
            // Add filter
            if (isMultiSelect) {
                // Add to array
                if (!Array.isArray(this.activeFilters[filterType])) {
                    this.activeFilters[filterType] = [];
                }
                this.activeFilters[filterType].push(filterValue);
                
                // Set this button as active
                button.classList.add('active');
            } else {
                // Deactivate other buttons in group
                filterGroup.querySelectorAll('.filter-button').forEach(btn => {
                    btn.classList.remove('active');
                });
                
                // Set single value
                this.activeFilters[filterType] = filterValue;
                
                // Set this button as active
                button.classList.add('active');
            }
        }
        
        // Notify change
        if (typeof this.onFilterChange === 'function') {
            this.onFilterChange(this.activeFilters);
        }
    }
    
    /**
     * Handle preset button click
     * @param {HTMLElement} button - Clicked button
     */
    handlePresetClick(button) {
        const presetValue = button.getAttribute('data-preset');
        const filterGroup = button.closest('.filter-group');
        
        // Toggle active state
        if (button.classList.contains('active')) {
            // Remove preset
            button.classList.remove('active');
            delete this.activeFilters.preset;
        } else {
            // Deactivate other buttons in group
            filterGroup.querySelectorAll('.preset-button').forEach(btn => {
                btn.classList.remove('active');
            });
            
            // Set preset
            this.activeFilters.preset = presetValue;
            
            // Set this button as active
            button.classList.add('active');
        }
        
        // Notify change
        if (typeof this.onFilterChange === 'function') {
            this.onFilterChange(this.activeFilters);
        }
    }
    
    /**
     * Get active filters
     * @returns {Object} Active filters
     */
    getActiveFilters() {
        return this.activeFilters;
    }
    
    /**
     * Set active filters
     * @param {Object} filters - Filters to set
     */
    setActiveFilters(filters) {
        this.activeFilters = filters || {};
        
        // Update UI
        this.updateFilterUI();
        
        // Notify change
        if (typeof this.onFilterChange === 'function') {
            this.onFilterChange(this.activeFilters);
        }
    }
    
    /**
     * Update filter UI based on active filters
     */
    updateFilterUI() {
        // Reset all buttons
        this.container.querySelectorAll('.filter-button').forEach(button => {
            button.classList.remove('active');
        });
        
        // Set active buttons
        Object.entries(this.activeFilters).forEach(([type, value]) => {
            if (type === 'preset') {
                // Handle preset
                const presetButton = this.container.querySelector(`.preset-button[data-preset="${value}"]`);
                if (presetButton) {
                    presetButton.classList.add('active');
                }
            } else if (Array.isArray(value)) {
                // Handle multi-select
                value.forEach(v => {
                    const button = this.container.querySelector(`.filter-button[data-filter-type="${type}"][data-filter-value="${v}"]`);
                    if (button) {
                        button.classList.add('active');
                    }
                });
            } else {
                // Handle single value
                const button = this.container.querySelector(`.filter-button[data-filter-type="${type}"][data-filter-value="${value}"]`);
                if (button) {
                    button.classList.add('active');
                }
            }
        });
    }
    
    /**
     * Clear all filters
     */
    clearFilters() {
        this.activeFilters = {};
        this.updateFilterUI();
        
        // Notify change
        if (typeof this.onFilterChange === 'function') {
            this.onFilterChange(this.activeFilters);
        }
    }
}
