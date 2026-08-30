/*
 * What holds links.mjs to being the only place an outbound address is written.
 *
 * Three questions, and the third is the one that matters: a page that spells a
 * URL out inline looks exactly right until the product moves, and then it is
 * the line nobody edits. Failing the build is cheaper than finding it later in
 * a bookmark that no longer resolves.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { links } from "../links.mjs";

const SITE = new URL("../site/", import.meta.url).pathname;
const PLACEHOLDER = /\{\{\s*([A-Za-z]+)\s*\}\}/g;

// Anything that looks like a written-out address. The two schemes only: a bare
// "github.com/..." in prose is a thing a reader types, not a link a build has
// to resolve.
const BARE_URL = /https?:\/\/[^\s"'<>]+/g;

/* Five holes the build fills from the Sammlungen shelf rather than from
 * links.mjs. They are generated content, not addresses, and the rule below
 * would otherwise report each of them as a missing entry. */
const GENERATED = new Set(["filter", "filterRules", "karten", "anzahl", "stand"]);

/* site/ has folders in it, so the walk recurses — a page in a subdirectory owes
 * the same rule as one at the top. */
function pagesUnder(dir, prefix = "") {
  const found = [];
  for (const name of readdirSync(dir)) {
    if (prefix === "" && name === "design") continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) found.push(...pagesUnder(path, `${prefix}${name}/`));
    else if (name.endsWith(".html")) found.push(`${prefix}${name}`);
  }
  return found;
}

const pages = pagesUnder(SITE);
const problems = [];
const used = new Set();

for (const page of pages) {
  const html = readFileSync(join(SITE, page), "utf8");

  for (const [, key] of html.matchAll(PLACEHOLDER)) {
    if (GENERATED.has(key)) continue;
    if (!(key in links)) {
      problems.push(`${page}: {{${key}}} has no entry in links.mjs`);
    }
    used.add(key);
  }

  for (const [url] of html.matchAll(BARE_URL)) {
    problems.push(
      `${page}: the address ${url} is written into the page. ` +
        "Put it in links.mjs and use its placeholder here.",
    );
  }
}

for (const key of Object.keys(links)) {
  if (!used.has(key)) {
    problems.push(`links.mjs: nothing uses ${key}. Remove it, or use it.`);
  }
}

/* ------------------------------------------------ the Sammlungen entries ---
 *
 * Two licensing rules and the rest integrity. The licensing ones are first
 * because they are why the entries live in a repository with a check at all:
 *
 * METACOM is licensed per person. A person handing another person their own
 * exported file may carry METACOM references — bildhaft does that deliberately,
 * and it is what makes a shared collection look identical to a recipient
 * holding the same licence. Publishing a curated index of those names is a
 * different act. The line is the actor, not the bytes, and this is what makes
 * the second half true rather than intended.
 */

const ENTRIES = new URL("../sammlungen/entries/", import.meta.url).pathname;
const SCHEMA = 1;
const PRODUCTS = ["vorlaut-app", "vorlaut-talker", "bildhaft", "mitreden"];
/* "none" is the format's own third value (exchange/SPEC.md §5.1), and a
 * mitreden Sammlung is what it is for: sentences carry no pictures at all. */
const SOURCES = ["arasaac", "none"];
const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const PICTURE = /\.(png|jpe?g|gif|webp|avif|svg|bmp)$/i;
/* Not word-bounded: `metacom:haus` and `METACOM_wasser_01` both have to be
   caught, and a false positive costs somebody one rename. */
const METACOM = /metacom/i;

const entries = new Map();

if (existsSync(ENTRIES)) {
  for (const dir of readdirSync(ENTRIES).filter((d) => statSync(join(ENTRIES, d)).isDirectory())) {
    const here = `sammlungen/entries/${dir}`;

    for (const name of readdirSync(join(ENTRIES, dir))) {
      if (PICTURE.test(name)) {
        problems.push(`${here}/${name}: is a picture. Entries hold symbol numbers; `
          + "the pictures are fetched at build time.");
      }
      if (METACOM.test(readFileSync(join(ENTRIES, dir, name), "utf8"))) {
        problems.push(`${here}/${name}: names METACOM. A published entry may not: `
          + "the licence is per person. Use an ARASAAC number, or leave the key without one.");
      }
    }

    let entry;
    try {
      entry = JSON.parse(readFileSync(join(ENTRIES, dir, "entry.json"), "utf8"));
    } catch (error) {
      problems.push(`${here}/entry.json: is not readable JSON — ${error.message}`);
      continue;
    }

    if (entry.schema !== SCHEMA) {
      problems.push(`${here}/entry.json: is schema ${entry.schema}, and this check knows ${SCHEMA}.`);
    }
    if (entry.id !== dir || !ID.test(String(entry.id))) {
      problems.push(`${here}/entry.json: the id "${entry.id}" must match its folder and be `
        + "lower-case words joined by hyphens — a URL is built from it.");
    }
    if (entries.has(entry.id)) problems.push(`${here}/entry.json: repeats the id "${entry.id}".`);
    for (const field of ["name", "description", "payload"]) {
      if (!String(entry[field] ?? "").trim()) problems.push(`${here}/entry.json: has no ${field}.`);
    }
    /* Attribution is owed where there are pictures and is meaningless where
       there are none — an entry drawn in nothing has nobody to credit. */
    if (entry.symbols !== "none" && !String(entry.attribution ?? "").trim()) {
      problems.push(`${here}/entry.json: has no attribution, and its symbols are ${entry.symbols}.`);
    }
    if (entry.symbols === "none" && String(entry.attribution ?? "").trim()) {
      problems.push(`${here}/entry.json: credits somebody for symbols it does not have.`);
    }
    /* Where an entry is made of somebody else's work — a word list out of a
       published game, the sentences of a picture book — `source` is where that
       is said. Half a credit is worse than none: a title nobody can follow is a
       claim that somebody was credited. */
    if (entry.source !== undefined) {
      const s = entry.source ?? {};
      for (const field of ["title", "by", "url"]) {
        if (!String(s[field] ?? "").trim()) {
          problems.push(`${here}/entry.json: source has no ${field}.`);
        }
      }
      if (s.url && !/^https:\/\//.test(String(s.url))) {
        problems.push(`${here}/entry.json: source.url is not an https address.`);
      }
    }

    if (!SOURCES.includes(entry.symbols)) {
      problems.push(`${here}/entry.json: names the symbol source "${entry.symbols}". `
        + `Known: ${SOURCES.join(", ")}.`);
    }
    if (!PRODUCTS.includes(entry.product)) {
      problems.push(`${here}/entry.json: names the product "${entry.product}". `
        + `Known: ${PRODUCTS.join(", ")}.`);
    }

    let payload = null;
    try {
      payload = JSON.parse(readFileSync(join(ENTRIES, dir, entry.payload), "utf8"));
    } catch (error) {
      problems.push(`${here}/${entry.payload}: is not readable JSON — ${error.message}`);
    }
    entries.set(entry.id, { entry, payload, here });
  }
}

/* A link that holds on one side only is the one somebody finds by being
   confused. Mirroring it in CI would be nicer still; until then this. */
for (const { entry, here } of entries.values()) {
  for (const other of entry.seeAlso ?? []) {
    const target = entries.get(other);
    if (!target) { problems.push(`${here}/entry.json: points at "${other}", which is not here.`); continue; }
    if (!(target.entry.seeAlso ?? []).includes(entry.id)) {
      problems.push(`${here}/entry.json: points at "${other}", which does not point back.`);
    }
  }
}

/** Every arasaac number in a payload, wherever the product keeps it. */
function numbersIn(value, found = []) {
  if (Array.isArray(value)) for (const one of value) numbersIn(one, found);
  else if (value && typeof value === "object") {
    for (const [key, inner] of Object.entries(value)) {
      if (key === "arasaac") found.push(inner);
      else numbersIn(inner, found);
    }
  }
  return found;
}

const numbers = new Set();
for (const { payload, here } of entries.values()) {
  for (const number of numbersIn(payload ?? {})) {
    if (!Number.isInteger(number) || number <= 0) {
      problems.push(`${here}: has the ARASAAC number ${JSON.stringify(number)}, which is not one.`);
    } else numbers.add(number);
  }
}

/* Asking ARASAAC whether every number still resolves is the one check that
   needs the network, so it is opt-in: CI runs it, a laptop on a train does
   not, and a third party being down never fails somebody's local build. */
const online = process.argv.includes("--online");
if (online && numbers.size > 0) {
  const list = [...numbers];
  const missing = [];
  let at = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (at < list.length) {
      const number = list[at++];
      try {
        const answer = await fetch(`https://api.arasaac.org/v1/pictograms/${number}`);
        if (!answer.ok) missing.push(number);
      } catch (error) {
        problems.push(`arasaac.org: could not be asked about ${number} — ${error.message}`);
      }
    }
  }));
  for (const number of missing.sort((a, b) => a - b)) {
    problems.push(`arasaac.org: has no pictogram ${number}.`);
  }
}

if (problems.length > 0) {
  for (const problem of problems) console.error(problem);
  process.exit(1);
}

console.log(
  `${pages.length} pages, ${used.size} addresses, all of them out of links.mjs.`,
);
console.log(
  `${entries.size} ${entries.size === 1 ? "Sammlung" : "Sammlungen"}, `
  + `${numbers.size} ARASAAC numbers`
  + `${online ? ", all of which resolve" : " (not asked — pass --online)"}, `
  + "no METACOM name and no picture.",
);
