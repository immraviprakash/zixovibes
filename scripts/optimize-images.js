import { Jimp } from 'jimp';
import path from 'path';
import fs from 'fs';

const assetsDir = path.join(process.cwd(), 'src', 'assets');

const targets = [
  { file: 'sleep-playlist.png', width: 256, height: 256 },
  { file: 'relax-playlist.png', width: 256, height: 256 },
  { file: 'lofi-playlist.png', width: 256, height: 256 },
  { file: 'coffee-shop-artwork.png', width: 256, height: 256 },
  { file: 'dedicated-playlist.png', width: 256, height: 256 },
  { file: 'jazz-lofi-focus.png', width: 256, height: 256 },
  { file: 'vinyl-texture.png', width: 512, height: 512 },
  { file: 'zixovibes-favicon.png', width: 128, height: 128 }
];

async function run() {
  console.log("Starting Image Optimization...");
  for (const target of targets) {
    const filePath = path.join(assetsDir, target.file);
    if (!fs.existsSync(filePath)) {
      console.warn(`[Warning] File not found: ${target.file}`);
      continue;
    }
    
    const initialSize = fs.statSync(filePath).size;
    try {
      const img = await Jimp.read(filePath);
      console.log(`Processing ${target.file} (${img.width}x${img.height}, ${initialSize} bytes)...`);
      
      if (target.width && target.height) {
        img.resize({ w: target.width, h: target.height });
      }
      
      if (target.quality) {
        img.quality(target.quality);
      }
      
      await img.write(filePath);
      
      const finalSize = fs.statSync(filePath).size;
      console.log(`Optimized ${target.file} -> ${target.width || img.width}x${target.height || img.height}, ${finalSize} bytes (reduced by ${((initialSize - finalSize) / initialSize * 100).toFixed(1)}%)`);
    } catch (err) {
      console.error(`Error processing ${target.file}:`, err);
    }
  }
  console.log("Image Optimization Completed.");
}

run();
