#!/bin/bash

# Kindcipe P1 Core Test Runner
# Run this on your Mac with iOS Simulator (after P0 passes)

set -e

echo "🧪 Kindcipe P1 Core Test (Scenarios 5-10)"
echo "=========================================="
echo ""

# Check prerequisites
if ! command -v xcrun &> /dev/null; then
    echo "❌ Xcode not found. Please install Xcode."
    exit 1
fi

echo "✅ Xcode found"

# Check if simulator is running
SIMULATOR_STATUS=$(xcrun simctl list devices available | grep -c "Booted" || true)
if [ "$SIMULATOR_STATUS" -eq 0 ]; then
    echo "⚠️  No simulator is currently booted."
    echo "   Please open a simulator first:"
    echo "   xcrun simctl boot \"iPhone 16\""
    exit 1
fi

echo "✅ Simulator is running"
echo ""

# Check for test account
if [ -z "$E2E_EMAIL" ] || [ -z "$E2E_PASSWORD" ]; then
    echo "⚠️  E2E_EMAIL or E2E_PASSWORD not set."
    echo "   Please set them before running:"
    echo "   export E2E_EMAIL='your-test-account@example.com'"
    echo "   export E2E_PASSWORD='your-test-password'"
    echo ""
    read -p "Continue without credentials? (test will fail) [y/N]: " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo ""
echo "⚠️  IMPORTANT: Run P0 tests first before P1!"
echo "   ./scripts/run-p0-smoke.sh"
echo ""
read -p "Have you already run P0 tests? [y/N]: " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Please run P0 tests first."
    exit 1
fi

# Run P1 core tests
echo "🧪 Running P1 Core Tests (Scenarios 5-10)..."
echo ""

export E2E_EMAIL="${E2E_EMAIL:-test@kindcipe.com}"
export E2E_PASSWORD="${E2E_PASSWORD:-testpassword}"

# Run only P1 tests
EXPO_PUBLIC_E2E=1 detox test -c ios.sim.debug e2e/p1-core.test.js

TEST_RESULT=$?

echo ""
echo "=========================================="
if [ $TEST_RESULT -eq 0 ]; then
    echo "✅ P1 Core Tests PASSED!"
    echo ""
    echo "All core tests passed! You can now run full 100 scenarios:"
    echo "  npm run e2e:test:ios"
else
    echo "❌ P1 Core Tests FAILED!"
    echo ""
    echo "Check the output above for details."
    echo "Fill in BUG_REPORT_TEMPLATE.md and send back."
fi
echo "=========================================="

exit $TEST_RESULT
