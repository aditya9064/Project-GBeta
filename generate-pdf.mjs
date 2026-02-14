import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WIDTH = 1920;
const HEIGHT = 1080;

async function generatePDF() {
  console.log('🚀 Launching browser...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 2 });

  // CRITICAL: Force screen media type so PDF renders exactly like the browser
  await page.emulateMediaType('screen');

  const filePath = path.resolve(__dirname, 'pitch-deck.html');
  console.log(`📄 Loading: ${filePath}`);
  await page.goto(`file://${filePath}`, { waitUntil: 'networkidle0' });

  // Restyle the page for PDF: show all slides stacked, hide nav
  await page.evaluate(() => {
    // Hide navigation
    const nav = document.querySelector('.nav');
    if (nav) nav.remove();

    // Make logo per-slide (not fixed)
    const logo = document.querySelector('.logo');
    if (logo) logo.style.position = 'absolute';

    // Make the deck a normal flow container
    const deck = document.getElementById('deck');
    deck.style.width = '1920px';
    deck.style.height = 'auto';
    deck.style.overflow = 'visible';
    deck.style.position = 'relative';
    deck.style.display = 'flex';
    deck.style.flexDirection = 'column';

    // Body needs to allow scrolling for PDF generation
    document.body.style.overflow = 'visible';
    document.body.style.height = 'auto';
    document.body.style.width = '1920px';

    // Make every slide visible, sized to exactly one page, no overlap
    const slides = document.querySelectorAll('.slide');
    slides.forEach((slide, i) => {
      slide.style.position = 'relative';
      slide.style.opacity = '1';
      slide.style.pointerEvents = 'auto';
      slide.style.transform = 'none';
      slide.style.transition = 'none';
      slide.style.width = '1920px';
      slide.style.height = '1080px';
      slide.style.minHeight = '1080px';
      slide.style.maxHeight = '1080px';
      slide.style.overflow = 'hidden';
      slide.style.flexShrink = '0';
      slide.style.pageBreakAfter = 'always';
      slide.style.breakAfter = 'page';
      slide.classList.add('active');

      // Clone the logo into each slide so it appears on every page
      if (i > 0) {
        const logoClone = document.querySelector('.logo').cloneNode(true);
        logoClone.style.position = 'absolute';
        logoClone.style.top = '32px';
        logoClone.style.left = '48px';
        slide.appendChild(logoClone);
      }
    });

    // Add a style tag to ensure print CSS matches screen
    const style = document.createElement('style');
    style.textContent = `
      @page {
        size: 1920px 1080px;
        margin: 0;
      }
      @media print {
        body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        .slide { page-break-after: always; break-after: page; }
        .glow-orb { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      }
    `;
    document.head.appendChild(style);
  });

  // Let styles settle
  await new Promise(r => setTimeout(r, 500));

  console.log('📐 Generating PDF...');

  await page.pdf({
    path: path.resolve(__dirname, 'CrewOS-Pitch-Deck.pdf'),
    width: '1920px',
    height: '1080px',
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
    preferCSSPageSize: false,
    scale: 1,
  });

  console.log('✅ PDF saved: CrewOS-Pitch-Deck.pdf');
  await browser.close();
  console.log('🎉 Done!');
}

generatePDF().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});

