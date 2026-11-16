// Root-language citations for /names. Reads names.json; does not edit it.
const URL_RE = /https?:\/\/[^\s<>"']+/g;

function urlsIn(source) {
  return [...source.matchAll(URL_RE)].map((match) => match[0].replace(/[.,);]+$/g, ""));
}

/** Cards that store a root-language citation, in registry order. */
export function extractNameSources(names) {
  const rows = [];
  for (const row of names) {
    const source = row?.root?.source;
    if (typeof source !== "string" || !source.trim()) continue;
    const urls = urlsIn(source);
    rows.push({ id: row.id, source, urls: [...urls] });
  }
  return rows;
}

export function sourcePack(names) {
  const pack = {};
  for (const row of extractNameSources(names)) pack[row.id] = row.source;
  return pack;
}

export function sourceIds(names) {
  return extractNameSources(names).map((row) => row.id);
}

export function assertNameSourcesFresh(pack, ids, names) {
  const expected = sourcePack(names);
  const expectedIds = Object.keys(expected).sort();
  const packIds = Object.keys(pack).sort();
  const listed = [...ids].sort();
  if (packIds.join("\n") !== expectedIds.join("\n") || listed.join("\n") !== expectedIds.join("\n")) {
    throw new Error("name source pack stale: ids drifted from names.json");
  }
  for (const id of expectedIds) {
    if (pack[id] !== expected[id]) throw new Error(`name source pack stale: ${id}`);
  }
}
