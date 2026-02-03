# PDF Generator

A Node.js script that generates large PDF documents with high-resolution programmatically generated images on each page.

## Installation

Install dependencies:

```bash
npm install
```

**Note:** This script uses only pure JavaScript libraries (no native dependencies required), so installation should work on all platforms without additional setup.

## Usage

Generate a PDF with default 100 pages:

```bash
node generate-pdf.js
```

Generate a PDF with a specific number of pages:

```bash
node generate-pdf.js --pages 50
# or
node generate-pdf.js -p 200
```

## Output

The script generates `output.pdf` in the `generator` folder. Each page contains:
- A high-resolution image (2480x3508 pixels, 300 DPI)
- Unique colorful gradient background with geometric patterns
- Page number embedded in the image
- Page number overlay in the top-left corner
- Total pages indicator at the bottom

## Features

- Configurable page count via command-line arguments
- High-resolution images suitable for printing (300 DPI)
- A4 page size (210mm x 297mm)
- Unique visual design on each page
- Progress indicator during generation
