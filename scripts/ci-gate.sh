#!/bin/bash
set -e

echo "========================================"
echo "Kindcipe App - CI Gate"
echo "========================================"
echo ""

# Step 1: Clean install
echo "📦 Running npm ci..."
npm ci --legacy-peer-deps --ignore-scripts
echo "✅ npm ci passed"
echo ""

# Step 2: TypeScript check
echo "🔷 Running TypeScript check..."
npx tsc --noEmit --project tsconfig.json
echo "✅ TypeScript passed"
echo ""

# Step 3: ESLint check (zero warnings required)
echo "🔍 Running ESLint with --max-warnings=0..."
npx eslint --max-warnings=0 \
  'app/(tabs)/index.tsx' \
  'app/(tabs)/planner.tsx' \
  'app/pantry.tsx' \
  'app/shopping-templates.tsx' \
  'app/recipe/[id].tsx' \
  'src/components/RecipeCard.tsx' \
  'src/components/Toast.tsx' \
  'e2e/ai-chef.smoke.test.js'
echo "✅ ESLint passed (zero warnings)"
echo ""

echo "========================================"
echo "✅ All CI gates passed!"
echo "========================================"
