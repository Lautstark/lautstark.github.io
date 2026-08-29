/*
 * The files somebody downloads, built into dist/.
 *
 * Its own entry point rather than a step inside build.mjs, because this is the
 * one thing on this site that reaches a third party: it asks ARASAAC for
 * pixels. A page that fails to build is a mistake in this repository; a
 * download step that fails is usually somebody else's server having a bad
 * morning, and the two should not read as the same failure.
 */

import { downloads } from "./sammlungen.mjs";

const root = new URL("../", import.meta.url).pathname;
const written = await downloads(root, `${root}dist`);

for (const one of written) {
  console.log(`sammlungen/download/${one.id}.json: `
    + `${one.symbols} Bilder, ${Math.round(one.bytes / 1024)} KB.`);
}
if (!written.length) console.log("No tablet Sammlungen to package.");
