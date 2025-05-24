/**
 * VirtualScroller - Efficient handling of large datasets with virtual scrolling
 * Designed for the Stock Screener application to handle 5,700+ stocks
 */
class VirtualScroller {
  constructor(options) {
    // Required options
    this.containerElement = options.container;
    this.itemHeight = options.itemHeight;
    this.renderItem = options.renderItem;
    
    // Optional configurations with defaults
    this.bufferSize = options.bufferSize || 10; // Extra items to render above/below viewport
    this.batchSize = options.batchSize || 500; // Number of items to load in each batch
    this.loadingIndicator = options.loadingIndicator;
    this.progressCallback = options.progressCallback;
    
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
    
    // DOM elements
    this.scrollContainer = null;
    this.innerContainer = null;
    
    // Initialize the scroller
    this._initialize();
  }
  
  /**
   * Initialize the virtual scroller
   * @private
   */
  _initialize() {
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
    
    // Create inner container for proper scrolling
    this.innerContainer = document.createElement('div');
    this.innerContainer.style.position = 'relative';
    this.innerContainer.style.width = '100%';
    this.innerContainer.style.height = '0px'; // Will be updated when items are loaded
    
    // Append inner container to the main container
    this.containerElement.appendChild(this.innerContainer);
    
    // Store reference to the scroll container
    this.scrollContainer = this.containerElement;
  }
  
  /**
   * Bind necessary event listeners
   * @private
   */
  _bindEvents() {
    // Throttled scroll handler using requestAnimationFrame for performance
    let ticking = false;
    this.scrollContainer.addEventListener('scroll', () => {
      this.scrollPosition = this.scrollContainer.scrollTop;
      
      if (!ticking) {
        window.requestAnimationFrame(() => {
          this._handleScroll();
          ticking = false;
        });
        ticking = true;
      }
    });
    
    // Handle resize events
    const resizeObserver = new ResizeObserver(entries => {
      this._updateVisibleItems();
    });
    resizeObserver.observe(this.containerElement);
  }
  
  /**
   * Handle scroll events
   * @private
   */
  _handleScroll() {
    this._updateVisibleItems();
  }
  
  /**
   * Update which items are currently visible
   * @private
   */
  _updateVisibleItems() {
    // Calculate visible range
    const startIndex = Math.max(0, Math.floor(this.scrollPosition / this.itemHeight) - this.bufferSize);
    const visibleCount = Math.ceil(this.containerElement.clientHeight / this.itemHeight) + (this.bufferSize * 2);
    const endIndex = Math.min(startIndex + visibleCount, this.items.length);
    
    // Update visible range
    this.visibleRange = { start: startIndex, end: endIndex };
    
    // Render visible items
    this._renderVisibleItems();
  }
  
  /**
   * Render currently visible items
   * @private
   */
  _renderVisibleItems() {
    // Get currently visible items
    this.visibleItems = this.items.slice(this.visibleRange.start, this.visibleRange.end);
    
    // Clear existing items that are no longer needed
    const existingNodes = Array.from(this.innerContainer.children);
    const existingIndices = existingNodes.map(node => parseInt(node.dataset.index, 10));
    
    // Remove nodes that are no longer visible
    existingNodes.forEach(node => {
      const index = parseInt(node.dataset.index, 10);
      if (index < this.visibleRange.start || index >= this.visibleRange.end) {
        this.innerContainer.removeChild(node);
        this.recycledNodes.push(node); // Add to recycling pool
      }
    });
    
    // Render new visible items
    this.visibleItems.forEach((item, relativeIndex) => {
      const absoluteIndex = this.visibleRange.start + relativeIndex;
      
      // Skip if this item is already rendered
      if (existingIndices.includes(absoluteIndex)) return;
      
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
      }
      
      // Set position and data attributes
      itemNode.style.transform = `translateY(${absoluteIndex * this.itemHeight}px)`;
      itemNode.dataset.index = absoluteIndex;
      
      // Render item content
      this.renderItem(item, itemNode, absoluteIndex);
      
      // Add to DOM
      this.innerContainer.appendChild(itemNode);
    });
  }
  
  /**
   * Set the data items for the scroller
   * @param {Array} items - Array of data items
   * @param {Number} totalCount - Total number of items to expect
   */
  setItems(items, totalCount) {
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
    
    // Update visible items
    this._updateVisibleItems();
  }
  
  /**
   * Add more items to the existing dataset
   * @param {Array} newItems - New items to add
   */
  addItems(newItems) {
    this.items = [...this.items, ...newItems];
    this.loadedItemsCount = this.items.length;
    
    // Update progress
    if (this.progressCallback) {
      this.progressCallback(this.loadedItemsCount, this.totalItemsCount);
    }
    
    // Update total height if needed
    if (this.totalItemsCount < this.loadedItemsCount) {
      this.totalItemsCount = this.loadedItemsCount;
      this.totalHeight = this.totalItemsCount * this.itemHeight;
      this.innerContainer.style.height = `${this.totalHeight}px`;
    }
    
    // Update visible items
    this._updateVisibleItems();
  }
  
  /**
   * Filter the visible items based on a filter function
   * @param {Function} filterFn - Function that returns true for items to keep
   */
  filterItems(filterFn) {
    // Store original items if this is the first filter
    if (!this._originalItems) {
      this._originalItems = [...this.items];
    }
    
    if (filterFn) {
      // Apply filter
      this.items = this._originalItems.filter(filterFn);
    } else {
      // Reset to original items
      this.items = [...this._originalItems];
    }
    
    // Update total height for filtered items
    this.totalHeight = this.items.length * this.itemHeight;
    this.innerContainer.style.height = `${this.totalHeight}px`;
    
    // Reset scroll position to top
    this.scrollContainer.scrollTop = 0;
    this.scrollPosition = 0;
    
    // Update visible items
    this._updateVisibleItems();
  }
  
  /**
   * Scroll to a specific item by index
   * @param {Number} index - Index of item to scroll to
   */
  scrollToIndex(index) {
    if (index < 0 || index >= this.items.length) return;
    
    const scrollPosition = index * this.itemHeight;
    this.scrollContainer.scrollTop = scrollPosition;
  }
  
  /**
   * Refresh the scroller (re-render all visible items)
   */
  refresh() {
    this._updateVisibleItems();
  }
  
  /**
   * Clean up resources
   */
  destroy() {
    // Remove event listeners
    this.scrollContainer.removeEventListener('scroll', this._handleScroll);
    
    // Clear DOM
    while (this.innerContainer.firstChild) {
      this.innerContainer.removeChild(this.innerContainer.firstChild);
    }
    
    // Clear data
    this.items = [];
    this.visibleItems = [];
    this.recycledNodes = [];
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { VirtualScroller };
}
