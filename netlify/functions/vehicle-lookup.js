// netlify/functions/vehicle-lookup.js
const fs = require("fs");
const path = require("path");
const matter = require("gray-matter");

exports.handler = async (event) => {
  try {
    const { make, model, year, modification } = JSON.parse(event.body || "{}");
    if (!make || !model || !year || !modification) {
      return json(400, { error: "make/model/year/modification required" });
    }

    const userKey = process.env.WHEELSIZE_API_KEY;
    if (!userKey) return json(500, { error: "Missing WHEELSIZE_API_KEY" });

    // --- call Wheel-Size (as you already had) ---
    const qs = new URLSearchParams({
      make,
      model,
      year,
      modification,
      user_key: userKey,
    });
    const url = `https://api.wheel-size.com/v2/search/by_model/?${qs}`;
    const res = await fetch(url, { headers: { accept: "application/json" } });
    const text = await res.text();
    if (!res.ok)
      return json(res.status, { error: `Wheel-Size API error: ${text}`, url });
    const payload = JSON.parse(text);

    // extract sizes (same way your Drupal code does)
    const sizes = [];
    const first = payload?.data?.[0];
    if (first?.wheels?.length) {
      for (const w of first.wheels) {
        if (w?.front?.tire_full) sizes.push(w.front.tire_full);
        if (w?.rear?.tire_full) sizes.push(w.rear.tire_full);
      }
    }

    // --- normalize to canonical form like 235/45R19 ---
    const wanted = new Set(sizes.map(normalizeSize).filter(Boolean));

    // --- load local inventory from Markdown ---
    const matches = loadInventory().filter(
      (t) => t.inStock && wanted.has(t.sizeNorm)
    );

    return json(200, {
      sizes, // original (e.g., "235/45ZR19 95W")
      sizesNormalized: [...wanted], // canonical ("235/45R19")
      results: matches, // your matching tires
      // raw: payload,
    });
  } catch (e) {
    return json(500, { error: e.message });
  }
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

// ---------- helpers ----------
function normalizeSize(s) {
  if (!s) return "";
  let x = String(s).trim().toUpperCase();
  x = x.split(/\s+/)[0]; // drop load/speed (e.g., "98H")
  x = x.replace(/ZR/g, "R"); // ZR -> R
  // Normalize any weird spacing, zero-padding etc.
  const m = x.match(/^(\d{3})\/(\d{2})(R)(\d{2})$/);
  if (m) return `${m[1]}/${m[2]}R${m[4]}`;
  return x;
}

let INVENTORY_CACHE;
function loadInventory() {
  if (INVENTORY_CACHE) return INVENTORY_CACHE;

  const dir = path.join(process.cwd(), "src", "tires");
  const files = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((f) => f.endsWith(".md"))
    : [];

  const items = files.map((file) => {
    const fp = path.join(dir, file);
    const { data } = matter.read(fp);

    // Build size from either a single field or width/aspect/rim triplet
    const sizeRaw =
      data.size ||
      (data.width && data.aspect && data.rim
        ? `${data.width}/${data.aspect}R${data.rim}`
        : "");

    return {
      sku: data.sku,
      title: data.title,
      brand: data.brand,
      model: data.model,
      price: data.price,
      images: (data.images || [])
        .map((i) => (i?.src ? i.src : i))
        .filter(Boolean),
      size: sizeRaw,
      sizeNorm: normalizeSize(sizeRaw),
      inStock: data.inStock !== false, // default true
      url: `/tires/${(data.sku || path.basename(file, ".md"))
        .toString()
        .toLowerCase()}/`, // adjust to your permalink pattern
    };
  });

  INVENTORY_CACHE = items;
  return items;
}
