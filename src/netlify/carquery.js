import fetch from "node-fetch";
export const handler = async (event) => {
  const url = new URL(event.rawUrl);
  const type = url.searchParams.get("type");
  const make = url.searchParams.get("make");
  const model = url.searchParams.get("model");
  const year = url.searchParams.get("year");

  const base = "https://www.carqueryapi.com/api/0.3";
  let cqUrl;
  if (type === "makes") cqUrl = `${base}/?cmd=getMakes`;
  else if (type === "models")
    cqUrl = `${base}/?cmd=getModels&make=${encodeURIComponent(make)}`;
  else if (type === "years")
    cqUrl = `${base}/?cmd=getYears&make=${encodeURIComponent(
      make
    )}&model=${encodeURIComponent(model)}`;
  else if (type === "trims")
    cqUrl = `${base}/?cmd=getTrims&make=${encodeURIComponent(
      make
    )}&model=${encodeURIComponent(model)}&year=${encodeURIComponent(year)}`;
  else return { statusCode: 400, body: "bad request" };

  const r = await fetch(cqUrl);
  const t = await r.text(); // CarQuery returns JSONP-ish
  const json = JSON.parse(t.replace(/^[^(]*\(/, "").replace(/\);?$/, ""));
  return { statusCode: 200, body: JSON.stringify(json) };
};
