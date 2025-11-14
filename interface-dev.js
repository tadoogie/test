/**
 * interface-dev.js
 * Demonstrates the fix for text accordion positioning and default verses state
 */

// Sample data for psalms
const psalms = [
    { id: 1, name: 'Psalm 1', verses: 6 },
    { id: 6, name: 'Psalm 6 (First Version)', verses: 10 },
    { id: 6.1, name: 'Psalm 6 (Second Version)', verses: 10 },
    { id: 23, name: 'Psalm 23', verses: 6 },
    { id: 42, name: 'Psalm 42', verses: 11 },
    { id: 100, name: 'Psalm 100', verses: 5 },
    { id: 150, name: 'Psalm 150', verses: 6 }
];

let selectedPsalm = null;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Set up the texts accordion
    setTexts(psalms);
    
    // Set up the verses accordion toggle
    setupVersesAccordion();
});

/**
 * FIX #1: setTexts() - Properly positions psalm buttons in #texts container
 * This fixes the bug where buttons appeared behind content
 */
function setTexts(textList) {
    // Get references to the containers
    const textsContainer = document.getElementById('texts');
    const selectTextsHeader = document.getElementById('selectTexts');
    
    // Clear and hide the texts container initially
    textsContainer.innerHTML = '';
    textsContainer.style.display = 'none';
    selectTextsHeader.classList.remove('expanded');
    
    // Create the psalm buttons container
    const psalmButtons = document.createElement('div');
    psalmButtons.id = 'psalmButtons';
    
    // Populate with psalm buttons
    textList.forEach(psalm => {
        const button = document.createElement('button');
        button.className = 'psalm-button';
        button.textContent = psalm.name;
        button.dataset.psalmId = psalm.id;
        button.dataset.verses = psalm.verses;
        
        button.addEventListener('click', function() {
            selectPsalm(psalm);
        });
        
        psalmButtons.appendChild(button);
    });
    
    // KEY FIX: Append to #texts container (in .submenu) instead of #psTextList (in .menuSpan)
    // This allows the accordion to expand without being constrained by the fixed height
    textsContainer.appendChild(psalmButtons);
    
    // Set up toggle for the texts accordion
    selectTextsHeader.addEventListener('click', function() {
        toggleTextsAccordion();
    });
}

/**
 * Toggle the texts accordion visibility
 */
function toggleTextsAccordion() {
    const textsContainer = document.getElementById('texts');
    const selectTextsHeader = document.getElementById('selectTexts');
    
    if (textsContainer.style.display === 'none') {
        // Expand
        textsContainer.style.display = 'block';
        selectTextsHeader.classList.add('expanded');
    } else {
        // Collapse
        textsContainer.style.display = 'none';
        selectTextsHeader.classList.remove('expanded');
    }
}

/**
 * Handle psalm selection
 */
function selectPsalm(psalm) {
    selectedPsalm = psalm;
    
    // Collapse the texts accordion after selection
    const textsContainer = document.getElementById('texts');
    const selectTextsHeader = document.getElementById('selectTexts');
    textsContainer.style.display = 'none';
    selectTextsHeader.classList.remove('expanded');
    
    // Update display
    updateDisplay();
    
    // Populate verses for the selected psalm
    populateVersesFromSelectedText(psalm);
}

/**
 * FIX #2: populateVersesFromSelectedText() - Keeps verses collapsed by default
 * This fixes the bug where verses were automatically expanded
 */
function populateVersesFromSelectedText(psalm) {
    const versesContainer = document.getElementById('verses');
    const selectVersesHeader = document.getElementById('selectVerses');
    
    // Clear existing verses
    versesContainer.innerHTML = '';
    
    // Create verse buttons container
    const verseButtons = document.createElement('div');
    verseButtons.id = 'verseButtons';
    
    // Add "All Verses" option
    const allVersesCheckbox = createVerseCheckbox('all', 'All Verses');
    verseButtons.appendChild(allVersesCheckbox);
    
    // Add individual verse checkboxes
    for (let i = 1; i <= psalm.verses; i++) {
        const verseCheckbox = createVerseCheckbox(i, `Verse ${i}`);
        verseButtons.appendChild(verseCheckbox);
    }
    
    versesContainer.appendChild(verseButtons);
    
    // KEY FIX: Do NOT automatically expand the verses
    // Remove these lines that were causing the bug:
    // versesContainer.style.display = 'block';  // DON'T DO THIS
    // versesContainer.classList.add('expanded'); // DON'T DO THIS
    
    // Keep verses collapsed - user must click to expand
    versesContainer.style.display = 'none';
    selectVersesHeader.classList.remove('expanded');
}

/**
 * Create a verse checkbox element
 */
function createVerseCheckbox(value, label) {
    const container = document.createElement('div');
    container.className = 'verse-checkbox';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `verse-${value}`;
    checkbox.value = value;
    checkbox.addEventListener('change', updateDisplay);
    
    const labelElement = document.createElement('label');
    labelElement.htmlFor = `verse-${value}`;
    labelElement.textContent = label;
    
    container.appendChild(checkbox);
    container.appendChild(labelElement);
    
    return container;
}

/**
 * Set up the verses accordion toggle functionality
 */
function setupVersesAccordion() {
    const selectVersesHeader = document.getElementById('selectVerses');
    const versesContainer = document.getElementById('verses');
    
    selectVersesHeader.addEventListener('click', function() {
        if (versesContainer.style.display === 'none') {
            // Expand
            versesContainer.style.display = 'block';
            selectVersesHeader.classList.add('expanded');
        } else {
            // Collapse
            versesContainer.style.display = 'none';
            selectVersesHeader.classList.remove('expanded');
        }
    });
}

/**
 * Update the display area with selected content
 */
function updateDisplay() {
    const displayArea = document.getElementById('display-area');
    
    if (!selectedPsalm) {
        displayArea.innerHTML = '<p>Select a psalm text and verses to display content here.</p>';
        return;
    }
    
    // Get selected verses
    const checkboxes = document.querySelectorAll('.verse-checkbox input[type="checkbox"]:checked');
    const selectedVerses = Array.from(checkboxes).map(cb => cb.value);
    
    let html = `<h3>${selectedPsalm.name}</h3>`;
    
    if (selectedVerses.length === 0) {
        html += '<p>No verses selected. Click "Select the Verses:" to choose verses.</p>';
    } else if (selectedVerses.includes('all')) {
        html += '<p><strong>All verses selected</strong></p>';
        html += '<p>This would display all verses of the psalm.</p>';
    } else {
        html += `<p><strong>Selected verses:</strong> ${selectedVerses.join(', ')}</p>`;
        html += '<p>This would display the selected verses of the psalm.</p>';
    }
    
    displayArea.innerHTML = html;
}
