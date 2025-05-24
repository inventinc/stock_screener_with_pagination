/**
 * Enhanced VirtualScroller - Optimized for handling 5,700+ stocks
 * Implements advanced recycling, progressive loading, and memory optimization
 */
class EnhancedVirtualScroller {
  constructor(options) {
    // Required options
    this.containerElement = options.container;
    this.itemHeight = options.itemHeight;
    this.renderItem = options.renderItem;
    
    // Optional configurations with defaults
    this.bufferSize = options.bufferSize || 15; // Increased buffer for smoother scrolling
    this.batchSize = options.batchSize || 1000; // Larger batch size for better performance
    this.loadingIndicator = options.loadingIndicator;
    this.progressCallback = options.progressCallback;
    this.overscanCount = options.overscanCount || 5; // Extra items to render for smoother scrolling
    this.scrollThreshold = options.scrollThreshold || 0.8; // Threshold for triggering more data loading
    
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
    console.log('Initializing EnhancedVirtualScroller');
    
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
    
    // Append containers
    this.innerContainer.appendChild(this.placeholderContainer);
    this.containerElement.appendChild(this.innerContainer);
    
    // Store reference to the scroll container
    this.scrollContainer = this.containerElement;
  }
  
  /**
   * Bind necessary event listeners
   * @private
   */
  _bindEvents() {
    // Optimized scroll handler using requestAnimationFrame for performance
    let scrollTicking = false;
    let lastScrollY = this.scrollContainer.scrollTop;
    let scrollTimeout;
    
    const handleScroll = () => {
      const currentTime = performance.now();
      const currentScrollY = this.scrollContainer.scrollTop;
      
      // Update scroll position
      this.scrollPosition = currentScrollY;
      
      // Calculate scroll direction and velocity
      this.lastScrollDirection = currentScrollY > lastScrollY ? 'down' : 'up';
      
      if (this.lastScrollTime) {
        const timeDelta = currentTime - this.lastScrollTime;
        const positionDelta = Math.abs(currentScrollY - lastScrollY);
        this.scrollVelocity = timeDelta > 0 ? positionDelta / timeDelta : 0;
      }
      
      this.lastScrollTime = currentTime;
      lastScrollY = currentScrollY;
      
      // Clear previous scroll end timeout
      if (this.scrollEndTimeout) {
        clearTimeout(this.scrollEndTimeout);
      }
      
      // Set new timeout to detect when scrolling stops
      this.scrollEndTimeout = setTimeout(() => {
        this.scrollVelocity = 0;
        this._onScrollEnd();
      }, 150);
      
      if (!scrollTicking) {
        requestAnimationFrame(() => {
          const startTime = performance.now();
          this._handleScroll();
          const endTime = performance.now();
          
          // Track scroll handler performance
          this.scrollTimes.push(endTime - startTime);
          if (this.scrollTimes.length > 30) this.scrollTimes.shift();
          
          scrollTicking = false;
        });
        scrollTicking = true;
      }
    };
    
    this.scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    
    // Handle resize events with ResizeObserver
    this.resizeObserver = new ResizeObserver(entries => {
      this._updateVisibleItems();
    });
    this.resizeObserver.observe(this.containerElement);
    
    // Add event listener for visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this._updateVisibleItems();
      }
    });
  }
  
  /**
   * Handle scroll events
   * @private
   */
  _handleScroll() {
    this._updateVisibleItems();
    
    // Check if we need to load more data
    this._checkLoadMoreData();
  }
  
  /**
   * Handle scroll end event
   * @private
   */
  _onScrollEnd() {
    // Perform any cleanup or optimization when scrolling stops
    this._updateVisibleItems(true); // Force update with higher quality rendering
  }
  
  /**
   * Check if we need to load more data based on scroll position
   * @private
   */
  _checkLoadMoreData() {
    if (!this.onNeedMoreData || this.isLoading) return;
    
    const scrollPercentage = this.scrollPosition / (this.totalHeight - this.containerElement.clientHeight);
    
    if (scrollPercentage > this.scrollThreshold) {
      this.isLoading = true;
      this.onNeedMoreData().then(() => {
        this.isLoading = false;
      }).catch(err => {
        console.error('Error loading more data:', err);
        this.isLoading = false;
      });
    }
  }
  
  /**
   * Update which items are currently visible
   * @param {Boolean} forceUpdate - Whether to force update all visible items
   * @private
   */
  _updateVisibleItems(forceUpdate = false) {
    // Calculate visible range with dynamic buffer based on scroll velocity
    const dynamicBuffer = Math.min(50, Math.max(this.bufferSize, Math.ceil(this.scrollVelocity * 10)));
    
    const startIndex = Math.max(0, Math.floor(this.scrollPosition / this.itemHeight) - dynamicBuffer);
    const visibleCount = Math.ceil(this.containerElement.clientHeight / this.itemHeight) + (dynamicBuffer * 2);
    const endIndex = Math.min(startIndex + visibleCount, this.items.length);
    
    // Skip update if visible range hasn't changed and not forcing update
    if (!forceUpdate && 
        this.visibleRange.start === startIndex && 
        this.visibleRange.end === endIndex) {
      return;
    }
    
    // Update visible range
    this.visibleRange = { start: startIndex, end: endIndex };
    
    // Render visible items
    this._renderVisibleItems();
  }
  
  /**
   * Render currently visible items with DOM recycling
   * @private
   */
  _renderVisibleItems() {
    const startTime = performance.now();
    
    // Get currently visible items
    this.visibleItems = this.items.slice(this.visibleRange.start, this.visibleRange.end);
    
    // Track which indices should be visible
    const visibleIndices = new Set();
    for (let i = this.visibleRange.start; i < this.visibleRange.end; i++) {
      visibleIndices.add(i);
    }
    
    // Remove nodes that are no longer visible
    for (const [index, node] of this.renderedNodes.entries()) {
      if (!visibleIndices.has(index)) {
        this.placeholderContainer.removeChild(node);
        this.recycledNodes.push(node); // Add to recycling pool
        this.renderedNodes.delete(index);
      }
    }
    
    // Render new visible items
    const fragment = document.createDocumentFragment();
    let nodesAdded = 0;
    
    this.visibleItems.forEach((item, relativeIndex) => {
      const absoluteIndex = this.visibleRange.start + relativeIndex;
      
      // Skip if this item is already rendered
      if (this.renderedNodes.has(absoluteIndex)) return;
      
      // Create or recycle a node
      let itemNode;
      if (this.recycledNodes.length > 0) {
        itemNode = this.recycledNodes.pop();
        itemNode.innerHTML = ''; // Clear existing content
      } else {
        itemNode = document.createElement('div');
        itemNode.style.position = 'absolute';
        itemNode.style.width = '100%';
        itemNode.style.height = `${this.itemHeight}px`;
        itemNode.style.willChange = 'transform';
      }
      
      // Set position and data attributes
      itemNode.style.transform = `translateY(${absoluteIndex * this.itemHeight}px)`;
      itemNode.dataset.index = absoluteIndex;
      
      // Render item content
      const renderStartTime = performance.now();
      this.renderItem(item, itemNode, absoluteIndex);
      const renderEndTime = performance.now();
      
      // Track render time
      this.renderTimes.push(renderEndTime - renderStartTime);
      if (this.renderTimes.length > 30) this.renderTimes.shift();
      
      // Add to tracking map
      this.renderedNodes.set(absoluteIndex, itemNode);
      
      // Add to fragment
      fragment.appendChild(itemNode);
      nodesAdded++;
    });
    
    // Batch DOM updates for better performance
    if (nodesAdded > 0) {
      this.placeholderContainer.appendChild(fragment);
    }
    
    const endTime = performance.now();
    
    // Log performance metrics occasionally
    if (Math.random() < 0.05) {
      const avgRenderTime = this.renderTimes.reduce((sum, time) => sum + time, 0) / this.renderTimes.length;
      const avgScrollTime = this.scrollTimes.reduce((sum, time) => sum + time, 0) / this.scrollTimes.length;
      
      console.log(`VirtualScroller performance:
        - Visible items: ${this.visibleItems.length}
        - Rendered nodes: ${this.renderedNodes.size}
        - Recycled nodes: ${this.recycledNodes.length}
        - Update time: ${(endTime - startTime).toFixed(2)}ms
        - Avg item render: ${avgRenderTime.toFixed(2)}ms
        - Avg scroll handler: ${avgScrollTime.toFixed(2)}ms
      `);
    }
  }
  
  /**
   * Set the data items for the scroller
   * @param {Array} items - Array of data items
   * @param {Number} totalCount - Total number of items to expect
   */
  setItems(items, totalCount) {
    console.log(`Setting ${items.length} items, total expected: ${totalCount || items.length}`);
    
    this.items = items;
    this.loadedItemsCount = items.length;
    this.totalItemsCount = totalCount || items.length;
    
    // Update total height
    this.totalHeight = this.totalItemsCount * this.itemHeight;
    this.innerContainer.style.height = `${this.totalHeight}px`;
    
    // Update progress
    if (this.progressCallback) {
      this.progressCallback(this.loadedItemsCount, this.totalItemsCount);
    }
    
    // Clear existing rendered nodes to force re-render
    this.renderedNodes.forEach((node) => {
      if (node.parentNode) {
        node.parentNode.removeChild(node);
      }
      this.recycledNodes.push(node);
    });
    this.renderedNodes.clear();
    
    // Update visible items
    this._updateVisibleItems(true);
  }
  
  /**
   * Add more items to the existing dataset
   * @param {Array} newItems - New items to add
   */
  addItems(newItems) {
    if (!newItems || newItems.length === 0) return;
    
    console.log(`Adding ${newItems.length} items to existing ${this.items.length} items`);
    
    const oldLength = this.items.length;
    this.items = [...this.items, ...newItems];
    this.loadedItemsCount = this.items.length;
    
    // Update progress
    if (this.progressCallback) {
      this.progressCallback(this.loadedItemsCount, this.totalItemsCount);
    }
    
    // Update total height if needed
    if (this.totalItemsCount < this.loadedItemsCount) {
      this.totalItemsCount = this.loadedItemsCount;
    }
    
    this.totalHeight = this.totalItemsCount * this.itemHeight;
    this.innerContainer.style.height = `${this.totalHeight}px`;
    
    // Update visible items if we're near the new content
    if (this.visibleRange.end >= oldLength - 20) {
      this._updateVisibleItems();
    }
  }
  
  /**
   * Filter the visible items based on a filter function
   * @param {Function} filterFn - Function that returns true for items to keep
   */
  filterItems(filterFn) {
    console.log('Filtering items');
    
    // Store original items if this is the first filter
    if (!this._originalItems) {
      this._originalItems = [...this.items];
    }
    
    const startTime = performance.now();
    
    if (filterFn) {
      // Apply filter
      this.items = this._originalItems.filter(filterFn);
    } else {
      // Reset to original items
      this.items = [...this._originalItems];
    }
    
    const filterTime = performance.now() - startTime;
    console.log(`Filtering completed in ${filterTime.toFixed(2)}ms, ${this.items.length} items remaining`);
    
    // Update total height for filtered items
    this.totalHeight = this.items.length * this.itemHeight;
    this.innerContainer.style.height = `${this.totalHeight}px`;
    
    // Reset scroll position to top
    this.scrollContainer.scrollTop = 0;
    this.scrollPosition = 0;
    
    // Clear existing rendered nodes to force re-render
    this.renderedNodes.forEach((node) => {
      if (node.parentNode) {
        node.parentNode.removeChild(node);
      }
      this.recycledNodes.push(node);
    });
    this.renderedNodes.clear();
    
    // Update visible items
    this._updateVisibleItems(true);
  }
  
  /**
   * Scroll to a specific item by index
   * @param {Number} index - Index of item to scroll to
   * @param {String} position - Where to position the item: 'start', 'center', 'end' (default: 'start')
   * @param {Boolean} smooth - Whether to use smooth scrolling
   */
  scrollToIndex(index, position = 'start', smooth = false) {
    if (index < 0 || index >= this.items.length) return;
    
    let scrollPosition;
    const itemTop = index * this.itemHeight;
    
    switch (position) {
      case 'center':
        scrollPosition = itemTop - (this.containerElement.clientHeight / 2) + (this.itemHeight / 2);
        break;
      case 'end':
        scrollPosition = itemTop - this.containerElement.clientHeight + this.itemHeight;
        break;
      case 'start':
      default:
        scrollPosition = itemTop;
    }
    
    // Ensure scroll position is within bounds
    scrollPosition = Math.max(0, Math.min(scrollPosition, this.totalHeight - this.containerElement.clientHeight));
    
    // Apply scroll
    if (smooth && 'scrollBehavior' in document.documentElement.style) {
      this.scrollContainer.scrollTo({
        top: scrollPosition,
        behavior: 'smooth'
      });
    } else {
      this.scrollContainer.scrollTop = scrollPosition;
    }
  }
  
  /**
   * Refresh the scroller (re-render all visible items)
   */
  refresh() {
    console.log('Refreshing virtual scroller');
    
    // Clear existing rendered nodes to force re-render
    this.renderedNodes.forEach((node) => {
      if (node.parentNode) {
        node.parentNode.removeChild(node);
      }
      this.recycledNodes.push(node);
    });
    this.renderedNodes.clear();
    
    // Update visible items
    this._updateVisibleItems(true);
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
      renderedNodes: this.renderedNodes.size,
      recycledNodes: this.recycledNodes.length,
      averageRenderTime: avgRenderTime,
      averageScrollTime: avgScrollTime,
      totalItems: this.items.length,
      scrollVelocity: this.scrollVelocity
    };
  }
  
  /**
   * Clean up resources
   */
  destroy() {
    console.log('Destroying virtual scroller');
    
    // Remove event listeners
    this.scrollContainer.removeEventListener('scroll', this._handleScroll);
    
    // Disconnect resize observer
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    
    // Clear any pending timeouts
    if (this.scrollEndTimeout) {
      clearTimeout(this.scrollEndTimeout);
    }
    
    // Clear DOM
    while (this.placeholderContainer.firstChild) {
      this.placeholderContainer.removeChild(this.placeholderContainer.firstChild);
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
  module.exports = { EnhancedVirtualScroller };
} else {
  // For browser usage
  window.EnhancedVirtualScroller = EnhancedVirtualScroller;
}
