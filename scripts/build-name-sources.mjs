// Writes the root-language citation pack. Does not edit names.json.
import { readFileSync, writeFileSync } from "node:fs";
import { sourceIds, sourcePack } from "./name-sources.mjs";

const names = JSON.parse(readFileSync(new URL("../src/data/names.json", import.meta.url), "utf8")).names;
const pack = sourcePack(names);
const ids = sourceIds(names);
writeFileSync(new URL("../src/lib/name-source-pack.json", import.meta.url), `${JSON.stringify(pack)}\n`);
writeFileSync(new URL("../src/lib/name-source-ids.json", import.meta.url), `${JSON.stringify(ids)}\n`);
console.log(`name sources ${ids.length}`);
