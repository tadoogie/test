/**
 * Basic tests for melody-search-results.js
 * Validates the component structure and exports
 */

// Simple test framework
const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

function runTests() {
  console.log('Running tests...\n');
  let passed = 0;
  let failed = 0;
  
  tests.forEach(({ name, fn }) => {
    try {
      fn();
      console.log(`✓ ${name}`);
      passed++;
    } catch (error) {
      console.log(`✗ ${name}`);
      console.log(`  Error: ${error.message}`);
      failed++;
    }
  });
  
  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

// Import the module
import { MelodySearchResults, melodySearchResultsCSS } from './js/melody-search-results.js';

// Tests
test('MelodySearchResults class is exported', () => {
  if (typeof MelodySearchResults !== 'function') {
    throw new Error('MelodySearchResults is not a function/class');
  }
});

test('melodySearchResultsCSS is exported', () => {
  if (typeof melodySearchResultsCSS !== 'string') {
    throw new Error('melodySearchResultsCSS is not a string');
  }
  if (melodySearchResultsCSS.length === 0) {
    throw new Error('melodySearchResultsCSS is empty');
  }
});

test('CSS contains required classes', () => {
  const requiredClasses = [
    'melody-search-results',
    'melody-result-item',
    'melody-result-title',
    'melody-play-button',
    'play-progress-circle',
    'progress-fill',
    'progress-bg'
  ];
  
  requiredClasses.forEach(className => {
    if (!melodySearchResultsCSS.includes(className)) {
      throw new Error(`CSS missing class: ${className}`);
    }
  });
});

test('MelodySearchResults has required methods', () => {
  const requiredMethods = [
    'render',
    'createResultItem',
    'createPlayButton',
    'handlePlayClick',
    'startPlayback',
    'stopPlayback',
    'convertPaeToMei'
  ];
  
  requiredMethods.forEach(method => {
    if (typeof MelodySearchResults.prototype[method] !== 'function') {
      throw new Error(`Missing method: ${method}`);
    }
  });
});

test('convertPaeToMei generates valid XML structure', () => {
  // Create a mock container and toolkit
  const mockContainer = {
    innerHTML: '',
    appendChild: () => {},
    querySelector: () => null
  };
  
  const mockToolkit = {
    loadData: () => {},
    renderToMIDI: () => 'base64data',
    setOptions: () => {}
  };
  
  // Mock document for Node.js environment
  global.document = { addEventListener: () => {} };
  global.window = {};
  
  const component = new MelodySearchResults(mockContainer, mockToolkit);
  const mei = component.convertPaeToMei('@clef:G-2 @data:4C4D4E', 'Test Tune');
  
  if (!mei.includes('<?xml')) {
    throw new Error('MEI output missing XML declaration');
  }
  if (!mei.includes('<mei')) {
    throw new Error('MEI output missing root element');
  }
  if (!mei.includes('Test Tune')) {
    throw new Error('MEI output missing title');
  }
  if (!mei.includes('@clef:G-2 @data:4C4D4E')) {
    throw new Error('MEI output missing PAE code');
  }
  if (!mei.includes('plaineAndEasie')) {
    throw new Error('MEI output missing plaineAndEasie form attribute');
  }
  
  // Clean up
  delete global.document;
  delete global.window;
});

test('escapeXml handles special characters', () => {
  const mockContainer = { innerHTML: '', appendChild: () => {}, querySelector: () => null };
  const mockToolkit = { loadData: () => {}, renderToMIDI: () => '', setOptions: () => {} };
  
  // Mock document for Node.js environment
  global.document = { addEventListener: () => {} };
  global.window = {};
  
  const component = new MelodySearchResults(mockContainer, mockToolkit);
  
  const input = 'Test & <tag> "quotes" \'apostrophe\'';
  const escaped = component.escapeXml(input);
  
  if (escaped.includes('&') && !escaped.includes('&amp;')) {
    throw new Error('Ampersand not escaped');
  }
  if (escaped.includes('<') || escaped.includes('>')) {
    throw new Error('Angle brackets not escaped');
  }
  
  // Clean up
  delete global.document;
  delete global.window;
});

test('Component initializes without errors', () => {
  const mockContainer = {
    innerHTML: '',
    appendChild: () => {},
    querySelector: () => null
  };
  
  const mockToolkit = {
    loadData: () => {},
    renderToMIDI: () => 'base64data',
    setOptions: () => {}
  };
  
  // Mock document for Node.js environment
  global.document = { addEventListener: () => {} };
  global.window = {};
  
  const component = new MelodySearchResults(mockContainer, mockToolkit);
  
  if (!component.container) {
    throw new Error('Container not set');
  }
  if (!component.vrvToolkit) {
    throw new Error('Toolkit not set');
  }
  
  // Clean up
  delete global.document;
  delete global.window;
});

// Run all tests
runTests();
