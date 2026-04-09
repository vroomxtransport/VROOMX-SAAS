/**
 * PWA Icon Generator for VroomX TMS
 *
 * Composites the VroomX logo (white on transparent) onto a navy background
 * and generates all required PWA icon sizes using sharp.
 *
 * Usage:
 *   node scripts/generate-pwa-icons.mjs
 *
 * Output:
 *   public/images/icons/icon-192.png          — 192×192 manifest icon
 *   public/images/icons/icon-512.png          — 512×512 manifest icon
 *   public/images/icons/icon-maskable-512.png — 512×512 maskable (80% safe zone)
 *   public/apple-touch-icon.png               — 180×180 for iOS
 */

import sharp from 'sharp'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const LOGO_PATH = join(__dirname, '..', 'public', 'images', 'logo-white.png')
const OUT_DIR = join(__dirname, '..', 'public', 'images', 'icons')
const APPLE_OUT = join(__dirname, '..', 'public', 'apple-touch-icon.png')

const NAVY = { r: 25, g: 35, b: 52, alpha: 255 } // #192334

/**
 * Generate a standard PWA icon: navy background with logo centered.
 * Logo is resized to ~70% of the icon size for visual balance.
 */
async function generateStandardIcon(size, outputPath) {
  const logoSize = Math.round(size * 0.70)

  const logo = await sharp(LOGO_PATH)
    .resize(logoSize, logoSize, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer()

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: NAVY,
    },
  })
    .composite([{ input: logo, gravity: 'centre' }])
    .png()
    .toFile(outputPath)
}

/**
 * Generate a maskable PWA icon: navy background, logo at 60% (within 80% safe zone).
 * No rounded corners — OS applies its own mask shape.
 */
async function generateMaskableIcon(size, outputPath) {
  // Safe zone is inner 80%, so logo should be ~60% of total to have breathing room
  const logoSize = Math.round(size * 0.55)

  const logo = await sharp(LOGO_PATH)
    .resize(logoSize, logoSize, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer()

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: NAVY,
    },
  })
    .composite([{ input: logo, gravity: 'centre' }])
    .png()
    .toFile(outputPath)
}

async function main() {
  console.log('Generating PWA icons from VroomX logo...\n')

  await generateStandardIcon(192, join(OUT_DIR, 'icon-192.png'))
  console.log('  icon-192.png (192×192)')

  await generateStandardIcon(512, join(OUT_DIR, 'icon-512.png'))
  console.log('  icon-512.png (512×512)')

  await generateMaskableIcon(512, join(OUT_DIR, 'icon-maskable-512.png'))
  console.log('  icon-maskable-512.png (512×512, maskable)')

  await generateStandardIcon(180, APPLE_OUT)
  console.log('  apple-touch-icon.png (180×180)')

  console.log('\nDone. Icons use the actual VroomX logo on navy background.')
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
