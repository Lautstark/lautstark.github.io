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

import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { links } from "../links.mjs";
import { sammlungen } from "./sammlungen.mjs";

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

/* The shelf, before the pages: it writes its own index and payloads into dist/
 * and hands back the holes its page carries. Those holes are generated content
 * rather than addresses, which is why they are substituted from here and not
 * from links.mjs — and why tools/check.mjs knows their names. */
const shelf = sammlungen(root, dist, links) ?? {};

/* site/ has a folder in it now, so the walk recurses. It used to be one level
 * and a `continue` past site/design; both facts moved into here. */
function* under(dir, prefix = "") {
  for (const name of readdirSync(dir)) {
    // Local copies of the shared styles, for opening a page straight off disk.
    // The build writes its pinned copy below and must not treat this as a page.
    if (prefix === "" && name === "design") continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* under(path, `${prefix}${name}/`);
    else yield { path, out: `${prefix}${name}`, dir };
  }
}

for (const file of under(site)) {
  const to = join(dist, file.out);
  mkdirSync(dirname(to), { recursive: true });

  if (file.out.endsWith(".html")) {
    const html = readFileSync(file.path, "utf8")
      .replace(/\{\{\s*([A-Za-z]+)\s*\}\}/g, (_, key) =>
        key in shelf ? shelf[key] : links[key])
      // Resolved against the page's own folder, not against site/: a page in a
      // subdirectory names its pictures relative to itself.
      .replace(/<img[^>]*?src="([^"]+\.png)"/g, (whole, src) => {
        const { width, height } = pngSize(join(file.dir, src));
        return `${whole} width="${width}" height="${height}"`;
      });
    writeFileSync(to, html);
  } else {
    cpSync(file.path, to);
  }
}

// Self-hosted, both of them: no stylesheet on this site is fetched from
// somewhere else, and the pinned tag in package.json is what says which version
// a visitor gets.
cpSync(join(design, "tokens", "vorlaut.css"), join(dist, "styles", "tokens.css"));
cpSync(join(design, "docs", "components.css"), join(dist, "styles", "components.css"));

console.log(`Built ${readdirSync(dist).length} entries into dist/.`);
