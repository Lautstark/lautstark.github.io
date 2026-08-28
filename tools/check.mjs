/*
 * What holds links.mjs to being the only place an outbound address is written.
 *
 * Three questions, and the third is the one that matters: a page that spells a
 * URL out inline looks exactly right until the product moves, and then it is
 * the line nobody edits. Failing the build is cheaper than finding it later in
 * a bookmark that no longer resolves.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { links } from "../links.mjs";

const SITE = new URL("../site/", import.meta.url).pathname;
const PLACEHOLDER = /\{\{\s*([A-Za-z]+)\s*\}\}/g;

// Anything that looks like a written-out address. The two schemes only: a bare
// "github.com/..." in prose is a thing a reader types, not a link a build has
// to resolve.
const BARE_URL = /https?:\/\/[^\s"'<>]+/g;

const pages = readdirSync(SITE).filter((f) => f.endsWith(".html"));
const problems = [];
const used = new Set();

for (const page of pages) {
  const html = readFileSync(join(SITE, page), "utf8");

  for (const [, key] of html.matchAll(PLACEHOLDER)) {
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

if (problems.length > 0) {
  for (const problem of problems) console.error(problem);
  process.exit(1);
}

console.log(
  `${pages.length} pages, ${used.size} addresses, all of them out of links.mjs.`,
);
