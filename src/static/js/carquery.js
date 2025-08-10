function jsonp(url, params = {}, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const cb = "cq_" + Math.random().toString(36).slice(2);
    const qs = new URLSearchParams({ ...params, callback: cb });
    const script = document.createElement("script");
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("CarQuery request timed out"));
    }, timeoutMs);

    function cleanup() {
      clearTimeout(timer);
      script.remove();
      // Avoid leaking globals if callback never fires
      try {
        delete window[cb];
      } catch {}
    }

    window[cb] = (data) => {
      cleanup();
      resolve(data);
    };
    script.src = `${url}?${qs}`;
    script.onerror = () => {
      cleanup();
      reject(new Error("CarQuery script error"));
    };
    document.head.appendChild(script);
  });
}

const CQ_BASE = "https://www.carqueryapi.com/api/0.3/";

async function getMakes() {
  const data = await jsonp(CQ_BASE, { cmd: "getMakes" });
  return data.Makes || [];
}
async function getModels(make) {
  const data = await jsonp(CQ_BASE, { cmd: "getModels", make });
  return data.Models || [];
}
async function getYears(make, model) {
  const data = await jsonp(CQ_BASE, { cmd: "getYears", make, model });
  // CarQuery returns { Years: { min_year, max_year } }
  const y = data.Years || data;
  if (!y || !y.min_year || !y.max_year) return [];
  const arr = [];
  for (let yr = Number(y.max_year); yr >= Number(y.min_year); yr--)
    arr.push(yr);
  return arr;
}
async function getTrims(make, model, year) {
  const data = await jsonp(CQ_BASE, { cmd: "getTrims", make, model, year });
  return data.Trims || [];
}

// Small util
function optList(
  items,
  getValue,
  getLabel,
  includeBlank = true,
  blankLabel = "Select"
) {
  const first = includeBlank ? `<option value="">${blankLabel}</option>` : "";
  return (
    first +
    items
      .map((i) => `<option value="${getValue(i)}">${getLabel(i)}</option>`)
      .join("")
  );
}

// Public initializer called from the page
window.initCarQueryPicker = function initCarQueryPicker() {
  const makeEl = document.getElementById("cq-make");
  const modelEl = document.getElementById("cq-model");
  const yearEl = document.getElementById("cq-year");
  const trimEl = document.getElementById("cq-trim");
  const debugEl = document.getElementById("debug");

  // Populate makes
  getMakes()
    .then((makes) => {
      // CarQuery "make_display" is the pretty label, "make_id" is canonical
      makeEl.innerHTML = optList(
        makes,
        (m) => m.make_display,
        (m) => m.make_display
      );
    })
    .catch((err) => (debugEl.textContent = err.message));

  makeEl.addEventListener("change", async () => {
    modelEl.disabled = yearEl.disabled = trimEl.disabled = true;
    modelEl.innerHTML =
      yearEl.innerHTML =
      trimEl.innerHTML =
        optList(
          [],
          (x) => x,
          (x) => x
        );
    if (!makeEl.value) return;

    const models = await getModels(makeEl.value);
    modelEl.innerHTML = optList(
      models,
      (m) => m.model_name,
      (m) => m.model_name
    );
    modelEl.disabled = false;
  });

  modelEl.addEventListener("change", async () => {
    yearEl.disabled = trimEl.disabled = true;
    yearEl.innerHTML = trimEl.innerHTML = optList(
      [],
      (x) => x,
      (x) => x
    );
    if (!modelEl.value) return;

    const years = await getYears(makeEl.value, modelEl.value);
    yearEl.innerHTML = optList(
      years,
      (y) => y,
      (y) => y
    );
    yearEl.disabled = false;
  });

  yearEl.addEventListener("change", async () => {
    trimEl.disabled = true;
    trimEl.innerHTML = optList(
      [],
      (x) => x,
      (x) => x,
      true,
      "(Optional)"
    );
    if (!yearEl.value) return;

    const trims = await getTrims(makeEl.value, modelEl.value, yearEl.value);
    // Some entries have blank/undefined model_trim; give them a label
    trimEl.innerHTML = optList(
      trims,
      (t) => t.model_trim || "",
      (t) => t.model_trim || "Standard",
      true,
      "(Optional)"
    );
    trimEl.disabled = false;
  });
};
