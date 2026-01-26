window.INTERFACE_DEV_BUILD = '2025-12-06-1';
/*This is my new comment to check if this is updated*/

/* ----------------------------- URL parameter application ----------------------------- */
if (document.readyState === 'loading') {
  document.addEventListener("DOMContentLoaded", () => {
    try { applyURLParametersToForm(); } catch(e) { console.warn('applyURLParametersToForm error', e); }
  });
} else {
  try { applyURLParametersToForm(); } catch(e) { console.warn('applyURLParametersToForm error', e); }
}

function applyURLParametersToForm() {
  const urlParams = new URLSearchParams(window.location.search);

  // 1. Handle 'psSource' parameter
  const psSourceParam = urlParams.get('psSource') || urlParams.get('pssource');
  if (psSourceParam) {
    const psSourceInput = document.getElementById('pssource');
    if (psSourceInput) {
      psSourceInput.value = psSourceParam;
      console.log(`URL parameter 'psSource' applied: ${psSourceParam}`);
    } else {
      window._initialPsSourceParam = psSourceParam;
    }
  }

  // 2. Handle 'pstext' parameter
  const psTextParam = urlParams.get('pstext');
  if (psTextParam) {
    const psTextSelect = document.getElementById('pstext');
    if (psTextSelect) {
      psTextSelect.value = psTextParam;
      console.log(`URL parameter 'pstext' applied: ${psTextParam}`);
    } else {
      window._initialPsTextParam = psTextParam;
    }
  }
}

/* ----------------------------- Modals (Share, Paper Size) ----------------------------- */
function setupModals() {
  function setupModalCloseOnOutsideClick(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.addEventListener("click", function(e) {
      if (e.target === modal) modal.style.display = "none";
    });
  }
  setupModalCloseOnOutsideClick("shareModal");
  setupModalCloseOnOutsideClick("paperSizeModal");
}
if (document.readyState === 'loading') {
  document.addEventListener("DOMContentLoaded", setupModals);
} else {
  setupModals();
}

/* ----------------------------- Share modal wiring ----------------------------- */
function setupShareModal() {
  const shareLink = document.getElementById("shareLink");
  const shareModal = document.getElementById("shareModal");
  const shareUrlInput = document.getElementById("shareUrlInput");
  const copyBtn = document.getElementById("copyShareUrlBtn");
  const closeBtn = document.getElementById("closeShareModalBtn");

  const facebookBtn = document.getElementById("share-facebook");
  const xBtn = document.getElementById("share-x");
  const redditBtn = document.getElementById("share-reddit");
  const mastodonBtn = document.getElementById("share-mastodon");

  function getShareUrl() {
    const baseUrl = "https://splitleaf.org/app.html";
    const params = new URLSearchParams();
    if (window.globalTeiID) params.append('teiID', window.globalTeiID);
    if (window.globalPsTune) params.append('psTune', window.globalPsTune);
    if (window.globalSelStanzas && window.globalSelStanzas.length > 0) {
      params.append('selStanzas', window.globalSelStanzas.join(','));
    }
    params.append('autoGen', 'true');
    return `${baseUrl}?${params.toString()}`;
  }

  if (shareLink) {
    shareLink.addEventListener("click", function() {
      let url = getShareUrl();
      if (shareUrlInput) shareUrlInput.value = url;
      if (facebookBtn) facebookBtn.href = "https://www.facebook.com/sharer/sharer.php?u=" + encodeURIComponent(url);
      if (xBtn) xBtn.href = "https://x.com/intent/tweet?url=" + encodeURIComponent(url);
      if (redditBtn) redditBtn.href = "https://reddit.com/submit?url=" + encodeURIComponent(url);
      if (mastodonBtn) mastodonBtn.href = "https://mastodon.social/share?text=" + encodeURIComponent(url);
      if (shareModal) shareModal.style.display = "flex";
    });
  }

  if (copyBtn) {
    copyBtn.addEventListener("click", function() {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(shareUrlInput.value).then(() => {
          copyBtn.textContent = "Copied!";
          setTimeout(() => { copyBtn.textContent = "Copy Link"; }, 1200);
        });
      } else {
        shareUrlInput.select();
        document.execCommand("copy");
        copyBtn.textContent = "Copied!";
        setTimeout(() => { copyBtn.textContent = "Copy Link"; }, 1200);
      }
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", function() {
      if (shareModal) shareModal.style.display = "none";
    });
  }
}
if (document.readyState === 'loading') {
  document.addEventListener("DOMContentLoaded", setupShareModal);
} else {
  setupShareModal();
}

/* ----------------------------- Sound menu ----------------------------- */
let urlParamsUsed = false;

function setupSoundMenu() {
  const soundMenu = document.getElementById("soundMenu");
  const soundSettingsBtn = document.getElementById("soundSettingsBtn");
  const closeSoundMenu = document.getElementById("closeSoundMenu");
  const resetAudioBtn = document.getElementById("resetAudioBtn");
  const applyAudioBtn = document.getElementById("applyAudioBtn");

  function showSoundMenu() {
    if (!soundMenu) return;
    soundMenu.style.display = "block";
    soundMenu.offsetHeight;
    soundMenu.style.transform = "translateY(0)";
    soundMenu.style.opacity = "1";
  }
  function hideSoundMenu() {
    if (!soundMenu) return;
    soundMenu.style.transform = "translateY(-20px)";
    soundMenu.style.opacity = "0";
    setTimeout(() => { soundMenu.style.display = "none"; }, 300);
  }

  if (soundSettingsBtn) {
    soundSettingsBtn.addEventListener("click", function() {
      if (!soundMenu) return;
      if (soundMenu.style.display === "none" || soundMenu.style.display === "") showSoundMenu();
      else hideSoundMenu();
    });
  }
  if (closeSoundMenu) {
    closeSoundMenu.addEventListener("click", hideSoundMenu);
  }
  if (resetAudioBtn) {
    resetAudioBtn.addEventListener("click", function() {
      resetAllAudioSettings();
    });
  }
  if (applyAudioBtn) {
    applyAudioBtn.addEventListener("click", async function() {
      try { stopMIDIHandler(); } catch(e) {}
      hideSoundMenu();
      try { await loadAudioAndPlayHandler(); } catch(e) {}
    });
  }
}
if (document.readyState === 'loading') {
  document.addEventListener("DOMContentLoaded", setupSoundMenu);
} else {
  setupSoundMenu();
}

/* ----------------------------- Tempo & layer volume helpers ----------------------------- */
const tempoSlider = document.getElementById("tempoSlider");
const tempoDisplay = document.getElementById("tempoDisplay");
if (tempoSlider) {
  tempoSlider.min = 0.2;
  tempoSlider.max = 2.5;
  tempoSlider.step = 0.05;
  tempoSlider.value = 1.0;
}
let midiTempoAdjustment = 1.0;
if (tempoSlider) {
  tempoSlider.addEventListener("input", function() {
    midiTempoAdjustment = parseFloat(tempoSlider.value);
    if (tempoDisplay) tempoDisplay.textContent = midiTempoAdjustment.toFixed(2);
  });
}
function getVoiceVolume(id) {
  const el = document.getElementById(id);
  return el ? (el.value / 100) : 0;
}
function resetAllAudioSettings() {
  const tempoSlider = document.getElementById("tempoSlider");
  const tempoDisplay = document.getElementById("tempoDisplay");
  if (tempoSlider && tempoDisplay) {
    tempoSlider.value = "1.0";
    tempoDisplay.textContent = "1.00";
    midiTempoAdjustment = 1.0;
  }
  if (window.currentLayers) {
    window.currentLayers.forEach(layer => {
      window.layerVolumes[layer.id] = 71;
      window.layerMuteStates[layer.id] = false;
      const slider = document.getElementById(`layer-volume-${layer.id}`);
      const muteButton = document.getElementById(`mute-btn-${layer.id}`);
      if (slider) slider.value = '71';
      if (muteButton) {
        muteButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" style="width: 20px; height: 20px; fill: #fff;">
          <path d="M533.6 96.5C523.3 88.1 508.2 89.7 499.8 100C491.4 110.3 493 125.4 503.3 133.8C557.5 177.8 592 244.8 592 320C592 395.2 557.5 462.2 503.3 506.3C493 514.7 491.5 529.8 499.8 540.1C508.1[...]
        </svg>`;
      }
    });
  }
  console.log('All audio settings reset to defaults');
}

/* ----------------------------- Metre sorting helper ----------------------------- */
/**
 * Custom sort for metre strings:
 * - Priority order: 8.6.8.6., 8.8.8.8., 6.6.8.6. (if present, in this order)
 * - Then all others sorted numerically by parsing the digit groups
 */
function sortMetres(metreArray) {
  const priority = ['8.6.8.6.', '8.8.8.8.', '6.6.8.6.'];
  
  function parseMetreDigits(metre) {
    const str = String(metre || '');
    const matches = str.match(/\d+/g);
    return matches ? matches.map(d => parseInt(d, 10)) : [];
  }
  
  function compareDigitArrays(a, b) {
    const len = Math.max(a.length, b.length);
    for (let i = 0; i < len; i++) {
      const aVal = i < a.length ? a[i] : 0;
      const bVal = i < b.length ? b[i] : 0;
      if (aVal < bVal) return -1;
      if (aVal > bVal) return 1;
    }
    return 0;
  }
  
  return metreArray.slice().sort(function(a, b) {
    const aStr = String(a || '');
    const bStr = String(b || '');
    
    const aPriority = priority.indexOf(aStr);
    const bPriority = priority.indexOf(bStr);
    
    if (aPriority !== -1 && bPriority !== -1) {
      return aPriority - bPriority;
    }
    if (aPriority !== -1) return -1;
    if (bPriority !== -1) return 1;
    
    const aDigits = parseMetreDigits(aStr);
    const bDigits = parseMetreDigits(bStr);
    const cmp = compareDigitArrays(aDigits, bDigits);
    if (cmp !== 0) return cmp;
    
    return aStr.localeCompare(bStr);
  });
}

/* ----------------------------- getTunes & tune synchronization ----------------------------- */

/* syncTuneInputDataset: updated to prefer dataset.tunelabel, keep dataset.tuneid
   This preserves backward compatibility with code that may call this function. */
function syncTuneInputDataset() {
  var tuneInput = document.getElementById("pstune");
  var tuneListText = document.getElementById("pstuneListData");
  var tuneList = tuneListText ? JSON.parse(tuneListText.value || tuneListText.textContent || '[]') : [];
  if (!tuneInput) return;

  // Prefer dataset.tunelabel (explicit selection), otherwise use the input's visible value
  var selectedLabel = (tuneInput.dataset && tuneInput.dataset.tunelabel) ? tuneInput.dataset.tunelabel : tuneInput.value;

  // If selectedLabel is empty, clear tuneid
  if (!selectedLabel) {
    tuneInput.dataset.tuneid = "";
    window.globalPsTune = "";
    return;
  }

  var selectedObj = tuneList.find(function(item){ return item.label === selectedLabel; });
  if (selectedObj) {
    tuneInput.dataset.tuneid = selectedObj.id;
    // Also ensure dataset.tunelabel is set to the canonical label
    tuneInput.dataset.tunelabel = selectedObj.label;
    window.globalPsTune = selectedObj.id;
  } else {
    // We don't want to put an id into the visible input value anymore;
    // keep the dataset empty if we couldn't find a match
    tuneInput.dataset.tuneid = "";
    window.globalPsTune = "";
  }
}

function ensurePstuneSearchUI(tuneLabels, tuneListObjs, initialValue) {
  const tunesContainer = document.getElementById('tunes');
  let tuneButtonsContainer = document.getElementById('tuneButtons');

  if (!tunesContainer) {
    console.warn('#tunes container missing; cannot render tune search UI');
    return;
  }

  // Create or reuse search input
  let tuneInput = document.getElementById('pstune');
  if (!tuneInput) {
    tuneInput = document.createElement('input');
    tuneInput.type = 'text';
    tuneInput.id = 'pstune';
    tuneInput.placeholder = '[Type here to filter tunes]';
    tuneInput.autocomplete = 'off';
    tuneInput.className = 'tune-search-input';
    tunesContainer.innerHTML = '';
    tunesContainer.appendChild(tuneInput);
  } else {
    try { tuneInput.placeholder = tuneInput.placeholder || '[Type here to filter tunes]'; } catch(e) {}
  }

  // Create or reuse melody search link
  let melodySearchContainer = document.getElementById('searchMelodyContainer');
  if (!melodySearchContainer) {
    melodySearchContainer = document.createElement('div');
    melodySearchContainer.id = 'searchMelodyContainer';
    melodySearchContainer.style.cssText = 'margin-top:10px;margin-bottom:10px;margin-left:8px;display:block;';
    
    const melodySearchLink = document.createElement('a');
    melodySearchLink.href = '#';
    melodySearchLink.id = 'searchMelodyLink';
    melodySearchLink.style.cssText = 'color:#6fc252;text-decoration:none;font-size:1em;display:inline-flex;align-items:center;gap:10px;';
    
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 640 640');
    svg.setAttribute('width', '18');
    svg.setAttribute('height', '18');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.style.cssText = 'display:inline-block;vertical-align:middle;fill:currentColor;';
    
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M532 71C539.6 77.1 544 86.3 544 96L544 400C544 444.2 501 480 448 480C395 480 352 444.2 352 400C352 355.8 395 320 448 320C459.2 320 470 321.6 480 324.6L480 207.9L256 257.7L256 464C256 508.2 213 544 160 544C107 544 64 508.2 64 464C64 419.8 107 384 160 384C171.2 384 182 385.6 192 388.6L192 160C192 145 202.4 132 217.1 128.8L505.1 64.8C514.6 62.7 524.5 65 532.1 71.1z');
    svg.appendChild(path);
    
    const span = document.createElement('span');
    span.textContent = 'Search by Melody';
    
    melodySearchLink.appendChild(svg);
    melodySearchLink.appendChild(span);
    melodySearchContainer.appendChild(melodySearchLink);
    tunesContainer.appendChild(melodySearchContainer);
    
    // Attach click handler to open melody search modal
    melodySearchLink.addEventListener('click', function(e) {
      e.preventDefault();
      const modal = document.getElementById('melodySearchModal');
      const input = document.getElementById('melodySearchInput');
      if (modal && input) {
        modal.style.display = 'flex';
        input.focus();
        const resultsDiv = document.getElementById('melodySearchResults');
        if (resultsDiv) {
          resultsDiv.innerHTML = '<div style="padding:20px;text-align:center;color:#555;">Enter pitch classes (0-11) separated by spaces to search for matching melodies.</div>';
        }
      }
    });
  }

  if (!tuneButtonsContainer) {
    tuneButtonsContainer = document.createElement('div');
    tuneButtonsContainer.id = 'tuneButtons';
    tunesContainer.appendChild(tuneButtonsContainer);
  }

  // Build mapping label -> id
  window._pstuneMap = {};
  if (Array.isArray(tuneListObjs) && tuneListObjs.length) {
    tuneListObjs.forEach(function(o) {
      if (o && o.label) window._pstuneMap[o.label] = o.id || '';
    });
  } else if (Array.isArray(tuneLabels)) {
    tuneLabels.forEach(function(l) {
      window._pstuneMap[l] = window._pstuneMap[l] || '';
    });
  }

  // ← NEW: Flag to track if user is clicking a button
  let isClickingButton = false;

  function clearActiveButton() {
    const btns = tuneButtonsContainer.querySelectorAll('.verse-btn, .tune-btn');
    btns.forEach(b => b.classList.remove('active'));
  }

  // Helper function to normalize strings by removing diacritical marks
  // Uses Unicode NFD normalization to separate base characters from combining marks
  function normalizeString(str) {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  function renderTuneButtons(filter) {
     tuneButtonsContainer.innerHTML = '';
    filter = (filter || '').toLowerCase().trim();

    const sourceList = Array.isArray(tuneLabels) && tuneLabels.length ? tuneLabels : Object.keys(window._pstuneMap || {});

    const matches = sourceList.filter(function(lbl) {
        if (!filter) return true;
        return normalizeString(lbl).indexOf(normalizeString(filter)) !== -1;
    });

    if (!matches.length) {
      const p = document.createElement('div');
      p.className = 'menuSpan';
      p.textContent = 'No tunes match your search';
      tuneButtonsContainer.appendChild(p);
      return;
    }

    matches.forEach(function(lbl) {
      const mappingId = window._pstuneMap[lbl] || '';

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'verse-btn tune-btn';
      btn.dataset.label = lbl;
      btn.dataset.tuneid = mappingId;

      const m = lbl.trim().match(/^(.*?)(?:\s*\(([^)]+)\))?$/);
      const title = (m && m[1]) ? m[1].trim() : lbl;
      const paren = (m && m[2]) ? m[2].trim() : '';

      const titleSpan = document.createElement('span');
      titleSpan.className = 'tune-title';
      titleSpan.textContent = title;

      btn.appendChild(titleSpan);

      if (paren) {
        const dateSpan = document.createElement('span');
        dateSpan.className = 'tune-date';
        dateSpan.textContent = paren;
        btn.appendChild(dateSpan);
      }

      // ← NEW: Set flag on mousedown (before blur fires)
      btn.addEventListener('mousedown', function(e) {
        isClickingButton = true;
      });

      btn.addEventListener('click', function(e) {
        const input = document.getElementById('pstune');
        if (input) {
          // Store selection in dataset
          input.dataset.tuneid = mappingId || '';
          input.dataset.tunelabel = lbl || '';
          
          // Show the tune name in the input field
          input.value = lbl;
          
          // Mark button as active
          tuneButtonsContainer.querySelectorAll('.verse-btn, .tune-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');

          // Update global variable
          window.globalPsTune = mappingId || '';
          
          // Filter to show only this tune button
          renderTuneButtons(lbl);
        }

        // ← NEW: Reset flag after click completes
        isClickingButton = false;

        try { updateSelectionSummary(); } catch(e) {}
        try { maybeShowNextForTune(); } catch(e) {}
      });

      tuneButtonsContainer.appendChild(btn);
    });

    // After rendering, re-apply active state to the selected tune button
    const currentInput = document.getElementById('pstune');
    if (currentInput && currentInput.dataset && currentInput.dataset.tunelabel) {
      const selectedLabel = currentInput.dataset.tunelabel;
      try {
        const chosenBtn = tuneButtonsContainer.querySelector(`[data-label="${CSS.escape(selectedLabel)}"]`);
        if (chosenBtn) {
          chosenBtn.classList.add('active');
        }
      } catch (e) {
        const allBtns = tuneButtonsContainer.querySelectorAll('.tune-btn');
        allBtns.forEach(function(btn) {
          if (btn.dataset.label === selectedLabel) {
            btn.classList.add('active');
          }
        });
      }
    }
  }

  // When user clicks input (focus), clear it and show all tunes
  tuneInput.addEventListener('focus', function() {
    this.value = '';
    renderTuneButtons('');
    
    try {
      setTimeout(() => {
        try {
          tuneInput.scrollIntoView({ behavior: 'smooth', block: 'start' });
          setTimeout(() => { try { window.scrollTo(0, 1); } catch(_) {} }, 250);
        } catch (e) {}
      }, 250);
    } catch(e) {}
  });

  // When user types, filter the list
  tuneInput.addEventListener('input', function() {
    renderTuneButtons(this.value || '');
    try { updateSelectionSummary(); } catch(e) {}
  });

  // ← CHANGED: Only restore selection if user is NOT clicking a button
  tuneInput.addEventListener('blur', function() {
    // Use setTimeout to allow button click to complete first
    setTimeout(() => {
      if (!isClickingButton && this.dataset.tunelabel && !this.value) {
        this.value = this.dataset.tunelabel;
        renderTuneButtons(this.dataset.tunelabel);
      }
      // Reset flag just in case
      isClickingButton = false;
    }, 150);
  });
  
  // Always keep input empty and show all tunes on initial load
  tuneInput.value = '';
  renderTuneButtons('');

  try { maybeShowNextForTune(); } catch (_) {}
}

function getTunes(tuneLabel) {
  var psInput = document.getElementById("pstext");
  var psDataStr = psInput ? psInput.dataset.psdata : "";
  if (!psDataStr) return;

  var psData = psDataStr.split(";");
  var teiID = psData[0];
  var metre = psData[1];
  var suggTune = tuneLabel || psData[2] || "201a";

  var urlVariable = encodeURI("getTunes.xq?metre=" + metre + "&suggTune=" + suggTune + "&teiID=" + teiID);

  var selMetInput = document.getElementById("selMet");
  if (selMetInput) {
    try { selMetInput.value = metre; } catch(_) {}
  }

  var tuneQuery = new XMLHttpRequest();
  tuneQuery.open("GET", urlVariable, true);
  tuneQuery.send();

  tuneQuery.onreadystatechange = function() {
    if (this.readyState == 4 && this.status == 200) {
      document.getElementById("tunes").innerHTML = tuneQuery.responseText;

      var tuneListText = document.getElementById("pstuneListData");
      var tuneLabelsText = document.getElementById("pstuneLabelsData");
      var tuneList = tuneListText ? JSON.parse(tuneListText.value || tuneListText.textContent || '[]') : [];
      var tuneLabels = tuneLabelsText ? JSON.parse(tuneLabelsText.value || tuneLabelsText.textContent || '[]') : [];

      // Initialize our persistent filter UI (input placeholder + buttons)
      try {
        ensurePstuneSearchUI(tuneLabels, tuneList, tuneLabel || '');
      } catch (e) {
        console.warn('ensurePstuneSearchUI failed', e);
      }

      const optionsSpacer = document.getElementById("optionsSpacer");
      if (optionsSpacer) optionsSpacer.style.height = "15px";

      setTimeout(function(){ try { updateSelectionSummary(); } catch(e) {} }, 0);

      document.getElementById("submit").innerHTML =
        "<button type='button' class='submitbtn' onclick='loadFile(); closeNav();'>" +
        "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'>" +
        "<path d='M21,4 C21.5128358,4 21.9355072,4.38604019 21.9932723,4.88337887 L22,5 L22,11.5 C22,13.3685634 20.5357224,14.8951264 18.6920352,14.9948211 L18.5,15 L5.415,15 L8.70710678,18.2928932 C9.06759074,18.6533772 9.09532028,19.2206082 8.79029539,19.6128994 L8.70710678,19.7071068 C8.34662282,20.0675907 7.77939176,20.0953203 7.38710056,19.7902954 L7.29289322,19.7071068 L2.29289322,14.7071068 C2.25749917,14.6717127 2.22531295,14.6343256 2.19633458,14.5953066 L2.12467117,14.4840621 L2.12467117,14.4840621 L2.07122549,14.371336 L2.07122549,14.371336 L2.03584514,14.265993 L2.03584514,14.265993 L2.0110178,14.1484669 L2.0110178,14.1484669 L2.00397748,14.0898018 L2.00397748,14.0898018 L2,14 L2.00278786,13.9247615 L2.00278786,13.9247615 L2.02024007,13.7992742 L2.02024007,13.7992742 L2.04973809,13.6878575 L2.04973809,13.6878575 L2.09367336,13.5767785 L2.09367336,13.5767785 L2.14599545,13.4792912 L2.14599545,13.4792912 L2.20970461,13.3871006 L2.20970461,13.3871006 L2.29289322,13.2928932 L2.29289322,13.2928932 L7.29289322,8.29289322 C7.68341751,7.90236893 8.31658249,7.90236893 8.70710678,8.29289322 C9.06759074,8.65337718 9.09532028,9.22060824 8.79029539,9.61289944 L8.70710678,9.70710678 L5.415,13 L18.5,13 C19.2796961,13 19.9204487,12.4051119 19.9931334,11.64446 L20,11.5 L20,5 C20,4.44771525 20.4477153,4 21,4 Z'></path>"+
        "</svg>" +
        "Go" +
        "</button>";

      loadcssfile();

      try { watchForVersesAndShowNext(); } catch(e) {}
    }
  }
}

/* ----------------------------- Convert verse checkboxes to buttons ----------------------------- */
/**
 * This function finds all the checkbox-based verse selectors in #verses
 * and converts them to mobile-friendly button-based selectors.
 * Preserves Psalm 119 grouped structure with "select all" functionality.
 */
function convertVersesToButtons() {
  const versesEl = document.getElementById('verses');
  if (!versesEl) return;

  // Find #indVerses container (this is where checkboxes live)
  const indVerses = document.getElementById('indVerses');
  if (!indVerses) return;

  // Check if this is Psalm 119 (has multiple groups)
  const verseGroups = indVerses.querySelectorAll('.verseGroup');
  
  if (verseGroups.length > 0) {
    // Psalm 119 or similar: has sections with group headers
    verseGroups.forEach(function(group, groupIdx) {
      // Find the group header checkbox (if any)
      const groupCheckbox = group.querySelector('input[type="checkbox"]');
      const groupLabel = group.querySelector('.stanza-label');
      
      // Create "Select All" button for this group
      const selectAllBtn = document.createElement('button');
      selectAllBtn.type = 'button';
      selectAllBtn.className = 'stanza-control-btn';
      selectAllBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" style="width: 1em; height: 1em; fill: currentColor;">
          <path d="M438.6 105.4c12.5 12.5 12.5 32.8 0 45.3l-256 256c-12.5 12.5-32.8 12.5-45.3 0l-128-128c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0L160 338.7 393.4 105.4c12.5-12.5 32.8-12.5 45.3 0z"[...]
        </svg>
        <span class="stanza-toggle-label">Select All</span>
      `;
      selectAllBtn.dataset.groupIdx = groupIdx;
      
      // Find all verse checkboxes in this group
      const verseCheckboxes = group.querySelectorAll('input[type="checkbox"][value]');
      
      // Convert each checkbox to a button
      verseCheckboxes.forEach(function(checkbox) {
        const verseValue = checkbox.value;
        const verseBtn = document.createElement('button');
        verseBtn.type = 'button';
        verseBtn.className = 'verse-btn';
        verseBtn.dataset.verse = verseValue;
        verseBtn.dataset.selected = 'false';
        
        const verseNum = document.createElement('span');
        verseNum.className = 'verse-number';
        verseNum.textContent = verseValue;
        verseBtn.appendChild(verseNum);
        
        // Click handler: toggle selection
        verseBtn.addEventListener('click', function() {
          const isSelected = verseBtn.dataset.selected === 'true';
          verseBtn.dataset.selected = isSelected ? 'false' : 'true';
          if (isSelected) {
            verseBtn.classList.remove('active');
          } else {
            verseBtn.classList.add('active');
          }
          verseMenu();
        });
        
        // Replace checkbox with button
        if (checkbox.parentElement) {
          checkbox.parentElement.replaceWith(verseBtn);
        }
      });
      
      // Wire up "Select All" button
      selectAllBtn.addEventListener('click', function() {
        const verseBtns = group.querySelectorAll('.verse-btn');
        const allSelected = Array.from(verseBtns).every(btn => btn.dataset.selected === 'true');
        
        verseBtns.forEach(btn => {
          btn.dataset.selected = allSelected ? 'false' : 'true';
          if (allSelected) {
            btn.classList.remove('active');
          } else {
            btn.classList.add('active');
          }
        });
        
        verseMenu();
      });
      
      // Insert "Select All" button after the group label
      if (groupLabel && groupLabel.nextSibling) {
        groupLabel.parentElement.insertBefore(selectAllBtn, groupLabel.nextSibling);
      } else if (groupLabel) {
        groupLabel.parentElement.appendChild(selectAllBtn);
      }
      
      // Remove original group checkbox if it exists
      if (groupCheckbox && groupCheckbox.parentElement) {
        groupCheckbox.parentElement.remove();
      }
    });
  } else {
    // Regular psalm: flat list of verse checkboxes
    const verseCheckboxes = indVerses.querySelectorAll('input[type="checkbox"][value]');
    
    verseCheckboxes.forEach(function(checkbox) {
      const verseValue = checkbox.value;
      const verseBtn = document.createElement('button');
      verseBtn.type = 'button';
      verseBtn.className = 'verse-btn';
      verseBtn.dataset.verse = verseValue;
      verseBtn.dataset.selected = 'false';
      
      const verseNum = document.createElement('span');
      verseNum.className = 'verse-number';
      verseNum.textContent = verseValue;
      verseBtn.appendChild(verseNum);
      
      verseBtn.addEventListener('click', function() {
        const isSelected = verseBtn.dataset.selected === 'true';
        verseBtn.dataset.selected = isSelected ? 'false' : 'true';
        if (isSelected) {
          verseBtn.classList.remove('active');
        } else {
          verseBtn.classList.add('active');
        }
        verseMenu();
      });
      
      // Replace checkbox with button (preserve parent structure if it's a label)
      if (checkbox.parentElement) {
        const parent = checkbox.parentElement;
        if (parent.tagName.toLowerCase() === 'label') {
          parent.replaceWith(verseBtn);
        } else {
          checkbox.replaceWith(verseBtn);
        }
      }
    });
  }
}

/* ----------------------------- Verses formatting and selection helpers ----------------------------- */
function parseVerseToken(tok) {
  const m = String(tok).trim().match(/^(\d+)([a-z])?$/i);
  if (!m) return { raw: tok, num: NaN, suf: "" };
  return { raw: tok, num: parseInt(m[1], 10), suf: (m[2] || "").toLowerCase() };
}

function tokensAdjacent(a, b) {
  if (Number.isNaN(a.num) || Number.isNaN(b.num)) return false;
  if (a.num === b.num && a.suf && b.suf && a.suf.length === 1 && b.suf.length === 1) {
    return b.suf.charCodeAt(0) === a.suf.charCodeAt(0) + 1;
  }
  return b.num === a.num + 1;
}

function formatVersesCompact(list) {
  if (!Array.isArray(list) || list.length === 0) return "";
  const toks = list.map(parseVerseToken);
  let out = [];
  let rangeStart = toks[0];
  let prev = toks[0];
  for (let i = 1; i < toks.length; i++) {
    const cur = toks[i];
    if (tokensAdjacent(prev, cur)) {
      prev = cur;
    } else {
      out.push(rangeStart.raw === prev.raw ? rangeStart.raw : (rangeStart.raw + "-" + prev.raw));
      rangeStart = prev = cur;
    }
  }
  out.push(rangeStart.raw === prev.raw ? rangeStart.raw : (rangeStart.raw + "-" + prev.raw));
  return out.join(", ");
}

function verseMenu(){
  var ind = document.getElementById("indVerses");
  if (!ind) return;
  
  // Gather all verse buttons (selected and unselected)
  var allVerseBtns = ind.querySelectorAll('.verse-btn');
  var selVerseBtns = ind.querySelectorAll('.verse-btn[data-selected="true"]');
  
  var verseList = [];
  
  selVerseBtns.forEach(function(btn) {
    verseList.push(btn.dataset.verse);
  });
  
  // Filter out Psalm 119 section headers if applicable
  if (document.getElementById("pstext") && document.getElementById("pstext").value === "Psalm 119"){
    var ps119Array = ["ALEPH","BETH","GIMEL","DALETH","HE","VAV","ZAIN","HETH","TETH","YOD","CAPH","LAMED","MEM","NUN","SAMECH","AIN","PE","TSADE","KOPH","RES","SHIN","TAV"];
    verseList = verseList.filter(function(el){ return !ps119Array.includes(el); });
  }
  
  // Store in global variable
  window.globalSelStanzas = verseList;
  
  // Store in hidden input for renderPsalm() to read
  var hiddenInput = document.getElementById("selectedStanzasData");
  if (!hiddenInput) {
    // Create the hidden input if it doesn't exist
    hiddenInput = document.createElement('input');
    hiddenInput.type = 'hidden';
    hiddenInput.id = 'selectedStanzasData';
    hiddenInput.name = 'stanzas';
    // Append to indVerses or verses container
    if (ind) {
      ind.appendChild(hiddenInput);
    } else {
      document.getElementById('verses').appendChild(hiddenInput);
    }
  }
  hiddenInput.value = verseList.join(',');
  
  var display;
  
  // Check if all verses are selected
  if (allVerseBtns.length > 0 && selVerseBtns.length === allVerseBtns.length) {
    display = "All";
  } else {
    var compact = formatVersesCompact(verseList);
    var limit = 40;
    if (!compact) {
      display = "Select verses below...";
    } else if (compact.length > limit) {
      var cut = limit;
      if (compact.charAt(cut) === ",") { /* ok */ }
      else if (compact.charAt(cut) === " ") { cut = cut - 1; }
      else if (compact.charAt(cut + 1) === ",") { cut = cut + 1; }
      else { while (cut > 0 && compact.charAt(cut) !== " ") cut--; cut = Math.max(0, cut - 1); }
      display = compact.slice(0, Math.max(0, cut)) + "...";
    } else {
      display = compact;
    }
  }
  
   var box = document.getElementById("selectVerses");
  if (box) box.innerHTML = display;
  try { updateSelectionSummary(); } catch(_) {}
  
  // ADD THIS:  Update Next button state
  updateNextButtonState();
}

// Add this new function:
function updateNextButtonState() {
  const nextBtn = document.getElementById('next-btn-text');
  if (!nextBtn) return;
  
  const selectedVerses = getSelectedVerses();
  
  if (selectedVerses.length < 2) {
    nextBtn.style.opacity = '0.5';
    nextBtn.style.cursor = 'not-allowed';
    nextBtn.disabled = true;
  } else {
    nextBtn. style.opacity = '1';
    nextBtn.style.cursor = 'pointer';
    nextBtn.disabled = false;
  }
}

function getSelectedVerses() {
  var ind = document.getElementById("indVerses");
  if (! ind) return [];
  
  var selVerseBtns = ind.querySelectorAll('.verse-btn[data-selected="true"]');
  var verseList = [];
  
  selVerseBtns.forEach(function(btn) {
    verseList.push(btn.dataset.verse);
  });
  
  // Filter out Psalm 119 section headers if applicable
  if (document.getElementById("pstext") && document.getElementById("pstext").value === "Psalm 119"){
    var ps119Array = ["ALEPH","BETH","GIMEL","DALETH","HE","VAV","ZAIN","HETH","TETH","YOD","CAPH","LAMED","MEM","NUN","SAMECH","AIN","PE","TSADE","KOPH","RES","SHIN","TAV"];
    verseList = verseList.filter(function(el){ return ! ps119Array.includes(el); });
  }
  
  return verseList;
}

/* ----------------------------- Utility helpers ----------------------------- */
function myFunction() {
  var dd = document.getElementById("myDropdown");
  if (dd) dd.classList.toggle("show");
}

function filterFunction() {
  var input = document.getElementById("myInput");
  var div = document.getElementById("myDropdown");
  if (!input || !div) return;
  var filter = input.value.toUpperCase();
  var a = div.getElementsByTagName("a");
  for (var i = 0; i < a.length; i++) {
    var txtValue = a[i].getAttribute("name") || a[i].innerText;
    a[i].style.display = (txtValue.toUpperCase().indexOf(filter) > -1) ? "" : "none";
  }
}

function toggle(section) {
  var parSelect = document.getElementById("selectAll");
  var selection = section.getAttribute("id");
  var selChecks = document.getElementById(selection).getElementsByTagName("input");
  if (parSelect && parSelect.checked == true) {
    for (var a = 0; a < selChecks.length; a++){ selChecks[a].checked = true; }
    document.getElementById("selectVerses").innerHTML = "All";
  } else {
    for (var b = 0; b < selChecks.length; b++){ selChecks[b].checked = false; }
    document.getElementById("selectVerses").innerHTML = "Select verses below...";
  }
}

function secToggle(section) {
  var selection = section.getAttribute("id");
  var selChecks = document.getElementById(selection).getElementsByTagName("input");
  if (selChecks[0].checked == true) {
    for (var a = 0; a < selChecks.length; a++){ selChecks[a].checked = true; }
  } else {
    for (var b = 0; b < selChecks.length; b++){ selChecks[b].checked = false; }
  }
  verseMenu();
}

function loadcssfile(){
  var fileref=document.createElement("link");
  fileref.setAttribute("rel", "stylesheet");
  fileref.setAttribute("type", "text/css");
  fileref.setAttribute("href", "resources/css/toggle.css");
  document.getElementsByTagName('head')[0].appendChild(fileref);
}

/* ----------------------------- Consolidated server fetch and client-side UI building ----------------------------- */
async function fetchConsolidatedData() {
  try {
    const resp = await fetch('getSourcesTextsMetres.xq', { cache: 'no-store' });
    if (!resp.ok) throw new Error('Network response not ok: ' + resp.status);
    const data = await resp.json();
    window.consolidatedData = data || { sources: [], metres: [] };

    window.sourceMap = {};
    if (Array.isArray(window.consolidatedData.sources)) {
      window.consolidatedData.sources.forEach(function(s) {
        const label = (s && s.label) ? s.label : String(s || '');
        const texts = (s && s.texts && Array.isArray(s.texts)) ? s.texts : [];
        window.sourceMap[label] = texts;
      });
    }
    window.globalMetres = Array.isArray(window.consolidatedData.metres) ? window.consolidatedData.metres.slice() : [];

    initializeSourceButtons();

  } catch (err) {
    console.warn('Failed to fetch consolidated data (getSourcesTextsMetres.xq):', err);
  }
}

function initializeSourceButtons() {
  const sourceContainer = document.getElementById('sourceButtonContainer');
  if (!sourceContainer) {
    console.warn('#sourceButtonContainer not found - skipping source button generation.');
    return;
  }
  sourceContainer.innerHTML = '';

  const labels = Object.keys(window.sourceMap || {});
  if (!labels.length) {
    const span = document.createElement('div');
    span.className = 'menuSpan';
    span.textContent = 'No sources available';
    sourceContainer.appendChild(span);
    return;
  }

  let hiddenInput = document.getElementById('pssource');
  if (!hiddenInput) {
    hiddenInput = document.createElement('input');
    hiddenInput.type = 'hidden';
    hiddenInput.id = 'pssource';
    sourceContainer.parentElement.appendChild(hiddenInput);
    if (window._initialPsSourceParam) {
      hiddenInput.value = window._initialPsSourceParam;
      delete window._initialPsSourceParam;
    }
  }

  labels.forEach(function(label) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'source-button';
    btn.textContent = label;
    btn.setAttribute('data-source-label', label);

    btn.addEventListener('click', function() {
      // Single selection only - deselect all others
      sourceContainer.querySelectorAll('.source-button').forEach(b => {
        b.classList.remove('active');
      });
      
      // Select this button
      btn.classList.add('active');
      
      // Update hidden input with single source
      const sourceLabel = btn.getAttribute('data-source-label');
      hiddenInput.value = sourceLabel;
      
      // Handle source selection
      handleSourceSelection(sourceLabel);
    });

    sourceContainer.appendChild(btn);
  });

  if (hiddenInput.value) {
    // Single source selection - take the first one if comma-separated
    const initialSource = hiddenInput.value.split(',')[0].trim();
    if (initialSource) {
      const existing = Array.from(sourceContainer.querySelectorAll('.source-button'))
        .find(b => b.getAttribute('data-source-label') === initialSource);
      if (existing) existing.click();
    }
  }
}

function clearTextSelection() {
  // Clear text list
  const container = document.getElementById('psTextList');
  if (container) {
    container.textContent = 'Select source first';
  }
  
  // Clear verses
  const versesEl = document.getElementById('verses');
  if (versesEl) {
    versesEl.innerHTML = '';
    versesEl.style.display = 'none';
  }
  
  // Clear tune selection
  const tuneButtons = document.getElementById('tuneButtons');
  if (tuneButtons) {
    tuneButtons.innerHTML = '';
  }
  
  // Clear metre dropdown
  const metreContainer = document.getElementById('psMetreList');
  if (metreContainer) {
    metreContainer.textContent = 'Select source first';
  }
  
  try { updateSelectionSummary(); } catch (_) {}
}

function handleMultipleSourceSelection(sourceLabels) {
  // Combine texts from all selected sources
  const allTexts = [];
  const seenIds = new Set();
  const allMetres = new Set();
  
  sourceLabels.forEach(function(label) {
    const texts = window.sourceMap && window.sourceMap[label] ? window.sourceMap[label] : [];
    texts.forEach(function(t) {
      // Remove duplicates by text ID
      if (!seenIds.has(t.id)) {
        seenIds.add(t.id);
        allTexts.push(t);
      }
      // Collect unique metres
      if (t.metre) {
        allMetres.add(t.metre);
      }
    });
  });
  
  // Build psalm list
  const psList = allTexts.map(function(t) {
    const label = t.label || '';
    const teiID = t.id || '';
    const metre = t.metre || '';
    const sugg = t.suggTune || '';
    return { label: label, data: `${teiID};${metre};${sugg}`, rawObj: t };
  });
  
  const psLabels = psList.map(l => l.label);
  
  window.fullPsList = psList;
  window.fullPsLabels = psLabels;
  
  // Populate metre filter dropdown
  let selMetElem = document.getElementById('selMet');
  
  if (!selMetElem || selMetElem.tagName.toLowerCase() !== 'select') {
    const container = document.getElementById('psMetreList');
    if (container) {
      const select = document.createElement('select');
      select.id = 'selMet';
      select.className = 'metre-picker';
      const defaultOpt = document.createElement('option');
      defaultOpt.value = '';
      defaultOpt.textContent = 'Filter by metre (optional)';
      select.appendChild(defaultOpt);
      
      container.innerHTML = '';
      container.appendChild(select);
      selMetElem = select;
    }
  }
  
  if (selMetElem && selMetElem.tagName.toLowerCase() === 'select') {
    selMetElem.innerHTML = '';
    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = 'Filter by metre (optional)';
    selMetElem.appendChild(defaultOpt);
    
    const metresArray = Array.from(allMetres);
    if (metresArray.length) {
      const sorted = sortMetres(metresArray);
      sorted.forEach(function(m) {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m;
        selMetElem.appendChild(opt);
      });
    } else {
      const none = document.createElement('option');
      none.value = '';
      none.disabled = true;
      none.textContent = 'No metres available';
      selMetElem.appendChild(none);
    }
    
    selMetElem.addEventListener('change', function() {
      setTexts();
    });
  }
  
  setTexts();
  
  try { updateSelectionSummary(); } catch (_) {}
  
  const container = document.getElementById('panel-source') || document.querySelector('.menu-item');
  try { ensureNextButton(container, 'next-btn-source', () => switchToTab('text')); } catch (_) {}
}

function handleSourceSelection(sourceLabel) {
  const texts = window.sourceMap && window.sourceMap[sourceLabel] ? window.sourceMap[sourceLabel] : [];

  const psList = texts.map(function(t) {
    const label = t.label || '';
    const teiID = t.id || '';
    const metre = t.metre || '';
    const sugg = t.suggTune || '';
    return { label: label, data: `${teiID};${metre};${sugg}`, rawObj: t };
  });

  const psLabels = psList.map(l => l.label);

  window.fullPsList = psList;
  window.fullPsLabels = psLabels;

  const metresForSource = Array.from(new Set(texts.map(t => t.metre || '').filter(Boolean)));
  let selMetElem = document.getElementById('selMet');

  if (!selMetElem || selMetElem.tagName.toLowerCase() !== 'select') {
    const container = document.getElementById('psMetreList');
    if (container) {
      const select = document.createElement('select');
      select.id = 'selMet';
      select.className = 'metre-picker';
      const defaultOpt = document.createElement('option');
      defaultOpt.value = '';
      defaultOpt.textContent = 'Filter by metre (optional)';
      select.appendChild(defaultOpt);

      container.innerHTML = '';
      container.appendChild(select);
      selMetElem = select;
    }
  }

  if (selMetElem && selMetElem.tagName.toLowerCase() === 'select') {
    selMetElem.innerHTML = '';
    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = 'Filter by metre (optional)';
    selMetElem.appendChild(defaultOpt);

    const sourceMetres = (metresForSource.length ? metresForSource : (window.globalMetres || []));
    if (sourceMetres && sourceMetres.length) {
      const sorted = sortMetres(sourceMetres);
      sorted.forEach(function(m) {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m;
        selMetElem.appendChild(opt);
      });
    } else {
      const none = document.createElement('option');
      none.value = '';
      none.disabled = true;
      none.textContent = 'No metres available';
      selMetElem.appendChild(none);
    }

    selMetElem.addEventListener('change', function() {
      setTexts();
    });

    if (window._initialSelMetParam && selMetElem.querySelector(`option[value="${window._initialSelMetParam}"]`)) {
      selMetElem.value = window._initialSelMetParam;
      delete window._initialSelMetParam;
    }
  }

  setTexts();

  try { updateSelectionSummary(); } catch (_) {}

  const container = document.getElementById('panel-source') || document.querySelector('.menu-item');
  try { ensureNextButton(container, 'next-btn-source', () => switchToTab('text')); } catch (_) {}
}

function setTexts() {
  const selMetEl = document.getElementById("selMet");
  const selectedMetre = selMetEl ? selMetEl.value : '';
  const fullList = Array.isArray(window.fullPsList) ? window.fullPsList : [];

  const filtered = fullList.filter(function(item) {
    if (!selectedMetre) return true;
    const parts = String(item.data || '').split(';');
    const metre = parts[1] || '';
    return metre === selectedMetre;
  });

  window.currentPsListForUI = filtered.map(function(item) {
    return { label: item.label, data: item.data, rawObj: item.rawObj || null };
  });

  // Sort psalms numerically with version ordering
  window.currentPsListForUI.sort(function(a, b) {
    const aMatch = a.label.match(/Psalm\s+(\d+)(?:\s+\(([^)]+)\))?/i);
    const bMatch = b.label.match(/Psalm\s+(\d+)(?:\s+\(([^)]+)\))?/i);
    
    // If both match the psalm pattern
    if (aMatch && bMatch) {
      const aNum = parseInt(aMatch[1], 10);
      const bNum = parseInt(bMatch[1], 10);
      
      // Sort by psalm number first
      if (aNum !== bNum) {
        return aNum - bNum;
      }
      
      // Same psalm number - sort by version
      const aVersion = aMatch[2] || '';
      const bVersion = bMatch[2] || '';
      
      // Define version order
      const versionOrder = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth'];
      
      const aVersionMatch = aVersion.match(/(First|Second|Third|Fourth|Fifth|Sixth|Seventh|Eighth|Ninth|Tenth)/i);
      const bVersionMatch = bVersion.match(/(First|Second|Third|Fourth|Fifth|Sixth|Seventh|Eighth|Ninth|Tenth)/i);
      
      if (aVersionMatch && bVersionMatch) {
        const aIdx = versionOrder.findIndex(v => v.toLowerCase() === aVersionMatch[1].toLowerCase());
        const bIdx = versionOrder.findIndex(v => v.toLowerCase() === bVersionMatch[1].toLowerCase());
        return aIdx - bIdx;
      }
      
      // If only one has version, non-version comes first
      if (aVersionMatch && !bVersionMatch) return 1;
      if (!aVersionMatch && bVersionMatch) return -1;
      
      // Otherwise sort version text alphabetically
      return aVersion.localeCompare(bVersion);
    }
    
    // If only one matches psalm pattern, psalms come first
    if (aMatch && !bMatch) return -1;
    if (!aMatch && bMatch) return 1;
    
    // Neither matches - sort alphabetically
    return a.label.localeCompare(b.label);
  });

  const container = document.getElementById('psTextList');
  // ⬇️ NEW: Also get the texts container
  const textsContainer = document.getElementById('texts');
  
  if (!container) {
    console.warn('#psTextList missing; cannot populate texts');
    return;
  }

  // Clear both containers
  container.innerHTML = '';
  if (textsContainer) {
    textsContainer.innerHTML = '';
    textsContainer.style.display = 'none';  // Start hidden
  }

  if (filtered.length === 0) {
    container.textContent = 'No texts match this metre.';
    // Also clear verses
    const versesEl = document.getElementById('verses');
    if (versesEl) {
      versesEl.innerHTML = '';
      versesEl.style.display = 'none';
    }
    return;
  }

  // Create selector display
  const selectPsDiv = document.createElement('div');
  selectPsDiv.id = 'selectPsalm';
  selectPsDiv.textContent = 'Select text below...';
  selectPsDiv.setAttribute('role', 'button');
  selectPsDiv.setAttribute('tabindex', '0');
  selectPsDiv.setAttribute('aria-expanded', 'false');

  // Hidden input
  let hiddenInput = document.getElementById('pstext');
  if (!hiddenInput) {
    hiddenInput = document.createElement('input');
    hiddenInput.type = 'hidden';
    hiddenInput.id = 'pstext';
  } else {
    hiddenInput.value = '';
    hiddenInput.removeAttribute('data-psdata');
  }

  // Psalm buttons container
  const psalmBtnsContainer = document.createElement('div');
  psalmBtnsContainer.id = 'psalmButtons';

  // Inner wrapper
  const psalmBtnsInner = document.createElement('div');
  psalmBtnsInner.className = 'psalm-btn-container';

  // Create buttons (using the now-sorted list)
  window.currentPsListForUI.forEach(function(item) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'psalm-btn';
    btn.dataset.label = item.label;
    btn.dataset.psdata = item.data;

    const match = item.label.match(/Psalm\s+(\d+)(?:\s+\(([^)]+)\))?/i);
    
    if (match) {
      const psalmNum = match[1];
      const versionText = match[2];

      const labelSpan = document.createElement('span');
      labelSpan.className = 'psalm-label';
      labelSpan.textContent = 'PSALM';

      const numberSpan = document.createElement('span');
      numberSpan.className = 'psalm-number';
      numberSpan.textContent = psalmNum;

      btn.appendChild(labelSpan);
      btn.appendChild(numberSpan);

      if (versionText) {
        const sublineSpan = document.createElement('span');
        sublineSpan.className = 'psalm-subline';
        
        const versionMatch = versionText.match(/(First|Second|Third|Fourth|Fifth|Sixth|Seventh|Eighth|Ninth|Tenth)/i);
        if (versionMatch) {
          const versionWords = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth'];
          const versionIndex = versionWords.findIndex(w => w.toLowerCase() === versionMatch[1].toLowerCase());
          sublineSpan.textContent = `VER ${versionIndex + 1}`;
        } else {
          sublineSpan.textContent = versionText.toUpperCase();
        }
        
        btn.appendChild(sublineSpan);
      }
    } else {
      const labelSpan = document.createElement('span');
      labelSpan.className = 'psalm-label';
      labelSpan.textContent = item.label;
      btn.appendChild(labelSpan);
    }

    btn.addEventListener('click', function() {
      psalmBtnsInner.querySelectorAll('.psalm-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      hiddenInput.value = item.label;
      hiddenInput.dataset.psdata = item.data;
      selectPsDiv.textContent = item.label;
      
      // ⬇️ CHANGED: Hide psalm buttons
      if (textsContainer) {
        textsContainer.style.display = 'none';
      }
      psalmBtnsContainer.classList.remove('expanded');
      selectPsDiv.classList.remove('open');
      selectPsDiv.setAttribute('aria-expanded', 'false');
      
      const parts = (item.data || '').split(';');
      const teiID = parts[0] || '';
      const metre = parts[1] || '';
      const suggTune = parts[2] || '';
      
      const selMetInput = document.getElementById("selMet");
      if (selMetInput) {
        try { selMetInput.value = metre; } catch(_) {}
      }
    
      populateVersesFromSelectedText(item.rawObj || { verses: [], sections: [] });
    
      try { getTunes(suggTune); } catch (e) { console.warn('getTunes failed', e); }
    });

    psalmBtnsInner.appendChild(btn);
  });

  psalmBtnsContainer.appendChild(psalmBtnsInner);

  // Toggle - ⬇️ MODIFIED: Toggle the texts container visibility
  const togglePanel = function(e) {
    if (e) e.preventDefault();
    
    if (!textsContainer) return;
    
    const isExpanded = textsContainer.style.display === 'block';
    
    if (isExpanded) {
      textsContainer.style.display = 'none';
      psalmBtnsContainer.classList.remove('expanded');
      selectPsDiv.classList.remove('open');
      selectPsDiv.setAttribute('aria-expanded', 'false');
    } else {
      textsContainer.style.display = 'block';
      psalmBtnsContainer.classList.add('expanded');
      selectPsDiv.classList.add('open');
      selectPsDiv.setAttribute('aria-expanded', 'true');
    }
  };

  selectPsDiv.addEventListener('click', togglePanel);
  selectPsDiv.addEventListener('keydown', function(e) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      togglePanel(e);
    }
  });

  container.appendChild(selectPsDiv);    
  container.appendChild(hiddenInput);   
  
  if (textsContainer) {
      textsContainer.appendChild(psalmBtnsContainer);
      
      // Show immediately on first load (no transition)
      textsContainer.style.display = 'block';
      textsContainer.style.maxHeight = 'none';
      textsContainer.style.opacity = '1';
      textsContainer.classList.add('expanded');
      psalmBtnsContainer.classList.add('expanded');
      selectPsDiv.classList.add('open');
      selectPsDiv.setAttribute('aria-expanded', 'true');
    }

  // Clear verse selector
  const selectVersesDiv = document.getElementById("selectVerses");
  if (selectVersesDiv) selectVersesDiv.textContent = "Select Psalm first";
  
  const versesList = document.getElementById("verses");
  if (versesList) {
    versesList.innerHTML = "";
    versesList.style.display = "none";
    versesList.classList.remove("expanded");
  }
}

/* ----------------------------- Populate verses ----------------------------- */
function populateVersesFromSelectedText(rawObj) {
  const versesEl = document.getElementById('verses');
  const selectVersesEl = document.getElementById('selectVerses');
  const verseSection = document.getElementById('VerseSection');

  if (!versesEl) {
    console.warn('#verses element missing; cannot render verses');
    return;
  }

  versesEl.innerHTML = '';

  const sections = (rawObj && Array.isArray(rawObj.sections) && rawObj.sections.length) ? rawObj.sections : null;
  const flatVerses = (rawObj && Array.isArray(rawObj.verses) && rawObj.verses.length) ? rawObj.verses : [];

  const indContainer = document.createElement('div');
  indContainer.id = 'indVerses';

  if (sections && sections.length) {
    // Psalm 119-style with sections
    sections.forEach(function(sec, idx) {
      const secDiv = document.createElement('div');
      secDiv.className = 'verseGroup';

      const secHeader = document.createElement('div');
      secHeader.className = 'stanza-label';
      secHeader.textContent = sec.name || `Section ${idx+1}`;
      secDiv.appendChild(secHeader);

      // "Select All" button for this section
      const selectAllBtn = document.createElement('button');
      selectAllBtn.type = 'button';
      selectAllBtn.className = 'stanza-control-btn active';  // <-- CHANGED: Added 'active' class
      selectAllBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" style="width: 1em; height: 1em; fill: currentColor;">
          <path d="M438.6 105.4c12.5 12.5 12.5 32.8 0 45.3l-256 256c-12.5 12.5-32.8 12.5-45.3 0l-128-128c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0L160 338.7 393.4 105.4c12.5-12.5 32.8-12.5 45.3 0z"[...]
        </svg>
        <span class="stanza-toggle-label">Select All</span>
      `;
      secDiv.appendChild(selectAllBtn);

      const verseList = Array.isArray(sec.verses) ? sec.verses : [];
      const versesWrap = document.createElement('div');
      versesWrap.className = 'psalm-btn-container';
      versesWrap.style.display = 'flex';
      versesWrap.style.flexWrap = 'wrap';
      versesWrap.style.gap = '6px';
      
      verseList.forEach(function(v) {
        const verseBtn = document.createElement('button');
        verseBtn.type = 'button';
        verseBtn.className = 'verse-btn active';  // <-- CHANGED: Added 'active' class by default
        verseBtn.dataset.verse = v;
        verseBtn.dataset.selected = 'true';  // <-- CHANGED: Set to 'true' by default
        verseBtn.textContent = v;
        
        verseBtn.addEventListener('click', function() {
          const isSelected = verseBtn.dataset.selected === 'true';
          verseBtn.dataset.selected = isSelected ? 'false' : 'true';
          if (isSelected) {
            verseBtn.classList.remove('active');
          } else {
            verseBtn.classList.add('active');
          }
          verseMenu();
        });
        
        versesWrap.appendChild(verseBtn);
      });
      secDiv.appendChild(versesWrap);
      
      // Wire "Select All" button
      selectAllBtn.addEventListener('click', function() {
        const verseBtns = secDiv.querySelectorAll('.verse-btn');
        const allSelected = Array.from(verseBtns).every(btn => btn.dataset.selected === 'true');
        
        verseBtns.forEach(btn => {
          btn.dataset.selected = allSelected ? 'false' : 'true';
          if (allSelected) {
            btn.classList.remove('active');
          } else {
            btn.classList.add('active');
          }
        });
        
        // Update the select all button appearance
        if (allSelected) {
          selectAllBtn.classList.remove('active');
        } else {
          selectAllBtn.classList.add('active');
        }
        
        verseMenu();
      });
      
      indContainer.appendChild(secDiv);
    });
  } else if (flatVerses && flatVerses.length) {
    // Regular psalm: flat button list with "Select All" button at the top
    
    // Create "Select All" button for the entire psalm
    const selectAllBtn = document.createElement('button');
    selectAllBtn.type = 'button';
    selectAllBtn.className = 'stanza-control-btn active';  // <-- Added: "Select All" button for regular psalms
    selectAllBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" style="width: 1em; height: 1em; fill: currentColor;">
        <path d="M438.6 105.4c12.5 12.5 12.5 32.8 0 45.3l-256 256c-12.5 12.5-32.8 12.5-45.3 0l-128-128c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0L160 338.7 393.4 105.4c12.5-12.5 32.8-12.5 45.3 0z"/>
      </svg>
      <span class="stanza-toggle-label">Select All</span>
    `;
    indContainer.appendChild(selectAllBtn);
    
    const versesWrap = document.createElement('div');
    versesWrap.className = 'psalm-btn-container';
    versesWrap.style.display = 'flex';
    versesWrap.style.flexWrap = 'wrap';
    versesWrap.style.gap = '6px';
    versesWrap.style.marginTop = '8px';
    
    flatVerses.forEach(function(v) {
      const verseBtn = document.createElement('button');
      verseBtn.type = 'button';
      verseBtn.className = 'verse-btn active';  // <-- CHANGED: Added 'active' class by default
      verseBtn.dataset.verse = v;
      verseBtn.dataset.selected = 'true';  // <-- CHANGED: Set to 'true' by default
      verseBtn.textContent = v;
      
      verseBtn.addEventListener('click', function() {
        const isSelected = verseBtn.dataset.selected === 'true';
        verseBtn.dataset.selected = isSelected ? 'false' : 'true';
        if (isSelected) {
          verseBtn.classList.remove('active');
        } else {
          verseBtn.classList.add('active');
        }
        verseMenu();
      });
      
      versesWrap.appendChild(verseBtn);
    });
    indContainer.appendChild(versesWrap);
    
    // Wire "Select All" button for regular psalms
    selectAllBtn.addEventListener('click', function() {
      const verseBtns = indContainer.querySelectorAll('.verse-btn');
      const allSelected = Array.from(verseBtns).every(btn => btn.dataset.selected === 'true');
      
      verseBtns.forEach(btn => {
        btn.dataset.selected = allSelected ? 'false' : 'true';
        if (allSelected) {
          btn.classList.remove('active');
        } else {
          btn.classList.add('active');
        }
      });
      
      // Update the select all button appearance
      if (allSelected) {
        selectAllBtn.classList.remove('active');
      } else {
        selectAllBtn.classList.add('active');
      }
      
      verseMenu();
    });
    
  } else {
    const p = document.createElement('div');
    p.textContent = 'No verse metadata available for this text';
    indContainer.appendChild(p);
  }

  versesEl.appendChild(indContainer);
  versesEl.style.display = 'block';         
  versesEl.classList.add('expanded'); 

    if (selectVersesEl) {
      selectVersesEl.innerHTML = 'All';
      selectVersesEl.classList.add('open');  // ← ADDED: Reset caret
      selectVersesEl.setAttribute('aria-expanded', 'true');  // ← ADDED: Reset ARIA
    }

  if (selectVersesEl) {
    const togglePanel = function(e) {
      if (e) e.preventDefault();
      
      if (!textsContainer) return;
      
      const isExpanded = textsContainer.style.display === 'block';
      
      if (isExpanded) {
        textsContainer.style.display = 'none';
        psalmBtnsContainer.classList.remove('expanded');
        selectPsDiv.classList.remove('open');
        selectPsDiv.setAttribute('aria-expanded', 'false');
      } else {
        textsContainer.style.display = 'block';
        psalmBtnsContainer.classList.add('expanded');
        selectPsDiv.classList.add('open');
        selectPsDiv.setAttribute('aria-expanded', 'true');
      }
    };
    selectVersesEl.setAttribute('role', 'button');
    selectVersesEl.setAttribute('tabindex', '0');
    selectVersesEl.setAttribute('aria-expanded', 'true');
    selectVersesEl.style.cursor = 'pointer';
    selectVersesEl.onclick = togglePanel;
    selectVersesEl.onkeydown = function(e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); togglePanel(e); }
    };
  }

  try { 
  ensureNextButton(verseSection || versesEl.parentElement, 'next-btn-text', () => {
    const selectedVerses = getSelectedVerses();
    if (selectedVerses. length < 2) {
      alert('Please select at least 2 verses before proceeding.');
      return;
    }
    switchToTab('tune');
  }); 
} catch (_) {}
  try { updateSelectionSummary(); } catch (_) {}
}

/* ----------------------------- Tab navigation and sidenav open/close ----------------------------- */
if (document.readyState === 'loading') {
  document.addEventListener("DOMContentLoaded", function() {
    initializeTabNavigation();
  });
} else {
  initializeTabNavigation();
}

function initializeTabNavigation() {
  const tabs = document.querySelectorAll('.sidenav-tab, .top-tab');
  const panels = document.querySelectorAll('.tab-panel');
  if (tabs.length === 0 || panels.length === 0) {
    console.warn('Tab navigation elements not found');
    return;
  }
  function activate(tabEl) {
    const target = tabEl.getAttribute('data-tab');
    tabs.forEach(t => {
      t.classList.remove('active');
      t.setAttribute('aria-selected', 'false');
      t.setAttribute('tabindex', '-1');
    });
    tabEl.classList.add('active');
    tabEl.setAttribute('aria-selected', 'true');
    tabEl.setAttribute('tabindex', '0');

    panels.forEach(p => p.classList.remove('active'));
    const panel = document.getElementById('panel-' + target);
    if (panel) panel.classList.add('active');
  }
  tabs.forEach(tab => {
    tab.addEventListener('click', function () { activate(this); });
    tab.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(this); }
    });
  });
  const initial = document.querySelector('.top-tab.active, .sidenav-tab.active') || tabs[0];
  if (initial) activate(initial);
}

function openNav() {
  var sidenav = document.getElementById("sidenav");
  var menutoggle = document.getElementById("menutoggle");
  
  // Use responsive width based on orientation and viewport
  var sidenavWidth = "360px";
  if (window.matchMedia("(orientation: landscape) and (max-height: 500px)").matches) {
    sidenavWidth = "min(360px, 90vw)"; // Never exceed 90% of viewport width
  }
  
  sidenav.style.width = sidenavWidth;
  sidenav.classList.add("open");
  sidenav.style.height = "100%";
  menutoggle.classList.add("is-active");
}

function closeNav() {
  var sidenav = document.getElementById("sidenav");
  var menutoggle = document.getElementById("menutoggle");
  sidenav.style.width = "0";
  sidenav.classList.remove("open");
  menutoggle.classList.remove("is-active");
}

/* ----------------------------- iPhone Chrome fallback CSS injection ----------------------------- */
function ensureSidenavStyles() {
  try {
    const tab = document.querySelector('.sidenav-tab');
    const icon = document.querySelector('.sidenav-tab svg');
    if (!tab || !icon) return;
    const tabStyle = getComputedStyle(tab);
    const iconStyle = getComputedStyle(icon);
    const tabLooksUnstyled = tabStyle.display !== 'flex';
    const iconFill = iconStyle.fill || '';
    const iconLooksBlack =
      iconFill === 'rgb(0, 0, 0)' || iconFill.toLowerCase() === '#000' || iconFill.toLowerCase() === 'black';
    if (tabLooksUnstyled || iconLooksBlack) {
      console.warn('Sidenav CSS not applied. Injecting fallback styles for tabs.');
      const style = document.createElement('style');
      style.setAttribute('data-injected', 'sidenav-fallback');
      style.textContent = `
        #sidenav.open { width: min(360px, 90vw); max-width: 90vw; }
        .sidenav-container { display: flex; flex-direction: row; height: 100%; width: 100%; max-width: 90vw; position: relative; }
        .sidenav-content { flex: 1; width: 290px; overflow-y: auto; background: #555; order: 1; -webkit-overflow-scrolling: touch; }
        .sidenav-tabs { width: 60px; min-width: 60px; max-width: 60px; background: #444; display: flex; flex-direction: column; border-left: 2px solid #333; flex-shrink: 0; order: 2; padding-top: 65px[...]
        .sidenav-tab { flex: 1 1 auto; min-height: 80px; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 12px 8px; cursor: pointer; background: #555; bord[...]
        .sidenav-tab:hover { background: #5f6f4f; }
        .sidenav-tab.active { background: #6fc252; }
        .sidenav-tab svg { width: 28px !important; height: 28px !important; display: block !important; fill: #fff !important; }
        .sidenav-tab-label { writing-mode: vertical-rl; transform: rotate(0deg); color: #fff; font-size: 18px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; white-space: nowrap; op[...]
        .sidenav-tab.active .sidenav-tab-label { opacity: 1; max-height: 150px; }
        .tab-panel { display: none; padding: 15px; }
        .tab-panel.active { display: block; }
      `;
      document.head.appendChild(style);
    }
  } catch (e) { console.error('Error ensuring sidenav styles:', e); }
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', ensureSidenavStyles);
} else {
  ensureSidenavStyles();
}

/* ----------------------------- Summary display & wiring ----------------------------- */
function updateSelectionSummary() {
  var srcEl = document.getElementById("pssource");
  var txtEl = document.getElementById("pstext");
  var versesEl = document.getElementById("selectVerses");
  var tuneEl = document.getElementById("pstune");

  var srcOut = document.getElementById("summary-source");
  var txtOut = document.getElementById("summary-text");
  var tuneOut = document.getElementById("summary-tune");
  if (!srcOut || !txtOut || !tuneOut) return;

  var sourceVal = srcEl && srcEl.value ? srcEl.value.trim() : "";
  
  // Single source selection
  if (sourceVal) {
    srcOut.textContent = sourceVal;
  } else {
    srcOut.textContent = "Select Source";
  }

  var textTitle = txtEl && txtEl.value ? txtEl.value.trim() : "";
  var versesText = versesEl && versesEl.textContent ? versesEl.textContent.trim() : "";

  function versesChosen(v) { return v && v.toLowerCase().indexOf("select") === -1; }

  if (textTitle) {
    if (versesChosen(versesText)) {
      txtOut.textContent = textTitle + ": " + versesText;
    } else {
      txtOut.textContent = textTitle + ":";
    }
  } else {
    txtOut.textContent = "Select Text";
  }

  // Determine tune title to show in summary:
  // prefer selected label stored in data-tunelabel; otherwise show visible input value (filter) if it looks like a selection
  var tuneTitle = "";
  if (tuneEl) {
    if (tuneEl.dataset && tuneEl.dataset.tunelabel) {
      tuneTitle = tuneEl.dataset.tunelabel;
    } else if (tuneEl.value && tuneEl.value.trim()) {
      tuneTitle = tuneEl.value.trim();
    } else {
      tuneTitle = "";
    }
  }
  tuneOut.textContent = tuneTitle || "Select Tune";

  var ready = !!(sourceVal && textTitle && ( (tuneEl && tuneEl.dataset && tuneEl.dataset.tuneid) || tuneTitle ));
  ensureSummaryGoButton(ready);
}

function domContentLoadedHandler1639() {
  updateSelectionSummary();
  var srcEl = document.getElementById("pssource");
  if (srcEl) {
    srcEl.addEventListener("change", updateSelectionSummary);
    srcEl.addEventListener("input", updateSelectionSummary);
  }
  var txtEl = document.getElementById("pstext");
  if (txtEl) {
    txtEl.addEventListener("change", updateSelectionSummary);
    txtEl.addEventListener("input", updateSelectionSummary);
  }
  var tuneEl = document.getElementById("pstune");
  if (tuneEl) {
    tuneEl.addEventListener("change", updateSelectionSummary);
    tuneEl.addEventListener("input", updateSelectionSummary);
  }
  document.addEventListener("click", function (e) {
    if (e.target && (e.target.closest("#indVerses") || e.target.id === "selectAll")) {
      setTimeout(updateSelectionSummary, 0);
    }
  });
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', domContentLoadedHandler1639);
} else {
  domContentLoadedHandler1639();
}

/* ----------------------------- NEXT buttons ----------------------------- */
function switchToTab(tabKey) {
  const tabEl = document.querySelector(`.top-tab[data-tab="${tabKey}"], .sidenav-tab[data-tab="${tabKey}"]`);
  if (tabEl) tabEl.click();
}

const NEXT_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" aria-hidden="true">
  <path d="M566.6 342.6C579.1 330.1 579.1 309.8 566.6 297.3L406.6 137.3C394.1 124.8 373.8 124.8 361.3 137.3C348.8 149.8 348.8 170.1 361.3 182.6L466.7 288L96 288C78.3 288 64 302.3 64 320C64 337.7 78.3 352 96 352L466.7 352L361.3 457.4C348.8 469.9 348.8 490.2 361.3 502.6C373.8 515.1 394.1 515.1 406.6 502.6L566.6 342.6z"/>
</svg>`.trim();

function ensureNextButton(containerEl, id, onClick) {
  if (!containerEl) return null;
  let row = containerEl.querySelector('.next-btn-row');
  if (!row) {
    row = document.createElement('div');
    row.className = 'next-btn-row';
    containerEl.appendChild(row);
  }
  let btn = document.getElementById(id);
  // ← CHANGED: Remove span wrapper, use plain text like original
  const html = NEXT_SVG + 'Next';
  if (!btn) {
    btn = document.createElement('button');
    btn.id = id;
    btn.type = 'button';
    btn.className = 'next-btn';
    btn.innerHTML = html;
    row.appendChild(btn);
  } else {
    btn.innerHTML = html;
    btn.style.display = 'inline-flex';
    if (btn.parentElement !== row) row.appendChild(btn);
  }
  btn.onclick = onClick;
  return btn;
}

function ensureNextButtonAfter(anchorEl, id, onClick) {
  if (!anchorEl || !anchorEl.parentElement) return null;
  let row = anchorEl.nextElementSibling;
  const desiredClass = 'next-btn-row';
  if (!row || !row.classList || !row.classList.contains(desiredClass)) {
    row = document.createElement('div');
    row.className = desiredClass;
    anchorEl.parentElement.insertBefore(row, anchorEl.nextSibling);
  }
  let btn = document.getElementById(id);
  // ← CHANGED: Remove span wrapper
  const html = NEXT_SVG + 'Next';
  if (!btn) {
    btn = document.createElement('button');
    btn.id = id;
    btn.type = 'button';
    btn.className = 'next-btn';
    btn.innerHTML = html;
    row.appendChild(btn);
  } else {
    btn.innerHTML = html;
    btn.style.display = 'inline-flex';
    if (btn.parentElement !== row) row.appendChild(btn);
  }
  btn.onclick = onClick;
  return btn;
}

function ensureClearButton(containerEl, id, onClick) {
  if (!containerEl) return null;
  
  // Look for clear-next-btn-row specifically
  let row = containerEl. classList && containerEl.classList.contains('clear-next-btn-row') 
    ? containerEl 
    : containerEl.querySelector('. clear-next-btn-row');
  
  // If no row exists, create one with the NEW class
  if (!row) {
    row = document.createElement('div');
    row.className = 'clear-next-btn-row';  // ← Changed class name
    containerEl. appendChild(row);
  }
  
  let btn = document. getElementById(id);
  const clearSVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" aria-hidden="true">
  <path d="M431.2 476.5L163.5 208.8C141.1 240.2 128 278.6 128 320C128 426 214 512 320 512C361.5 512 399.9 498.9 431.2 476.5zM476.5 431.2C498.9 399.8 512 361.4 512 320C512 214 426 128 320 128C278.5 128 240.1 141.1 208.8 163.5L476.5 431.2zM64 320C64 178.6 178.6 64 320 64C461.4 64 576 178.6 576 320C576 461.4 461.4 576 320 576C178.6 576 64 461.4 64 320z"/>
</svg>`.trim();
  
  const html = clearSVG + 'Clear<br>Selection';
  
  if (! btn) {
    btn = document.createElement('button');
    btn.id = id;
    btn.type = 'button';
    btn.className = 'clear-btn';
    btn.innerHTML = html;
    row.insertBefore(btn, row.firstChild);
  } else {
    btn.innerHTML = html;
    btn.className = 'clear-btn';
    btn.style.display = 'inline-flex';
    if (btn.parentElement === row) {
      row.removeChild(btn);
    }
    row.insertBefore(btn, row.firstChild);
  }
  
  btn.onclick = onClick;
  return btn;
}

function hideClearButton(id) {
  const btn = document.getElementById(id);
  if (btn) btn.style.display = 'none';
}

function domContentLoadedHandler1734() {
  const src = document.getElementById('pssource');
  if (!src) return;
  const container = src.closest('.menu-item') || document.getElementById('panel-source');
  function maybeShowNextForSource() {
    if (src.value && src.value.trim().length) {
      ensureNextButton(container, 'next-btn-source', () => switchToTab('text'));
    } else {
      hideNextButton('next-btn-source');
    }
  }
  src.addEventListener('change', maybeShowNextForSource);
  src.addEventListener('input', maybeShowNextForSource);
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', domContentLoadedHandler1734);
} else {
  domContentLoadedHandler1734();
}

let versesObserver;
function watchForVersesAndShowNext() {
  const verses = document.getElementById('verses');
  if (!verses) return;
  if (versesObserver) versesObserver.disconnect();
  versesObserver = new MutationObserver(function () {
    if (verses.childElementCount > 0 || verses.textContent.trim().length > 0) {
      const verseSection = document.getElementById('VerseSection') || verses.parentElement;
      ensureNextButton(verseSection, 'next-btn-text', () => validateAndSwitchToTune());
      try { updateSelectionSummary(); } catch (_) {}
      versesObserver.disconnect();
    }
  });
  versesObserver.observe(verses, { childList: true, subtree: true, characterData: true });
}

// Validate verse selection before switching to tune tab
function validateAndSwitchToTune() {
  const verses = document.getElementById('verses');
  if (!verses) {
    switchToTab('tune');
    return;
  }

  // Get all verse buttons
  const verseBtns = verses.querySelectorAll('.verse-btn');
  const selectedVerseBtns = Array.from(verseBtns).filter(btn => btn.dataset.selected === 'true');
  
  if (selectedVerseBtns.length < 2) {
    // Show error message
    alert('You must select at least two stanzas. Please select another and try again.');
    return;
  }

  // Validation passed, proceed to tune tab
  switchToTab('tune');
}

document.addEventListener('awesomplete-selectcomplete', function (e) {
  if (e.target && e.target.id === 'pstext') watchForVersesAndShowNext();
}, true);

document.addEventListener('input', function (e) {
  if (e.target && e.target.id === 'pstext') {
    if (!e.target.value.trim()) hideNextButton('next-btn-text');
  }
});

function maybeShowNextForTune() {
  console.log('=== maybeShowNextForTune called ===');
  
  const tuneInput = document.getElementById('pstune');
  const anchor = document. getElementById('tunes');
  
  console.log('tuneInput:', tuneInput);
  console.log('anchor:', anchor);
  
  if (!tuneInput || !anchor) {
    console.warn('Missing required elements');
    return;
  }
  
  const chosen = (tuneInput.dataset && tuneInput. dataset.tuneid) || tuneInput.value.trim();
  console.log('chosen:', chosen);
  console.log('tuneInput.dataset.tuneid:', tuneInput.dataset.tuneid);
  console.log('tuneInput.value:', tuneInput. value);
  
  if (chosen) {
    console.log('✓ Tune is selected - showing buttons');
    
    // Create or get the row with the clear-next-btn-row class
    let btnRow = anchor.nextElementSibling;
    if (!btnRow || !btnRow.classList.contains('clear-next-btn-row')) {
      btnRow = document.createElement('div');
      btnRow.className = 'clear-next-btn-row';
      anchor.parentElement.insertBefore(btnRow, anchor.nextSibling);
    }
    console.log('Button row:', btnRow);
    
    // Show Clear button first (goes to left)
    ensureClearButton(btnRow, 'clear-btn-tune', () => {
      console.log('Clearing tune selection');
      
      // Clear the tune selection
      if (tuneInput) {
        tuneInput.value = '';
        tuneInput.dataset.tuneid = '';
        tuneInput.dataset.tunelabel = '';
      }
      window.globalPsTune = '';
      
      // Get the selected text's metre to restore filtered view
      const psTextInput = document.getElementById('pstext');
      let currentMetre = '';
      if (psTextInput && psTextInput.dataset && psTextInput.dataset.psdata) {
        const psdata = psTextInput.dataset.psdata. split(';');
        currentMetre = psdata[1] || '';
      }
      
      console.log('Restoring tune list filtered by metre:', currentMetre);
      
      // Deactivate all tune buttons
      const tuneButtonsContainer = document. getElementById('tuneButtons');
      if (tuneButtonsContainer) {
        tuneButtonsContainer.querySelectorAll('.tune-btn, .verse-btn').forEach(b => {
          b. classList.remove('active');
        });
      }
      
      // Re-run getTunes to restore the original filtered list by metre
      try {
        getTunes(currentMetre);  // ← Pass currentMetre to show all tunes for that metre
      } catch(e) {
        console.warn('Error calling getTunes:', e);
      }
      
      // Hide both buttons and remove the row
      hideNextButton('next-btn-tune');
      hideClearButton('clear-btn-tune');
      if (btnRow && btnRow.parentElement) {
        btnRow.parentElement.removeChild(btnRow);
      }
      
      // Update summary
      try { updateSelectionSummary(); } catch(_) {}
      
      // Re-run maybeShowNextForTune to ensure buttons are hidden
      setTimeout(() => maybeShowNextForTune(), 100);
    });
    console.log('Clear button created/shown');
    
    // Create Next button directly in the btnRow
    let nextBtn = document.getElementById('next-btn-tune');
    if (!nextBtn) {
      nextBtn = document.createElement('button');
      nextBtn.id = 'next-btn-tune';
      nextBtn.type = 'button';
      nextBtn.className = 'next-btn';
      nextBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" aria-hidden="true">
          <path d="M566.6 342.6C579.1 330.1 579.1 309.8 566.6 297.3L406.6 137.3C394.1 124.8 373.8 124.8 361.3 137.3C348.8 149.8 348.8 170.1 361.3 182.6L466.7 288L96 288C78.3 288 64 302.3 64 320C64 337.7 78.3 352 96 352L466.7 352L361.3 457.4C348.8 469.9 348.8 490.2 361.3 502.6C373.8 515.1 394.1 515.1 406.6 502.6L566.6 342.6z"/>
        </svg>
        Next
      `;
      btnRow.appendChild(nextBtn);
    } else {
      nextBtn.style.display = 'inline-flex';
      if (nextBtn.parentElement !== btnRow) {
        btnRow.appendChild(nextBtn);
      }
    }
    nextBtn.onclick = () => switchToTab('options');
    console.log('Next button created/shown');
    
  } else {
    console.log('✗ No tune selected - hiding buttons');
    hideNextButton('next-btn-tune');
    hideClearButton('clear-btn-tune');
    // Clean up the row
    const btnRow = anchor.nextElementSibling;
    if (btnRow && btnRow.classList.contains('clear-next-btn-row')) {
      btnRow.parentElement.removeChild(btnRow);
    }
  }
  
  console.log('=== maybeShowNextForTune end ===');
}

document.addEventListener('awesomplete-selectcomplete', function (e) {
  if (e.target && e.target.id === 'pstune') maybeShowNextForTune();
}, true);

document.addEventListener('change', function (e) {
  if (e.target && e.target.id === 'pstune') maybeShowNextForTune();
}, true);

document.addEventListener('input', function (e) {
  if (e.target && e.target.id === 'pstune') maybeShowNextForTune();
}, true);

function domContentLoadedHandler1799() {
  const tunesContainer = document.getElementById('tunes');
  if (!tunesContainer) return;
  const ob = new MutationObserver(() => { maybeShowNextForTune(); });
  ob.observe(tunesContainer, { childList: true, subtree: true });
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', domContentLoadedHandler1799);
} else {
  domContentLoadedHandler1799();
}

function ensureSummaryGoButton(shouldShow) {
  const holder = document.getElementById('summaryBtn');
  if (!holder) return;

  if (!shouldShow) {
    holder.style.display = 'none';
    holder.innerHTML = '';
    return;
  }

  holder.style.display = 'block';
  // ← CHANGED: Match original structure exactly - no nested indentation, text directly after SVG
  holder.innerHTML =
    "<button type='button' class='submitbtn' id='summaryGoBtn' onclick='loadFile(); closeNav();'>" +
      "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'>" +
        "<path d='M21,4 C21.5128358,4 21.9355072,4.38604019 21.9932723,4.88337887 L22,5 L22,11.5 C22,13.3685634 20.5357224,14.8951264 18.6920352,14.9948211 L18.5,15 L5.415,15 L8.70710678,18.2928932 C9.06759074,18.6533772 9.09532028,19.2206082 8.79029539,19.6128994 L8.70710678,19.7071068 C8.34662282,20.0675907 7.77939176,20.0953203 7.38710056,19.7902954 L7.29289322,19.7071068 L2.29289322,14.7071068 C2.25749917,14.6717127 2.22531295,14.6343256 2.19633458,14.5953066 L2.12467117,14.4840621 L2.12467117,14.4840621 L2.07122549,14.371336 L2.07122549,14.371336 L2.03584514,14.265993 L2.03584514,14.265993 L2.0110178,14.1484669 L2.0110178,14.1484669 L2.00397748,14.0898018 L2.00397748,14.0898018 L2,14 L2.00278786,13.9247615 L2.00278786,13.9247615 L2.02024007,13.7992742 L2.02024007,13.7992742 L2.04973809,13.6878575 L2.04973809,13.6878575 L2.09367336,13.5767785 L2.09367336,13.5767785 L2.14599545,13.4792912 L2.14599545,13.4792912 L2.20970461,13.3871006 L2.20970461,13.3871006 L2.29289322,13.2928932 L2.29289322,13.2928932 L7.29289322,8.29289322 C7.68341751,7.90236893 8.31658249,7.90236893 8.70710678,8.29289322 C9.06759074,8.65337718 9.09532028,9.22060824 8.79029539,9.61289944 L8.70710678,9.70710678 L5.415,13 L18.5,13 C19.2796961,13 19.9204487,12.4051119 19.9931334,11.64446 L20,11.5 L20,5 C20,4.44771525 20.4477153,4 21,4 Z'></path>" +
      "</svg>" +
      "Go" +
    "</button>";
  
  // Note: onclick in HTML above handles the click, but keeping this for compatibility
  const btn = document.getElementById('summaryGoBtn');
  if (btn && !btn.onclick) {
    btn.onclick = function () {
      try { loadFile(); } catch(_) {}
      try { closeNav(); } catch(_) {}
    };
  }
}

/* ----------------------------- Tab tooltip helpers ----------------------------- */
function addTopTabTooltips() {
  const labelMap = {
    source: "Source",
    text: "Text",
    tune: "Tune",
    options: "Options"
  };
  const tabs = document.querySelectorAll('.sidenav-top-tabs .top-tab');
  tabs.forEach(tab => {
    const key = tab.getAttribute('data-tab');
    const label = labelMap[key] || (key ? key.charAt(0).toUpperCase() + key.slice(1) : "Tab");
    tab.setAttribute('data-tooltip', label);
    tab.setAttribute('title', label);
    tab.setAttribute('aria-label', label);
  });
}
function domContentLoadedHandler1853() {
  try { addTopTabTooltips(); } catch(e) {}
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', domContentLoadedHandler1853);
} else {
  domContentLoadedHandler1853();
}

function wireTopTabTooltipDismissal() {
  const tabs = document.querySelectorAll('.sidenav-top-tabs .top-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', function (e) {
      if (e && e.detail > 0) {
        tab.classList.add('no-tooltip');
        setTimeout(() => tab.blur(), 0);
        setTimeout(() => tab.classList.remove('no-tooltip'), 300);
      }
    });
    tab.addEventListener('mouseleave', function () {
      tab.classList.add('no-tooltip');
    });
    tab.addEventListener('mouseenter', function () {
      tab.classList.remove('no-tooltip');
    });
    tab.addEventListener('focus', function () {
      tab.classList.remove('no-tooltip');
    });
    tab.addEventListener('blur', function () {
      tab.classList.add('no-tooltip');
    });
  });
}
function domContentLoadedHandler1881() {
  try { wireTopTabTooltipDismissal(); } catch(e) {}
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', domContentLoadedHandler1881);
} else {
  domContentLoadedHandler1881();
}

/* ----------------------------- Startup: fetch consolidated data ----------------------------- */
function domContentLoadedHandler1886() {
  try { fetchConsolidatedData(); } catch (e) { console.warn('fetchConsolidatedData failed', e); }
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', domContentLoadedHandler1886);
} else {
  domContentLoadedHandler1886();
}

function initializeTextAccordion() {
  const selectPsalm = document.getElementById('selectPsalm');
  const psalmButtons = document.getElementById('psalmButtons');
  
  if (!selectPsalm || !psalmButtons) {
    return;
  }
  
  // Add caret indicator if not already present
  if (!selectPsalm.querySelector('.accordion-caret')) {
    const caret = document.createElement('span');
    caret.className = 'accordion-caret';
    selectPsalm.insertBefore(caret, selectPsalm.firstChild);
  }
  
  // Toggle function
  const toggleTextAccordion = function(e) {
    if (e) e.preventDefault();
    const isExpanded = psalmButtons.classList.contains('expanded');
    
    if (isExpanded) {
      psalmButtons.classList.remove('expanded');
      selectPsalm.classList.remove('open');
      selectPsalm.setAttribute('aria-expanded', 'false');
    } else {
      psalmButtons.classList.add('expanded');
      selectPsalm.classList.add('open');
      selectPsalm.setAttribute('aria-expanded', 'true');
    }
  };
  
  // Wire up click handlers
  selectPsalm.addEventListener('click', toggleTextAccordion);
  selectPsalm.addEventListener('keydown', function(e) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggleTextAccordion(e);
    }
  });
  
  console.log('Text accordion initialized');
}

function initializeVerseAccordion() {
  const selectVerses = document.getElementById('selectVerses');
  const versesContainer = document.getElementById('verses');
 
  
  // Add caret indicator if not already present
  if (!selectVerses.querySelector('.accordion-caret')) {
    const caret = document.createElement('span');
    caret.className = 'accordion-caret';
    selectVerses.insertBefore(caret, selectVerses.firstChild);
  }
  
  // Toggle function
  const toggleVerseAccordion = function(e) {
    if (e) e.preventDefault();
    const isExpanded = versesContainer.classList.contains('expanded');
    
    if (isExpanded) {
      versesContainer.classList.remove('expanded');
      selectVerses.classList.remove('open');
      selectVerses.setAttribute('aria-expanded', 'false');
    } else {
      versesContainer.classList.add('expanded');
      selectVerses.classList.add('open');
      selectVerses.setAttribute('aria-expanded', 'true');
    }
  };
  
  // Wire up click handlers
  selectVerses.addEventListener('click', toggleVerseAccordion);
  selectVerses.addEventListener('keydown', function(e) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggleVerseAccordion(e);
    }
  });
}

function domContentLoadedHandler1971() {
  // Use a slight delay to ensure all dynamic content is loaded first
  setTimeout(function() {
    initializeTextAccordion();
    initializeVerseAccordion();
  }, 100);
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', domContentLoadedHandler1971);
} else {
  domContentLoadedHandler1971();
}

/* ----------------------------- Text Search Modal ----------------------------- */
function domContentLoadedHandler1980() {
  // Helper function to normalize strings (for accent-insensitive search)
  // Reusing the same pattern as the tune search normalizeString function
  function normalizeStringForSearch(str) {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }
  const searchLink = document.getElementById("searchPhraseLink");
  const searchModal = document.getElementById("searchModal");
  const searchInput = document.getElementById("searchInput");
  const searchResults = document.getElementById("searchResults");
  const closeSearchBtn = document.getElementById("closeSearchModalBtn");

  // Setup modal close on outside click
  function setupSearchModalCloseOnOutsideClick() {
    if (!searchModal) return;
    searchModal.addEventListener("click", function(e) {
      if (e.target === searchModal) {
        searchModal.style.display = "none";
        searchInput.value = "";
        searchResults.innerHTML = "";
      }
    });
  }
  setupSearchModalCloseOnOutsideClick();

  // Open modal
  if (searchLink) {
    searchLink.addEventListener("click", function(e) {
      e.preventDefault();
      if (searchModal) {
        populateSearchModalSourceList();
        searchModal.style.display = "flex";
        searchInput.focus();
        showSearchInstructions();
      }
    });
  }

  // Close button
  if (closeSearchBtn) {
    closeSearchBtn.addEventListener("click", function() {
      if (searchModal) {
        searchModal.style.display = "none";
        searchInput.value = "";
        searchResults.innerHTML = "";
      }
    });
  }

  // ESC key to close
  document.addEventListener("keydown", function(e) {
    if (e.key === "Escape" && searchModal && searchModal.style.display === "flex") {
      searchModal.style.display = "none";
      searchInput.value = "";
      searchResults.innerHTML = "";
    }
  });

  // Show initial instructions
  function showSearchInstructions() {
    if (!searchResults) return;
    searchResults.innerHTML = '<div style="padding:20px;text-align:center;color:#555;">Type a word or phrase to search through all psalm texts in the selected source.</div>';
  }
  
  // Populate search modal source list with checkboxes
  function populateSearchModalSourceList() {
    const searchSourcesList = document.getElementById('searchSourcesList');
    if (!searchSourcesList) {
      console.warn('populateSearchModalSourceList: searchSourcesList element not found');
      return;
    }
    
    searchSourcesList.innerHTML = '';
    
    const availableSources = Object.keys(window.sourceMap || {});
    console.log('populateSearchModalSourceList: availableSources =', availableSources);
    
    if (availableSources.length === 0) {
      // Show message if no sources available yet
      const msgDiv = document.createElement('div');
      msgDiv.style.cssText = 'color:#888;font-style:italic;padding:5px 0;';
      msgDiv.textContent = 'No sources available. Please select a source from the EDITION tab first.';
      searchSourcesList.appendChild(msgDiv);
      console.warn('populateSearchModalSourceList: No sources in sourceMap');
      return;
    }
    
    // Get currently selected sources from hidden input
    const psSourceInput = document.getElementById('pssource');
    const selectedSources = psSourceInput && psSourceInput.value ? 
      psSourceInput.value.split(',').map(s => s.trim()).filter(Boolean) : [];
    
    // Container for "All sources" button (on its own line)
    const allButtonContainer = document.createElement('div');
    allButtonContainer.style.cssText = 'margin-top: 8px; margin-bottom: 8px; text-align: center;';
    
    // Add "All sources" button
    const allButton = document.createElement('button');
    allButton.type = 'button';
    allButton.id = 'search-source-all';
    allButton.className = 'search-source-button search-source-all';
    allButton.textContent = 'All sources';
    allButton.style.cssText = 'padding: 8px 16px; border: 1px solid #ccc; border-radius: 4px; background: #d8e5d3; cursor: pointer; font-size: 0.95em;';
    
    // Set initial active state
    if (selectedSources.length === 0 || selectedSources.length === availableSources.length) {
      allButton.classList.add('active');
      allButton.style.background = '#6fc252';
      allButton.style.color = 'white';
    }
    
    allButtonContainer.appendChild(allButton);
    searchSourcesList.appendChild(allButtonContainer);
    
    // Container for individual source buttons (on separate line)
    const sourcesButtonContainer = document.createElement('div');
    sourcesButtonContainer.style.cssText = 'display: flex; flex-wrap: wrap; gap: 8px; justify-content: center;';
    
    // Add individual source buttons
    availableSources.forEach(function(source) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'search-source-button search-source-item';
      button.setAttribute('data-source', source);
      
      // Split source title into year and remainder
      // Typical format: "1564 Psalm Buik" or "1650 Scottish Metrical"
      const yearMatch = source.match(/^(\d{4})\s+(.+)$/);
      if (yearMatch) {
        // Create two-line structure: year on first line, rest on second
        const yearSpan = document.createElement('div');
        yearSpan.textContent = yearMatch[1];
        yearSpan.style.cssText = 'font-weight: bold; font-size: 1.1em;';
        
        const titleSpan = document.createElement('div');
        titleSpan.textContent = yearMatch[2];
        titleSpan.style.cssText = 'font-size: 0.85em; margin-top: 2px;';
        
        button.appendChild(yearSpan);
        button.appendChild(titleSpan);
      } else {
        // Fallback if format doesn't match
        button.textContent = source;
      }
      
      button.style.cssText = 'padding: 8px 16px; border: 1px solid #ccc; border-radius: 4px; background: #d8e5d3; cursor: pointer; font-size: 0.95em; text-align: center; min-width: 120px;';
      
      // Set initial active state
      if (selectedSources.length === 0 || selectedSources.includes(source)) {
        button.classList.add('active');
        button.style.background = '#6fc252';
        button.style.color = 'white';
      }
      
      sourcesButtonContainer.appendChild(button);
    });
    
    searchSourcesList.appendChild(sourcesButtonContainer);
    
    // Wire up "All sources" toggle
    allButton.addEventListener('click', function() {
      const isActive = allButton.classList.contains('active');
      
      if (isActive) {
        // Deactivate all
        allButton.classList.remove('active');
        allButton.style.background = '#d8e5d3';
        allButton.style.color = '';
        
        searchSourcesList.querySelectorAll('.search-source-item').forEach(function(btn) {
          btn.classList.remove('active');
          btn.style.background = '#d8e5d3';
          btn.style.color = '';
        });
      } else {
        // Activate all
        allButton.classList.add('active');
        allButton.style.background = '#6fc252';
        allButton.style.color = 'white';
        
        searchSourcesList.querySelectorAll('.search-source-item').forEach(function(btn) {
          btn.classList.add('active');
          btn.style.background = '#6fc252';
          btn.style.color = 'white';
        });
      }
    });
    
    // Wire up individual buttons
    searchSourcesList.querySelectorAll('.search-source-item').forEach(function(btn) {
      btn.addEventListener('click', function() {
        // Toggle this button
        const isActive = btn.classList.contains('active');
        
        if (isActive) {
          btn.classList.remove('active');
          btn.style.background = '#d8e5d3';
          btn.style.color = '';
        } else {
          btn.classList.add('active');
          btn.style.background = '#6fc252';
          btn.style.color = 'white';
        }
        
        // Update "All sources" button state
        const allItemButtons = Array.from(searchSourcesList.querySelectorAll('.search-source-item'));
        const allActive = allItemButtons.every(function(b) { return b.classList.contains('active'); });
        const noneActive = allItemButtons.every(function(b) { return !b.classList.contains('active'); });
        
        if (allActive) {
          allButton.classList.add('active');
          allButton.style.background = '#6fc252';
          allButton.style.color = 'white';
        } else {
          allButton.classList.remove('active');
          allButton.style.background = '#d8e5d3';
          allButton.style.color = '';
        }
      });
    });
  }

  // Search through psalms using server-side XQuery
  async function searchPsalms(query) {
    if (!query || query.trim().length === 0) {
      showSearchInstructions();
      return;
    }

    // Show loading state
    searchResults.innerHTML = '<div style="padding:20px;text-align:center;color:#555;">Searching...</div>';

    try {
      // Collect selected sources from buttons in search modal
      const sourceAllBtn = document.getElementById('search-source-all');
      let selectedSources = [];
      
      if (sourceAllBtn && sourceAllBtn.classList.contains('active')) {
        // "All sources" is active - search all sources (pass empty array)
        selectedSources = [];
      } else {
        // Collect individually active sources
        const activeButtons = Array.from(document.querySelectorAll('#searchSourcesList button.search-source-item.active'))
          .map(btn => btn.getAttribute('data-source'))
          .filter(Boolean);
        selectedSources = activeButtons;
      }
      
      // Build the query URL with optional source filter
      let url = `searchTexts.xq?query=${encodeURIComponent(query.trim())}`;
      if (selectedSources && selectedSources.length > 0) {
        url += `&source=${encodeURIComponent(selectedSources.join(','))}`;
      }
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Search failed: ${response.status} ${response.statusText}`);
      }
      
      const results = await response.json();
      displaySearchResults(results, query);
      
    } catch (error) {
      console.error('Search error:', error);
      searchResults.innerHTML = '<div style="padding:20px;text-align:center;color:#555;">Search failed. Please try again.</div>';
    }
  }

  // Display search results
  function displaySearchResults(results, query) {
    if (!searchResults) return;

    if (!results || results.length === 0) {
      searchResults.innerHTML = '<div style="padding:20px;text-align:center;color:#555;">No results found for "' + query + '"</div>';
      return;
    }

    let html = '<div style="margin-bottom:10px;color:#555;font-size:0.9em;">Found ' + results.length + ' result' + (results.length > 1 ? 's' : '') + '</div>';
    
    results.forEach(result => {
      // Highlight the match in the snippet
      const snippet = highlightMatchInSnippet(result.snippet, query);
      
      html += '<div class="search-result-item" data-label="' + result.label + '" data-psdata="' + result.data + '" data-source="' + (result.source || '') + '" data-source-short="' + (result.sourceShort || '') + '" data-verse-num="' + (result.verseNum || '') + '" style="padding:12px;margin:8px 0;background:#f5f5f5;border-radius:6px;cursor:pointer;border:1px solid #ddd;">';
      html += '<div style="font-weight:700;margin-bottom:6px;color:#333;">' + result.label + '</div>';
      html += '<div style="color:#555;font-size:0.9em;">' + snippet + '</div>';
      if (result.source) {
        html += '<div style="color:#888;font-size:0.8em;margin-top:4px;">' + result.source + '</div>';
      }
      html += '</div>';
    });

    searchResults.innerHTML = html;

    // Add click handlers to results
    const resultItems = searchResults.querySelectorAll('.search-result-item');
    resultItems.forEach(item => {
      item.addEventListener('click', function() {
        const label = this.getAttribute('data-label');
        const psdata = this.getAttribute('data-psdata');
        const source = this.getAttribute('data-source');
        const sourceShort = this.getAttribute('data-source-short');
        const verseNum = this.getAttribute('data-verse-num');
        selectPsalmFromSearch(label, psdata, source, sourceShort, verseNum);
      });
      
      // Hover effect
      item.addEventListener('mouseenter', function() {
        this.style.background = '#e8e8e8';
      });
      item.addEventListener('mouseleave', function() {
        this.style.background = '#f5f5f5';
      });
    });
  }

  // Helper function to highlight match in snippet
  function highlightMatchInSnippet(snippet, query) {
    if (!snippet || !query) return snippet;
    
    const normalizedSnippet = normalizeStringForSearch(snippet);
    const normalizedQuery = normalizeStringForSearch(query.trim());
    const matchStartInSnippet = normalizedSnippet.indexOf(normalizedQuery);
    
    if (matchStartInSnippet === -1) return snippet;
    
    // Find the match length in the original text
    let matchEnd = matchStartInSnippet;
    let normalizedCharsMatched = 0;
    
    while (normalizedCharsMatched < normalizedQuery.length && matchEnd < snippet.length) {
      const char = snippet[matchEnd];
      const normalizedChar = normalizeStringForSearch(char);
      if (normalizedChar.length > 0) {
        normalizedCharsMatched += normalizedChar.length;
      }
      matchEnd++;
    }
    
    const beforeMatch = snippet.substring(0, matchStartInSnippet);
    const match = snippet.substring(matchStartInSnippet, matchEnd);
    const afterMatch = snippet.substring(matchEnd);
    return beforeMatch + '<mark style="background:#ffd966;">' + match + '</mark>' + afterMatch;
  }

  // Select psalm from search results
  function selectPsalmFromSearch(label, psdata, source, sourceShort, verseNum) {
    console.log('selectPsalmFromSearch called:', { label, psdata, source, sourceShort, verseNum });
    
    // Close modal
    if (searchModal) {
      searchModal.style.display = "none";
      searchInput.value = "";
      searchResults.innerHTML = "";
    }

    // First, select the source if provided
    // Use sourceShort to match the button's data-source-label (which is the short title)
    if (sourceShort) {
      console.log('Selecting source by short title:', sourceShort);
      const sourceContainer = document.getElementById('sourceButtonContainer');
      if (sourceContainer) {
        const sourceButtons = sourceContainer.querySelectorAll('.source-button');
        let sourceFound = false;
        sourceButtons.forEach(btn => {
          const btnLabel = btn.getAttribute('data-source-label');
          console.log('Checking button with label:', btnLabel, 'against:', sourceShort);
          if (btnLabel === sourceShort) {
            console.log('Found source button, clicking it');
            sourceFound = true;
            // Always click to ensure it's selected (single-select now)
            btn.click();
          }
        });
        if (!sourceFound) {
          console.warn('Source button not found with short title:', sourceShort);
        }
      } else {
        console.warn('sourceButtonContainer not found');
      }
    }

    // Wait a moment for the source selection to populate texts, then find and click the psalm
    setTimeout(function() {
      console.log('Looking for psalm button with label:', label);
      const textsContainer = document.getElementById('texts');
      if (textsContainer) {
        const psalms = textsContainer.querySelectorAll('.psalm-btn');
        console.log('Found', psalms.length, 'psalm buttons');
        let psalmFound = false;
        psalms.forEach(btn => {
          if (btn.dataset.label === label) {
            console.log('Found matching psalm button, clicking it');
            psalmFound = true;
            btn.click();
            
            // After selecting the psalm, switch to TEXT tab and select only the matching verse
            setTimeout(function() {
              console.log('Switching to TEXT tab');
              // Switch to TEXT tab
              switchToTab('text');
              
              // Find and select only the verse with the matching verse number
              if (verseNum) {
                selectVerseByNumber(verseNum);
              } else {
                // Fallback to selecting first verse if no verse number
                selectVerseByNumber('1');
              }
            }, 200);
            
            return;
          }
        });
        if (!psalmFound) {
          console.warn('Psalm button not found with label:', label);
        }
      } else {
        console.warn('texts container not found');
      }
    }, 200);
  }

  // Select only the verse with the given verse number
  function selectVerseByNumber(verseNum) {
    console.log('Selecting verse by number:', verseNum);
    const verses = document.getElementById('verses');
    if (!verses) {
      console.warn('verses element not found');
      return;
    }

    // Get all verse buttons
    const verseBtns = verses.querySelectorAll('.verse-btn');
    if (verseBtns.length === 0) {
      console.warn('No verse buttons found');
      return;
    }

    // First, deselect all verses (don't set inline styles - let CSS handle appearance)
    verseBtns.forEach(btn => {
      btn.dataset.selected = 'false';
      btn.classList.remove('active');
      // Remove any inline styles that may have been set
      btn.style.background = '';
      btn.style.color = '';
    });

    // Deselect any "Select All" button(s)
    const selectAllBtns = verses.querySelectorAll('.stanza-control-btn');
    selectAllBtns.forEach(btn => {
      btn.classList.remove('active');
    });

    // Find the verse button with matching verse number
    // The verse button text should contain the verse number
    let foundVerse = false;
    for (let btn of verseBtns) {
      const verseText = btn.textContent || '';
      // Try to extract the verse number/designation from the button text
      // Common patterns: "1", "1.", "Verse 1", "20-21", "16a", etc.
      // Look for patterns like: digit(s), optionally followed by letter or hyphen+digit(s)
      const match = verseText.match(/\b(\d+(?:[a-z]|-\d+)?)\b/i);
      if (match && match[1] === verseNum) {
        console.log('Found matching verse button for verse', verseNum, ':', verseText);
        // Select this verse (let CSS handle the styling via .active class)
        btn.dataset.selected = 'true';
        btn.classList.add('active');
        foundVerse = true;
        break;
      }
    }

    if (!foundVerse) {
      console.warn('No verse found with number:', verseNum, 'selecting first verse as fallback');
      // Fallback: select the first verse
      if (verseBtns.length > 0) {
        verseBtns[0].dataset.selected = 'true';
        verseBtns[0].classList.add('active');
      }
    }

    // Update the summary display
    const selectVersesEl = document.getElementById('selectVerses');
    if (selectVersesEl) {
      const selectedCount = Array.from(verseBtns).filter(btn => btn.dataset.selected === 'true').length;
      selectVersesEl.innerHTML = selectedCount === verseBtns.length ? 'All' : `${selectedCount} selected`;
    }
  }

  // Search button click handler
  const executeSearchBtn = document.getElementById('executeSearchBtn');
  if (executeSearchBtn && searchInput) {
    executeSearchBtn.addEventListener('click', function() {
      searchPsalms(searchInput.value);
    });
  }
  
  // Also allow Enter key in search input to trigger search
  if (searchInput) {
    searchInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        searchPsalms(this.value);
      }
    });
  }
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', domContentLoadedHandler1980);
} else {
  domContentLoadedHandler1980();
}

/* ----------------------------- Melody Search Modal ----------------------------- */
function domContentLoadedHandlerMelodySearch() {
  // Translate pitch classes to signed intervals
  function translatePitchClassesToSignedIntervals(pitchClasses) {
    if (!Array.isArray(pitchClasses) || pitchClasses.length < 2) {
      return [];
    }
    
    const intervals = [];
    for (let i = 1; i < pitchClasses.length; i++) {
      const prev = pitchClasses[i - 1];
      const curr = pitchClasses[i];
      
      // Calculate difference with octave wrapping
      let diff = curr - prev;
      
      // Normalize to range [-6, +6] to handle octave wrapping
      // If the interval is greater than 6 semitones, it's more likely the shorter way around
      if (diff > 6) {
        diff = diff - 12;
      } else if (diff < -6) {
        diff = diff + 12;
      }
      
      intervals.push(diff);
    }
    
    return intervals;
  }
  
  // Format intervals with + prefix for positive numbers
  function formatSignedInterval(interval) {
    return interval >= 0 ? `+${interval}` : `${interval}`;
  }
  
  const melodySearchLink = document.getElementById("searchMelodyLink");
  const melodySearchModal = document.getElementById("melodySearchModal");
  const melodySearchInput = document.getElementById("melodySearchInput");
  const melodySearchResults = document.getElementById("melodySearchResults");
  const closeMelodySearchBtn = document.getElementById("closeMelodySearchModalBtn");
  const executeMelodySearchBtn = document.getElementById("executeMelodySearchBtn");

  // Setup modal close on outside click
  function setupMelodySearchModalCloseOnOutsideClick() {
    const modal = document.getElementById('melodySearchModal');
    if (!modal) return;
    
    modal.addEventListener('click', function(e) {
        // Check if click is on the modal backdrop (not the content div inside)
        if (e.target === modal) {
            e.preventDefault();
            e.stopPropagation();
            
            // Stop any playing melody FIRST
            console.log('Clicking outside modal - stopping playback');
            if (window.melodyPlayer && window.melodyPlayer.isPlaying) {
                console.log('Stopping melody player');
                window.melodyPlayer.stop();
            }
            
            // Small delay to ensure stop completes before closing
            setTimeout(() => {
                modal.style.display = 'none';
            }, 50);
        }
    });
}
  setupMelodySearchModalCloseOnOutsideClick();

  // Open modal
  if (melodySearchLink) {
    melodySearchLink.addEventListener("click", function(e) {
      e.preventDefault();
      if (melodySearchModal) {
        melodySearchModal.style.display = "flex";
        melodySearchInput.focus();
        showMelodySearchInstructions();
      }
    });
  }

  // Close button
  if (closeMelodySearchBtn) {
        closeMelodySearchBtn.addEventListener('click', function() {
            // Stop any playing melody
            if (window.melodyPlayer && window. melodyPlayer.isPlaying) {
                window.melodyPlayer.stop();
            }
            
            const modal = document.getElementById('melodySearchModal');
            if (modal) {
                modal.style. display = 'none';
            }
        });
    }

  // ESC key to close
  document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            const modal = document.getElementById('melodySearchModal');
            if (modal && modal. style.display !== 'none') {
                e.preventDefault();
                
                // Stop any playing melody
                console.log('Escape pressed - stopping playback');
                if (window.melodyPlayer && window.melodyPlayer.isPlaying) {
                    console.log('Stopping melody player');
                    window.melodyPlayer. stop();
                }
                
                setTimeout(() => {
                    modal.style.display = 'none';
                }, 50);
            }
        }
    });

  // Show initial instructions
  function showMelodySearchInstructions() {
    if (!melodySearchResults) return;
    melodySearchResults.innerHTML = '<div style="padding:20px;text-align:center;color:#555;">Enter pitch classes (0-11) separated by spaces to search for matching melodies.<br><small>Note: Search uses 3-note n-grams (trigrams) to match melodic patterns flexibly.</small></div>';
  }

  // Search melodies using server-side XQuery with trigram (3-note n-gram) matching
  async function searchMelodies(pitchClassInput) {
    if (!pitchClassInput || pitchClassInput.trim().length === 0) {
      showMelodySearchInstructions();
      return;
    }

    // Parse pitch classes
    const pitchClassStrings = pitchClassInput.trim().split(/\s+/);
    const pitchClasses = pitchClassStrings.map(s => parseInt(s, 10));
    
    // Validate pitch classes
    const invalidClasses = pitchClasses.filter(pc => isNaN(pc) || pc < 0 || pc > 11);
    if (invalidClasses.length > 0) {
      melodySearchResults.innerHTML = '<div style="padding:20px;text-align:center;color:#d32f2f;">Invalid pitch classes. Please enter numbers between 0 and 11.</div>';
      return;
    }
    
    if (pitchClasses.length < 2) {
      melodySearchResults.innerHTML = '<div style="padding:20px;text-align:center;color:#d32f2f;">Please enter at least 2 pitch classes.</div>';
      return;
    }

    // Translate to signed intervals
    const intervals = translatePitchClassesToSignedIntervals(pitchClasses);
    const intervalString = intervals.join(' ');

    // Determine search mode
    const useFuzzy = typeof window.isFuzzySearchMode === 'function' ? window.isFuzzySearchMode() : true;
    
    // Show loading state with the translated intervals
    const searchType = useFuzzy ? 
      (intervals.length >= 2 ? '3-note n-gram (trigram) matching' : 'exact matching') :
      'exact interval matching';
    melodySearchResults.innerHTML = '<div style="padding:20px;text-align:center;color:#555;">Searching using ' + searchType + ' for intervals: ' + intervals.map(formatSignedInterval).join(' ') + '...</div>';

    try {
      // Call server-side search using appropriate XQuery file
      const xqueryFile = useFuzzy ? 'sesarchMelodies.xq' : 'sesarchMelodiesExact.xq';
      const url = `${xqueryFile}?signedinterval=${encodeURIComponent(intervalString)}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Search failed: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      displayMelodySearchResults(data.results || [], intervals, pitchClasses);
      
    } catch (error) {
      console.error('Melody search error:', error);
      melodySearchResults.innerHTML = '<div style="padding:20px;text-align:center;color:#d32f2f;">Search failed. Please try again.</div>';
    }
  }

  // Display melody search results
function displayMelodySearchResults(results) {
    if (! melodySearchResults) return;
    
    if (results.length === 0) {
        melodySearchResults.innerHTML = '<div style="padding: 20px;text-align:center;color:#888;">No matching tunes found.  Try a different pattern.</div>';
        return;
    }
    
    // Get the currently selected text's metre
    const psTextInput = document.getElementById('pstext');
    let currentMetre = '';
    if (psTextInput && psTextInput.dataset && psTextInput.dataset.psdata) {
        const psdata = psTextInput.dataset.psdata. split(';');
        currentMetre = psdata[1] || ''; // metre is the second element
    }
    console.log('Current text metre:', currentMetre);
    
    // Helper function to normalize metres for comparison
    // Helper function to normalize metres for comparison
function normalizeMetreForComparison(metre) {
    if (!metre) return '';
    
    // Trim whitespace
    let normalized = metre.trim();
    
    // Remove anything in parentheses (and the parentheses themselves)
    // This handles cases like "8.6.8.6. (6.)"
    normalized = normalized.replace(/\s*\([^)]*\)/g, '').trim();
    
    // Check if it ends with a period
    if (! normalized.endsWith('.')) {
        return normalized;
    }
    
    // Remove the final period temporarily
    normalized = normalized.slice(0, -1);
    
    // Check if the last character (before the period) is a letter
    // This handles cases like "8.6.8.6. D" or "8.6.8.6. T"
    while (normalized.length > 0 && /[a-zA-Z]/.test(normalized[normalized.length - 1])) {
        // Remove the letter
        normalized = normalized.slice(0, -1).trim();
        
        // Remove trailing period if it exists after removing the letter
        if (normalized.endsWith('.')) {
            normalized = normalized.slice(0, -1);
        }
    }
    
    // Add back the final period if normalized string doesn't end with one
    if (normalized.length > 0 && !normalized.endsWith('.')) {
        normalized += '.';
    }
    
    return normalized;
}
    
    melodySearchResults.innerHTML = '';
    
    // Initialize Verovio toolkit if needed
    let verovioTk = null;
    console.log('[Verovio Check] window.melodyPlayer:', window.melodyPlayer);
    console.log('[Verovio Check] typeof verovio:', typeof verovio);
    
    if (window.melodyPlayer && window.melodyPlayer.verovioToolkit) {
        verovioTk = window.melodyPlayer.verovioToolkit;
        console.log('[Verovio Check] Using melodyPlayer.verovioToolkit');
    } else if (typeof verovio !== 'undefined' && verovio.toolkit) {
        // Create a toolkit instance for rendering notations
        try {
            verovioTk = new verovio.toolkit();
            console.log('[Verovio Check] Created new verovio.toolkit()');
        } catch (e) {
            console.error('[Verovio Check] Error creating toolkit:', e);
        }
    } else {
        console.warn('[Verovio Check] Verovio not available');
    }
    
    results.forEach(result => {
        const resultItem = document.createElement('div');
        resultItem.style.cssText = 'padding:12px;margin:8px 0;background:#f5f5f5;border-radius:6px;cursor:pointer;display:flex;align-items:center;gap:12px;transition:background 0.2s;';
        resultItem.addEventListener('mouseenter', () => resultItem.style.background = '#e8e8e8');
        resultItem.addEventListener('mouseleave', () => resultItem.style.background = '#f5f5f5');
        
        // Check if metres match using normalized comparison
        const normalizedCurrentMetre = normalizeMetreForComparison(currentMetre);
        const normalizedResultMetre = normalizeMetreForComparison(result.metre);
        const metreMatches = normalizedCurrentMetre && normalizedResultMetre && 
                            normalizedCurrentMetre === normalizedResultMetre;
        
        // Create full label with date (to match button labels)
        const fullLabel = result.date ? `${result.title} (${result.date})` : result.title;
        
        console.log('Metre comparison:', {
            current: currentMetre,
            currentNormalized: normalizedCurrentMetre,
            result: result.metre,
            resultNormalized: normalizedResultMetre,
            matches: metreMatches,
            fullLabel: fullLabel
        });
        
        // Column 1: Create play button
        const playBtn = window.melodyPlayer.createPlayButton();
        playBtn.style.cssText = 'flex-shrink:0;width:40px;';
        
        // Column 2: Title, date, and metre
        const textInfo = document.createElement('div');
        textInfo.style.cssText = 'flex:1;min-width:0;';
        
        // Title and date on same line
        const titleDateDiv = document.createElement('div');
        titleDateDiv.style.cssText = 'font-size:1em;color:#333;margin-bottom:4px;';
        
        const titleSpan = document.createElement('span');
        titleSpan.textContent = result.title;
        titleSpan.style.fontWeight = 'bold';
        
        const dateSpan = document.createElement('span');
        dateSpan.textContent = result.date ? ` (${result.date})` : '';
        dateSpan.style.fontWeight = 'normal';
        
        titleDateDiv.appendChild(titleSpan);
        titleDateDiv.appendChild(dateSpan);
        
        // Metre on second line with conditional styling
        const metreDiv = document.createElement('div');
        metreDiv.style.cssText = 'font-size:0.85em;';
        
        if (!metreMatches && currentMetre) {
            metreDiv.style.color = '#d32f2f'; // Red
            metreDiv.textContent = (result.metre || 'Unknown metre') + ' *';
        } else {
            metreDiv.style.color = '#666';
            metreDiv.textContent = result.metre || 'Unknown metre';
        }
        
        textInfo.appendChild(titleDateDiv);
        textInfo.appendChild(metreDiv);
        
        // Column 3: Music notation SVG
        const notationContainer = document.createElement('div');
        notationContainer.style.cssText = 'width:200px;height:70px;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:white;border:1px solid #ddd;border-radius:4px;overflow:hidden;';
        
        console.log('[Notation Render] Processing result:', result.title);
        console.log('[Notation Render] PAE code:', result.plaineAndEasie);
        console.log('[Notation Render] verovioTk available:', !!verovioTk);
        
        // Generate SVG from PAE code using Verovio - first 2 bars only
        if (result.plaineAndEasie && verovioTk) {
            try {
                // Extract first 3 bars from PAE code
                // In PAE: first '/' is after time signature, then each '/' is a bar line
                // To get first 3 bars, we need everything up to the 4th '/'
                let paeCode = result.plaineAndEasie.trim();
                console.log('[Notation Render] Original PAE:', paeCode);
                
                // Find the position of the 4th '/' (index 3 in 0-based counting)
                let slashCount = 0;
                let cutPosition = -1;
                for (let i = 0; i < paeCode.length; i++) {
                    if (paeCode[i] === '/') {
                        slashCount++;
                        if (slashCount === 4) {
                            cutPosition = i;
                            break;
                        }
                    }
                }
                
                console.log('[Notation Render] Found', slashCount, 'slashes, cut position:', cutPosition);
                
                if (cutPosition > 0) {
                    // Truncate to first 3 bars (everything before the 4th slash)
                    paeCode = paeCode.substring(0, cutPosition);
                    console.log('[Notation Render] Truncated PAE to 3 bars:', paeCode);
                } else {
                    console.log('[Notation Render] Less than 4 bars, using full PAE');
                }
                
                // Set Verovio options before loading data
                console.log('[Notation Render] Setting Verovio options');
                verovioTk.setOptions({
                    inputFrom: 'pae',
                    scale: 40,
                    pageHeight: 400,
                    pageWidth: 1000,
                    adjustPageHeight: true,
                    breaks: 'none',
                    header: 'none',
                    footer: 'none'
                });
                
                // Load PAE data directly (no MEI wrapper needed with inputFrom: 'pae')
                console.log('[Notation Render] Loading PAE data into Verovio');
                verovioTk.loadData(paeCode);
                
                console.log('[Notation Render] Rendering to SVG');
                const svg = verovioTk.renderToSVG(1);
                console.log('[Notation Render] SVG rendered, length:', svg ? svg.length : 0);
                
                if (svg) {
                    notationContainer.innerHTML = svg;
                    const svgElement = notationContainer.querySelector('svg');
                    if (svgElement) {
                        svgElement.style.cssText = 'max-width:100%;max-height:100%;';
                        console.log('[Notation Render] SVG element inserted successfully');
                    } else {
                        console.warn('[Notation Render] No SVG element found after insertion');
                    }
                } else {
                    console.warn('[Notation Render] Verovio returned empty SVG');
                    notationContainer.innerHTML = '<span style="color:#999;font-size:0.8em;">Notation unavailable</span>';
                }
            } catch (e) {
                console.error('[Notation Render] Error rendering notation:', e);
                console.error('[Notation Render] Error stack:', e.stack);
                notationContainer.innerHTML = '<span style="color:#999;font-size:0.8em;">Error rendering notation</span>';
            }
        } else {
            if (!result.plaineAndEasie) {
                console.warn('[Notation Render] No PAE code available for:', result.title);
            }
            if (!verovioTk) {
                console.warn('[Notation Render] Verovio toolkit not available');
            }
            notationContainer.innerHTML = '<span style="color:#999;font-size:0.8em;">Notation unavailable</span>';
        }
        
        resultItem.appendChild(playBtn);
        resultItem.appendChild(textInfo);
        resultItem.appendChild(notationContainer);
        
        // Play button click handler
        playBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            
            window.melodyPlayer.play(
                result.meiFilePath,
                result.title,
                playBtn
            );
        });
        
        // Click on result item to select the tune
        resultItem.addEventListener('click', function() {
            // Stop any playing melody
            if (window.melodyPlayer) {
                window.melodyPlayer. stop();
            }
            
            // If metre matches, auto-select the tune and close modal
            if (metreMatches) {
                console.log('Metre matches - auto-selecting tune with full label:', fullLabel);
                selectTuneFromMelodySearch(fullLabel, result.meiFilePath);  // Use fullLabel here
                
                // Close the search modal
                const modal = document.getElementById('melodySearchModal');
                if (modal) {
                    modal. style.display = 'none';
                }
            } else {
                // Metre doesn't match - just show a warning, don't auto-select
                console.log('Metre mismatch - not auto-selecting');
                alert(`This tune (${result.metre || 'unknown metre'}) does not match your text's metre (${currentMetre}). Please select a matching tune or change your text selection.`);
            }
        });
        
        melodySearchResults.appendChild(resultItem);
    });
}

  // Highlight the matching portion of the interval sequence
  function highlightMelodyMatch(fullIntervals, searchIntervals) {
    // fullIntervals is a string like "2 0 2 1 2 -2 5" (raw format from MEI)
    // searchIntervals is an array like [2, 0, 2] (raw numbers)
    // We need to match using raw format (without + prefix)
    const searchString = searchIntervals.join(' ');
    const fullString = fullIntervals;
    
    // Find the match and highlight it
    // Use word boundary checking to avoid false positives like "12 0" matching "2 0"
    let matchIndex = -1;
    let searchIndex = 0;
    
    while (searchIndex <= fullString.length - searchString.length) {
      const testIndex = fullString.indexOf(searchString, searchIndex);
      if (testIndex === -1) break;
      
      // Check if this is a word boundary match (start of string or preceded by space)
      const isStartBoundary = testIndex === 0 || fullString[testIndex - 1] === ' ';
      // Check if followed by space or end of string
      const endPos = testIndex + searchString.length;
      const isEndBoundary = endPos === fullString.length || fullString[endPos] === ' ';
      
      if (isStartBoundary && isEndBoundary) {
        matchIndex = testIndex;
        break;
      }
      
      searchIndex = testIndex + 1;
    }
    
    if (matchIndex === -1) {
      return fullString;
    }
    
    const beforeMatch = fullString.substring(0, matchIndex);
    const match = fullString.substring(matchIndex, matchIndex + searchString.length);
    const afterMatch = fullString.substring(matchIndex + searchString.length);
    
    return beforeMatch + '<mark style="background:#ffd966;">' + match + '</mark>' + afterMatch;
  }

  // Select tune from melody search results
  function selectTuneFromMelodySearch(tuneTitle, meiFilePath) {
    console.log('=== selectTuneFromMelodySearch START ===');
    console.log('tuneTitle:', tuneTitle);
    console.log('meiFilePath:', meiFilePath);
    
    // Switch to TUNE tab
    switchToTab('tune');
    
    // Wait for tune UI to be ready
    setTimeout(function() {
        console.log('Step 1: Looking for tune input and buttons container');
        
        const tuneInput = document. getElementById('pstune');
        const tuneButtonsContainer = document. getElementById('tuneButtons');
        
        console.log('tuneInput found:', !!tuneInput);
        console.log('tuneButtonsContainer found:', !!tuneButtonsContainer);
        
        if (! tuneInput || !tuneButtonsContainer) {
            console.error('Required elements not found');
            return;
        }
        
        // Extract tune ID from file path
        const fileName = meiFilePath. split('/').pop();
        const tuneId = fileName.replace('. xml', '');
        console.log('Extracted tuneId from path:', tuneId);
        
        // Check if renderTuneButtons function exists
        console.log('renderTuneButtons function exists:', typeof renderTuneButtons);
        console.log('window._pstuneMap exists:', typeof window._pstuneMap);
        console.log('window._pstuneMap contents:', window._pstuneMap);
        
        // First, ensure all tune buttons are visible
        console.log('Step 2: Rendering all tune buttons');
        if (typeof renderTuneButtons === 'function') {
            renderTuneButtons('');
        }
        
        // Wait a moment for buttons to render
        setTimeout(function() {
            console. log('Step 3: Searching for tune button');
            
            // Find all tune buttons
            const allButtons = tuneButtonsContainer.querySelectorAll('button');
            console.log('Total buttons in container:', allButtons.length);
            
            // Log details about each button
            allButtons. forEach((btn, index) => {
                console.log(`Button ${index}:`, {
                    className: btn.className,
                    label: btn.dataset.label,
                    tuneid: btn.dataset.tuneid,
                    textContent: btn.textContent. substring(0, 50)
                });
            });
            
            // Try to find the matching button
            let foundButton = null;
            
            allButtons.forEach(btn => {
                if (btn.dataset.label === tuneTitle) {
                    foundButton = btn;
                    console.log('✓ FOUND MATCH by label:', tuneTitle);
                }
            });
            
            if (!foundButton) {
                console.error('✗ NO MATCH FOUND for:', tuneTitle);
                console.error('Searched among labels:', Array.from(allButtons).map(b => b.dataset.label));
                return;
            }
            
            console.log('Step 4: Applying selection');
            const mappingId = foundButton.dataset.tuneid || '';
            console.log('Using tuneid:', mappingId);
            
            // Apply the selection
            tuneInput.dataset. tuneid = mappingId;
            tuneInput.dataset.tunelabel = tuneTitle;
            tuneInput.value = tuneTitle;
            window.globalPsTune = mappingId;
            
            console. log('tuneInput.dataset after update:', tuneInput.dataset);
            console.log('tuneInput.value after update:', tuneInput.value);
            console.log('window.globalPsTune after update:', window.globalPsTune);
            
            // Mark button as active
            console.log('Step 5: Marking button as active');
            allButtons.forEach(b => {
                if (b.classList.contains('active')) {
                    console.log('Removing active from:', b.dataset.label);
                }
                b.classList.remove('active');
            });
            foundButton.classList.add('active');
            console.log('Added active class to:', foundButton.dataset.label);
            
            // Filter to show only this tune
            console.log('Step 6: Filtering to show only selected tune');
            if (typeof renderTuneButtons === 'function') {
                renderTuneButtons(tuneTitle);
                console.log('Called renderTuneButtons with:', tuneTitle);
            }
            
            // Scroll into view
            foundButton. scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // Update UI
            try { updateSelectionSummary(); } catch(e) { console.warn('updateSelectionSummary error:', e); }
            try { maybeShowNextForTune(); } catch(e) { console.warn('maybeShowNextForTune error:', e); }
            
            console.log('=== selectTuneFromMelodySearch END ===');
            
        }, 300);
    }, 200);
    
    try { maybeShowNextForTune(); } catch(e) { console.warn('maybeShowNextForTune error:', e); }
}

  // ===== CONTOUR SEARCH FUNCTIONALITY =====
  
  let currentSearchMode = 'pitch'; // 'pitch' or 'contour'
  
  // Setup search mode toggle buttons
  const pitchSearchModeBtn = document.getElementById('pitchSearchModeBtn');
  const contourSearchModeBtn = document.getElementById('contourSearchModeBtn');
  const pitchSearchInterface = document.getElementById('pitchSearchInterface');
  const contourSearchInterface = document.getElementById('contourSearchInterface');
  
  // Helper function to update button styles
  function updateSearchModeButtons(activeBtn, inactiveBtn) {
    activeBtn.classList.add('active');
    inactiveBtn.classList.remove('active');
    activeBtn.style.background = '#6fc252';
    activeBtn.style.color = 'white';
    inactiveBtn.style.background = 'white';
    inactiveBtn.style.color = '#6fc252';
  }
  
  if (pitchSearchModeBtn && contourSearchModeBtn) {
    pitchSearchModeBtn.addEventListener('click', function() {
      currentSearchMode = 'pitch';
      updateSearchModeButtons(pitchSearchModeBtn, contourSearchModeBtn);
      if (pitchSearchInterface) pitchSearchInterface.style.display = 'block';
      if (contourSearchInterface) contourSearchInterface.style.display = 'none';
    });
    
    contourSearchModeBtn.addEventListener('click', function() {
      currentSearchMode = 'contour';
      updateSearchModeButtons(contourSearchModeBtn, pitchSearchModeBtn);
      if (pitchSearchInterface) pitchSearchInterface.style.display = 'none';
      if (contourSearchInterface) contourSearchInterface.style.display = 'block';
    });
  }
  
  // Contour input handling
  let contourPattern = '';
  const contourSearchInput = document.getElementById('contourSearchInput');
  const contourUpBtn = document.getElementById('contourUpBtn');
  const contourDownBtn = document.getElementById('contourDownBtn');
  const contourSameBtn = document.getElementById('contourSameBtn');
  const deleteContourBtn = document.getElementById('deleteContourBtn');
  const clearContourBtn = document.getElementById('clearContourBtn');
  
  function updateContourDisplay() {
    if (contourSearchInput) {
      contourSearchInput.value = contourPattern;
    }
  }
  
  if (contourUpBtn) {
    contourUpBtn.addEventListener('click', function() {
      contourPattern += '+';
      updateContourDisplay();
    });
  }
  
  if (contourDownBtn) {
    contourDownBtn.addEventListener('click', function() {
      contourPattern += '-';
      updateContourDisplay();
    });
  }
  
  if (contourSameBtn) {
    contourSameBtn.addEventListener('click', function() {
      contourPattern += '=';
      updateContourDisplay();
    });
  }
  
  if (deleteContourBtn) {
    deleteContourBtn.addEventListener('click', function() {
      if (contourPattern.length > 0) {
        contourPattern = contourPattern.slice(0, -1);
        updateContourDisplay();
      }
    });
  }
  
  if (clearContourBtn) {
    clearContourBtn.addEventListener('click', function() {
      contourPattern = '';
      updateContourDisplay();
    });
  }
  
  // Search by contour
  async function searchMelodiesByContour(contour) {
    if (!contour || contour.trim().length === 0) {
      melodySearchResults.innerHTML = '<div style="padding:20px;text-align:center;color:#555;">Build a contour pattern using the buttons above to search for matching melodies.</div>';
      return;
    }
    
    if (contour.length < 2) {
      melodySearchResults.innerHTML = '<div style="padding:20px;text-align:center;color:#d32f2f;">Please enter at least 2 contour symbols.</div>';
      return;
    }
    
    // Show loading state
    melodySearchResults.innerHTML = '<div style="padding:20px;text-align:center;color:#555;">Searching for contour: ' + contour + '...</div>';
    
    try {
      // Call server-side search
      const url = `searchMelodiesContour.xq?contour=${encodeURIComponent(contour)}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Search failed: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      displayMelodySearchResults(data.results || []);
      
    } catch (error) {
      console.error('Contour search error:', error);
      melodySearchResults.innerHTML = '<div style="padding:20px;text-align:center;color:#d32f2f;">Search failed. Please try again.</div>';
    }
  }

  // Search button click handler
  if (executeMelodySearchBtn && melodySearchInput) {
    executeMelodySearchBtn.addEventListener('click', function() {
      if (currentSearchMode === 'pitch') {
        searchMelodies(melodySearchInput.value);
      } else if (currentSearchMode === 'contour') {
        searchMelodiesByContour(contourPattern);
      }
    });
  }
  
  // Also allow Enter key in search input to trigger search
  if (melodySearchInput) {
    melodySearchInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        searchMelodies(this.value);
      }
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', domContentLoadedHandlerMelodySearch);
} else {
  domContentLoadedHandlerMelodySearch();
}
