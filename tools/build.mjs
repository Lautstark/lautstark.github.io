/*
 * Assembles dist/: the pages with their addresses substituted in, the design
 * tokens copied in beside them, and nothing else.
 *
 * There is no framework here and no bundler, because there is nothing to bundle
 * — two hand-written pages and a stylesheet. What this script is for is the two
 * things that cannot be done by hand: putting the addresses from links.mjs into
 * the markup, and taking the shared design files out of node_modules so they
 * are served from this origin rather than fetched from anywhere.
 *
 * Every path inside the built pages is relative, so the output is correct under
 * a project site's /vorlaut/ base, under a user site's root, and from a file://
 * path on disk. There is no base to configure and so no base to get wrong.
 */

import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { links } from "../links.mjs";

/* A PNG's own width and height, out of its IHDR: eight bytes of signature, a
 * four-byte length, the four letters, then the two numbers.
 *
 * The pages do not carry these as typed-in attributes, because a screenshot
 * gets replaced -- a collection is re-shot with different symbols, a tablet
 * with a different screen -- and a stale pair of numbers reserves the wrong
 * box, so the page jumps while the picture loads. Read from the file, they
 * cannot disagree with it. */
function pngSize(file) {
  const head = readFileSync(file).subarray(16, 24);
  return { width: head.readUInt32BE(0), height: head.readUInt32BE(4) };
}

const root = new URL("../", import.meta.url).pathname;
const site = join(root, "site");
const dist = join(root, "dist");
const design = join(root, "node_modules", "@lautstark", "design");

rmSync(dist, { recursive: true, force: true });
// NOT "design/". On an organisation site every repository in the organisation
// claims its own path prefix, and Lautstark/design has a project site — so
// /design/ is served by that repository and shadows anything of the same name
// here. It cost a deploy that looked green with no colour tokens on it. The
// same trap waits for any folder named after a repository: vorlaut, mitreden,
// bildhaft, bildquelle, sicherung, stimmquelle.
mkdirSync(join(dist, "styles"), { recursive: true });

for (const file of readdirSync(site)) {
  // The source pages may be opened directly during writing, so site/design
  // holds local copies of the shared styles. The build writes its pinned copy
  // below, and must not try to copy this directory as if it were a file.
  if (file === "design") continue;
  if (file.endsWith(".html")) {
    const html = readFileSync(join(site, file), "utf8")
      .replace(/\{\{\s*([A-Za-z]+)\s*\}\}/g, (_, key) => links[key])
      .replace(/<img[^>]*?src="([^"]+\.png)"/g, (whole, src) => {
        const { width, height } = pngSize(join(site, src));
        return `${whole} width="${width}" height="${height}"`;
      });
    writeFileSync(join(dist, file), html);
  } else {
    cpSync(join(site, file), join(dist, file));
  }
}

// Self-hosted, both of them: no stylesheet on this site is fetched from
// somewhere else, and the pinned tag in package.json is what says which version
// a visitor gets.
cpSync(join(design, "tokens", "vorlaut.css"), join(dist, "styles", "tokens.css"));
cpSync(join(design, "docs", "components.css"), join(dist, "styles", "components.css"));

console.log(`Built ${readdirSync(dist).length} entries into dist/.`);
