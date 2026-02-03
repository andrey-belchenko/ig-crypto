const PDFDocument = require('pdfkit');
const Jimp = require('jimp');
const fs = require('fs');
const path = require('path');

// Parse command-line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  let pageCount = 100; // default

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

// Generate a high-resolution raster image using Jimp
async function generateHighResImage(pageNumber, totalPages) {
  // Very high resolution: 4000x6000 pixels (much larger than A4 at 300 DPI)
  // This will create a much larger file size
  const width = 4000;
  const height = 6000;
  
  // Create image with Jimp
  const image = new Jimp(width, height);
  
  // Create a unique color scheme for each page
  const hue = (pageNumber * 137.508) % 360;
  
  // Draw gradient background using scan for better performance
  // Pre-calculate gradient colors
  const color1 = hslToRgb(hue, 70, 60);
  const color2 = hslToRgb((hue + 60) % 360, 80, 50);
  const color3 = hslToRgb((hue + 120) % 360, 70, 55);
  
  image.scan(0, 0, width, height, function (x, y, idx) {
    const t = y / height;
    let r, g, b;
    
    if (t < 0.5) {
      const localT = t * 2;
      r = Math.round(color1[0] * (1 - localT) + color2[0] * localT);
      g = Math.round(color1[1] * (1 - localT) + color2[1] * localT);
      b = Math.round(color1[2] * (1 - localT) + color2[2] * localT);
    } else {
      const localT = (t - 0.5) * 2;
      r = Math.round(color2[0] * (1 - localT) + color3[0] * localT);
      g = Math.round(color2[1] * (1 - localT) + color3[1] * localT);
      b = Math.round(color2[2] * (1 - localT) + color3[2] * localT);
    }
    
    this.bitmap.data[idx] = r;     // R
    this.bitmap.data[idx + 1] = g; // G
    this.bitmap.data[idx + 2] = b; // B
    this.bitmap.data[idx + 3] = 255; // A
  });
  
  // Add geometric patterns - circles using scan for better performance
  const centerY = height / 2;
  image.scan(0, 0, width, height, function (x, y, idx) {
    // Check if pixel is inside any circle
    for (let i = 0; i < 5; i++) {
      const centerX = (width / 6) * (i + 1);
      const radius = 300 + (i * 100);
      const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
      
      if (dist < radius) {
        // Blend with white (semi-transparent overlay)
        this.bitmap.data[idx] = Math.round(this.bitmap.data[idx] * 0.7 + 255 * 0.3);
        this.bitmap.data[idx + 1] = Math.round(this.bitmap.data[idx + 1] * 0.7 + 255 * 0.3);
        this.bitmap.data[idx + 2] = Math.round(this.bitmap.data[idx + 2] * 0.7 + 255 * 0.3);
        break;
      }
    }
    
    // Check if pixel is near diagonal lines
    for (let i = 0; i < 8; i++) {
      const x1 = (width / 9) * i;
      const y1 = 0;
      const x2 = width;
      const y2 = (height / 8) * (i + 1);
      
      // Distance from point to line segment
      const A = x - x1;
      const B = y - y1;
      const C = x2 - x1;
      const D = y2 - y1;
      const dot = A * C + B * D;
      const lenSq = C * C + D * D;
      let param = -1;
      if (lenSq !== 0) param = dot / lenSq;
      
      let xx, yy;
      if (param < 0) {
        xx = x1;
        yy = y1;
      } else if (param > 1) {
        xx = x2;
        yy = y2;
      } else {
        xx = x1 + param * C;
        yy = y1 + param * D;
      }
      
      const dx = x - xx;
      const dy = y - yy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < 20) {
        // Darken line
        this.bitmap.data[idx] = Math.round(this.bitmap.data[idx] * 0.8);
        this.bitmap.data[idx + 1] = Math.round(this.bitmap.data[idx + 1] * 0.8);
        this.bitmap.data[idx + 2] = Math.round(this.bitmap.data[idx + 2] * 0.8);
        break;
      }
    }
  });
  
  // Add page number text (large, detailed)
  const font = await Jimp.loadFont(Jimp.FONT_SANS_128_BLACK);
  const pageText = `Page ${pageNumber}`;
  
  // Draw white background for text using composite
  const textWidth = Jimp.measureText(font, pageText);
  const textHeight = Jimp.measureTextHeight(font, pageText);
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
  image.print(font, textX + padding, textY + padding, {
    text: pageText,
    alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
    alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE
  }, textWidth, textHeight);
  
  // Add total pages at bottom
  const smallFont = await Jimp.loadFont(Jimp.FONT_SANS_64_WHITE);
  const totalText = `${pageNumber} / ${totalPages}`;
  const totalTextWidth = Jimp.measureText(smallFont, totalText);
  image.print(smallFont, (width - totalTextWidth) / 2, height - 200, totalText);
  
  // Get image buffer with minimal compression (quality 100)
  // Using PNG format which is uncompressed/lossless for maximum file size
  return await image.getBufferAsync(Jimp.MIME_PNG);
}

// Draw a page with embedded high-resolution image
async function drawPage(doc, pageNumber, totalPages, pageWidth, pageHeight) {
  // Generate high-resolution raster image
  const imageBuffer = await generateHighResImage(pageNumber, totalPages);
  
  // Embed the high-resolution image (full page, scaled to fit)
  // This embeds the entire large image data, significantly increasing file size
  doc.image(imageBuffer, {
    fit: [pageWidth, pageHeight],
    align: 'center',
    valign: 'center'
  });
  
  // Optionally add multiple layers of the same image for even larger file size
  // Uncomment the lines below to add additional image layers (increases size further)
  /*
  doc.save();
  doc.opacity(0.1);
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
  
  const outputPath = path.join(__dirname, 'output.pdf');
  const doc = new PDFDocument({
    size: 'A4',
    margin: 0
  });

  const stream = fs.createWriteStream(outputPath);
  doc.pipe(stream);

  // A4 dimensions in points (72 DPI)
  const pageWidth = 595.28;
  const pageHeight = 841.89;

  // Generate each page
  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    if (pageNum > 1) {
      doc.addPage();
    }

    // Draw the page content with high-resolution embedded image
    await drawPage(doc, pageNum, pageCount, pageWidth, pageHeight);

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
