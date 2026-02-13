# getTunes.xq Expected Output Format

## Overview
The `getTunes.xq` server-side script should generate the suggested tune HTML directly, rather than outputting plain text that gets reformatted by JavaScript.

## Required HTML Structure

The `getTunes.xq` response should include:

### 1. Suggested Tune Button
Instead of outputting plain text like:
```html
<span id="pstuneSuggestion">Suggested tune: BELMONT (47a)</span>
```

Output a properly formatted button:
```html
<span id="pstuneSuggestion">
  <span style="display: block; margin-bottom: 4px;">Suggested tune:</span>
  <button type="button" class="verse-btn tune-btn" data-sugg-tune="47a" style="width: 100%; display: block;">
    <span class="tune-title" style="display: block;">BELMONT</span>
    <span class="tune-date" style="display: block;">47a</span>
  </button>
</span>
```

### 2. "Select a different tune:" Label
Before the filter input area, add:
```html
<span id="pstuneFilterLabel" style="display: block; margin-bottom: 4px; margin-top: 10px; margin-left: 8px;">
  Select a different tune:
</span>
```

### 3. Complete Example Response
```html
<!-- Suggested tune section -->
<span id="pstuneSuggestion">
  <span style="display: block; margin-bottom: 4px;">Suggested tune:</span>
  <button type="button" class="verse-btn tune-btn" data-sugg-tune="47a" style="width: 100%; display: block;">
    <span class="tune-title" style="display: block;">BELMONT</span>
    <span class="tune-date" style="display: block;">47a</span>
  </button>
</span>

<!-- Filter label -->
<span id="pstuneFilterLabel" style="display: block; margin-bottom: 4px; margin-top: 10px; margin-left: 8px;">
  Select a different tune:
</span>

<!-- Hidden data elements for JavaScript -->
<input type="hidden" id="pstuneListData" value='[{"label":"ABBEY (201a)","id":"201a"}, ...]' />
<input type="hidden" id="pstuneLabelsData" value='["ABBEY (201a)", "BANGOR (56a)", ...]' />
```

## Button Click Behavior
The suggested tune button should work like other tune buttons. Add an onclick handler:

```javascript
onclick="
  var input = document.getElementById('pstune');
  if (input) {
    input.value = 'BELMONT (47a)';
    input.dataset.tunelabel = 'BELMONT (47a)';
    input.dataset.tuneid = '47a';
    this.classList.add('active');
    window.globalPsTune = '47a';
    if (typeof renderTuneButtons !== 'undefined') {
      renderTuneButtons('BELMONT (47a)');
    }
    try { updateSelectionSummary(); } catch(e) {}
    try { maybeShowNextForTune(); } catch(e) {}
  }
"
```

Or preferably, use a data attribute and let the existing event delegation handle it:
```html
<button type="button" 
        class="verse-btn tune-btn" 
        data-label="BELMONT (47a)"
        data-tuneid="47a"
        style="width: 100%; display: block;">
  <span class="tune-title" style="display: block;">BELMONT</span>
  <span class="tune-date" style="display: block;">47a</span>
</button>
```

## Benefits of Server-Side Generation
1. **Performance**: No client-side parsing and DOM manipulation
2. **Simplicity**: Single source of truth for HTML structure
3. **Maintainability**: UI changes happen in one place (XQuery)
4. **Consistency**: Suggested tune button matches other tune buttons exactly

## Changes Made to interface-dev.js
- Removed `transformSuggestionToButton()` function
- Removed call to transform suggested tune in `getTunes()`
- Removed client-side generation of "Select a different tune:" label
- Server response is now used as-is, without client-side reformatting
