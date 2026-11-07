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
  'hooks/useScreenAwake.ts' \
  'lib/featureFlags.ts' \
  'lib/ingredientSanitize.ts' \
  'src/components/HomePlanHero.tsx' \
  'src/screens/AiPlanScreen.tsx' \
  'app/ai-plan.tsx' \
  'app/meal-preferences.tsx' \
  'lib/mealPreferences.ts' \
  'src/components/RecipeCard.tsx' \
  'src/components/ShoppingAddConfirm.tsx' \
  'src/components/NextDayPrompt.tsx' \
  'src/components/AiBubbleIcon.tsx' \
  'src/components/MealConflictPrompt.tsx' \
  'src/components/Toast.tsx' \
  'e2e/ai-chef.smoke.test.js'
echo "✅ ESLint passed (zero warnings)"
echo ""

# Step 3b: Typography token enforcement
echo "🔍 Running typography lint..."
npx eslint --max-warnings=0 app/settings.tsx "app/(tabs)/more.tsx" "app/(tabs)/index.tsx" src/components/RecipeCard.tsx app/visual-typography.tsx
echo "✅ Typography lint passed"
echo ""

# Step 4: i18n key completeness (all t() keys present in all 4 locales)
echo "🌐 Checking i18n key completeness..."
node scripts/check-i18n-keys.js
echo "✅ i18n keys passed"
echo ""

# Step 5: i18n hardcoded-CJK audit (AST-aware baseline: no new UI CJK)
echo "🌐 Auditing hardcoded CJK in UI (baseline)..."
node scripts/i18n-ui-audit.js --check
echo "✅ i18n audit passed"
echo ""

echo "========================================"
echo "✅ All CI gates passed!"
echo "========================================"
