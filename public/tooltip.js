/**
 * Tooltip - Simple tooltip component
 */
class Tooltip {
  constructor() {
    this.tooltipElement = document.getElementById('tooltip');
    
    if (!this.tooltipElement) {
      this.tooltipElement = document.createElement('div');
      this.tooltipElement.id = 'tooltip';
      document.body.appendChild(this.tooltipElement);
    }
    
    this.init();
  }
  
  init() {
    // Add event listeners to elements with title attribute
    document.addEventListener('mouseover', (e) => {
      const target = e.target;
      if (target.title) {
        this.show(target, target.title);
        // Store the title and remove it to prevent default tooltip
        target.dataset.tooltipText = target.title;
        target.title = '';
      }
    });
    
    document.addEventListener('mouseout', (e) => {
      const target = e.target;
      if (target.dataset.tooltipText) {
        this.hide();
        // Restore the title
        target.title = target.dataset.tooltipText;
        delete target.dataset.tooltipText;
      }
    });
    
    document.addEventListener('mousemove', (e) => {
      if (this.tooltipElement.style.display === 'block') {
        this.position(e.clientX, e.clientY);
      }
    });
  }
  
  show(element, text) {
    this.tooltipElement.textContent = text;
    this.tooltipElement.style.display = 'block';
    this.position(element.getBoundingClientRect());
  }
  
  position(rect) {
    const tooltip = this.tooltipElement;
    const margin = 10;
    
    // Position above the element if possible
    let top = rect.top - tooltip.offsetHeight - margin;
    
    // If not enough space above, position below
    if (top < 0) {
      top = rect.bottom + margin;
    }
    
    // Center horizontally
    let left = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2);
    
    // Ensure tooltip is within viewport
    if (left < margin) {
      left = margin;
    } else if (left + tooltip.offsetWidth > window.innerWidth - margin) {
      left = window.innerWidth - tooltip.offsetWidth - margin;
    }
    
    tooltip.style.top = `${top + window.scrollY}px`;
    tooltip.style.left = `${left}px`;
  }
  
  hide() {
    this.tooltipElement.style.display = 'none';
  }
}
