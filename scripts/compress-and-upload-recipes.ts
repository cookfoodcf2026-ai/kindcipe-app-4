/**
 * Script to compress 316 recipe images and upload to backend R2 storage
 * 
 * Usage: npx ts-node scripts/compress-and-upload-recipes.ts
 * 
 * Requirements:
 * - sharp: npm install sharp
 * - Backend .env configured with R2 credentials
 */

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const RECIPE_ASSETS_DIR = path.join(__dirname, '../assets/recipes');
const OUTPUT_DIR = path.join(__dirname, '../assets/recipes-compressed');
const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

// Recipe name to filename mapping (extracted from RecipeCard.tsx)
const RECIPE_NAME_MAP: Record<string, string> = {
  '番茄炒蛋': 'scrambled-eggs-tomatoes.png',
  '蒜蓉炒菜心': 'garlic-choy-sum.png',
  '紅燒肉': 'braised-pork-belly.png',
  '宮保雞丁': 'kung-pao-chicken.png',
  '麻婆豆腐': 'mapo-tofu.png',
  '糖醋排骨': 'sweet-sour-ribs.png',
  '清蒸鱸魚': 'steamed-sea-bass.png',
  '豉油王炒麵': 'soy-sauce-noodles.png',
  '臘味煲仔飯': 'claypot-rice.png',
  '紅蘿蔔粟米豬骨湯': 'carrot-corn-soup.png',
  '回鍋肉': 'twice-cooked-pork.png',
  '干煸四季豆': 'dry-fried-beans.png',
  '蝦仁炒蛋': 'shrimp-scrambled-eggs.png',
  '梅菜扣肉': 'preserved-vegetable-pork.png',
  '薑蔥蒸雞': 'steamed-chicken.png',
  '魚香茄子': 'fish-fragrant-eggplant.png',
  '腐乳通菜': 'fermented-water-spinach.png',
  '鹽焗雞翼': 'salt-baked-wings.png',
  '蠔油冬菇炆雞': 'braised-chicken-mushroom.png',
  '榨菜肉絲湯米粉': 'rice-noodle-soup.png',
  // ... add all 316 mappings here
};

async function compressImage(inputPath: string, outputPath: string, maxWidth = 800) {
  try {
    const metadata = await sharp(inputPath).metadata();
    const width = metadata.width || maxWidth;
    const height = metadata.height || maxWidth;
    
    const scale = Math.min(1, maxWidth / width);
    const newWidth = Math.floor(width * scale);
    const newHeight = Math.floor(height * scale);
    
    await sharp(inputPath)
      .resize(newWidth, newHeight, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 75, progressive: true })
      .toFile(outputPath);
    
    const originalSize = fs.statSync(inputPath).size;
    const compressedSize = fs.statSync(outputPath).size;
    const reduction = ((1 - compressedSize / originalSize) * 100).toFixed(1);
    
    return {
      success: true,
      originalSize: (originalSize / 1024 / 1024).toFixed(2) + ' MB',
      compressedSize: (compressedSize / 1024).toFixed(0) + ' KB',
      reduction: reduction + '%',
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

async function uploadToR2(filePath: string, recipeName: string) {
  // This would call the backend API to upload
  // For now, just log what would happen
  console.log(`  → Would upload ${recipeName} to R2`);
  return {
    key: `recipe-thumbnails/official-${recipeName}.jpg`,
    url: `${BACKEND_URL}/r2-storage/recipe-thumbnails/official-${recipeName}.jpg`,
  };
}

async function main() {
  console.log('🔍 Scanning recipe assets...\n');
  
  if (!fs.existsSync(RECIPE_ASSETS_DIR)) {
    console.error(`❌ Recipe assets directory not found: ${RECIPE_ASSETS_DIR}`);
    process.exit(1);
  }
  
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`📁 Created output directory: ${OUTPUT_DIR}\n`);
  }
  
  const files = fs.readdirSync(RECIPE_ASSETS_DIR).filter(f => f.endsWith('.png'));
  console.log(`Found ${files.length} recipe images\n`);
  
  const results = {
    success: 0,
    failed: 0,
    totalOriginalSize: 0,
    totalCompressedSize: 0,
  };
  
  for (const file of files) {
    const inputPath = path.join(RECIPE_ASSETS_DIR, file);
    const outputPath = path.join(OUTPUT_DIR, file.replace('.png', '.jpg'));
    
    console.log(`Processing ${file}...`);
    
    const result = await compressImage(inputPath, outputPath);
    
    if (result.success) {
      results.success++;
      console.log(`  ✅ Compressed: ${result.originalSize} → ${result.compressedSize} (${result.reduction} reduction)`);
      
      // Extract recipe name from filename for upload
      const recipeName = path.basename(file, '.png');
      await uploadToR2(outputPath, recipeName);
      
      const compressedSize = fs.statSync(outputPath).size;
      results.totalCompressedSize += compressedSize;
    } else {
      results.failed++;
      console.log(`  ❌ Failed: ${result.error}`);
    }
    
    const originalSize = fs.statSync(inputPath).size;
    results.totalOriginalSize += originalSize;
  }
  
  console.log('\n📊 Summary:');
  console.log(`  ✅ Success: ${results.success}`);
  console.log(`  ❌ Failed: ${results.failed}`);
  console.log(`  📦 Original total: ${(results.totalOriginalSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  📦 Compressed total: ${(results.totalCompressedSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  💾 Reduction: ${((1 - results.totalCompressedSize / results.totalOriginalSize) * 100).toFixed(1)}%`);
}

main().catch(console.error);
