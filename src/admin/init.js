// /src/admin/init.js
// Generate a readable, unique SKU before save if it's missing
window.CMS?.registerEventListener({
  name: "preSave",
  handler: ({ entry, collection }) => {
    if (collection.get("name") !== "tires") return entry;

    const path = ["data", "sku"];
    const cur = entry.getIn(path);

    // treat empty and literal placeholders as missing
    if (!cur || cur === "{{uuid}}" || cur === "/uuid/") {
      // short unique segment (fallback if crypto.randomUUID not present)
      const short = (
        crypto?.randomUUID?.() ||
        Date.now().toString(36) + Math.random().toString(36)
      )
        .replace(/-/g, "")
        .slice(0, 8)
        .toUpperCase();

      const generated = `TIRE-${short}`;
      return entry.setIn(path, generated);
    }

    return entry;
  },
});
