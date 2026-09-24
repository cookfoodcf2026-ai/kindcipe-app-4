/**
 * Post-upload helper: wait for the new iOS build to appear in App Store Connect,
 * clear the "Missing Compliance" (export compliance) flag, and report status.
 *
 * Usage: node scripts/asc-post-upload.mjs [--wait-min 30]
 */
import crypto from "node:crypto";
import fs from "node:fs";

const KEY_ID = process.env.ASC_KEY_ID || "FF2R74GV59";
const ISSUER = process.env.ASC_ISSUER_ID || "4ff6caa9-b13b-40f0-8407-bc43317c7b33";
const KEY_PATH = process.env.ASC_KEY_PATH || `${process.env.HOME}/.appstoreconnect/private_keys/AuthKey_${KEY_ID}.p8`;
const APP_ID = process.env.ASC_APP_ID || "6815294638";

const b64 = (b) => Buffer.from(b).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
function token() {
  const now = Math.floor(Date.now() / 1000);
  const signing = `${b64(JSON.stringify({ alg: "ES256", kid: KEY_ID, typ: "JWT" }))}.${b64(
    JSON.stringify({ iss: ISSUER, iat: now, exp: now + 1200, aud: "appstoreconnect-v1" })
  )}`;
  const sig = crypto.sign("sha256", Buffer.from(signing), { key: fs.readFileSync(KEY_PATH, "utf8"), dsaEncoding: "ieee-p1363" });
  return `${signing}.${b64(sig)}`;
}
const H = () => ({ Authorization: `Bearer ${token()}`, "Content-Type": "application/json" });
const API = "https://api.appstoreconnect.apple.com/v1";

async function latestBuild() {
  const r = await fetch(`${API}/builds?filter[app]=${APP_ID}&limit=1&sort=-uploadedDate`, { headers: H() });
  const j = await r.json();
  return (j.data || [])[0] ?? null;
}

async function main() {
  const waitMin = Number(process.argv[process.argv.indexOf("--wait-min") + 1] || 30);
  const deadline = Date.now() + waitMin * 60_000;
  let build = null;

  while (Date.now() < deadline) {
    build = await latestBuild();
    const state = build?.attributes?.processingState;
    console.log(new Date().toISOString(), "build:", build?.id ?? "(none)", "state:", state ?? "-");
    if (build && state && state !== "PROCESSING") break;
    await new Promise((r) => setTimeout(r, 60_000));
  }
  if (!build) {
    console.log("No build found yet — check App Store Connect.");
    return;
  }

  // Clear export compliance (standard HTTPS only → exempt)
  const enc = build.attributes?.usesNonExemptEncryption;
  if (enc === null || enc === undefined) {
    const res = await fetch(`${API}/builds/${build.id}`, {
      method: "PATCH",
      headers: H(),
      body: JSON.stringify({ data: { id: build.id, type: "builds", attributes: { usesNonExemptEncryption: false } } }),
    });
    console.log("compliance patch:", res.status, res.ok ? "OK ✅" : (await res.text()).slice(0, 200));
  } else {
    console.log("compliance already set:", enc);
  }

  const bd = await (await fetch(`${API}/builds/${build.id}/buildBetaDetail`, { headers: H() })).json();
  console.log("beta detail:", JSON.stringify(bd.data?.attributes ?? bd.errors ?? {}).slice(0, 300));

  const groups = await (await fetch(`${API}/betaGroups?filter[app]=${APP_ID}`, { headers: H() })).json();
  console.log("beta groups:", (groups.data || []).map((g) => `${g.attributes?.name}(internal=${g.attributes?.isInternalGroup})`).join(", ") || "(none)");
}

main().catch((e) => { console.error(e); process.exit(1); });
