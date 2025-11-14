# Accordion Implementation for Verses Section

This implementation adds accordion functionality to the verses section in a sidenav panel-text, following the same pattern as the texts accordion.

## Features

✅ **Toggle Functionality**: Click on `selectVerses` div to expand/collapse the `verses` div
✅ **Smooth Animation**: 0.3s cubic-bezier transition for professional feel
✅ **ARIA Accessibility**: Full screen reader support with proper attributes
✅ **Keyboard Navigation**: Tab, Enter, and Space key support
✅ **Consistent Styling**: Matches the texts accordion pattern
✅ **Visual Feedback**: Hover, focus, and active states
✅ **Responsive Design**: Works on mobile and desktop
✅ **Dark Mode Support**: Automatic theme adaptation
✅ **Reduced Motion**: Respects user preferences

## Files

### Demo Files
- `accordion-demo.html` - Standalone demonstration of the accordion
- `verovio-with-sidenav.html` - Integrated example with Verovio layout

### Module Files
- `js/accordion.js` - Reusable JavaScript module for accordion functionality
- `css/accordion.css` - Standalone CSS styles for accordion components

## Usage

### Option 1: Standalone HTML

Include the accordion in your HTML:

```html
<div class="sidenav">
  <div class="panel-text">
    
    <!-- Verses Section -->
    <div class="section">
      <div class="section-header">Verses</div>
      <div 
        class="selectVerses" 
        role="button"
        tabindex="0"
        aria-expanded="false"
        aria-controls="verses-content"
        id="selectVerses"
      >
        <span>View Verses</span>
        <span class="accordion-icon" aria-hidden="true"></span>
      </div>
      <div 
        class="verses" 
        id="verses-content"
        role="region"
        aria-labelledby="selectVerses"
      >
        <div class="verses-content">
          <!-- Your verse content here -->
        </div>
      </div>
    </div>

  </div>
</div>
```

### Option 2: Using the Module

```html
<!-- In your HTML head -->
<link rel="stylesheet" href="css/accordion.css">
<script type="module">
  import { initVersesAccordion } from './js/accordion.js';
  
  document.addEventListener('DOMContentLoaded', () => {
    initVersesAccordion();
  });
</script>
```

### Option 3: Auto-initialization

```html
<!-- Include CSS -->
<link rel="stylesheet" href="css/accordion.css">

<!-- Include JavaScript -->
<script src="js/accordion.js"></script>
<!-- Accordions will auto-initialize on DOM load -->
```

## JavaScript API

The accordion module provides several functions:

### initAccordion(button, content, options)
Initialize a single accordion with custom elements.

```javascript
const button = document.getElementById('selectVerses');
const content = document.getElementById('verses-content');
const accordion = initAccordion(button, content);

// Programmatic control
accordion.expand();
accordion.collapse();
accordion.toggle();
console.log(accordion.isExpanded());
```

### initAllAccordions(options)
Initialize all accordions in the document automatically.

```javascript
initAllAccordions({
  buttonSelector: '[role="button"][aria-controls]',
  closeOthers: false
});
```

### initVersesAccordion()
Convenience function to initialize the verses accordion specifically.

```javascript
const versesAccordion = initVersesAccordion();
```

### initTextsAccordion()
Convenience function to initialize the texts accordion (reference).

```javascript
const textsAccordion = initTextsAccordion();
```

## ARIA Accessibility

The implementation includes proper ARIA attributes for screen readers:

- `role="button"` - Identifies the clickable trigger
- `aria-expanded="true|false"` - Indicates expanded/collapsed state
- `aria-controls="content-id"` - Links button to its content
- `aria-labelledby="button-id"` - Links content back to its button
- `tabindex="0"` - Makes element keyboard accessible
- `aria-hidden="true"` - Hides decorative icon from screen readers

## Keyboard Support

- **Tab**: Navigate to accordion buttons
- **Enter**: Toggle accordion
- **Space**: Toggle accordion

## Browser Compatibility

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

## Customization

### Changing Animation Speed

Edit the CSS transition duration:

```css
.verses {
  transition: max-height 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}
```

### Changing Max Height

Adjust the expanded max-height based on your content:

```css
.verses.expanded {
  max-height: 800px; /* Increase for more content */
}
```

### Custom Icons

Replace the default arrow icons:

```css
.selectVerses[aria-expanded="false"] .accordion-icon::before {
  content: "+";
}

.selectVerses[aria-expanded="true"] .accordion-icon::before {
  content: "−";
}
```

## Testing

To test the implementation:

1. Open `accordion-demo.html` in a browser
2. Click on "View Verses" to expand
3. Click again to collapse
4. Test keyboard navigation with Tab and Enter/Space
5. Test with a screen reader (NVDA, JAWS, VoiceOver)

## Integration with Existing Projects

To integrate into existing Verovio or other projects:

1. Copy `css/accordion.css` to your project's CSS folder
2. Copy `js/accordion.js` to your project's JS folder
3. Add the HTML structure from the examples
4. Include the CSS and JS files in your HTML
5. Initialize accordions with your preferred method

## Performance

- Lightweight: ~7KB JavaScript, ~4KB CSS (uncompressed)
- No external dependencies
- Pure vanilla JavaScript
- CSS transitions for smooth animations

## Security

- No external dependencies to minimize security risks
- No inline event handlers
- Follows modern JavaScript best practices
- XSS-safe (no innerHTML manipulation of user content)

## License

This implementation follows standard web accessibility guidelines and best practices.

## Support

For issues or questions, refer to:
- ARIA Authoring Practices Guide: https://www.w3.org/WAI/ARIA/apg/
- MDN Web Docs: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA

## Version History

- v1.0.0 (2025-11-14): Initial implementation with full ARIA support
