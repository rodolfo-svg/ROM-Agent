/**
 * Script para gerar PNGs a partir do SVG base
 * Usado para PWA icons - Android installability
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ICONS_DIR = path.join(__dirname, '../public/icons');
const SVG_SOURCE = path.join(ICONS_DIR, 'icon-512x512.svg');

const SIZES = [
  { size: 192, name: 'icon-192x192.png' },
  { size: 512, name: 'icon-512x512.png' },
  { size: 180, name: 'icon-180x180.png' },
];

async function generateIcons() {
  console.log('Generating PNG icons from SVG...\n');

  // Verificar se SVG existe
  if (!fs.existsSync(SVG_SOURCE)) {
    console.error('SVG source not found:', SVG_SOURCE);
    process.exit(1);
  }

  // Ler SVG
  const svgBuffer = fs.readFileSync(SVG_SOURCE);

  for (const { size, name } of SIZES) {
    const outputPath = path.join(ICONS_DIR, name);

    try {
      await sharp(svgBuffer)
        .resize(size, size)
        .png()
        .toFile(outputPath);

      console.log(`Created: ${name} (${size}x${size})`);
    } catch (error) {
      console.error(`Error creating ${name}:`, error.message);
      process.exit(1);
    }
  }

  console.log('\nAll icons generated successfully!');
}

generateIcons().catch(console.error);
