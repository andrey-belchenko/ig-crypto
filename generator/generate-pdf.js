const PDFDocument = require('pdfkit');
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

// Draw a page with high-resolution graphics directly in PDF
function drawPage(doc, pageNumber, totalPages, pageWidth, pageHeight) {
  // Create a unique color scheme for each page
  const hue = (pageNumber * 137.508) % 360; // Golden angle for color distribution
  
  // Calculate gradient colors
  const color1 = hslToRgb(hue, 70, 60);
  const color2 = hslToRgb((hue + 60) % 360, 80, 50);
  const color3 = hslToRgb((hue + 120) % 360, 70, 55);
  
  // Draw gradient background using multiple rectangles
  const gradientSteps = 100;
  for (let i = 0; i < gradientSteps; i++) {
    const t = i / (gradientSteps - 1);
    let r, g, b;
    
    if (t < 0.5) {
      // Interpolate between color1 and color2
      const localT = t * 2;
      r = Math.round(color1[0] * (1 - localT) + color2[0] * localT);
      g = Math.round(color1[1] * (1 - localT) + color2[1] * localT);
      b = Math.round(color1[2] * (1 - localT) + color2[2] * localT);
    } else {
      // Interpolate between color2 and color3
      const localT = (t - 0.5) * 2;
      r = Math.round(color2[0] * (1 - localT) + color3[0] * localT);
      g = Math.round(color2[1] * (1 - localT) + color3[1] * localT);
      b = Math.round(color2[2] * (1 - localT) + color3[2] * localT);
    }
    
    const y = (pageHeight / gradientSteps) * i;
    const height = pageHeight / gradientSteps;
    
    doc.rect(0, y, pageWidth, height)
       .fill(rgbToHex(r, g, b));
  }
  
  // Add geometric patterns - circles
  doc.save();
  doc.opacity(0.3);
  doc.strokeColor('white');
  doc.lineWidth(20);
  
  for (let i = 0; i < 5; i++) {
    const x = (pageWidth / 6) * (i + 1);
    const y = pageHeight / 2;
    const radius = 50 + (i * 15);
    
    doc.circle(x, y, radius)
       .stroke();
  }
  
  // Add diagonal lines
  doc.opacity(0.2);
  doc.strokeColor('black');
  doc.lineWidth(15);
  
  for (let i = 0; i < 8; i++) {
    const x1 = (pageWidth / 9) * i;
    const y1 = 0;
    const x2 = pageWidth;
    const y2 = (pageHeight / 8) * (i + 1);
    
    doc.moveTo(x1, y1)
       .lineTo(x2, y2)
       .stroke();
  }
  
  doc.restore();
  
  // Add page number in the center with background
  const pageText = `Page ${pageNumber}`;
  const fontSize = 72;
  
  doc.fontSize(fontSize)
     .font('Helvetica-Bold');
  
  const textWidth = doc.widthOfString(pageText);
  const textHeight = fontSize;
  const padding = 20;
  
  // Draw background rectangle
  doc.rect(
    pageWidth / 2 - textWidth / 2 - padding,
    pageHeight / 2 - textHeight / 2 - padding,
    textWidth + padding * 2,
    textHeight + padding * 2
  )
  .fillOpacity(0.9)
  .fill('white')
  .fillOpacity(1.0);
  
  // Draw page number text
  const textColor = hslToRgb(hue, 80, 30);
  doc.fillColor(rgbToHex(textColor[0], textColor[1], textColor[2]))
     .text(pageText, pageWidth / 2, pageHeight / 2 - textHeight / 2, {
       align: 'center',
       width: pageWidth
     });
  
  // Add total pages info at bottom
  const totalText = `${pageNumber} / ${totalPages}`;
  doc.fontSize(fontSize * 0.4)
     .fillColor('white')
     .fillOpacity(0.8)
     .text(totalText, pageWidth / 2, pageHeight - 50, {
       align: 'center',
       width: pageWidth
     })
     .fillOpacity(1.0);
  
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

    // Draw the page content directly
    drawPage(doc, pageNum, pageCount, pageWidth, pageHeight);

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
