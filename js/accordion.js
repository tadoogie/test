/**
 * Accordion Module for Sidenav Panel-Text
 * 
 * This module provides reusable accordion functionality for verses and other sections
 * in a sidenav panel-text component. It includes proper ARIA accessibility support
 * and smooth animations.
 * 
 * Usage:
 *   import { initAccordion, initAllAccordions } from './accordion.js';
 *   
 *   // Initialize a single accordion
 *   const button = document.getElementById('selectVerses');
 *   const content = document.getElementById('verses-content');
 *   initAccordion(button, content);
 *   
 *   // Or initialize all accordions at once
 *   initAllAccordions();
 */

/**
 * Initialize accordion functionality for a button and content pair
 * 
 * @param {HTMLElement} button - The accordion button/trigger element
 * @param {HTMLElement} content - The accordion content element to show/hide
 * @param {Object} options - Optional configuration
 * @param {boolean} options.closeOthers - Close other accordions when opening this one
 * @returns {Object} - Object with expand, collapse, and toggle methods
 */
export function initAccordion(button, content, options = {}) {
  if (!button || !content) {
    console.error('Accordion initialization failed: button or content element not found');
    return null;
  }

  const { closeOthers = false } = options;

  // Ensure proper ARIA attributes are set
  if (!button.hasAttribute('aria-expanded')) {
    button.setAttribute('aria-expanded', 'false');
  }
  if (!button.hasAttribute('aria-controls')) {
    button.setAttribute('aria-controls', content.id || '');
  }
  if (!content.hasAttribute('role')) {
    content.setAttribute('role', 'region');
  }
  if (!content.hasAttribute('aria-labelledby')) {
    content.setAttribute('aria-labelledby', button.id || '');
  }

  /**
   * Expand the accordion
   */
  function expand() {
    button.setAttribute('aria-expanded', 'true');
    content.classList.add('expanded');
    
    // Dispatch custom event
    const event = new CustomEvent('accordionExpanded', {
      detail: { button, content },
      bubbles: true
    });
    button.dispatchEvent(event);
  }

  /**
   * Collapse the accordion
   */
  function collapse() {
    button.setAttribute('aria-expanded', 'false');
    content.classList.remove('expanded');
    
    // Dispatch custom event
    const event = new CustomEvent('accordionCollapsed', {
      detail: { button, content },
      bubbles: true
    });
    button.dispatchEvent(event);
  }

  /**
   * Toggle the accordion state
   */
  function toggle() {
    const isExpanded = button.getAttribute('aria-expanded') === 'true';
    
    if (closeOthers && !isExpanded) {
      // Close all other accordions
      closeAllAccordions(button);
    }
    
    if (isExpanded) {
      collapse();
    } else {
      expand();
    }
  }

  // Click event handler
  button.addEventListener('click', function(event) {
    event.preventDefault();
    toggle();
  });

  // Keyboard event handler for accessibility
  button.addEventListener('keydown', function(event) {
    // Support Enter and Space keys
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault(); // Prevent default space scrolling
      toggle();
    }
  });

  console.log(`Accordion initialized: ${button.id || 'unnamed button'}`);

  // Return API for programmatic control
  return {
    expand,
    collapse,
    toggle,
    isExpanded: () => button.getAttribute('aria-expanded') === 'true'
  };
}

/**
 * Close all accordions except the one specified
 * 
 * @param {HTMLElement} exceptButton - Button to exclude from closing
 */
function closeAllAccordions(exceptButton) {
  const allButtons = document.querySelectorAll('[role="button"][aria-expanded="true"]');
  allButtons.forEach(button => {
    if (button !== exceptButton) {
      const contentId = button.getAttribute('aria-controls');
      if (contentId) {
        const content = document.getElementById(contentId);
        if (content) {
          button.setAttribute('aria-expanded', 'false');
          content.classList.remove('expanded');
        }
      }
    }
  });
}

/**
 * Initialize all accordions in the document
 * Looks for elements with specific data attributes or class combinations
 * 
 * @param {Object} options - Configuration options
 * @param {string} options.buttonSelector - CSS selector for accordion buttons
 * @param {boolean} options.closeOthers - Close other accordions when opening one
 * @returns {Array} - Array of initialized accordion controllers
 */
export function initAllAccordions(options = {}) {
  const {
    buttonSelector = '[role="button"][aria-controls]',
    closeOthers = false
  } = options;

  const accordions = [];
  const buttons = document.querySelectorAll(buttonSelector);
  
  buttons.forEach(button => {
    const contentId = button.getAttribute('aria-controls');
    if (contentId) {
      const content = document.getElementById(contentId);
      if (content) {
        const accordion = initAccordion(button, content, { closeOthers });
        if (accordion) {
          accordions.push(accordion);
        }
      } else {
        console.warn(`Content element not found for accordion button: ${button.id}`);
      }
    }
  });

  console.log(`Initialized ${accordions.length} accordion(s)`);
  return accordions;
}

/**
 * Initialize verses accordion specifically
 * This is a convenience function for the verses section
 * 
 * @returns {Object|null} - Accordion controller or null if not found
 */
export function initVersesAccordion() {
  const button = document.getElementById('selectVerses') || 
                 document.querySelector('.selectVerses');
  const content = document.getElementById('verses-content') || 
                  document.querySelector('.verses');
  
  if (button && content) {
    return initAccordion(button, content);
  } else {
    console.warn('Verses accordion elements not found');
    return null;
  }
}

/**
 * Initialize texts accordion specifically
 * This is a convenience function for the texts section (reference)
 * 
 * @returns {Object|null} - Accordion controller or null if not found
 */
export function initTextsAccordion() {
  const button = document.getElementById('selectTexts') || 
                 document.querySelector('.selectTexts');
  const content = document.getElementById('texts-content') || 
                  document.querySelector('.texts');
  
  if (button && content) {
    return initAccordion(button, content);
  } else {
    console.warn('Texts accordion elements not found');
    return null;
  }
}

// Auto-initialize if module is loaded as a script (not imported)
if (typeof module === 'undefined' || !module.exports) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initAllAccordions();
    });
  } else {
    initAllAccordions();
  }
}

// For CommonJS environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initAccordion,
    initAllAccordions,
    initVersesAccordion,
    initTextsAccordion
  };
}
