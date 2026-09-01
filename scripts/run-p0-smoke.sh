#!/bin/bash

# Kindcipe P0 Smoke Test Runner
# Run this on your Mac with iOS Simulator

set -e

echo "🧪 Kindcipe P0 Smoke Test (Scenarios 1-4)"
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

# Build the app for E2E testing
echo "🔨 Building app for E2E testing..."
npm run e2e:build:ios

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

echo "✅ Build successful"
echo ""

# Start Metro if it is not already running.
METRO_STARTED=0
if ! lsof -i :8081 | grep LISTEN >/dev/null 2>&1; then
    echo "🟦 Starting Metro dev server..."
    npm start -- --dev-client > .metro-p0.log 2>&1 &
    METRO_PID=$!
    METRO_STARTED=1

    for i in $(seq 1 60); do
        if lsof -i :8081 | grep LISTEN >/dev/null 2>&1; then
            echo "✅ Metro is running"
            break
        fi
        sleep 2
    done

    if ! lsof -i :8081 | grep LISTEN >/dev/null 2>&1; then
        echo "❌ Metro did not start on port 8081"
        echo "   See .metro-p0.log for details"
        if [ -n "$METRO_PID" ]; then
            kill "$METRO_PID" >/dev/null 2>&1 || true
        fi
        exit 1
    fi

    trap 'if [ "$METRO_STARTED" -eq 1 ] && [ -n "$METRO_PID" ]; then kill "$METRO_PID" >/dev/null 2>&1 || true; fi' EXIT
else
    echo "✅ Metro already running"
fi
echo ""

# Run P0 smoke tests
echo "🧪 Running P0 Smoke Tests (Scenarios 1-4)..."
echo ""

export E2E_EMAIL="${E2E_EMAIL:-test@kindcipe.com}"
export E2E_PASSWORD="${E2E_PASSWORD:-testpassword}"

# Run only P0 tests
EXPO_PUBLIC_E2E=1 detox test -c ios.sim.debug e2e/p0-smoke.test.js

TEST_RESULT=$?

echo ""
echo "=========================================="
if [ $TEST_RESULT -eq 0 ]; then
    echo "✅ P0 Smoke Tests PASSED!"
    echo ""
    echo "Next: Run P1 tests (Scenarios 5-10):"
    echo "  ./scripts/run-p1-core.sh"
else
    echo "❌ P0 Smoke Tests FAILED!"
    echo ""
    echo "Check the output above for details."
    echo "Fill in BUG_REPORT_TEMPLATE.md and send back."
fi
echo "=========================================="

exit $TEST_RESULT
