/**
 * Create an internal beta group (if needed) and assign the latest build to it so
 * internal testers (App Store Connect users, incl. the Account Holder) can see
 * the app in TestFlight.
 *
 * Usage: node scripts/asc-setup-internal-group.mjs
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

async function main() {
  // Latest build
  const bRes = await fetch(`${API}/builds?filter[app]=${APP_ID}&limit=1&sort=-uploadedDate`, { headers: H() });
  const build = (await bRes.json()).data?.[0];
  if (!build) throw new Error("no build found");
  console.log("build:", build.id, build.attributes?.version, build.attributes?.processingState);

  // Existing groups
  const gRes = await fetch(`${API}/betaGroups?filter[app]=${APP_ID}&limit=10`, { headers: H() });
  let groups = (await gRes.json()).data || [];
  console.log("existing groups:", groups.map((g) => `${g.attributes?.name}(internal=${g.attributes?.isInternalGroup})`).join(", ") || "(none)");

  let group = groups.find((g) => g.attributes?.isInternalGroup);
  if (!group) {
    const cRes = await fetch(`${API}/betaGroups`, {
      method: "POST",
      headers: H(),
      body: JSON.stringify({
        data: {
          type: "betaGroups",
          attributes: { name: "Internal Testers", isInternalGroup: true },
          relationships: { app: { data: { type: "apps", id: APP_ID } } },
        },
      }),
    });
    const cJson = await cRes.json();
    console.log("create group status:", cRes.status);
    if (cJson.errors) console.log("create errors:", JSON.stringify(cJson.errors).slice(0, 400));
    group = cJson.data;
  }
  if (!group) throw new Error("could not create/find an internal group");
  console.log("group:", group.id, group.attributes?.name, "internal:", group.attributes?.isInternalGroup);

  // Assign the build
  const aRes = await fetch(`${API}/betaGroups/${group.id}/relationships/builds`, {
    method: "POST",
    headers: H(),
    body: JSON.stringify({ data: [{ type: "builds", id: build.id }] }),
  });
  console.log("assign build status:", aRes.status, aRes.ok ? "OK ✅" : (await aRes.text()).slice(0, 300));

  // Verify
  const vRes = await fetch(`${API}/builds/${build.id}/betaGroups`, { headers: H() });
  const vg = (await vRes.json()).data || [];
  console.log("build now in groups:", vg.map((g) => g.attributes?.name).join(", ") || "(none)");
}

main().catch((e) => { console.error(e); process.exit(1); });
