/**
 * Tooltip - Simple tooltip implementation for the stock screener
 */
class Tooltip {
    constructor() {
        this.tooltipElement = document.getElementById('tooltip');
        this.setupEventListeners();
    }
    
    /**
     * Set up event listeners for tooltip
     */
    setupEventListeners() {
        // Add event listeners to elements with title attribute
        document.querySelectorAll('[title]').forEach(element => {
            element.addEventListener('mouseenter', (e) => this.show(e));
            element.addEventListener('mouseleave', () => this.hide());
            element.addEventListener('mousemove', (e) => this.move(e));
        });
    }
    
    /**
     * Show tooltip
     * @param {Event} e - Mouse event
     */
    show(e) {
        const target = e.target;
        const title = target.getAttribute('title');
        
        if (!title) return;
        
        // Store original title and remove it to prevent native tooltip
        target.dataset.originalTitle = title;
        target.removeAttribute('title');
        
        // Set tooltip content
        this.tooltipElement.textContent = title;
        this.tooltipElement.style.display = 'block';
        
        // Position tooltip
        this.move(e);
    }
    
    /**
     * Hide tooltip
     */
    hide() {
        this.tooltipElement.style.display = 'none';
        
        // Restore original title
        const element = document.querySelector('[data-original-title]');
        if (element) {
            element.setAttribute('title', element.dataset.originalTitle);
            element.removeAttribute('data-original-title');
        }
    }
    
    /**
     * Move tooltip with cursor
     * @param {Event} e - Mouse event
     */
    move(e) {
        const offset = 15;
        let x = e.clientX + offset;
        let y = e.clientY + offset;
        
        // Check if tooltip would go off screen
        const tooltipWidth = this.tooltipElement.offsetWidth;
        const tooltipHeight = this.tooltipElement.offsetHeight;
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        
        if (x + tooltipWidth > windowWidth) {
            x = windowWidth - tooltipWidth - offset;
        }
        
        if (y + tooltipHeight > windowHeight) {
            y = windowHeight - tooltipHeight - offset;
        }
        
        this.tooltipElement.style.left = `${x}px`;
        this.tooltipElement.style.top = `${y}px`;
    }
}
