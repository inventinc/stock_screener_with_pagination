/**
 * IncrementalVirtualScroller - Optimized for handling 5,700+ stocks with smaller batch sizes
 * Implements advanced recycling, progressive loading, and memory optimization
 */
class IncrementalVirtualScroller {
  constructor(options) {
    // Required options
    this.containerElement = options.container;
    this.itemHeight = options.itemHeight;
    this.renderItem = options.renderItem;
    
    // Optional configurations with defaults
    this.bufferSize = options.bufferSize || 10; // Buffer size for smoother scrolling
    this.batchSize = options.batchSize || 50; // Smaller batch size for better user experience
    this.loadingIndicator = options.loadingIndicator;
    this.progressCallback = options.progressCallback;
    this.overscanCount = options.overscanCount || 3; // Extra items to render for smoother scrolling
    this.scrollThreshold = options.scrollThreshold || 0.8; // Threshold for triggering more data loading
    this.loadMoreCallback = options.loadMoreCallback; // Callback for loading more data
    this.manualLoadMode = options.manualLoadMode || false; // Whether to use manual loading mode
    
    // Internal state
    this.items = []; // All items data
    this.visibleItems = []; // Currently visible items
    this.visibleRange = { start: 0, end: 0 }; // Current visible range indices
    this.totalHeight = 0; // Total scrollable height
    this.scrollPosition = 0; // Current scroll position
    this.isLoading = false; // Loading state flag
    this.loadedItemsCount = 0; // Number of items loaded so far
    this.totalItemsCount = 0; // Total number of items to load
    this.recycledNodes = []; // Pool of DOM nodes for recycling
    this.renderedNodes = new Map(); // Map of currently rendered nodes by index
    this.lastScrollDirection = null; // Track scroll direction for optimizations
    this.scrollVelocity = 0; // Track scroll velocity for dynamic buffer sizing
    this.lastScrollTime = 0; // Last scroll timestamp for velocity calculation
    this.lastScrollPosition = 0; // Last scroll position for direction detection
    this.scrollEndTimeout = null; // Timeout for detecting scroll end
    this.resizeObserver = null; // ResizeObserver instance
    this.loadMoreButton = null; // Load more button element
    
    // Performance monitoring
    this.renderTimes = []; // Array of render times for performance tracking
    this.scrollTimes = []; // Array of scroll handler execution times
    
    // DOM elements
    this.scrollContainer = null;
    this.innerContainer = null;
    this.placeholderContainer = null;
    
    // Initialize the scroller
    this._initialize();
  }
  
  /**
   * Initialize the virtual scroller
   * @private
   */
  _initialize() {
    console.log('Initializing IncrementalVirtualScroller');
    
    // Create necessary DOM structure
    this._setupDOM();
    
    // Bind event handlers
    this._bindEvents();
    
    // Initial render
    this._updateVisibleItems();
  }
  
  /**
   * Set up the DOM structure for virtual scrolling
   * @private
   */
  _setupDOM() {
    // Style the container
    this.containerElement.style.position = 'relative';
    this.containerElement.style.overflow = 'auto';
    this.containerElement.style.willChange = 'transform'; // Optimize for GPU
    this.containerElement.style.webkitOverflowScrolling = 'touch'; // Smooth scrolling on iOS
    
    // Create inner container for proper scrolling
    this.innerContainer = document.createElement('div');
    this.innerContainer.style.position = 'relative';
    this.innerContainer.style.width = '100%';
    this.innerContainer.style.height = '0px'; // Will be updated when items are loaded
    
    // Create placeholder container for items
    this.placeholderContainer = document.createElement('div');
    this.placeholderContainer.style.position = 'absolute';
    this.placeholderContainer.style.top = '0';
    this.placeholderContainer.style.left = '0';
    this.placeholderContainer.style.width = '100%';
    
    // Create load more button
    this.loadMoreButton = document.createElement('button');
    this.loadMoreButton.className = 'load-more-button';
    this.loadMoreButton.textContent = 'Load More Stocks';
    this.loadMoreButton.style.display = 'none';
    this.loadMoreButton.style.position = 'relative';
    this.loadMoreButton.style.margin = '20px auto';
    this.loadMoreButton.style.padding = '10px 20px';
    this.loadMoreButton.style.backgroundColor = '#0066ff';
    this.loadMoreButton.style.color = 'white';
    this.loadMoreButton.style.border = 'none';
    this.loadMoreButton.style.borderRadius = '4px';
    this.loadMoreButton.style.cursor = 'pointer';
    this.loadMoreButton.style.fontWeight = '500';
    this.loadMoreButton.style.fontSize = '14px';
    this.loadMoreButton.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
    
    // Create load more button container
    const loadMoreContainer = document.createElement('div');
    loadMoreContainer.style.display = 'flex';
    loadMoreContainer.style.justifyContent = 'center';
    loadMoreContainer.style.width = '100%';
    loadMoreContainer.style.padding = '10px 0';
    loadMoreContainer.appendChild(this.loadMoreButton);
    
    // Append containers
    this.innerContainer.appendChild(this.placeholderContainer);
    this.innerContainer.appendChild(loadMoreContainer);
    this.containerElement.appendChild(this.innerContainer);
    
    // Store reference to the scroll container
    this.scrollContainer = this.containerElement;
  }
  
  /**
   * Bind event handlers
   * @private
   */
  _bindEvents() {
    // Scroll event handler
    this.scrollContainer.addEventListener('scroll', this._handleScroll.bind(this), { passive: true });
    
    // Load more button click handler
    this.loadMoreButton.addEventListener('click', this._handleLoadMoreClick.bind(this));
    
    // Resize observer for container size changes
    if (window.ResizeObserver) {
      this.resizeObserver = new ResizeObserver(this._handleResize.bind(this));
      this.resizeObserver.observe(this.containerElement);
    } else {
      // Fallback for browsers without ResizeObserver
      window.addEventListener('resize', this._handleResize.bind(this));
    }
  }
  
  /**
   * Handle scroll events
   * @param {Event} event - Scroll event
   * @private
   */
  _handleScroll(event) {
    const startTime = performance.now();
    
    // Get current scroll position
    this.scrollPosition = this.scrollContainer.scrollTop;
    
    // Calculate scroll direction and velocity
    const now = Date.now();
    const timeDelta = now - this.lastScrollTime;
    
    if (timeDelta > 0) {
      this.scrollVelocity = Math.abs(this.scrollPosition - this.lastScrollPosition) / timeDelta;
      this.lastScrollDirection = this.scrollPosition > this.lastScrollPosition ? 'down' : 'up';
    }
    
    this.lastScrollTime = now;
    this.lastScrollPosition = this.scrollPosition;
    
    // Clear previous scroll end timeout
    if (this.scrollEndTimeout) {
      clearTimeout(this.scrollEndTimeout);
    }
    
    // Set new timeout to detect when scrolling stops
    this.scrollEndTimeout = setTimeout(() => {
      this._handleScrollEnd();
    }, 150);
    
    // Update visible items
    this._updateVisibleItems();
    
    // Check if we need to load more data
    this._checkLoadMore();
    
    // Track performance
    const endTime = performance.now();
    this.scrollTimes.push(endTime - startTime);
    
    if (this.scrollTimes.length > 20) {
      this.scrollTimes.shift();
    }
  }
  
  /**
   * Handle scroll end event
   * @private
   */
  _handleScrollEnd() {
    // Reset scroll velocity
    this.scrollVelocity = 0;
    
    // Final update of visible items
    this._updateVisibleItems();
    
    // Final check for loading more
    this._checkLoadMore();
  }
  
  /**
   * Handle resize events
   * @private
   */
  _handleResize() {
    // Update visible items on resize
    this._updateVisibleItems();
    
    // Check if we need to load more data
    this._checkLoadMore();
  }
  
  /**
   * Handle load more button click
   * @private
   */
  _handleLoadMoreClick() {
    // Disable button during loading
    this.loadMoreButton.disabled = true;
    this.loadMoreButton.textContent = 'Loading...';
    
    // Call load more callback
    if (this.loadMoreCallback) {
      this.loadMoreCallback().then(success => {
        // Re-enable button if loading failed or there's more data
        this.loadMoreButton.disabled = false;
        this.loadMoreButton.textContent = 'Load More Stocks';
        
        // Update UI
        this._updateLoadMoreButton();
      });
    }
  }
  
  /**
   * Check if we need to load more data
   * @private
   */
  _checkLoadMore() {
    if (this.manualLoadMode) {
      // In manual mode, just update the button visibility
      this._updateLoadMoreButton();
      return;
    }
    
    // Calculate how close we are to the bottom
    const scrollBottom = this.scrollPosition + this.scrollContainer.clientHeight;
    const scrollPercentage = scrollBottom / this.totalHeight;
    
    // If we're close to the bottom and have a callback, trigger loading more
    if (scrollPercentage > this.scrollThreshold && this.loadMoreCallback && !this.isLoading) {
      this.isLoading = true;
      
      // Show loading state
      this._updateLoadingState(true);
      
      // Call load more callback
      this.loadMoreCallback().then(success => {
        this.isLoading = false;
        
        // Update loading state
        this._updateLoadingState(false);
        
        // Update UI
        this._updateVisibleItems();
        this._updateLoadMoreButton();
      });
    }
  }
  
  /**
   * Update loading state
   * @param {Boolean} isLoading - Whether data is loading
   * @private
   */
  _updateLoadingState(isLoading) {
    if (this.loadingIndicator) {
      this.loadingIndicator.style.display = isLoading ? 'block' : 'none';
    }
  }
  
  /**
   * Update load more button visibility
   * @private
   */
  _updateLoadMoreButton() {
    // Only show button in manual mode or when we have more data to load
    const hasMoreData = this.loadedItemsCount < this.totalItemsCount;
    const shouldShow = (this.manualLoadMode || !this.isLoading) && hasMoreData;
    
    this.loadMoreButton.style.display = shouldShow ? 'block' : 'none';
  }
  
  /**
   * Update visible items based on current scroll position
   * @private
   */
  _updateVisibleItems() {
    const startTime = performance.now();
    
    // Calculate visible range
    const containerHeight = this.scrollContainer.clientHeight;
    const startIndex = Math.floor(this.scrollPosition / this.itemHeight);
    const endIndex = Math.ceil((this.scrollPosition + containerHeight) / this.itemHeight);
    
    // Add buffer and overscan for smoother scrolling
    const bufferSize = Math.max(this.bufferSize, Math.ceil(this.scrollVelocity * 10));
    const visibleStartIndex = Math.max(0, startIndex - bufferSize - this.overscanCount);
    const visibleEndIndex = Math.min(this.items.length - 1, endIndex + bufferSize + this.overscanCount);
    
    // Update visible range
    this.visibleRange = {
      start: visibleStartIndex,
      end: visibleEndIndex
    };
    
    // Get currently visible items
    this.visibleItems = this.items.slice(visibleStartIndex, visibleEndIndex + 1);
    
    // Render visible items
    this._renderVisibleItems();
    
    // Track performance
    const endTime = performance.now();
    this.renderTimes.push(endTime - startTime);
    
    if (this.renderTimes.length > 20) {
      this.renderTimes.shift();
    }
  }
  
  /**
   * Render visible items
   * @private
   */
  _renderVisibleItems() {
    // Skip if no items
    if (this.items.length === 0) return;
    
    // Get current rendered indices
    const currentIndices = new Set(this.renderedNodes.keys());
    const newIndices = new Set();
    
    // Add new items
    for (let i = this.visibleRange.start; i <= this.visibleRange.end; i++) {
      if (i >= 0 && i < this.items.length) {
        newIndices.add(i);
        
        if (!currentIndices.has(i)) {
          this._renderItemAtIndex(i);
        }
      }
    }
    
    // Remove items that are no longer visible
    for (const index of currentIndices) {
      if (!newIndices.has(index)) {
        this._recycleItemAtIndex(index);
      }
    }
  }
  
  /**
   * Render item at specific index
   * @param {Number} index - Item index
   * @private
   */
  _renderItemAtIndex(index) {
    // Get item data
    const item = this.items[index];
    
    // Get or create node
    let node = this.recycledNodes.pop();
    
    if (!node) {
      node = document.createElement('div');
    }
    
    // Position the node
    node.style.position = 'absolute';
    node.style.top = `${index * this.itemHeight}px`;
    node.style.width = '100%';
    node.style.height = `${this.itemHeight}px`;
    
    // Render item content
    this.renderItem(item, node);
    
    // Add to DOM if not already there
    if (!node.parentNode) {
      this.placeholderContainer.appendChild(node);
    }
    
    // Store in rendered nodes map
    this.renderedNodes.set(index, node);
  }
  
  /**
   * Recycle item at specific index
   * @param {Number} index - Item index
   * @private
   */
  _recycleItemAtIndex(index) {
    const node = this.renderedNodes.get(index);
    
    if (node) {
      // Remove from DOM
      if (node.parentNode) {
        node.parentNode.removeChild(node);
      }
      
      // Add to recycled nodes pool
      this.recycledNodes.push(node);
      
      // Remove from rendered nodes map
      this.renderedNodes.delete(index);
    }
  }
  
  /**
   * Set items data
   * @param {Array} items - Items data
   */
  setItems(items) {
    // Store items
    this.items = items || [];
    this.loadedItemsCount = this.items.length;
    
    // Update total height
    this.totalHeight = this.items.length * this.itemHeight;
    this.innerContainer.style.height = `${this.totalHeight}px`;
    
    // Clear rendered nodes
    this.renderedNodes.forEach((node, index) => {
      this._recycleItemAtIndex(index);
    });
    
    // Update visible items
    this._updateVisibleItems();
    
    // Update load more button
    this._updateLoadMoreButton();
    
    console.log(`Set ${this.items.length} items in virtual scroller`);
  }
  
  /**
   * Set total items count
   * @param {Number} count - Total items count
   */
  setTotalItemsCount(count) {
    this.totalItemsCount = count;
    
    // Update load more button
    this._updateLoadMoreButton();
  }
  
  /**
   * Set loading state
   * @param {Boolean} isLoading - Whether data is loading
   */
  setLoading(isLoading) {
    this.isLoading = isLoading;
    
    // Update loading state
    this._updateLoadingState(isLoading);
    
    // Update load more button
    this._updateLoadMoreButton();
  }
  
  /**
   * Set manual load mode
   * @param {Boolean} enabled - Whether manual load mode should be enabled
   */
  setManualLoadMode(enabled) {
    this.manualLoadMode = enabled;
    
    // Update load more button
    this._updateLoadMoreButton();
  }
  
  /**
   * Refresh the scroller
   */
  refresh() {
    // Update visible items
    this._updateVisibleItems();
    
    // Check if we need to load more data
    this._checkLoadMore();
  }
  
  /**
   * Scroll to specific item
   * @param {Number} index - Item index
   * @param {String} position - Scroll position (start, center, end)
   */
  scrollToItem(index, position = 'start') {
    if (index < 0 || index >= this.items.length) return;
    
    let scrollTop = index * this.itemHeight;
    
    if (position === 'center') {
      scrollTop -= (this.scrollContainer.clientHeight - this.itemHeight) / 2;
    } else if (position === 'end') {
      scrollTop -= (this.scrollContainer.clientHeight - this.itemHeight);
    }
    
    this.scrollContainer.scrollTop = Math.max(0, scrollTop);
  }
  
  /**
   * Get performance metrics
   * @returns {Object} Performance metrics
   */
  getPerformanceMetrics() {
    const avgRenderTime = this.renderTimes.length > 0 
      ? this.renderTimes.reduce((sum, time) => sum + time, 0) / this.renderTimes.length 
      : 0;
      
    const avgScrollTime = this.scrollTimes.length > 0
      ? this.scrollTimes.reduce((sum, time) => sum + time, 0) / this.scrollTimes.length
      : 0;
      
    return {
      visibleItems: this.visibleItems.length,
      totalItems: this.items.length,
      recycledNodes: this.recycledNodes.length,
      renderedNodes: this.renderedNodes.size,
      averageRenderTime: avgRenderTime,
      averageScrollTime: avgScrollTime,
      scrollVelocity: this.scrollVelocity,
      lastScrollDirection: this.lastScrollDirection,
      manualLoadMode: this.manualLoadMode
    };
  }
  
  /**
   * Clean up resources
   */
  destroy() {
    // Remove event listeners
    this.scrollContainer.removeEventListener('scroll', this._handleScroll);
    this.loadMoreButton.removeEventListener('click', this._handleLoadMoreClick);
    
    // Disconnect resize observer
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    } else {
      window.removeEventListener('resize', this._handleResize);
    }
    
    // Clear timeouts
    if (this.scrollEndTimeout) {
      clearTimeout(this.scrollEndTimeout);
    }
    
    // Clear DOM
    while (this.containerElement.firstChild) {
      this.containerElement.removeChild(this.containerElement.firstChild);
    }
    
    // Clear data
    this.items = [];
    this.visibleItems = [];
    this.recycledNodes = [];
    this.renderedNodes.clear();
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { IncrementalVirtualScroller };
} else {
  // For browser usage
  window.IncrementalVirtualScroller = IncrementalVirtualScroller;
}
