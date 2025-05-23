/**
 * ImprovedVirtualScroller - Optimized virtual scrolling for stock screener with 5,700+ stocks
 * Features:
 * - DOM recycling for better performance
 * - Smooth scrolling with requestAnimationFrame
 * - Automatic loading of more data when needed
 * - Memory optimization for large datasets
 */
class IncrementalVirtualScroller {
    /**
     * Create a new IncrementalVirtualScroller
     * @param {Object} options - Configuration options
     * @param {HTMLElement} options.container - Container element
     * @param {Number} options.itemHeight - Height of each item in pixels
     * @param {Number} options.bufferSize - Number of items to render above/below viewport
     * @param {Function} options.renderItem - Function to render an item
     * @param {Function} options.loadMoreCallback - Callback when more items need to be loaded
     */
    constructor(options) {
        this.container = options.container;
        this.itemHeight = options.itemHeight || 160;
        this.bufferSize = options.bufferSize || 5;
        this.renderItem = options.renderItem;
        this.loadMoreCallback = options.loadMoreCallback;
        
        // State
        this.items = [];
        this.visibleItems = [];
        this.renderedItems = new Map();
        this.recycledItems = [];
        this.totalItemsCount = 0;
        this.isLoading = false;
        this.lastScrollTop = 0;
        this.scrollDirection = 'down';
        this.scrollThrottleTimer = null;
        this.resizeObserver = null;
        this.rafId = null;
        
        // Performance metrics
        this.metrics = {
            renderTime: 0,
            scrollTime: 0,
            visibleItemsCount: 0,
            recycledItemsCount: 0
        };
        
        // Initialize
        this.init();
    }
    
    /**
     * Initialize the virtual scroller
     */
    init() {
        // Set container style
        this.container.style.position = 'relative';
        this.container.style.overflow = 'auto';
        this.container.style.willChange = 'transform';
        
        // Create spacer element
        this.spacer = document.createElement('div');
        this.spacer.style.width = '100%';
        this.spacer.style.position = 'relative';
        this.container.appendChild(this.spacer);
        
        // Add scroll event listener
        this.container.addEventListener('scroll', this.handleScroll.bind(this));
        
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
     * Handle scroll event
     * @param {Event} event - Scroll event
     */
    handleScroll(event) {
        // Determine scroll direction
        const scrollTop = this.container.scrollTop;
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
                    
                    // Update visible items
                    this.updateVisibleItems();
                    
                    // Check if we need to load more items
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
     * Refresh the virtual scroller
     */
    refresh() {
        // Update container height
        this.updateContainerHeight();
        
        // Update visible items
        this.updateVisibleItems();
    }
    
    /**
     * Update container height based on total items
     */
    updateContainerHeight() {
        const totalHeight = this.totalItemsCount * this.itemHeight;
        this.spacer.style.height = `${totalHeight}px`;
    }
    
    /**
     * Update visible items based on scroll position
     */
    updateVisibleItems() {
        const startTime = performance.now();
        
        // Calculate visible range
        const scrollTop = this.container.scrollTop;
        const containerHeight = this.container.clientHeight;
        
        const startIndex = Math.max(0, Math.floor(scrollTop / this.itemHeight) - this.bufferSize);
        const endIndex = Math.min(
            this.items.length - 1,
            Math.ceil((scrollTop + containerHeight) / this.itemHeight) + this.bufferSize
        );
        
        // Get visible items
        this.visibleItems = [];
        for (let i = startIndex; i <= endIndex; i++) {
            if (i >= 0 && i < this.items.length) {
                this.visibleItems.push({
                    index: i,
                    item: this.items[i],
                    top: i * this.itemHeight
                });
            }
        }
        
        // Update metrics
        this.metrics.visibleItemsCount = this.visibleItems.length;
        
        // Render visible items
        this.renderVisibleItems();
        
        // Update metrics
        this.metrics.renderTime = performance.now() - startTime;
    }
    
    /**
     * Render visible items
     */
    renderVisibleItems() {
        // Track which items are still visible
        const stillVisible = new Set();
        
        // Render each visible item
        this.visibleItems.forEach(({ index, item, top }) => {
            let itemElement;
            
            // Check if item is already rendered
            if (this.renderedItems.has(index)) {
                itemElement = this.renderedItems.get(index);
                stillVisible.add(index);
            } else {
                // Try to recycle an element
                if (this.recycledItems.length > 0) {
                    itemElement = this.recycledItems.pop();
                } else {
                    // Create new element
                    itemElement = document.createElement('div');
                    itemElement.style.position = 'absolute';
                    itemElement.style.width = '100%';
                    itemElement.style.height = `${this.itemHeight}px`;
                    this.container.appendChild(itemElement);
                }
                
                // Render item
                this.renderItem(item, itemElement);
                
                // Store rendered item
                this.renderedItems.set(index, itemElement);
                stillVisible.add(index);
            }
            
            // Position element
            itemElement.style.transform = `translateY(${top}px)`;
        });
        
        // Recycle items that are no longer visible
        for (const [index, element] of this.renderedItems.entries()) {
            if (!stillVisible.has(index)) {
                // Remove from DOM
                this.container.removeChild(element);
                
                // Add to recycled items
                this.recycledItems.push(element);
                
                // Remove from rendered items
                this.renderedItems.delete(index);
            }
        }
        
        // Update metrics
        this.metrics.recycledItemsCount = this.recycledItems.length;
    }
    
    /**
     * Check if we need to load more items
     */
    checkLoadMore() {
        // If already loading, don't check
        if (this.isLoading) return;
        
        // If we have all items, don't check
        if (this.items.length >= this.totalItemsCount) return;
        
        // If scrolling down and near the bottom, load more
        if (this.scrollDirection === 'down') {
            const scrollTop = this.container.scrollTop;
            const containerHeight = this.container.clientHeight;
            const totalHeight = this.spacer.offsetHeight;
            
            // If within 1000px of the bottom, load more
            if (totalHeight - (scrollTop + containerHeight) < 1000) {
                this.loadMore();
            }
        }
    }
    
    /**
     * Load more items
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
     * Set items to display
     * @param {Array} items - Items to display
     */
    setItems(items) {
        this.items = items || [];
        
        // Clear rendered items
        this.clearRenderedItems();
        
        // Update container height
        this.updateContainerHeight();
        
        // Update visible items
        this.updateVisibleItems();
    }
    
    /**
     * Set total items count
     * @param {Number} count - Total items count
     */
    setTotalItemsCount(count) {
        this.totalItemsCount = count || 0;
        
        // Update container height
        this.updateContainerHeight();
    }
    
    /**
     * Set loading state
     * @param {Boolean} isLoading - Whether data is loading
     */
    setLoading(isLoading) {
        this.isLoading = isLoading;
    }
    
    /**
     * Clear all rendered items
     */
    clearRenderedItems() {
        // Remove all rendered items from DOM
        for (const element of this.renderedItems.values()) {
            this.container.removeChild(element);
        }
        
        // Clear rendered items
        this.renderedItems.clear();
        
        // Clear recycled items
        this.recycledItems = [];
    }
    
    /**
     * Get performance metrics
     * @returns {Object} Performance metrics
     */
    getPerformanceMetrics() {
        return {
            renderTime: `${this.metrics.renderTime.toFixed(2)}ms`,
            scrollTime: `${this.metrics.scrollTime.toFixed(2)}ms`,
            visibleItemsCount: this.metrics.visibleItemsCount,
            recycledItemsCount: this.metrics.recycledItemsCount,
            totalItemsCount: this.items.length
        };
    }
    
    /**
     * Destroy the virtual scroller
     */
    destroy() {
        // Remove event listeners
        this.container.removeEventListener('scroll', this.handleScroll);
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
        
        // Clear rendered items
        this.clearRenderedItems();
        
        // Remove spacer
        if (this.spacer && this.spacer.parentNode) {
            this.spacer.parentNode.removeChild(this.spacer);
        }
    }
}
