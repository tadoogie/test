window.INTERFACE_DEV_BUILD = '2025-10-28-2';

/* ----------------------------- URL parameter application ----------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  try { applyURLParametersToForm(); } catch(e) { console.warn('applyURLParametersToForm error', e); }
});

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
document.addEventListener("DOMContentLoaded", function() {
  function setupModalCloseOnOutsideClick(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.addEventListener("click", function(e) {
      if (e.target === modal) modal.style.display = "none";
    });
  }
  setupModalCloseOnOutsideClick("shareModal");
  setupModalCloseOnOutsideClick("paperSizeModal");
});

/* ----------------------------- Share modal wiring ----------------------------- */
document.addEventListener("DOMContentLoaded", function() {
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
});

/* ----------------------------- Sound menu ----------------------------- */
let urlParamsUsed = false;

document.addEventListener("DOMContentLoaded", function() {
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
});

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

  var urlVariable = encodeURI("/getTunes.xq?metre=" + metre + "&suggTune=" + suggTune + "&teiID=" + teiID);

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
      document.querySelectorAll('.source-button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      hiddenInput.value = label;
      handleSourceSelection(label);
    });

    sourceContainer.appendChild(btn);
  });

  if (hiddenInput.value) {
    const existing = Array.from(sourceContainer.querySelectorAll('.source-button'))
      .find(b => b.getAttribute('data-source-label') === hiddenInput.value);
    if (existing) existing.click();
  }
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
    // Hide search link
    const searchContainer = document.getElementById('searchPhraseContainer');
    if (searchContainer) searchContainer.style.display = 'none';
    return;
  }

  // Show search link when texts are available
  const searchContainer = document.getElementById('searchPhraseContainer');
  if (searchContainer) searchContainer.style.display = 'block';

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

  try { ensureNextButton(verseSection || versesEl.parentElement, 'next-btn-text', () => switchToTab('tune')); } catch (_) {}
  try { updateSelectionSummary(); } catch (_) {}
}

/* ----------------------------- Tab navigation and sidenav open/close ----------------------------- */
document.addEventListener("DOMContentLoaded", function() {
  initializeTabNavigation();
});

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
document.addEventListener('DOMContentLoaded', function ensureSidenavStyles() {
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
});

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
  srcOut.textContent = sourceVal || "Select Source";

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

document.addEventListener("DOMContentLoaded", function () {
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
});

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

function hideNextButton(id) {
  const btn = document.getElementById(id);
  if (btn) btn.style.display = 'none';
}

document.addEventListener('DOMContentLoaded', function () {
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
});

let versesObserver;
function watchForVersesAndShowNext() {
  const verses = document.getElementById('verses');
  if (!verses) return;
  if (versesObserver) versesObserver.disconnect();
  versesObserver = new MutationObserver(function () {
    if (verses.childElementCount > 0 || verses.textContent.trim().length > 0) {
      const verseSection = document.getElementById('VerseSection') || verses.parentElement;
      ensureNextButton(verseSection, 'next-btn-text', () => switchToTab('tune'));
      try { updateSelectionSummary(); } catch (_) {}
      versesObserver.disconnect();
    }
  });
  versesObserver.observe(verses, { childList: true, subtree: true, characterData: true });
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
  const tuneInput = document.getElementById('pstune');
  const anchor = document.getElementById('tunes');
  if (!tuneInput || !anchor) return;
  const chosen = (tuneInput.dataset && tuneInput.dataset.tuneid) || tuneInput.value.trim();
  if (chosen) {
    ensureNextButtonAfter(anchor, 'next-btn-tune', () => switchToTab('options'));
  } else {
    hideNextButton('next-btn-tune');
  }
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

document.addEventListener('DOMContentLoaded', function () {
  const tunesContainer = document.getElementById('tunes');
  if (!tunesContainer) return;
  const ob = new MutationObserver(() => { maybeShowNextForTune(); });
  ob.observe(tunesContainer, { childList: true, subtree: true });
});

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
document.addEventListener("DOMContentLoaded", function() {
  try { addTopTabTooltips(); } catch(e) {}
});

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
document.addEventListener("DOMContentLoaded", function() {
  try { wireTopTabTooltipDismissal(); } catch(e) {}
});

/* ----------------------------- Startup: fetch consolidated data ----------------------------- */
document.addEventListener('DOMContentLoaded', function() {
  try { fetchConsolidatedData(); } catch (e) { console.warn('fetchConsolidatedData failed', e); }
});

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

document.addEventListener('DOMContentLoaded', function() {
  // Use a slight delay to ensure all dynamic content is loaded first
  setTimeout(function() {
    initializeTextAccordion();
    initializeVerseAccordion();
  }, 100);
});

/* ----------------------------- Text Search Modal ----------------------------- */
document.addEventListener("DOMContentLoaded", function() {
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

  // Get current source name
  function getCurrentSource() {
    const sourceInput = document.getElementById('pssource');
    return sourceInput ? sourceInput.value : '';
  }

  // Search through psalms using XQuery endpoint
  async function searchPsalms(query) {
    if (!query || query.trim().length === 0) {
      showSearchInstructions();
      return;
    }

    // Show loading state
    searchResults.innerHTML = '<div style="padding:20px;text-align:center;color:#555;">Searching...</div>';

    const source = getCurrentSource();
    if (!source) {
      searchResults.innerHTML = '<div style="padding:20px;text-align:center;color:#555;">Please select a source first.</div>';
      return;
    }

    try {
      // Call XQuery endpoint with search parameters
      const url = `/searchPsalms.xq?query=${encodeURIComponent(query.trim())}&source=${encodeURIComponent(source)}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }

      const data = await response.json();
      const results = data.results || [];

      // Highlight the query in snippets
      const highlightedResults = results.map(result => {
        let snippet = result.snippet || '';
        
        // Highlight the match (case-insensitive and accent-insensitive)
        const normalizedSnippet = normalizeStringForSearch(snippet);
        const normalizedQuery = normalizeStringForSearch(query.trim());
        const matchStartInSnippet = normalizedSnippet.indexOf(normalizedQuery);
        
        if (matchStartInSnippet !== -1) {
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
          snippet = beforeMatch + '<mark style="background:#ffd966;">' + match + '</mark>' + afterMatch;
        }

        return {
          id: result.id,
          label: result.label,
          data: result.data,
          snippet: snippet
        };
      });

      // Display results
      displaySearchResults(highlightedResults, query);

    } catch (error) {
      console.error('Search error:', error);
      searchResults.innerHTML = '<div style="padding:20px;text-align:center;color:#555;">Search error. Please try again.</div>';
    }
  }

  // Display search results
  function displaySearchResults(results, query) {
    if (!searchResults) return;

    if (results.length === 0) {
      searchResults.innerHTML = '<div style="padding:20px;text-align:center;color:#555;">No results found for "' + query + '"</div>';
      return;
    }

    let html = '<div style="margin-bottom:10px;color:#555;font-size:0.9em;">Found ' + results.length + ' result' + (results.length > 1 ? 's' : '') + '</div>';
    
    results.forEach(result => {
      html += '<div class="search-result-item" data-label="' + result.label + '" data-psdata="' + result.data + '" style="padding:12px;margin:8px 0;background:#f5f5f5;border-radius:6px;cursor:pointer;border:1px solid #ddd;">';
      html += '<div style="font-weight:700;margin-bottom:6px;color:#333;">' + result.label + '</div>';
      html += '<div style="color:#555;font-size:0.9em;">' + result.snippet + '</div>';
      html += '</div>';
    });

    searchResults.innerHTML = html;

    // Add click handlers to results
    const resultItems = searchResults.querySelectorAll('.search-result-item');
    resultItems.forEach(item => {
      item.addEventListener('click', function() {
        const label = this.getAttribute('data-label');
        const psdata = this.getAttribute('data-psdata');
        selectPsalmFromSearch(label, psdata);
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

  // Select psalm from search results
  function selectPsalmFromSearch(label, psdata) {
    // Close modal
    if (searchModal) {
      searchModal.style.display = "none";
      searchInput.value = "";
      searchResults.innerHTML = "";
    }

    // Find the psalm button and click it
    const textsContainer = document.getElementById('texts');
    if (textsContainer) {
      const psalms = textsContainer.querySelectorAll('.psalm-btn');
      psalms.forEach(btn => {
        if (btn.dataset.label === label) {
          btn.click();
          return;
        }
      });
    }
  }

  // Real-time search as user types
  if (searchInput) {
    let searchTimeout;
    searchInput.addEventListener('input', function() {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        searchPsalms(this.value);
      }, 300); // Debounce by 300ms
    });
  }
});
