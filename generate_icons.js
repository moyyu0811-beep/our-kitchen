import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const sourceImg = '/Users/moyyu/.gemini/antigravity/brain/9531066c-16c7-49a1-b0b9-7cd37df683ba/media__1779723217777.jpg';
const publicDir = '/Users/moyyu/.gemini/antigravity/scratch/our-kitchen/public';

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

async function generateIcons() {
  try {
    await sharp(sourceImg)
      .resize(192, 192)
      .png()
      .toFile(path.join(publicDir, 'pwa-192x192.png'));
    
    await sharp(sourceImg)
      .resize(512, 512)
      .png()
      .toFile(path.join(publicDir, 'pwa-512x512.png'));
    
    // Also create a maskable icon just by adding some padding
    await sharp(sourceImg)
      .resize(512, 512, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .png()
      .toFile(path.join(publicDir, 'maskable-icon-512x512.png'));

    // Apple touch icon
    await sharp(sourceImg)
      .resize(180, 180)
      .png()
      .toFile(path.join(publicDir, 'apple-touch-icon-180x180.png'));
      
    console.log('Icons generated successfully.');
  } catch (err) {
    console.error('Error generating icons:', err);
  }
}

generateIcons();
