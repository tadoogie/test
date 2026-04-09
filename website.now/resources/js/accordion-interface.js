let originalSources = [];

// Single selected text key (string) or null
let selectedTextKey = null;

// Map textKey -> array of selected verse labels
const selectedVersesByTextId = {};

// Map textKey -> verse order as presented in UI (used to sort selections in display order)
const verseOrderByTextId = {};

// Map textKey -> map of sectionName -> [verse labels] (for texts with subsections)
const sectionVersesByTextId = {};

document.addEventListener("DOMContentLoaded", function() {
  fetch('getSourcesTextsMetres.xq')
    .then(res => res.json())
    .then(data => {
      originalSources = data.sources || [];
      populateMetrePicker(data.metres || []);
      populateSourceAccordions(originalSources);
    })
    .catch(err => {
      console.error('Failed to load sources/texts:', err);
    });

  attachInitialAccordionToggles();

  const menutoggle = document.getElementById('menutoggle');
  if (menutoggle) {
    menutoggle.addEventListener('click', function () {
      setTimeout(() => {
        const sidenav = document.getElementById('sidenav');
        if (!sidenav) return;
        const isOpen = sidenav.style.width && sidenav.style.width !== '0' && sidenav.style.width !== '0px' && sidenav.style.width !== '';
        if (isOpen) {
          openAccordionById('section-text');
        }
      }, 50);
    });
  }
});

// --- Helpers ---
function getTextKey(txt) {
  return (txt && (txt.id || txt.ID || txt.key)) ? (txt.id || txt.ID || txt.key) : String(txt.label || txt);
}

function ensureSelectedVersesInput() {
  let el = document.getElementById('selectedVerses');
  if (!el) {
    el = document.createElement('input');
    el.type = 'hidden';
    el.id = 'selectedVerses';
    document.body.appendChild(el);
  }
  return el;
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Compact numeric ranges (fallback)
function formatVerseList(arr) {
  const nums = arr.map(x => String(x).trim());
  const parsed = nums.map(n => Number.isNaN(Number(n)) ? n : Number(n));
  const result = [];
  let i = 0;
  while (i < parsed.length) {
    const cur = parsed[i];
    if (typeof cur === 'number') {
      let j = i + 1;
      while (j < parsed.length && typeof parsed[j] === 'number' && parsed[j] === parsed[j-1] + 1) j++;
      if (j - i >= 3) {
        result.push(`${parsed[i]}-${parsed[j-1]}`);
      } else {
        for (let k = i; k < j; k++) result.push(String(parsed[k]));
      }
      i = j;
    } else {
      result.push(String(cur));
      i++;
    }
  }
  return result.join(', ');
}

function compareVerseLabels(a, b) {
  const an = Number(a);
  const bn = Number(b);
  const aIsNum = !Number.isNaN(an);
  const bIsNum = !Number.isNaN(bn);
  if (aIsNum && bIsNum) return an - bn;
  if (aIsNum) return -1;
  if (bIsNum) return 1;
  return String(a).localeCompare(String(b));
}

function sortSelectedVersesByOriginalOrder(textKey, arr) {
  if (!Array.isArray(arr)) return [];
  const order = verseOrderByTextId[textKey];
  if (Array.isArray(order) && order.length) {
    const indexMap = new Map(order.map((v, i) => [String(v), i]));
    return arr.slice().sort((a, b) => {
      const ia = indexMap.has(String(a)) ? indexMap.get(String(a)) : Infinity;
      const ib = indexMap.has(String(b)) ? indexMap.get(String(b)) : Infinity;
      if (ia !== ib) return ia - ib;
      return compareVerseLabels(a, b);
    });
  }
  return arr.slice().sort(compareVerseLabels);
}

function compressOrderedVerses(textKey, orderedArr) {
  if (!Array.isArray(orderedArr) || orderedArr.length === 0) return '';
  const order = verseOrderByTextId[textKey] || [];
  const indexMap = order.length ? new Map(order.map((v, i) => [String(v), i])) : null;

  const tokens = [];
  let i = 0;
  while (i < orderedArr.length) {
    let j = i + 1;
    while (j < orderedArr.length) {
      const prev = orderedArr[j - 1];
      const cur = orderedArr[j];
      if (indexMap) {
        const ip = indexMap.has(String(prev)) ? indexMap.get(String(prev)) : null;
        const ic = indexMap.has(String(cur)) ? indexMap.get(String(cur)) : null;
        if (ip !== null && ic !== null && ic === ip + 1) { j++; continue; }
        break;
      } else {
        const prevN = Number(prev), curN = Number(cur);
        if (!Number.isNaN(prevN) && !Number.isNaN(curN) && curN === prevN + 1) { j++; continue; }
        break;
      }
    }
    const runLen = j - i;
    if (runLen >= 3) tokens.push(`${orderedArr[i]}-${orderedArr[j - 1]}`);
    else for (let k = i; k < j; k++) tokens.push(String(orderedArr[k]));
    i = j;
  }
  return tokens.join(', ');
}

function closeSourceSection(section) {
  if (!section) return;
  const toggle = section.querySelector('.accordion-toggle');
  const content = section.querySelector('.accordion-content');
  if (toggle) toggle.classList.remove('open');
  if (content) content.style.display = 'none';
}

// helper to open an accordion by section id and close siblings
function openAccordionById(idToOpen) {
  // close all first
  document.querySelectorAll('.accordion-toggle').forEach(btn => {
    btn.classList.remove('open');
    if (btn.nextElementSibling) btn.nextElementSibling.style.display = 'none';
  });
  const section = document.getElementById(idToOpen);
  if (!section) return;
  const toggle = section.querySelector('.accordion-toggle');
  const content = section.querySelector('.accordion-content');
  if (toggle) toggle.classList.add('open');
  if (content) content.style.display = 'block';
}

// Update the visible Tune header summary in the sidenav.
// There are duplicate #selectTuneBtn elements in the markup (one inside the accordion toggle and one below it).
// This helper updates both (any .select-text-line1 or .select-tune children it finds).
function updateTuneHeaderSummary(tuneLabel) {
  if (!tuneLabel) {
    // reset to default strings if empty
    document.querySelectorAll('#selectTuneBtn .select-text-line1').forEach(el => el.textContent = 'Select a tune below');
    document.querySelectorAll('#selectTuneBtn .select-tune').forEach(el => el.textContent = 'Tune: [Select below]');
    return;
  }
  const labelText = `Tune: ${tuneLabel}`;
  // update any .select-text-line1 within #selectTuneBtn (accordion header)
  document.querySelectorAll('#selectTuneBtn .select-text-line1').forEach(el => el.textContent = labelText);
  // update any .select-tune elements (always-visible summary)
  document.querySelectorAll('#selectTuneBtn .select-tune').forEach(el => el.textContent = labelText);
}

// --- Fetch tunes for the selected text's metre and populate a select (#tunePicker) ---
// Expects server endpoint getTunes.xq to return an HTML snippet containing:
// - textarea#pstuneListData (JSON array of {label, id})
// - optionally a #pstune input with suggested label
// - optionally a span#pstuneSuggestion with human readable suggestion
function fetchTunesForText(txt) {
  if (!txt) {
    console.debug('fetchTunesForText: no txt supplied');
    return;
  }
  const metre = String(txt.metre || txt.met || '').trim();
  const textURI = encodeURIComponent(txt.id || txt.ID || txt.key || txt.label || '');
  const suggTuneId = encodeURIComponent(txt.suggTune || '');
  const url = `getTunes.xq?metre=${encodeURIComponent(metre)}&textURI=${textURI}&suggTune=${suggTuneId}`;

  console.debug('fetchTunesForText: requesting', url);

  fetch(url, { credentials: 'same-origin' })
    .then(res => {
      if (!res.ok) throw new Error('Failed to load tune list: ' + res.status);
      return res.text();
    })
    .then(html => {
      const tmp = document.createElement('div');
      tmp.innerHTML = html;

      const listTA = tmp.querySelector('#pstuneListData');
      let tuneList = [];
      if (listTA && listTA.value) {
        try {
          tuneList = JSON.parse(listTA.value);
        } catch (e) {
          console.error('fetchTunesForText: failed to parse JSON in #pstuneListData', e, listTA.value);
        }
      } else {
        console.debug('fetchTunesForText: no #pstuneListData found in response', html);
      }

      const pstuneInputFromServer = tmp.querySelector('#pstune');
      const suggestionSpanFromServer = tmp.querySelector('#pstuneSuggestion');
      const suggestedLabel = suggestionSpanFromServer
        ? suggestionSpanFromServer.textContent.trim().replace(/^Suggested tune:\s*/, '')
        : (pstuneInputFromServer ? pstuneInputFromServer.value.trim() : '');

      const tuneAccordion = document.getElementById('tuneAccordion');
      if (!tuneAccordion) {
        console.warn('fetchTunesForText: no #tuneAccordion found in DOM');
        return;
      }

      // Remove any existing tunePicker, suggestion, and Go button
      const existing = document.getElementById('tunePicker');
      if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
      const existingSug = document.getElementById('tuneSuggestion');
      if (existingSug && existingSug.parentNode) existingSug.parentNode.removeChild(existingSug);
      const existingGo = document.getElementById('tuneGoContainer');
      if (existingGo && existingGo.parentNode) existingGo.parentNode.removeChild(existingGo);

      // Create select element
      const sel = document.createElement('select');
      sel.id = 'tunePicker';
      sel.style.width = '100%';
      sel.style.fontSize = '1em';
      sel.style.padding = '8px';
      sel.style.margin = '6px 0 6px 0';
      sel.style.borderRadius = '6px';
      sel.style.border = '1px solid #aaa';
      sel.setAttribute('aria-label', 'Select Tune');

      const defaultOpt = document.createElement('option');
      defaultOpt.value = '';
      defaultOpt.textContent = '-- Select Tune --';
      sel.appendChild(defaultOpt);

      tuneList.forEach(item => {
        const option = document.createElement('option');
        option.value = item.id || item.label || '';
        option.textContent = item.label || item.id || '';
        sel.appendChild(option);
      });

      // Insert select into tuneLetterAccordions if present, otherwise into tuneAccordion
      const letterAccordions = document.getElementById('tuneLetterAccordions');
      const parentForPicker = letterAccordions || tuneAccordion;
      parentForPicker.appendChild(sel);

      // Create a visible suggestion element under the select (if suggestion present)
      const sug = document.createElement('div');
      sug.id = 'tuneSuggestion';
      sug.style.marginTop = '6px';
      sug.style.color = '#ddd';
      sug.style.fontSize = '0.95em';
      if (suggestedLabel) sug.textContent = `Suggested tune: ${suggestedLabel}`;
      else sug.textContent = ''; // empty if none
      parentForPicker.appendChild(sug);

      // Create the Go button area (matching live site structure) and place it after the picker/suggestion.
      const goContainer = document.createElement('div');
      goContainer.className = 'menu-item right';
      goContainer.id = 'tuneGoContainer';

      const goInner = document.createElement('div');
      goInner.id = 'submit';
      goInner.className = 'goBtn';

      const goBtn = document.createElement('button');
      goBtn.type = 'button';
      goBtn.className = 'submitbtn';
      goBtn.id = 'tuneGoBtn';
      // Start disabled until a tune is selected
      goBtn.disabled = true;
      // SVG icon (kept inline to match the live UI)
      goBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" style="height: 40px;fill: #89cb72;stroke: #89cb72;stroke-width: 5;margin-bottom: -3px;"><path d="M438.6 278.6c12.5-12.5 12.5-32.8 0-45.3l-160-160c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L338.8 224 32 224c-17.7 0-32 14.3-32 32s14.3 32 32 32l306.7 0L233.4 393.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0l160-160z"></path></svg><br>Go!';

      // When clicked, call existing functions (if present) and attempt to ensure Verovio rendering.
      goBtn.addEventListener('click', function () {
        // Debugging: log the values that loadFile likely reads.
        try {
          const pstext = document.getElementById('pstext') ? document.getElementById('pstext').value : '';
          const pssource = document.getElementById('pssource') ? document.getElementById('pssource').value : '';
          const pstune = document.getElementById('pstune') ? document.getElementById('pstune').value : '';
          const selMet = document.getElementById('selMet') ? document.getElementById('selMet').value : '';
          const selectedVerses = document.getElementById('selectedVerses') ? document.getElementById('selectedVerses').value : '';
          console.debug('Go clicked: pstext=', pstext, 'pssource=', pssource, 'pstune=', pstune, 'selMet=', selMet, 'selectedVerses=', selectedVerses);
        } catch (e) {
          console.error('Error reading hidden fields for debug:', e);
        }

        // Call loadFile() if available
        try {
          if (typeof loadFile === 'function') {
            console.debug('Calling loadFile()...');
            loadFile();
          } else {
            console.warn('loadFile() not defined on window');
          }
        } catch (e) {
          console.error('Error calling loadFile():', e);
        }

        // close the navigation if available
        try {
          if (typeof closeNav === 'function') {
            closeNav();
          } else {
            // also attempt the local helper if defined
            const sidenav = document.getElementById('sidenav');
            if (sidenav) sidenav.style.width = '0';
          }
        } catch (e) {
          console.error('Error calling closeNav():', e);
        }

        // After a short delay, attempt to call common Verovio render entry points (safe guards)
        setTimeout(() => {
          try {
            if (typeof render === 'function') {
              console.debug('Calling render() fallback for Verovio...');
              render();
            }
          } catch (e) {
            console.debug('render() fallback failed or not present:', e);
          }
          try {
            if (typeof renderVerovio === 'function') {
              console.debug('Calling renderVerovio() fallback for Verovio...');
              renderVerovio();
            }
          } catch (e) {
            console.debug('renderVerovio() fallback failed or not present:', e);
          }
          try {
            // Some codebases attach a verovioToolkit instance; attempt a generic update event
            if (window.verovio && typeof window.verovio.render === 'function') {
              console.debug('Attempting window.verovio.render()...');
              window.verovio.render();
            }
          } catch (e) {
            // Ignore - just attempt best-effort
            console.debug('window.verovio.render() attempt failed:', e);
          }
          // Emit a custom event that other code can listen for if they need to trigger a Verovio render.
          try {
            const ev = new CustomEvent('splitleaf:goClicked', { detail: { time: Date.now() } });
            window.dispatchEvent(ev);
            console.debug('Dispatched splitleaf:goClicked event (other code may listen to this and run rendering).');
          } catch (e) {
            console.debug('Could not dispatch splitleaf:goClicked event:', e);
          }
        }, 50);
      });

      goInner.appendChild(goBtn);
      goContainer.appendChild(goInner);
      parentForPicker.appendChild(goContainer);

      // Ensure there's a #pstune input in the DOM (some code expects it). Keep it hidden.
      let pstune = document.getElementById('pstune');
      if (!pstune) {
        pstune = document.createElement('input');
        pstune.type = 'text';
        pstune.id = 'pstune';
        pstune.style.display = 'none';
        (tuneAccordion || document.body).appendChild(pstune);
      }

      // If the server returned a suggested label, set pstune and select matching option and enable Go button
      if (suggestedLabel) {
        pstune.value = suggestedLabel;
        let matched = false;
        for (let i = 0; i < sel.options.length; i++) {
          if (sel.options[i].textContent === suggestedLabel) {
            sel.selectedIndex = i;
            matched = true;
            break;
          }
        }
        // update header summary
        updateTuneHeaderSummary(suggestedLabel || '');
        // If suggestion matched an option, enable Go. Otherwise leave selection blank but still show suggestion.
        goBtn.disabled = !matched;
      } else {
        pstune.value = '';
        updateTuneHeaderSummary(''); // reset header
        goBtn.disabled = true;
      }

      // When user selects a tune, update the pstune input, update header summary and enable the Go button
      sel.addEventListener('change', function () {
        const idx = sel.selectedIndex;
        if (idx > 0) {
          const opt = sel.options[idx];
          const tuneLabel = opt.textContent || opt.value || '';
          pstune.value = tuneLabel;
          updateTuneHeaderSummary(tuneLabel);
          goBtn.disabled = false;
        } else {
          pstune.value = '';
          updateTuneHeaderSummary('');
          goBtn.disabled = true;
        }
      });

      // If the picker has a non-empty selection already, ensure the Go button state matches and update header
      if (sel.selectedIndex > 0) {
        const opt = sel.options[sel.selectedIndex];
        updateTuneHeaderSummary(opt ? (opt.textContent || opt.value) : '');
        goBtn.disabled = false;
      }

    })
    .catch(err => {
      console.error('fetchTunesForText error:', err);
      // show a small inline message so users see something obvious
      const tuneAccordion = document.getElementById('tuneAccordion');
      if (tuneAccordion) {
        const errEl = document.getElementById('tuneFetchError');
        if (!errEl) {
          const eDiv = document.createElement('div');
          eDiv.id = 'tuneFetchError';
          eDiv.style.color = '#f88';
          eDiv.style.marginTop = '8px';
          eDiv.textContent = 'Unable to load tunes for this metre.';
          tuneAccordion.appendChild(eDiv);
        }
      }
    });
}

// --- Metre picker ---
function populateMetrePicker(metres) {
  const picker = document.getElementById('metrePicker');
  if (!picker) return;
  const preferred = ["8.6.8.6.", "8.8.8.8.", "6.6.8.6."];
  const remaining = (metres || []).filter(m => !preferred.includes(m));
  remaining.sort((a, b) => {
    const toNums = str => String(str).split('.').filter(Boolean).map(Number);
    const an = toNums(a), bn = toNums(b);
    for (let i = 0; i < Math.max(an.length, bn.length); i++) {
      const av = an[i] || 0, bv = bn[i] || 0;
      if (av !== bv) return av - bv;
    }
    return an.length - bn.length;
  });
  const ordered = preferred.filter(m => metres.includes(m)).concat(remaining);
  picker.innerHTML = '<option value="">-- Select Metre --</option>';
  ordered.forEach(function(m) {
    const option = document.createElement('option');
    option.value = m; option.textContent = m; picker.appendChild(option);
  });
  picker.onchange = function() { filterSourcesByMetre(picker.value); };
}

// --- Source + Text accordions ---
function populateSourceAccordions(sources) {
  const container = document.getElementById('sourceAccordions');
  if (!container) return;
  container.innerHTML = '';

  sources.forEach(src => {
    const section = document.createElement('div');
    section.className = 'source-section';

    const toggle = document.createElement('button');
    toggle.className = 'accordion-source';
    toggle.innerHTML = `<span class="accordion-caret"></span>${escapeHtml(src.label || '')}`;

    const content = document.createElement('div');
    content.className = 'accordion-content';
    content.style.display = 'none';

    const btnContainer = document.createElement('div');
    btnContainer.className = 'psalm-btn-container';

    const sortedTexts = (src.texts || []).slice().sort((a, b) => {
      const numA = parseInt((a.label || '').match(/^Psalm\s*(\d+)/i)?.[1] || 0, 10);
      const numB = parseInt((b.label || '').match(/^Psalm\s*(\d+)/i)?.[1] || 0, 10);
      if (numA !== numB) return numA - numB;
      const rankA = getVersionRank(a.label || ''), rankB = getVersionRank(b.label || '');
      if (rankA !== rankB) return rankA - rankB;
      return String((a.label || '')).localeCompare(String((b.label || '')));
    });

    sortedTexts.forEach(txt => {
      const btn = document.createElement('button');
      btn.className = 'psalm-btn'; btn.type = 'button';
      const textKey = getTextKey(txt);
      btn.dataset.textKey = textKey;

      const psalmMatch = (txt.label || '').match(/^Psalm\s*(\d+)/i);
      const psalmNumber = psalmMatch ? psalmMatch[1] : null;
      let parenMatch = (txt.label || '').match(/\(([^)]+)\)/);
      let parenText = parenMatch ? parenMatch[1].trim() : '';
      if (/^first version$/i.test(parenText)) parenText = 'Ver 1';
      else if (/^second version$/i.test(parenText)) parenText = 'Ver 2';

      const lblSpan = document.createElement('span'); lblSpan.className = 'psalm-label'; lblSpan.textContent = 'PSALM';
      const numSpan = document.createElement('span'); numSpan.className = 'psalm-number'; numSpan.textContent = psalmNumber || (txt.label || '');
      btn.appendChild(lblSpan); btn.appendChild(numSpan);
      if (parenText) { const subSpan = document.createElement('span'); subSpan.className = 'psalm-subline'; subSpan.textContent = parenText; btn.appendChild(subSpan); }

      if (selectedTextKey && selectedTextKey === textKey) { btn.classList.add('active'); btn.setAttribute('aria-pressed','true'); }
      else btn.setAttribute('aria-pressed','false');

      btn.addEventListener('click', function () {
        if (selectedTextKey === textKey) {
          selectedTextKey = null; btn.classList.remove('active'); btn.setAttribute('aria-pressed','false');
          clearStanzaArea(); clearTopSelection();
        } else {
          if (selectedTextKey) {
            const prevBtn = document.querySelector(`.psalm-btn[data-text-key="${selectedTextKey}"]`);
            if (prevBtn) { prevBtn.classList.remove('active'); prevBtn.setAttribute('aria-pressed','false'); }
          }
          selectedTextKey = textKey;
          btn.classList.add('active'); btn.setAttribute('aria-pressed','true');
          selectPsalmBehavior(txt, src.label, section);
        }
      });

      btnContainer.appendChild(btn);
    });

    content.appendChild(btnContainer);

    toggle.addEventListener('click', function() {
      toggle.classList.toggle('open');
      content.style.display = toggle.classList.contains('open') ? 'block' : 'none';
    });

    section.appendChild(toggle);
    section.appendChild(content);
    container.appendChild(section);
  });
}

function getVersionRank(label) {
  const m = String(label || '').match(/\(([^)]+)\)/);
  if (!m) return 0;
  const t = m[1].trim().toLowerCase();
  if (t === 'first version') return 1;
  if (t === 'second version') return 2;
  const numMatch = t.match(/(?:ver(?:\.|sion)?\s*|version\s*)(\d+)/i);
  if (numMatch) { const n = parseInt(numMatch[1],10); if (!Number.isNaN(n)) return n; }
  return 99;
}

// --- Stanza area (non-accordion) ---
function populateStanzaArea(txt) {
  const container = document.getElementById('stanzaAccordion');
  if (!container) return;
  container.innerHTML = '';

  // Apply requested inline styles to the stanzaAccordion when stanzas are about to be rendered.
  container.style.borderTop = '1px solid #aaa';
  container.style.marginLeft = '-23px';
  container.style.paddingLeft = '25px';
  container.style.width = '330px';

  const label = document.createElement('div');
  label.className = 'stanza-label';
  label.textContent = 'Select Verses:';
  label.style.color = '#white';
  label.style.fontSize = '1.2em';
  label.style.marginTop = '10px';
  label.style.marginBottom = '6px';
  container.appendChild(label);

  const textKey = getTextKey(txt);

  // If text has sections (e.g., Psalm 119), render grouped UI
  if (Array.isArray(txt.sections) && txt.sections.length) {
    // Build flattened verse order from the sections (preserve UI order)
    const fullOrder = [];
    sectionVersesByTextId[textKey] = {};
    txt.sections.forEach(sec => {
      const secName = String(sec.name || '');
      const secVerses = (Array.isArray(sec.verses) ? sec.verses.map(v => String(v)) : []);
      sectionVersesByTextId[textKey][secName] = secVerses.slice();
      fullOrder.push(...secVerses);
    });
    verseOrderByTextId[textKey] = fullOrder.slice();

    if (!selectedVersesByTextId[textKey]) selectedVersesByTextId[textKey] = [];

    // For each section render a header, the verse buttons for that section, and a single toggle
    txt.sections.forEach(sec => {
      const secName = String(sec.name || '');
      const secVerses = (Array.isArray(sec.verses) ? sec.verses.map(v => String(v)) : []);

      // Section wrapper
      const sectionDiv = document.createElement('div');
      sectionDiv.className = 'psalm-section';
      sectionDiv.style.marginBottom = '30px';

      // Section header row: name + single toggle (select all / clear)
      const headerRow = document.createElement('div');
      headerRow.className = 'psalm-section-header';
      headerRow.style.display = 'flex';
      headerRow.style.alignItems = 'center';
      headerRow.style.gap = '8px';
      headerRow.style.marginBottom = '6px';

      const nameEl = document.createElement('strong');
      nameEl.textContent = secName;
      nameEl.style.flex = '0 0 auto';
      headerRow.appendChild(nameEl);

      // per-section toggle button (single)
      const sectionToggle = document.createElement('button');
      sectionToggle.type = 'button';
      sectionToggle.className = 'stanza-control-btn stanza-control-section-toggle';
      sectionToggle.dataset.sectionName = secName;
      sectionToggle.dataset.textKey = textKey;
      sectionToggle.setAttribute('title', `Toggle select all verses in ${secName}`);
      sectionToggle.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" style="width:20px;height:20px;vertical-align:middle;margin-right:2px;fill:#6fc252;"><path d="M480 96C515.3 96 544 124.7 544 160L544 480C544 515.3 515.3 544 480 544L160 544C124.7 544 96 515.3 96 480L96 160C96 124.7 124.7 96 160 96L480 96zM438 209.7C427.3 201.9 412.3 204.3 404.5 215L285.1 379.2L233 327.1C223.6 317.7 208.4 317.7 199.1 327.1C189.8 336.5 189.7 351.7 199.1 361L271.1 433C276.1 438 283 440.5 289.9 440C296.8 439.5 303.3 435.9 307.4 430.2L443.3 243.2C451.1 232.5 448.7 217.5 438 209.7z"/></svg>Select';

      updateSectionToggleState(textKey, secName, sectionToggle);

      sectionToggle.addEventListener('click', function () {
        const currentlyAll = isSectionFullySelected(textKey, secName);
        if (currentlyAll) {
          clearSectionVerses(textKey, secName);
        } else {
          selectAllSectionVerses(textKey, secName);
        }
      });

      headerRow.appendChild(sectionToggle);
      sectionDiv.appendChild(headerRow);

      // Buttons for verses in this section
      const verseRow = document.createElement('div');
      verseRow.className = 'psalm-btn-container stanza-btn-container';
      verseRow.style.marginBottom = '6px';

      secVerses.forEach(labelText => {
        const vbtn = document.createElement('button');
        vbtn.className = 'verse-btn';
        vbtn.type = 'button';
        vbtn.setAttribute('aria-pressed', 'false');
        vbtn.dataset.verse = labelText;
        vbtn.dataset.textKey = textKey;
        vbtn.dataset.section = secName;

        const vspan = document.createElement('span');
        vspan.className = 'verse-number';
        vspan.textContent = labelText;
        vbtn.appendChild(vspan);

        if (Array.isArray(selectedVersesByTextId[textKey]) && selectedVersesByTextId[textKey].indexOf(labelText) !== -1) {
          vbtn.classList.add('active'); vbtn.setAttribute('aria-pressed','true');
        }

        vbtn.addEventListener('click', function () {
          if (selectedTextKey !== textKey) {
            if (selectedTextKey) {
              const prevBtn = document.querySelector(`.psalm-btn[data-text-key="${selectedTextKey}"]`);
              if (prevBtn) { prevBtn.classList.remove('active'); prevBtn.setAttribute('aria-pressed','false'); }
            }
            selectedTextKey = textKey;
            const psBtn = document.querySelector(`.psalm-btn[data-text-key="${textKey}"]`);
            if (psBtn) { psBtn.classList.add('active'); psBtn.setAttribute('aria-pressed','true'); const section = psBtn.closest('.source-section'); if (section) closeSourceSection(section); }
          }

          const active = vbtn.classList.toggle('active');
          vbtn.setAttribute('aria-pressed', active ? 'true' : 'false');

          let arr = selectedVersesByTextId[textKey] || [];
          if (active) {
            if (arr.indexOf(labelText) === -1) arr.push(labelText);
          } else {
            const idx = arr.indexOf(labelText);
            if (idx !== -1) arr.splice(idx,1);
          }
          arr = sortSelectedVersesByOriginalOrder(textKey, arr);
          selectedVersesByTextId[textKey] = arr.slice();
          updateSelectedVersesHiddenAndSummary(textKey);
        });

        verseRow.appendChild(vbtn);
      });

      sectionDiv.appendChild(verseRow);
      container.appendChild(sectionDiv);
    });

    // Global toggle for whole text (single toggle)
    const globalControls = document.createElement('div');
    globalControls.className = 'stanza-controls';
    globalControls.style.marginTop = '8px';

    const globalToggle = document.createElement('button');
    globalToggle.type = 'button';
    globalToggle.className = 'stanza-control-btn stanza-control-global-toggle';
    globalToggle.dataset.textKey = textKey;
    globalToggle.setAttribute('title', 'Toggle select all verses for the whole psalm');
    globalToggle.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" style="width:20px;height:20px;vertical-align:middle;margin-right:2px;fill:#6fc252;"><path d="M480 96C515.3 96 544 124.7 544 160L544 480C544 515.3 515.3 544 480 544L160 544C124.7 544 96 515.3 96 480L96 160C96 124.7 124.7 96 160 96L480 96zM438 209.7C427.3 201.9 412.3 204.3 404.5 215L285.1 379.2L233 327.1C223.6 317.7 208.4 317.7 199.1 327.1C189.8 336.5 189.7 351.7 199.1 361L271.1 433C276.1 438 283 440.5 289.9 440C296.8 439.5 303.3 435.9 307.4 430.2L443.3 243.2C451.1 232.5 448.7 217.5 438 209.7z"/></svg>Select All';
    updateGlobalToggleState(textKey, globalToggle);
    globalToggle.addEventListener('click', function () {
      const allOrder = verseOrderByTextId[textKey] || [];
      const currentlyAll = (selectedVersesByTextId[textKey] || []).length === allOrder.length && allOrder.length > 0;
      if (currentlyAll) clearVersesForText(textKey);
      else selectAllVersesForText(textKey);
    });

    // Next button (opens Tune accordion and closes Text accordion)
    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'stanza-control-btn stanza-control-next-btn';
    nextBtn.setAttribute('title', 'Next — go to Tune');
    nextBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" style="width:20px;height:20px;vertical-align:middle;margin-right:2px;fill:#555;"><path d="M297.4 566.6C309.9 579.1 330.2 579.1 342.7 566.6L502.7 406.6C515.2 394.1 515.2 373.8 502.7 361.3C490.2 348.8 469.9 348.8 457.4 361.3L352 466.7L352 96C352 78.3 337.7 64 320 64C302.3 64 288 78.3 288 96L288 466.7L182.6 361.3C170.1 348.8 149.8 348.8 137.3 361.3C124.8 373.8 124.8 394.1 137.3 406.6L297.3 566.6z"/></svg>Next';

    nextBtn.addEventListener('click', function() {
      closeAccordionById('section-text');
      openAccordionById('section-tune');
      const tuneToggle = document.querySelector('#section-tune .accordion-toggle');
      if (tuneToggle) tuneToggle.focus();
    });

    globalControls.appendChild(globalToggle);
    globalControls.appendChild(nextBtn);
    container.appendChild(globalControls);

    ensureSelectedVersesInput();
    updateSelectedVersesHiddenAndSummary(textKey);
    return;
  } // end sections

  // Fallback (no sections) - single row + global toggle
  let verseLabels = [];
  if (Array.isArray(txt.verses) && txt.verses.length) verseLabels = txt.verses.map(v => String(v));
  else if (Number(txt.verseCount) > 0) { const n = Number(txt.verseCount); for (let i = 1; i <= n; i++) verseLabels.push(String(i)); }
  else if (Number(txt.numVerses) > 0) { const n = Number(txt.numVerses); for (let i = 1; i <= n; i++) verseLabels.push(String(i)); }
  else if (typeof txt.verses === 'string' && txt.verses.trim()) verseLabels = txt.verses.split(',').map(s => s.trim()).filter(Boolean);
  else { const noInfo = document.createElement('div'); noInfo.style.color = '#ddd'; noInfo.style.padding = '6px 0'; noInfo.textContent = 'No verse data available for this text.'; container.appendChild(noInfo); ensureSelectedVersesInput(); return; }

  verseOrderByTextId[textKey] = verseLabels.slice();
  if (!selectedVersesByTextId[textKey]) selectedVersesByTextId[textKey] = [];

  const verseRow = document.createElement('div');
  verseRow.className = 'psalm-btn-container stanza-btn-container';
  verseLabels.forEach(labelText => {
    const vbtn = document.createElement('button');
    vbtn.className = 'verse-btn'; vbtn.type = 'button'; vbtn.setAttribute('aria-pressed','false');
    vbtn.dataset.verse = labelText; vbtn.dataset.textKey = textKey;
    const vspan = document.createElement('span'); vspan.className = 'verse-number'; vspan.textContent = labelText;
    vbtn.appendChild(vspan);
    if (Array.isArray(selectedVersesByTextId[textKey]) && selectedVersesByTextId[textKey].indexOf(labelText) !== -1) {
      vbtn.classList.add('active'); vbtn.setAttribute('aria-pressed','true');
    }
    vbtn.addEventListener('click', function() {
      if (selectedTextKey !== textKey) {
        if (selectedTextKey) {
          const prevBtn = document.querySelector(`.psalm-btn[data-text-key="${selectedTextKey}"]`);
          if (prevBtn) { prevBtn.classList.remove('active'); prevBtn.setAttribute('aria-pressed','false'); }
        }
        selectedTextKey = textKey;
        const psBtn = document.querySelector(`.psalm-btn[data-text-key="${textKey}"]`);
        if (psBtn) { psBtn.classList.add('active'); psBtn.setAttribute('aria-pressed','true'); const section = psBtn.closest('.source-section'); if (section) closeSourceSection(section); }
      }
      const active = vbtn.classList.toggle('active'); vbtn.setAttribute('aria-pressed', active ? 'true' : 'false');
      let arr = selectedVersesByTextId[textKey] || [];
      if (active) { if (arr.indexOf(labelText) === -1) arr.push(labelText); }
      else { const idx = arr.indexOf(labelText); if (idx !== -1) arr.splice(idx,1); }
      arr = sortSelectedVersesByOriginalOrder(textKey, arr);
      selectedVersesByTextId[textKey] = arr.slice();
      updateSelectedVersesHiddenAndSummary(textKey);
    });
    verseRow.appendChild(vbtn);
  });
  container.appendChild(verseRow);

  // Global toggle for fallback view
  const controlsRow = document.createElement('div');
  controlsRow.className = 'stanza-controls';
  const globalToggle = document.createElement('button');
  globalToggle.type = 'button'; globalToggle.className = 'stanza-control-btn stanza-control-global-toggle';
  globalToggle.dataset.textKey = textKey; globalToggle.setAttribute('title','Toggle select all verses for the whole psalm');
  globalToggle.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" style="width:20px;height:20px;vertical-align:middle;margin-right:2px;fill:#6fc252;"><path d="M480 96C515.3 96 544 124.7 544 160L544 480C544 515.3 515.3 544 480 544L160 544C124.7 544 96 515.3 96 480L96 160C96 124.7 124.7 96 160 96L480 96zM438 209.7C427.3 201.9 412.3 204.3 404.5 215L285.1 379.2L233 327.1C223.6 317.7 208.4 317.7 199.1 327.1C189.8 336.5 189.7 351.7 199.1 361L271.1 433C276.1 438 283 440.5 289.9 440C296.8 439.5 303.3 435.9 307.4 430.2L443.3 243.2C451.1 232.5 448.7 217.5 438 209.7z"/></svg>Select all';
  updateGlobalToggleState(textKey, globalToggle);
  globalToggle.addEventListener('click', function() {
    const allOrder = verseOrderByTextId[textKey] || [];
    const currentlyAll = (selectedVersesByTextId[textKey] || []).length === allOrder.length && allOrder.length > 0;
    if (currentlyAll) clearVersesForText(textKey); else selectAllVersesForText(textKey);
  });

  // Next button for fallback (same behavior)
  const nextBtnFallback = document.createElement('button');
  nextBtnFallback.type = 'button';
  nextBtnFallback.className = 'stanza-control-btn stanza-control-next-btn';
  nextBtnFallback.setAttribute('title', 'Next — go to Tune');
  nextBtnFallback.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" style="width:20px;height:20px;vertical-align:middle;margin-right:2px;fill:white;"><path d="M297.4 566.6C309.9 579.1 330.2 579.1 342.7 566.6L502.7 406.6C515.2 394.1 515.2 373.8 502.7 361.3C490.2 348.8 469.9 348.8 457.4 361.3L352 466.7L352 96C352 78.3 337.7 64 320 64C302.3 64 288 78.3 288 96L288 466.7L182.6 361.3C170.1 348.8 149.8 348.8 137.3 361.3C124.8 373.8 124.8 394.1 137.3 406.6L297.3 566.6z"/></svg>Next';
  nextBtnFallback.addEventListener('click', function() {
    closeAccordionById('section-text');
    openAccordionById('section-tune');
    const tuneToggle = document.querySelector('#section-tune .accordion-toggle');
    if (tuneToggle) tuneToggle.focus();
  });

  controlsRow.appendChild(globalToggle);
  controlsRow.appendChild(nextBtnFallback);
  container.appendChild(controlsRow);

  ensureSelectedVersesInput();
  updateSelectedVersesHiddenAndSummary(textKey);
}

// select all verses in a section
function selectAllSectionVerses(textKey, sectionName) {
  const sectionMap = sectionVersesByTextId[textKey] || {};
  const secVerses = sectionMap[sectionName] || [];
  if (!secVerses.length) return;
  const arr = selectedVersesByTextId[textKey] ? selectedVersesByTextId[textKey].slice() : [];
  secVerses.forEach(v => { if (arr.indexOf(v) === -1) arr.push(v); });
  selectedVersesByTextId[textKey] = sortSelectedVersesByOriginalOrder(textKey, arr);
  secVerses.forEach(v => {
    const btn = document.querySelector(`.verse-btn[data-text-key="${textKey}"][data-verse="${CSS.escape(v)}"]`);
    if (btn && !btn.classList.contains('active')) { btn.classList.add('active'); btn.setAttribute('aria-pressed','true'); }
  });
  selectedTextKey = textKey;
  const psBtn = document.querySelector(`.psalm-btn[data-text-key="${textKey}"]`);
  if (psBtn) { psBtn.classList.add('active'); psBtn.setAttribute('aria-pressed','true'); const section = psBtn.closest('.source-section'); if (section) closeSourceSection(section); }
  updateSelectedVersesHiddenAndSummary(textKey);
}

// clear all verses in a section
function clearSectionVerses(textKey, sectionName) {
  const sectionMap = sectionVersesByTextId[textKey] || {};
  const secVerses = sectionMap[sectionName] || [];
  if (!secVerses.length) return;
  let arr = selectedVersesByTextId[textKey] || [];
  secVerses.forEach(v => {
    const idx = arr.indexOf(v); if (idx !== -1) arr.splice(idx,1);
    const btn = document.querySelector(`.verse-btn[data-text-key="${textKey}"][data-verse="${CSS.escape(v)}"]`);
    if (btn && btn.classList.contains('active')) { btn.classList.remove('active'); btn.setAttribute('aria-pressed','false'); }
  });
  selectedVersesByTextId[textKey] = arr.slice();
  updateSelectedVersesHiddenAndSummary(textKey);
}

function selectAllVersesForText(textKey) {
  const order = verseOrderByTextId[textKey] || [];
  if (!order.length) return;
  const verseBtns = Array.from(document.querySelectorAll(`.verse-btn[data-text-key="${textKey}"]`));
  verseBtns.forEach(b => { if (!b.classList.contains('active')) { b.classList.add('active'); b.setAttribute('aria-pressed','true'); } });
  selectedVersesByTextId[textKey] = order.slice();
  selectedTextKey = textKey;
  const psBtn = document.querySelector(`.psalm-btn[data-text-key="${textKey}"]`);
  if (psBtn) { psBtn.classList.add('active'); psBtn.setAttribute('aria-pressed','true'); const section = psBtn.closest('.source-section'); if (section) closeSourceSection(section); }
  updateSelectedVersesHiddenAndSummary(textKey);
}

function clearVersesForText(textKey) {
  const verseBtns = Array.from(document.querySelectorAll(`.verse-btn[data-text-key="${textKey}"]`));
  verseBtns.forEach(b => { if (b.classList.contains('active')) { b.classList.remove('active'); b.setAttribute('aria-pressed','false'); } });
  selectedVersesByTextId[textKey] = [];
  updateSelectedVersesHiddenAndSummary(textKey);
}

// returns true if every verse in the section is selected
function isSectionFullySelected(textKey, sectionName) {
  const secMap = sectionVersesByTextId[textKey] || {};
  const secVerses = secMap[sectionName] || [];
  if (!secVerses.length) return false;
  const selected = selectedVersesByTextId[textKey] || [];
  return secVerses.every(v => selected.indexOf(v) !== -1);
}

// update the DOM state (active/aria) for the section toggle button
function updateSectionToggleState(textKey, sectionName, btnEl) {
  const button =
    btnEl ||
    document.querySelector(`.stanza-control-section-toggle[data-text-key="${textKey}"][data-section-name="${sectionName}"]`) ||
    Array.from(document.querySelectorAll(`.stanza-control-section-toggle[data-text-key="${textKey}"]`))
      .find(b => b.dataset.sectionName === sectionName);

  if (!button) return;
  if (!button.dataset.origSvg) {
    const existingSvg = button.querySelector('svg');
    button.dataset.origSvg = existingSvg ? existingSvg.outerHTML : '';
  }
  if (!button.dataset.origLabel) {
    let labelEl = button.querySelector('.stanza-toggle-label');
    if (!labelEl) {
      for (const node of button.childNodes) {
        if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
          labelEl = document.createElement('span');
          labelEl.className = 'stanza-toggle-label';
          labelEl.textContent = node.textContent.trim();
          button.replaceChild(labelEl, node);
          break;
        }
      }
    }
    if (!labelEl) {
      labelEl = document.createElement('span');
      labelEl.className = 'stanza-toggle-label';
      button.appendChild(labelEl);
    }
    button.dataset.origLabel = labelEl.textContent || '';
  }

  function setButtonSvg(btn, svgHtml) {
    const oldSvg = btn.querySelector('svg');
    if (oldSvg) {
      const wrapper = document.createElement('span');
      wrapper.innerHTML = svgHtml;
      const newSvg = wrapper.firstElementChild;
      oldSvg.parentNode.replaceChild(newSvg, oldSvg);
    } else {
      const wrapper = document.createElement('span');
      wrapper.innerHTML = svgHtml;
      const newSvg = wrapper.firstElementChild;
      btn.insertBefore(newSvg, btn.firstChild);
    }
  }

  const selectedSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" style="width:20px;height:20px;vertical-align:middle;margin-right:2px;fill:#c2526f;"><path d="M431.2 476.5L163.5 208.8C141.1 240.2 128 278.6 128 320C128 426 214 512 320 512C361.5 512 399.9 498.9 431.2 476.5zM476.5 431.2C498.9 399.8 512 361.4 512 320C512 214 426 128 320 128C278.5 128 240.1 141.1 208.8 163.5L476.5 431.2zM64 320C64 178.6 178.6 64 320 64C461.4 64 576 178.6 576 320C576 461.4 461.4 576 320 576C178.6 576 64 461.4 64 320z"/></svg>';

  const all = isSectionFullySelected(textKey, sectionName);

  let labelEl = button.querySelector('.stanza-toggle-label');
  if (!labelEl) {
    for (const node of button.childNodes) {
      if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
        labelEl = document.createElement('span');
        labelEl.className = 'stanza-toggle-label';
        labelEl.textContent = node.textContent.trim();
        button.replaceChild(labelEl, node);
        break;
      }
    }
  }
  if (!labelEl) {
    labelEl = document.createElement('span');
    labelEl.className = 'stanza-toggle-label';
    button.appendChild(labelEl);
  }

  if (all) {
    button.classList.add('active');
    button.setAttribute('aria-pressed', 'true');
    setButtonSvg(button, selectedSvg);
    labelEl.textContent = 'Deselect';
  } else {
    button.classList.remove('active');
    button.setAttribute('aria-pressed', 'false');
    const origSvg = button.dataset.origSvg || '';
    if (origSvg) setButtonSvg(button, origSvg);
    const origLabel = button.dataset.origLabel || '';
    labelEl.textContent = origLabel;
  }
}

function updateGlobalToggleState(textKey, btnEl) {
  const button = btnEl || document.querySelector(`.stanza-control-global-toggle[data-text-key="${textKey}"]`);
  if (!button) return;
  const order = verseOrderByTextId[textKey] || [];
  const selected = selectedVersesByTextId[textKey] || [];
  const all = order.length > 0 && selected.length === order.length;
  if (all) { button.classList.add('active'); button.setAttribute('aria-pressed','true'); }
  else { button.classList.remove('active'); button.setAttribute('aria-pressed','false'); }
}

function updateSelectedVersesHiddenAndSummary(textKey) {
  const pairs = [];
  for (const tk of Object.keys(selectedVersesByTextId)) {
    const arr = sortSelectedVersesByOriginalOrder(tk, selectedVersesByTextId[tk] || []);
    if (arr.length) pairs.push(`${encodeURIComponent(tk)}:${arr.join(',')}`);
  }
  const input = ensureSelectedVersesInput();
  input.value = pairs.join('|');

  // update section toggles and global toggle to reflect current selections
  const secMap = sectionVersesByTextId[textKey] || {};
  Object.keys(secMap).forEach(secName => {
    const btn = document.querySelector(`.stanza-control-section-toggle[data-text-key="${textKey}"][data-section-name="${secName}"]`);
    if (btn) updateSectionToggleState(textKey, secName, btn);
    const btns = document.querySelectorAll(`.stanza-control-section-toggle[data-text-key="${textKey}"]`);
    btns.forEach(b => {
      if (b.dataset.sectionName === secName) updateSectionToggleState(textKey, secName, b);
    });
  });
  const globalBtn = document.querySelector(`.stanza-control-global-toggle[data-text-key="${textKey}"]`);
  if (globalBtn) updateGlobalToggleState(textKey, globalBtn);

  // Update visible selectTextBtn line1 summary
  const selectBtn = document.getElementById('selectTextBtn');
  if (!selectBtn) return;
  let line1 = selectBtn.querySelector('.select-text-line1');
  if (!line1) return;
  const baseTitle = line1.dataset.baseTitle || line1.textContent || '';
  line1.dataset.baseTitle = baseTitle;

  if (selectedTextKey) {
    const ordered = sortSelectedVersesByOriginalOrder(selectedTextKey, selectedVersesByTextId[selectedTextKey] || []).slice();
    const allOrder = verseOrderByTextId[selectedTextKey] || [];
    const isAllSelected = allOrder.length > 0 && ordered.length === allOrder.length;
    const versesDisplay = ordered.length ? (isAllSelected ? ': All' : `: ${compressOrderedVerses(selectedTextKey, ordered)}`) : '';
    line1.textContent = baseTitle + versesDisplay;
  } else {
    line1.textContent = baseTitle;
  }
}

// Other UI helpers
function clearStanzaArea() {
  const container = document.getElementById('stanzaAccordion');
  if (!container) return;
  container.innerHTML = '';
  // Remove the injected inline styles when clearing
  container.style.borderTop = '';
  container.style.marginLeft = '';
  container.style.paddingLeft = '';
  container.style.width = '';
}
function clearTopSelection() {
  const selectBtn = document.getElementById('selectTextBtn'); if (!selectBtn) return;
  const line1 = selectBtn.querySelector('.select-text-line1'); const line2 = selectBtn.querySelector('.select-text-line2');
  if (line1) { line1.textContent = 'Click to select a text below'; delete line1.dataset.baseTitle; }
  if (line2) line2.textContent = '';
  const pstext = document.getElementById('pstext'); if (pstext) pstext.value = '';
  const pssource = document.getElementById('pssource'); if (pssource) pssource.value = '';
  const input = document.getElementById('selectedVerses'); if (input) input.value = '';
}

function selectPsalmBehavior(txt, sourceLabel, sourceSection) {
  const pstext = document.getElementById('pstext'); const pssource = document.getElementById('pssource'); const selMet = document.getElementById('selMet');
  if (pstext) pstext.value = txt.label; if (pssource) pssource.value = sourceLabel; if (selMet) selMet.value = txt.metre || '';

  const selectBtn = document.getElementById('selectTextBtn');
  if (selectBtn) {
    let line1 = selectBtn.querySelector('.select-text-line1'); let line2 = selectBtn.querySelector('.select-text-line2');
    if (!line1) { line1 = document.createElement('span'); line1.className = 'select-text-line1'; selectBtn.appendChild(line1); }
    if (!line2) { line2 = document.createElement('span'); line2.className = 'select-text-line2'; selectBtn.appendChild(line2); }
    const baseTitle = txt.label || 'Psalm';
    line1.dataset.baseTitle = baseTitle; line1.textContent = baseTitle; line2.textContent = sourceLabel || '';
    selectBtn.classList.add('has-selection'); selectBtn.setAttribute('aria-label', `${line1.textContent}. Source: ${line2.textContent}`);
  }

  if (sourceSection && sourceSection.classList.contains('source-section')) { closeSourceSection(sourceSection); }

  populateStanzaArea(txt);

  // ensure we fetch tune choices for the selected text (only if metre present)
  try {
    const metre = String(txt.metre || txt.met || '').trim();
    if (metre) {
      console.debug('selectPsalmBehavior: calling fetchTunesForText for metre=', metre);
      fetchTunesForText(txt);
    } else {
      console.debug('selectPsalmBehavior: no metre for text, skipping fetchTunesForText');
    }
  } catch (e) {
    console.error('selectPsalmBehavior: fetchTunesForText threw', e);
  }
}

function selectPsalm(txt, sourceLabel, sourceSection) {
  const textKey = getTextKey(txt);
  if (selectedTextKey && selectedTextKey !== textKey) {
    const prevBtn = document.querySelector(`.psalm-btn[data-text-key="${selectedTextKey}"]`);
    if (prevBtn) { prevBtn.classList.remove('active'); prevBtn.setAttribute('aria-pressed','false'); }
  }
  selectedTextKey = textKey;
  const psBtn = document.querySelector(`.psalm-btn[data-text-key="${textKey}"]`);
  if (psBtn) { psBtn.classList.add('active'); psBtn.setAttribute('aria-pressed','true'); }
  selectPsalmBehavior(txt, sourceLabel, sourceSection);
}

function getSelectedVerses() {
  const input = document.getElementById('selectedVerses'); if (input && input.value) return input.value;
  const parts = []; for (const tk of Object.keys(selectedVersesByTextId)) { const arr = selectedVersesByTextId[tk] || []; if (arr.length) parts.push(`${tk}:${arr.join(',')}`); }
  return parts.join('|');
}

function filterSourcesByMetre(selectedMetre) {
  if (!selectedMetre) { populateSourceAccordions(originalSources); return; }
  const filtered = originalSources.map(src => { return { label: src.label, texts: (src.texts || []).filter(txt => txt.metre === selectedMetre) }; }).filter(src => (src.texts || []).length > 0);
  populateSourceAccordions(filtered);
}

function attachInitialAccordionToggles() {
  document.querySelectorAll('.accordion-toggle').forEach(function(toggle) {
    toggle.addEventListener('click', function() {
      document.querySelectorAll('.accordion-toggle').forEach(function(btn) {
        if (btn !== toggle) {
          btn.classList.remove('open');
          if (btn.nextElementSibling) btn.nextElementSibling.style.display = 'none';
        }
      });
      var content = toggle.nextElementSibling;
      var isOpen = toggle.classList.contains('open');
      if (isOpen) { toggle.classList.remove('open'); if (content) content.style.display = 'none'; }
      else { toggle.classList.add('open'); if (content) content.style.display = 'block'; }
    });
  });
}

// Utility to close a specific accordion by id (keeps behavior consistent with toggles)
function closeAccordionById(id) {
  const section = document.getElementById(id);
  if (!section) return;
  const toggle = section.querySelector('.accordion-toggle');
  const content = section.querySelector('.accordion-content');
  if (toggle) toggle.classList.remove('open');
  if (content) content.style.display = 'none';
}