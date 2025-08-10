// netlify/functions/vehicle-lookup.js
// CommonJS for widest compatibility with Netlify Functions

exports.handler = async (event) => {
  try {
    const {
      make,
      model,
      year,
      modification,
      debug = false,
    } = JSON.parse(event.body || "{}");
    if (!make || !model || !year || !modification) {
      return json(400, { error: "make/model/year/modification required" });
    }

    const userKey = process.env.WHEELSIZE_API_KEY;
    if (!userKey)
      return json(500, { error: "Missing WHEELSIZE_API_KEY env var" });

    // --- 1) Wheel-Size: fetch fitment for this modification ---
    const qs = new URLSearchParams({
      make,
      model,
      year,
      modification,
      user_key: userKey,
    });
    const wsUrl = `https://api.wheel-size.com/v2/search/by_model/?${qs}`;

    const wsRes = await fetch(wsUrl, {
      headers: { accept: "application/json" },
    });
    const wsText = await wsRes.text();
    if (!wsRes.ok)
      return json(wsRes.status, { error: `Wheel-Size API error: ${wsText}` });

    let ws;
    try {
      ws = JSON.parse(wsText);
    } catch {
      return json(502, {
        error: "Wheel-Size returned non-JSON",
        raw: wsText.slice(0, 400),
      });
    }

    // Extract tire sizes (like your Drupal code)
    const sizesFull = [];
    const first = ws?.data?.[0];
    if (first?.wheels?.length) {
      for (const w of first.wheels) {
        if (w?.front?.tire_full) sizesFull.push(w.front.tire_full);
        if (w?.rear?.tire_full) sizesFull.push(w.rear?.tire_full);
      }
    }
    const sizesNormalized = Array.from(
      new Set(sizesFull.map(normalizeSize).filter(Boolean))
    );

    // --- 2) Fetch inventory JSON that Eleventy publishes at /api/tires.json ---
    // Works on both local `netlify dev` and production.
    const origin = getOrigin(event);
    const invRes = await fetch(`${origin}/api/tires.json`, {
      headers: { accept: "application/json" },
    });
    if (!invRes.ok)
      return json(invRes.status, { error: "Could not load /api/tires.json" });

    const inventory = await invRes.json(); // array from your endpoint

    // Normalize inventory sizes and match
    const wanted = new Set(sizesNormalized);
    const results = inventory
      .map((t) => ({ ...t, sizeNorm: normalizeSize(t.size) }))
      .filter((t) => t.inStock && t.sizeNorm && wanted.has(t.sizeNorm));

    return json(200, {
      sizes: sizesFull,
      sizesNormalized,
      results,
      ...(debug
        ? { debug: { wsUrl, origin, inventoryCount: inventory.length } }
        : {}),
    });
  } catch (e) {
    return json(500, { error: e.message });
  }
};

// ---------- helpers ----------
function json(statusCode, body) {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

function normalizeSize(s) {
  if (!s) return "";
  let x = String(s).toUpperCase().trim();
  // grab only the size token (e.g., "235/45ZR19" or "225/55R18")
  const token =
    x.match(/[0-9]{3}\s*\/\s*[0-9]{2}\s*[Z]?R\s*[0-9]{2}/)?.[0] || "";
  if (!token) return "";
  x = token.replace(/\s+/g, "").replace(/ZR/, "R"); // remove spaces, ZR→R
  const m = x.match(/^(\d{3})\/(\d{2})R(\d{2})$/);
  return m ? `${m[1]}/${m[2]}R${m[3]}` : "";
}

function getOrigin(event) {
  // Prefer Netlify’s production URL if present
  if (process.env.URL) return process.env.URL.replace(/\/$/, "");
  // Fall back to request headers (works in netlify dev)
  const proto = (event.headers["x-forwarded-proto"] || "http")
    .split(",")[0]
    .trim();
  const host = (
    event.headers.host || `localhost:${process.env.NETLIFY_LOCAL_PORT || 8888}`
  ).trim();
  return `${proto}://${host}`;
}
