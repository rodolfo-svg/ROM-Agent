/**
 * Generate iOS Splash Screens for PWA
 * Supports all iPhone models (8 to 14 Pro Max)
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// iOS device specifications
const DEVICES = [
  { name: 'iphone-14-pro-max-portrait', width: 1290, height: 2796 },
  { name: 'iphone-14-pro-portrait', width: 1179, height: 2556 },
  { name: 'iphone-13-portrait', width: 1170, height: 2532 },
  { name: 'iphone-x-portrait', width: 1125, height: 2436 },
  { name: 'iphone-11-portrait', width: 828, height: 1792 },
  { name: 'iphone-8-portrait', width: 750, height: 1334 },
];

// Colors from ROM Agent branding
const BACKGROUND_COLOR = '#FAFAF9'; // stone-50
const LOGO_COLOR = '#D97706'; // bronze-400

const publicDir = path.join(__dirname, '../public');
const splashDir = path.join(publicDir, 'splash');
const iconPath = path.join(publicDir, 'icons/icon-512x512.png');

async function generateSplashScreen(device) {
  try {
    console.log(`Generating splash screen for ${device.name}...`);

    // Create a background
    const svg = `
      <svg width="${device.width}" height="${device.height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="${device.width}" height="${device.height}" fill="${BACKGROUND_COLOR}"/>
        <text
          x="50%"
          y="55%"
          font-family="system-ui, -apple-system, sans-serif"
          font-size="48"
          font-weight="600"
          fill="${LOGO_COLOR}"
          text-anchor="middle"
          dominant-baseline="middle">
          ROM Agent
        </text>
        <text
          x="50%"
          y="60%"
          font-family="system-ui, -apple-system, sans-serif"
          font-size="20"
          fill="#78716C"
          text-anchor="middle"
          dominant-baseline="middle">
          Assistente Jurídico Inteligente
        </text>
      </svg>
    `;

    // Create splash screen
    const outputPath = path.join(splashDir, `${device.name}.png`);

    await sharp(Buffer.from(svg))
      .resize(device.width, device.height, {
        fit: 'contain',
        background: BACKGROUND_COLOR
      })
      .png()
      .toFile(outputPath);

    console.log(`✅ Created: ${device.name}.png (${device.width}x${device.height})`);
  } catch (error) {
    console.error(`❌ Error generating ${device.name}:`, error.message);
  }
}

async function main() {
  console.log('🎨 Generating iOS Splash Screens for ROM Agent PWA\n');

  // Create splash directory if it doesn't exist
  if (!fs.existsSync(splashDir)) {
    fs.mkdirSync(splashDir, { recursive: true });
    console.log('📁 Created splash/ directory\n');
  }

  // Generate all splash screens
  for (const device of DEVICES) {
    await generateSplashScreen(device);
  }

  console.log('\n✅ All splash screens generated successfully!');
  console.log(`📁 Location: ${splashDir}`);
}

// Run
main().catch(console.error);
