// This runs in the browser on /admin after the CMS loads
// Auto-generate a SKU if empty on save
window.CMS?.registerEventListener({
  name: "preSave",
  handler: ({ entry }) => {
    const path = ["data", "sku"];
    const sku = entry.getIn(path);

    if (!sku) {
      const randomId =
        "TIRE-" + Math.random().toString(36).slice(2, 8).toUpperCase();
      return entry.setIn(path, randomId);
    }
    return entry;
  },
});
