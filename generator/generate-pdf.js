const PDFDocument = require('pdfkit');
const Jimp = require('jimp');
const fs = require('fs');
const path = require('path');

// Parse command-line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  let pageCount = 900; // default

  for (let i = 0; i < args.length; i++) {
    if ((args[i] === '--pages' || args[i] === '-p') && args[i + 1]) {
      pageCount = parseInt(args[i + 1], 10);
      if (isNaN(pageCount) || pageCount < 1) {
        console.error('Error: Page count must be a positive number');
        process.exit(1);
      }
      break;
    }
  }

  return pageCount;
}

// Convert HSL to RGB
function hslToRgb(h, s, l) {
  h /= 360;
  s /= 100;
  l /= 100;
  
  let r, g, b;
  
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  
  return [
    Math.round(r * 255),
    Math.round(g * 255),
    Math.round(b * 255)
  ];
}

// Convert RGB array to hex string
function rgbToHex(r, g, b) {
  return `#${[r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('')}`;
}

// Generate a high-resolution raster image template (generate once, reuse everywhere)
async function generateImageTemplate(largeFont, smallFont) {
  // Very high resolution: 4000x6000 pixels (much larger than A4 at 300 DPI)
  // This will create a much larger file size
  const width = 4000;
  const height = 6000;
  
  // Create a solid color background
  const rgb = hslToRgb(200, 70, 60); // Nice blue color
  const color = Jimp.rgbaToInt(rgb[0], rgb[1], rgb[2], 255);
  
  // Create image with solid color fill (much faster than gradient scan)
  const image = new Jimp(width, height, color);
  
  // Add generic text (no page-specific content needed)
  const pageText = `Page`;
  
  // Draw white background for text using composite
  const textWidth = Jimp.measureText(largeFont, pageText);
  const textHeight = Jimp.measureTextHeight(largeFont, pageText);
  const padding = 40;
  const textX = Math.max(0, (width - textWidth) / 2 - padding);
  const textY = Math.max(0, (height - textHeight) / 2 - padding);
  
  // Create white background rectangle
  const bgWidth = Math.min(textWidth + padding * 2, width - textX);
  const bgHeight = Math.min(textHeight + padding * 2, height - textY);
  const bg = new Jimp(bgWidth, bgHeight, 0xFFFFFFFF);
  bg.opacity(0.9);
  image.composite(bg, textX, textY);
  
  // Draw text
  image.print(largeFont, textX + padding, textY + padding, {
    text: pageText,
    alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
    alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE
  }, textWidth, textHeight);
  
  // Get image buffer with minimal compression (quality 100)
  // Using PNG format which is uncompressed/lossless for maximum file size
  return await image.getBufferAsync(Jimp.MIME_PNG);
}

// Draw a page with embedded high-resolution image (reusing pre-generated image)
function drawPage(doc, pageNumber, totalPages, pageWidth, pageHeight, imageBuffer) {
  // Reuse the same high-resolution image buffer for all pages
  // This embeds the entire large image data, significantly increasing file size
  doc.image(imageBuffer, {
    fit: [pageWidth, pageHeight],
    align: 'center',
    valign: 'center'
  });
  
  // Optionally embed the same image multiple times per page for even larger file size
  // Uncomment below to embed 3 copies of the image per page (triples the size per page)
  /*
  doc.save();
  doc.opacity(0.1);
  doc.image(imageBuffer, {
    fit: [pageWidth, pageHeight],
    align: 'center',
    valign: 'center'
  });
  doc.image(imageBuffer, {
    fit: [pageWidth, pageHeight],
    align: 'center',
    valign: 'center'
  });
  doc.restore();
  */
  
  // Add page number overlay in corner
  doc.fontSize(12)
     .fillColor('black')
     .text(`Page ${pageNumber}`, 50, 50, {
       align: 'left',
       width: 100
     });
}

// Main function to generate PDF
async function generatePDF(pageCount) {
  console.log(`Generating PDF with ${pageCount} pages...`);
  console.log('Loading fonts...');
  
  // Cache fonts once at startup (major speed improvement)
  const largeFont = await Jimp.loadFont(Jimp.FONT_SANS_128_BLACK);
  const smallFont = await Jimp.loadFont(Jimp.FONT_SANS_64_WHITE);
  console.log('Fonts loaded.');
  
  console.log('Generating image template (this will be reused for all pages)...');
  // Generate image ONCE and reuse for all pages (major speed optimization!)
  const imageBuffer = await generateImageTemplate(largeFont, smallFont);
  console.log('Image template generated. Starting PDF generation...');
  
  const outputPath = path.join(__dirname, 'data', 'output.pdf');
  const doc = new PDFDocument({
    size: 'A4',
    margin: 0
  });

  const stream = fs.createWriteStream(outputPath);
  doc.pipe(stream);

  // A4 dimensions in points (72 DPI)
  const pageWidth = 595.28;
  const pageHeight = 841.89;

  // Generate each page (reusing the same image buffer)
  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    if (pageNum > 1) {
      doc.addPage();
    }

    // Draw the page content with high-resolution embedded image (reusing cached image)
    drawPage(doc, pageNum, pageCount, pageWidth, pageHeight, imageBuffer);

    // Progress indicator
    if (pageNum % 10 === 0 || pageNum === pageCount) {
      console.log(`Progress: ${pageNum}/${pageCount} pages (${Math.round((pageNum / pageCount) * 100)}%)`);
    }
  }

  doc.end();

  return new Promise((resolve, reject) => {
    stream.on('finish', () => {
      console.log(`\nPDF generated successfully: ${outputPath}`);
      const stats = fs.statSync(outputPath);
      const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
      console.log(`File size: ${fileSizeMB} MB`);
      resolve(outputPath);
    });

    stream.on('error', (err) => {
      reject(err);
    });
  });
}

// Run the generator
const pageCount = parseArgs();
generatePDF(pageCount)
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Error generating PDF:', err);
    process.exit(1);
  });
