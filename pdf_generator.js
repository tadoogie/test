// Assume 'tk' is your initialized Verovio Toolkit instance, e.g.:
// let tk = new verovio.Toolkit();
// tk.loadData(your_mei_string); // Make sure your MEI data is loaded into tk

const printPdfButton = document.getElementById('printPdfButton');

if (printPdfButton) {
    printPdfButton.addEventListener('click', async () => {
        console.log("Print Preview PDF button clicked (client-side Verovio PDF).");

        // Ensure Verovio Toolkit (tk) is initialized and MEI data is loaded
        if (!tk || typeof tk.renderToPDF !== 'function' || tk.getMEI() === '') {
            alert("Verovio is not ready or does not support PDF rendering, or no MEI data loaded. Please check your Verovio Toolkit version.");
            console.error("Verovio Toolkit issues. Is 'tk.renderToPDF' a function? Is MEI loaded?");
            return;
        }

        const currentMEI = tk.getMEI(); // Get the current MEI XML string from the toolkit

        try {
            console.log("Generating PDF using Verovio Toolkit...");

            // Use tk.renderToPDF() directly.
            // This method returns an ArrayBuffer containing the PDF data.
            const pdfArrayBuffer = await tk.renderToPDF(currentMEI, {
                // You can add Verovio rendering options here for PDF output.
                // These are similar to those for SVG, but tailored for print layout.
                // Examples to consider for print quality:
                // scale: 40,        // Adjust overall scaling for print
                // pageWidth: 1000,  // Verovio units (e.g., 1000 for standard score width)
                // pageHeight: 1500, // Verovio units (e.g., 1500 for standard score height)
                // page: 'all',      // Very important: Renders ALL pages of the score for the PDF
                // adjustPageHeight: true, // Adjusts page height to fit content if true
                // header: 1,        // Add page numbers in the header
                // footer: 1         // Add page numbers in the footer
            });

            console.log("PDF ArrayBuffer generated. Size:", pdfArrayBuffer.byteLength, "bytes.");

            // Convert the ArrayBuffer to a Blob
            const pdfBlob = new Blob([pdfArrayBuffer], { type: 'application/pdf' });

            // Create a temporary URL for the Blob
            const pdfUrl = URL.createObjectURL(pdfBlob);

            // Create a temporary link element to trigger the download
            const a = document.createElement('a');
            a.href = pdfUrl;
            a.download = 'music_score_verovio.pdf'; // Suggested filename
            document.body.appendChild(a); // Append to body (required for Firefox to trigger click)
            a.click(); // Programmatically click the link to start download
            document.body.removeChild(a); // Clean up the temporary link
            URL.revokeObjectURL(pdfUrl); // Release the temporary URL resource

            console.log("PDF 'music_score_verovio.pdf' downloaded.");

        } catch (error) {
            console.error("Error generating PDF with Verovio Toolkit:", error);
            alert("Failed to generate PDF. Please ensure your Verovio Toolkit version supports PDF rendering and check the console for details.");
        }
    });
}
