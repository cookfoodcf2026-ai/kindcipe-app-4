#!/bin/bash

# Kindcipe Build Fix Script
# Run this on your Mac to fix the resource fork issue

set -e

echo "🔧 Kindcipe Build Fix Script"
echo "============================"
echo ""

cd /Users/mavisng/Desktop/Kindcipe/manus/kindcipe-app-4

echo "1. Cleaning macOS metadata files..."
find . -name "._*" -delete 2>/dev/null || true
find . -name ".DS_Store" -delete 2>/dev/null || true
echo "✅ Metadata files cleaned"
echo ""

echo "2. Clearing extended attributes..."
xattr -cr . 2>/dev/null || echo "⚠️ Some files couldn't be cleaned (normal for .git)"
echo "✅ Extended attributes cleared"
echo ""

echo "3. Cleaning iOS build..."
rm -rf ios/build
echo "✅ Build directory cleaned"
echo ""

echo "4. Reinstalling CocoaPods..."
cd ios
pod deintegrate
pod install
cd ..
echo "✅ CocoaPods reinstalled"
echo ""

echo "5. Building app..."
export E2E_EMAIL='test29@gmail.com'
export E2E_PASSWORD='12345678'
EXPO_PUBLIC_E2E=1 npm run e2e:build:ios

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Build successful!"
    echo ""
    echo "Now running P0 tests..."
    npm run e2e:test:ios -- e2e/p0-smoke.test.js
else
    echo ""
    echo "❌ Build failed. Please try running manually:"
    echo "   cd ios && pod deintegrate && pod install && cd .."
    echo "   rm -rf ios/build"
    echo "   npm run e2e:build:ios"
fi
