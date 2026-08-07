#!/usr/bin/env node
/**
 * Environment validation script
 * Run before build to ensure EXPO_PUBLIC_API_URL is valid for production
 * 
 * Usage: npx tsx scripts/check-env.ts
 */

import { readFileSync } from "fs";
import { join } from "path";

// Load .env file manually
const envPath = join(process.cwd(), ".env");
try {
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const [key, ...valueParts] = line.split("=");
    if (key && valueParts.length > 0) {
      process.env[key.trim()] = valueParts.join("=").trim();
    }
  }
} catch (err) {
  // .env file not found, will fail validation below
}

const API_URL = process.env.EXPO_PUBLIC_API_URL;

const PROD_URL = "https://kindcipe-backend-production.up.railway.app";
const DEV_PATTERNS = ["ngrok", "localhost", "127.0.0.1", "192.168."];

function isDevUrl(url: string): boolean {
  return DEV_PATTERNS.some((pattern) => url.includes(pattern));
}

function checkEnv(): number {
  console.log("🔍 Checking environment configuration...");

  if (!API_URL) {
    console.error("❌ EXPO_PUBLIC_API_URL is not set");
    console.error("   Please create a .env file with EXPO_PUBLIC_API_URL=<your-backend-url>");
    console.error("   See .env.example for reference");
    return 1;
  }

  console.log(`   API_URL: ${API_URL}`);

  // Check if using production URL
  if (API_URL === PROD_URL) {
    console.log("✅ Production URL detected");
    return 0;
  }

  // Check if using a dev URL
  if (isDevUrl(API_URL)) {
    console.error("❌ Development URL detected in EXPO_PUBLIC_API_URL");
    console.error(`   Current: ${API_URL}`);
    console.error("   This appears to be a development tunnel (ngrok/local network).");
    console.error("   For production builds, use: " + PROD_URL);
    console.error("");
    console.error("   If this is a development build, you can proceed with caution.");
    console.error("   For CI/CD production builds, this check should fail.");
    return 1;
  }

  // Unknown URL - warn but allow
  console.warn("⚠️  Custom URL detected (not production or known dev URL)");
  console.warn(`   ${API_URL}`);
  console.warn("   Ensure this is intentional for production.");

  return 0;
}

const exitCode = checkEnv();
process.exit(exitCode);
