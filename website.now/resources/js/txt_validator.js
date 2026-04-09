(function() {
    var fileInput = document.getElementById("textFile");
    var form = document.getElementById("teiUploadForm");
    var result = document.getElementById("validationResult");

    if (!fileInput || !form || !result) {
        return;
    }

    function isValidMetre(raw) {
        var metre = raw.trim();
        if (metre === "CM" || metre === "LM" || metre === "SM") {
            return true;
        }
        return /^(\d{1,2})([.\s]+\d{1,2})*$/.test(metre);
    }

    function validateText(text, fileName) {
        var errors = [];
        var warnings = [];

        if (!/\.txt$/i.test(fileName)) {
            errors.push("File extension should be .txt");
        }
        if (text.indexOf("\t") !== -1) {
            warnings.push("Tabs detected. Replace tabs with spaces for safer parsing.");
        }

        var lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
        var headerPattern = /^Psalm\s+(.+?)\s*(?:[^\w\s])?\s*\(([^)]+)\)\s*$/i;
        var verseStartPattern = /^\d+(?:[.)])?\s+.+$/;
        var editionMetaPattern = /^\s*(Long Title|Short Title|Publisher|Date)\s*:\s*.*$/i;

        var headerIndices = [];
        var firstHeaderIndex = -1;
        var i;
        for (i = 0; i < lines.length; i++) {
            if (headerPattern.test(lines[i].trim())) {
                headerIndices.push(i);
                if (firstHeaderIndex === -1) {
                    firstHeaderIndex = i;
                }
            }
        }

        if (headerIndices.length === 0) {
            errors.push("No valid psalm headers found. Expected lines like: Psalm 21 (CM) or Psalm 1A(88 88 88)");
        }

        if (firstHeaderIndex > 0) {
            for (i = 0; i < firstHeaderIndex; i++) {
                var preface = lines[i].trim();
                if (preface === "") {
                    continue;
                }
                if (!editionMetaPattern.test(preface)) {
                    errors.push("Unexpected content before first psalm header at line " + (i + 1) + ".");
                }
            }
        }

        for (i = 0; i < headerIndices.length; i++) {
            var headerLineNo = headerIndices[i] + 1;
            var headerLine = lines[headerIndices[i]].trim();
            var match = headerPattern.exec(headerLine);
            var metre = match ? match[2] : "";

            if (match && !isValidMetre(metre)) {
                errors.push("Invalid metre at line " + headerLineNo + ": " + metre);
            }

            var afterHeader = lines[headerIndices[i] + 1];
            if (typeof afterHeader !== "undefined" && afterHeader.trim() !== "") {
                warnings.push("Line " + (headerLineNo + 1) + ": expected a blank line after header.");
            }
        }

        for (i = 0; i < lines.length; i++) {
            var current = lines[i].trim();
            if (current === "") {
                continue;
            }
            if (headerPattern.test(current)) {
                continue;
            }
            if (firstHeaderIndex !== -1 && i < firstHeaderIndex && editionMetaPattern.test(current)) {
                continue;
            }
            var prev = i > 0 ? lines[i - 1].trim() : "";
            if (prev === "" || headerPattern.test(prev)) {
                if (!verseStartPattern.test(current)) {
                    errors.push("Stanza/verse start at line " + (i + 1) + " must start with a verse number.");
                }
            }
        }

        return {
            valid: errors.length === 0,
            errors: errors,
            warnings: warnings
        };
    }

    function showValidation(report) {
        result.style.display = "block";
        if (report.valid) {
            var warningsHtml = "";
            if (report.warnings.length > 0) {
                warningsHtml = "<p><strong>Warnings:</strong></p><ul><li>" + report.warnings.join("</li><li>") + "</li></ul>";
            }
            result.style.background = "#eefaf0";
            result.style.border = "1px solid #9ad3a2";
            result.innerHTML = "<p><strong>Validation successful.</strong> File looks compatible with the TEI generator.</p>" + warningsHtml;
        } else {
            var warnings = report.warnings.length > 0
                ? "<p><strong>Warnings:</strong></p><ul><li>" + report.warnings.join("</li><li>") + "</li></ul>"
                : "";
            result.style.background = "#fff1f0";
            result.style.border = "1px solid #e5a09a";
            result.innerHTML = "<p><strong>Validation failed.</strong> Please fix the following before upload:</p><ul><li>" + report.errors.join("</li><li>") + "</li></ul>" + warnings;
        }
    }

    function validateSelectedFile(callback) {
        var file = fileInput.files && fileInput.files[0];
        if (!file) {
            result.style.display = "none";
            if (callback) {
                callback({ valid: false, errors: ["No file selected."], warnings: [] });
            }
            return;
        }
        var reader = new FileReader();
        reader.onload = function(evt) {
            var text = String(evt.target.result || "");
            var report = validateText(text, file.name || "");
            showValidation(report);
            if (callback) {
                callback(report);
            }
        };
        reader.onerror = function() {
            var report = { valid: false, errors: ["Could not read the file."], warnings: [] };
            showValidation(report);
            if (callback) {
                callback(report);
            }
        };
        reader.readAsText(file, "UTF-8");
    }

    fileInput.addEventListener("change", function() {
        validateSelectedFile();
    });

    form.addEventListener("submit", function(e) {
        e.preventDefault();
        validateSelectedFile(function(report) {
            if (report.valid) {
                var file = fileInput.files && fileInput.files[0];
                if (!file) {
                    form.submit();
                    return;
                }

                var reader = new FileReader();
                reader.onload = function(evt) {
                    var text = String(evt.target.result || "");
                    var hiddenText = document.getElementById("textContentFallback");
                    var hiddenName = document.getElementById("fileNameFallback");

                    if (!hiddenText) {
                        hiddenText = document.createElement("input");
                        hiddenText.type = "hidden";
                        hiddenText.id = "textContentFallback";
                        hiddenText.name = "textContent";
                        form.appendChild(hiddenText);
                    }
                    if (!hiddenName) {
                        hiddenName = document.createElement("input");
                        hiddenName.type = "hidden";
                        hiddenName.id = "fileNameFallback";
                        hiddenName.name = "fileName";
                        form.appendChild(hiddenName);
                    }

                    hiddenText.value = text;
                    hiddenName.value = file.name || "upload.txt";
                    form.submit();
                };
                reader.onerror = function() {
                    form.submit();
                };
                reader.readAsText(file, "UTF-8");
            }
        });
    });
})();
