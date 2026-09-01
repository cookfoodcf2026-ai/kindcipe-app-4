const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const ASSETS_DIR = path.join(__dirname, '..', 'assets');
const LOGO_PATH = path.join(ASSETS_DIR, 'logo-full.png');
const ICON_OUTPUT = path.join(ASSETS_DIR, 'icon.png');
const ADAPTIVE_ICON_OUTPUT = path.join(ASSETS_DIR, 'adaptive-icon.png');
const ICON_SIZE = 1024;
const BACKGROUND_COLOR = '#FFFFFF';

async function generateIcon() {
  try {
    console.log('📁 Reading logo file...');
    const logoMetadata = await sharp(LOGO_PATH).metadata();
    console.log(`   Logo dimensions: ${logoMetadata.width}x${logoMetadata.height}`);

    console.log('🎨 Creating white background...');
    const background = await sharp({
      create: {
        width: ICON_SIZE,
        height: ICON_SIZE,
        channels: 4,
        background: BACKGROUND_COLOR,
      },
    })
      .png()
      .toBuffer();

    console.log('🔧 Resizing and centering logo...');
    const logoSize = Math.floor(ICON_SIZE * 0.6);
    const logoResized = await sharp(LOGO_PATH)
      .resize(logoSize, logoSize, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();

    console.log('✨ Compositing logo onto background...');
    const composite = await sharp(background)
      .composite([
        {
          input: logoResized,
          gravity: 'center',
        },
      ])
      .png()
      .toBuffer();

    console.log('💾 Saving icon.png...');
    await sharp(composite).toFile(ICON_OUTPUT);
    console.log(`   ✅ Saved: ${ICON_OUTPUT}`);

    console.log('💾 Saving adaptive-icon.png...');
    await sharp(composite).toFile(ADAPTIVE_ICON_OUTPUT);
    console.log(`   ✅ Saved: ${ADAPTIVE_ICON_OUTPUT}`);

    console.log('\n✅ Icon generation complete!');
    console.log('   - iOS/Android icon: icon.png (1024x1024)');
    console.log('   - Android adaptive icon: adaptive-icon.png (1024x1024)');
    console.log('\n📱 Remember to rebuild your app to see the new icon!');
  } catch (error) {
    console.error('❌ Error generating icon:', error.message);
    process.exit(1);
  }
}

generateIcon();
