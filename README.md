# BulkCertify

BulkCertify generates certificates from a DOCX template and an Excel sheet.

## Output formats

- DOCX: downloads filled Word files as a ZIP
- PDF: downloads filled PDF files as a ZIP

## How it works

1. Upload a DOCX template.
2. Upload an Excel file with the names.
3. Choose DOCX or PDF.
4. Click generate.

## Template placeholder

Use a placeholder like `{{NAME}}` in your DOCX template.
The app replaces it with each name from the Excel file.

## Notes

- All generation happens in your browser.
- PDF output is saved as a real `.pdf` file.
- No server setup is required.
