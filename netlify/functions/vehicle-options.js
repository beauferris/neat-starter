// netlify/functions/vehicle-options.js
exports.handler = async (event) => {
  try {
    const { make, model, year } = JSON.parse(event.body || "{}");
    if (!make || !model || !year)
      return json(400, { error: "make/model/year required" });

    const userKey = process.env.WHEELSIZE_API_KEY;
    if (!userKey) return json(500, { error: "Missing WHEELSIZE_API_KEY" });

    const qs = new URLSearchParams({ make, model, year, user_key: userKey });
    const url = `https://api.wheel-size.com/v2/modifications/?${qs}`;

    const res = await fetch(url, { headers: { accept: "application/json" } });
    const text = await res.text();
    if (!res.ok)
      return json(res.status, { error: `Wheel-Size API error: ${text}`, url });

    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      return json(502, { error: "Bad JSON", url, raw: text });
    }

    // v2 responses are typically { data: [...] }
    const arr = Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload)
      ? payload
      : [];
    const modifications = arr.map((m) => ({
      // Drupal uses 'slug' as the value it submits as 'modification'
      id: String(m.slug ?? m.id),
      label: m.name || String(m.slug ?? m.id),
    }));

    return json(200, { modifications, debug: { url } });
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
