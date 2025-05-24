/**
 * VirtualizedTable - High-performance table component for large datasets
 * 
 * Features:
 * - Only renders visible rows in viewport plus buffer
 * - DOM recycling for optimal performance
 * - Efficient scroll handling with requestAnimationFrame
 * - Fixed row heights for predictable rendering
 * - Memory-efficient with minimal object creation
 * - Support for sorting and filtering
 */
class VirtualizedTable {
    /**
     * Create a new VirtualizedTable
     * @param {Object} options - Configuration options
     * @param {HTMLElement} options.container - Container element
     * @param {Array} options.columns - Column definitions
     * @param {Number} options.rowHeight - Height of each row in pixels
     * @param {Number} options.headerHeight - Height of header row in pixels
     * @param {Number} options.bufferSize - Number of rows to render above/below viewport
     * @param {Function} options.loadMoreCallback - Callback when more items need to be loaded
     */
    constructor(options) {
        // Required options
        this.container = options.container;
        this.columns = options.columns || [];
        
        // Optional settings with defaults
        this.rowHeight = options.rowHeight || 50;
        this.headerHeight = options.headerHeight || 40;
        this.bufferSize = options.bufferSize || 10;
        this.loadMoreCallback = options.loadMoreCallback;
        this.loadThreshold = options.loadThreshold || 500;
        
        // State
        this.data = [];
        this.visibleRows = [];
        this.renderedRows = new Map();
        this.recycledRows = [];
        this.totalRowsCount = 0;
        this.isLoading = false;
        this.lastScrollTop = 0;
        this.scrollDirection = 'down';
        this.scrollThrottleTimer = null;
        this.resizeObserver = null;
        this.rafId = null;
        this.sortColumn = null;
        this.sortDirection = 'asc';
        
        // Performance metrics
        this.metrics = {
            renderTime: 0,
            scrollTime: 0,
            visibleRowsCount: 0,
            recycledRowsCount: 0
        };
        
        // Initialize
        this.init();
    }
    
    /**
     * Initialize the virtualized table
     */
    init() {
        // Create table structure
        this.createTableStructure();
        
        // Add scroll event listener
        this.scrollContainer.addEventListener('scroll', this.handleScroll.bind(this));
        
        // Add resize observer
        if (window.ResizeObserver) {
            this.resizeObserver = new ResizeObserver(this.handleResize.bind(this));
            this.resizeObserver.observe(this.container);
        } else {
            window.addEventListener('resize', this.handleResize.bind(this));
        }
        
        // Initial render
        this.refresh();
    }
    
    /**
     * Create the table structure
     */
    createTableStructure() {
        // Clear container
        this.container.innerHTML = '';
        
        // Set container style
        this.container.style.position = 'relative';
        this.container.style.overflow = 'hidden';
        
        // Create scroll container
        this.scrollContainer = document.createElement('div');
        this.scrollContainer.style.width = '100%';
        this.scrollContainer.style.height = '100%';
        this.scrollContainer.style.overflow = 'auto';
        this.scrollContainer.style.willChange = 'transform';
        this.container.appendChild(this.scrollContainer);
        
        // Create table element
        this.table = document.createElement('table');
        this.table.style.width = '100%';
        this.table.style.borderCollapse = 'collapse';
        this.scrollContainer.appendChild(this.table);
        
        // Create table header
        this.thead = document.createElement('thead');
        this.table.appendChild(this.thead);
        
        // Create header row
        const headerRow = document.createElement('tr');
        headerRow.style.height = `${this.headerHeight}px`;
        this.thead.appendChild(headerRow);
        
        // Create header cells
        this.columns.forEach(column => {
            const th = document.createElement('th');
            th.textContent = column.label || column.field;
            th.style.position = 'sticky';
            th.style.top = '0';
            th.style.backgroundColor = '#f8f9fa';
            th.style.zIndex = '1';
            th.style.padding = '10px';
            th.style.textAlign = 'left';
            th.style.borderBottom = '1px solid #e1e4e8';
            th.style.fontWeight = '600';
            
            // Add sort functionality if sortable
            if (column.sortable) {
                th.style.cursor = 'pointer';
                th.addEventListener('click', () => this.handleSort(column.field));
                
                // Add sort indicator
                const sortIndicator = document.createElement('span');
                sortIndicator.style.marginLeft = '5px';
                sortIndicator.dataset.field = column.field;
                sortIndicator.classList.add('sort-indicator');
                th.appendChild(sortIndicator);
            }
            
            headerRow.appendChild(th);
        });
        
        // Create table body
        this.tbody = document.createElement('tbody');
        this.table.appendChild(this.tbody);
        
        // Create spacer for virtual scrolling
        this.spacer = document.createElement('tr');
        this.spacer.style.height = '0';
        this.tbody.appendChild(this.spacer);
    }
    
    /**
     * Handle scroll event
     */
    handleScroll() {
        // Determine scroll direction
        const scrollTop = this.scrollContainer.scrollTop;
        this.scrollDirection = scrollTop > this.lastScrollTop ? 'down' : 'up';
        this.lastScrollTop = scrollTop;
        
        // Throttle scroll handling for better performance
        if (!this.scrollThrottleTimer) {
            this.scrollThrottleTimer = setTimeout(() => {
                this.scrollThrottleTimer = null;
                
                // Use requestAnimationFrame for smooth rendering
                if (this.rafId) {
                    cancelAnimationFrame(this.rafId);
                }
                
                this.rafId = requestAnimationFrame(() => {
                    const startTime = performance.now();
                    
                    // Update visible rows
                    this.updateVisibleRows();
                    
                    // Check if we need to load more data
                    this.checkLoadMore();
                    
                    // Update metrics
                    this.metrics.scrollTime = performance.now() - startTime;
                });
            }, 16); // ~60fps
        }
    }
    
    /**
     * Handle resize event
     */
    handleResize() {
        this.refresh();
    }
    
    /**
     * Handle sort event
     * @param {String} field - Field to sort by
     */
    handleSort(field) {
        // Toggle sort direction if same field
        if (this.sortColumn === field) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortColumn = field;
            this.sortDirection = 'asc';
        }
        
        // Update sort indicators
        const indicators = this.thead.querySelectorAll('.sort-indicator');
        indicators.forEach(indicator => {
            if (indicator.dataset.field === field) {
                indicator.textContent = this.sortDirection === 'asc' ? ' ▲' : ' ▼';
            } else {
                indicator.textContent = '';
            }
        });
        
        // Sort data
        this.sortData();
        
        // Refresh view
        this.refresh();
    }
    
    /**
     * Sort data based on current sort column and direction
     */
    sortData() {
        if (!this.sortColumn) return;
        
        this.data.sort((a, b) => {
            let valueA = a[this.sortColumn];
            let valueB = b[this.sortColumn];
            
            // Handle null/undefined values
            if (valueA === null || valueA === undefined) valueA = '';
            if (valueB === null || valueB === undefined) valueB = '';
            
            // Compare based on type
            if (typeof valueA === 'string' && typeof valueB === 'string') {
                return this.sortDirection === 'asc' 
                    ? valueA.localeCompare(valueB) 
                    : valueB.localeCompare(valueA);
            } else {
                return this.sortDirection === 'asc' 
                    ? valueA - valueB 
                    : valueB - valueA;
            }
        });
    }
    
    /**
     * Refresh the virtualized table
     */
    refresh() {
        // Update spacer height
        this.updateSpacerHeight();
        
        // Update visible rows
        this.updateVisibleRows();
    }
    
    /**
     * Update spacer height based on total rows
     */
    updateSpacerHeight() {
        const totalHeight = this.totalRowsCount * this.rowHeight;
        this.spacer.style.height = `${totalHeight}px`;
    }
    
    /**
     * Update visible rows based on scroll position
     */
    updateVisibleRows() {
        const startTime = performance.now();
        
        // Calculate visible range
        const scrollTop = this.scrollContainer.scrollTop;
        const containerHeight = this.scrollContainer.clientHeight;
        
        const startIndex = Math.max(0, Math.floor(scrollTop / this.rowHeight) - this.bufferSize);
        const endIndex = Math.min(
            this.data.length - 1,
            Math.ceil((scrollTop + containerHeight) / this.rowHeight) + this.bufferSize
        );
        
        // Get visible rows
        this.visibleRows = [];
        for (let i = startIndex; i <= endIndex; i++) {
            if (i >= 0 && i < this.data.length) {
                this.visibleRows.push({
                    index: i,
                    data: this.data[i],
                    top: i * this.rowHeight
                });
            }
        }
        
        // Update metrics
        this.metrics.visibleRowsCount = this.visibleRows.length;
        
        // Render visible rows
        this.renderVisibleRows();
        
        // Update metrics
        this.metrics.renderTime = performance.now() - startTime;
    }
    
    /**
     * Render visible rows
     */
    renderVisibleRows() {
        // Track which rows are still visible
        const stillVisible = new Set();
        
        // Render each visible row
        this.visibleRows.forEach(({ index, data, top }) => {
            let rowElement;
            
            // Check if row is already rendered
            if (this.renderedRows.has(index)) {
                rowElement = this.renderedRows.get(index);
                stillVisible.add(index);
            } else {
                // Try to recycle a row
                if (this.recycledRows.length > 0) {
                    rowElement = this.recycledRows.pop();
                } else {
                    // Create new row
                    rowElement = document.createElement('tr');
                    rowElement.style.height = `${this.rowHeight}px`;
                    
                    // Create cells
                    this.columns.forEach(() => {
                        const cell = document.createElement('td');
                        cell.style.padding = '10px';
                        cell.style.borderBottom = '1px solid #e1e4e8';
                        rowElement.appendChild(cell);
                    });
                    
                    this.tbody.appendChild(rowElement);
                }
                
                // Store rendered row
                this.renderedRows.set(index, rowElement);
                stillVisible.add(index);
            }
            
            // Update row data
            this.updateRowData(rowElement, data);
            
            // Position row (not needed for table rows as they flow naturally)
            // But we ensure it's in the right order
            this.tbody.insertBefore(rowElement, this.spacer);
        });
        
        // Recycle rows that are no longer visible
        for (const [index, element] of this.renderedRows.entries()) {
            if (!stillVisible.has(index)) {
                // Remove from DOM
                if (element.parentNode) {
                    element.parentNode.removeChild(element);
                }
                
                // Add to recycled rows
                this.recycledRows.push(element);
                
                // Remove from rendered rows
                this.renderedRows.delete(index);
            }
        }
        
        // Update metrics
        this.metrics.recycledRowsCount = this.recycledRows.length;
    }
    
    /**
     * Update row data
     * @param {HTMLElement} rowElement - Row element
     * @param {Object} data - Row data
     */
    updateRowData(rowElement, data) {
        // Update each cell
        this.columns.forEach((column, index) => {
            const cell = rowElement.children[index];
            
            // Get value
            let value = data[column.field];
            
            // Format value if formatter exists
            if (column.formatter) {
                value = column.formatter(value, data);
            } else if (value === null || value === undefined) {
                value = '';
            }
            
            // Update cell content
            if (typeof value === 'string' && value.startsWith('<')) {
                // Handle HTML content
                cell.innerHTML = value;
            } else {
                // Handle text content
                cell.textContent = value;
            }
            
            // Apply custom class if provided
            if (column.cellClass) {
                cell.className = column.cellClass;
            }
        });
    }
    
    /**
     * Check if we need to load more data
     */
    checkLoadMore() {
        // If already loading, don't check
        if (this.isLoading) return;
        
        // If we have all data, don't check
        if (this.data.length >= this.totalRowsCount) return;
        
        // If scrolling down and near the bottom, load more
        if (this.scrollDirection === 'down') {
            const scrollTop = this.scrollContainer.scrollTop;
            const containerHeight = this.scrollContainer.clientHeight;
            const totalHeight = this.totalRowsCount * this.rowHeight;
            
            // If within threshold of the bottom, load more
            if (totalHeight - (scrollTop + containerHeight) < this.loadThreshold) {
                this.loadMore();
            }
        }
    }
    
    /**
     * Load more data
     */
    loadMore() {
        if (this.isLoading) return;
        
        this.isLoading = true;
        
        // Call load more callback
        if (this.loadMoreCallback) {
            this.loadMoreCallback().then(() => {
                this.isLoading = false;
            }).catch(() => {
                this.isLoading = false;
            });
        } else {
            this.isLoading = false;
        }
    }
    
    /**
     * Set data to display
     * @param {Array} data - Data to display
     */
    setData(data) {
        this.data = data || [];
        
        // Apply current sort if needed
        if (this.sortColumn) {
            this.sortData();
        }
        
        // Clear rendered rows
        this.clearRenderedRows();
        
        // Refresh view
        this.refresh();
    }
    
    /**
     * Add data to existing dataset
     * @param {Array} data - Data to add
     */
    addData(data) {
        if (!data || !data.length) return;
        
        // Add data
        this.data = [...this.data, ...data];
        
        // Apply current sort if needed
        if (this.sortColumn) {
            this.sortData();
        }
        
        // Refresh view
        this.refresh();
    }
    
    /**
     * Set total rows count
     * @param {Number} count - Total rows count
     */
    setTotalRowsCount(count) {
        this.totalRowsCount = count || 0;
        
        // Update spacer height
        this.updateSpacerHeight();
    }
    
    /**
     * Set loading state
     * @param {Boolean} isLoading - Whether data is loading
     */
    setLoading(isLoading) {
        this.isLoading = isLoading;
    }
    
    /**
     * Clear all rendered rows
     */
    clearRenderedRows() {
        // Remove all rendered rows from DOM
        for (const element of this.renderedRows.values()) {
            if (element.parentNode) {
                element.parentNode.removeChild(element);
            }
        }
        
        // Clear rendered rows
        this.renderedRows.clear();
        
        // Clear recycled rows
        this.recycledRows = [];
    }
    
    /**
     * Get performance metrics
     * @returns {Object} Performance metrics
     */
    getPerformanceMetrics() {
        return {
            renderTime: `${this.metrics.renderTime.toFixed(2)}ms`,
            scrollTime: `${this.metrics.scrollTime.toFixed(2)}ms`,
            visibleRowsCount: this.metrics.visibleRowsCount,
            recycledRowsCount: this.metrics.recycledRowsCount,
            totalRowsCount: this.data.length
        };
    }
    
    /**
     * Scroll to specific row
     * @param {Number} index - Row index
     */
    scrollToRow(index) {
        if (index < 0 || index >= this.data.length) return;
        
        const top = index * this.rowHeight;
        this.scrollContainer.scrollTop = top;
    }
    
    /**
     * Scroll to top
     */
    scrollToTop() {
        this.scrollContainer.scrollTop = 0;
    }
    
    /**
     * Scroll to bottom
     */
    scrollToBottom() {
        this.scrollContainer.scrollTop = this.totalRowsCount * this.rowHeight;
    }
    
    /**
     * Destroy the virtualized table
     */
    destroy() {
        // Remove event listeners
        this.scrollContainer.removeEventListener('scroll', this.handleScroll);
        window.removeEventListener('resize', this.handleResize);
        
        // Disconnect resize observer
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
        
        // Cancel animation frame
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
        }
        
        // Clear timeout
        if (this.scrollThrottleTimer) {
            clearTimeout(this.scrollThrottleTimer);
        }
        
        // Clear rendered rows
        this.clearRenderedRows();
        
        // Clear container
        this.container.innerHTML = '';
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VirtualizedTable;
}
