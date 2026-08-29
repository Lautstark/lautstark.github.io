/*
 * Making an entry by hand, until the editor can export one.
 *
 *     npm run entry -- neu <id>              a folder with the two files in it
 *     npm run entry -- symbol <wort> …       what ARASAAC has, and how well
 *
 * ## Why the second verb exists
 *
 * Because the first hit is often wrong, and wrong in a way that reads fine
 * until somebody puts it in front of a child. Searching the German `mehr`
 * returns a map of a sheltered workshop; `nicht` returns a guessing game; `weg`
 * returns an exact keyword match for the *noun* — a footpath — rather than the
 * adverb. `nochmal` returns nothing at all until you know to ask for `noch
 * einmal`.
 *
 * So this prints candidates rather than picking one, says whether a hit matched
 * the word or merely contained it, and shows the keywords a pictogram actually
 * carries so that a wrong sense is visible before it is chosen. Choosing stays
 * a person's job, and `symbolNotes` in the entry is where the choice gets its
 * reason.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("../", import.meta.url).pathname;
const [verb, ...rest] = process.argv.slice(2);

const say = (line = "") => console.log(line);

/* ------------------------------------------------------------------ neu --- */

const SKELETON = (id) => ({
  schema: 1,
  id,
  product: "vorlaut-app",
  name: "",
  description: "",
  tags: [],
  language: "de",
  symbols: "arasaac",
  attribution: "Piktogramme: ARASAAC (arasaac.org), CC BY-NC-SA. "
    + "Autor: Sergio Palao. Urheber: Regierung von Aragón (Spanien).",
  seeAlso: [],
  payload: "board.json",
  symbolNotes: {},
});

/* A 4×7 with its first column shared, which is the shape the shelf's first
 * entry settled on. Two buttons, so the file says what a button looks like
 * without pretending to be a vocabulary. */
const BOARD = {
  grid: { rows: 4, columns: 7 },
  firstColumnShared: true,
  home: "start",
  pages: [{
    id: "start",
    name: "",
    buttons: [
      { row: 0, col: 0, text: "ich", wordclass: "pronoun", concept: "ich", terms: ["ich"], arasaac: 6632 },
      { row: 3, col: 0, text: "Start", wordclass: "", act: "home" },
    ],
  }],
};

function neu(id) {
  if (!id || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) {
    say("An id is lower-case words joined by hyphens: erste-woerter");
    process.exit(1);
  }
  const dir = join(ROOT, "sammlungen", "entries", id);
  if (existsSync(dir)) { say(`${id} is already there.`); process.exit(1); }

  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "entry.json"), `${JSON.stringify(SKELETON(id), null, 2)}\n`);
  writeFileSync(join(dir, "board.json"), `${JSON.stringify(BOARD, null, 2)}\n`);

  say(`sammlungen/entries/${id}/`);
  say("  entry.json   name and description are empty; the check will say so");
  say("  board.json   a 4×7 with its first column shared, and two buttons");
  say("");
  say("Then:  npm run entry -- symbol mehr weg      to find the numbers");
  say("       npm run check                        to see what is missing");
}

/* --------------------------------------------------------------- symbol --- */

/** How well a pictogram answers the word that was asked for.
 *
 * Trimmed, and that is not tidiness: ARASAAC stores „mehr " with a trailing
 * space, so an untrimmed comparison called every one of its four exact matches
 * approximate — and the first version of this tool did, which is how the shelf
 * ended up carrying „hinzufügen" for a word that has its own pictogram. */
function rate(pictogram, word) {
  const keywords = (pictogram.keywords ?? []).map((k) => (k.keyword ?? "").trim().toLowerCase());
  return keywords.includes(word.trim().toLowerCase()) ? "genau" : "ungefähr";
}

async function symbol(words) {
  if (!words.length) { say("Which word? npm run entry -- symbol mehr weg"); process.exit(1); }

  for (const word of words) {
    say(`\n${word}`);
    let found;
    try {
      const answer = await fetch(
        `https://api.arasaac.org/v1/pictograms/de/search/${encodeURIComponent(word)}`);
      found = answer.ok ? await answer.json() : [];
    } catch (error) {
      say(`  ARASAAC ließ sich nicht fragen — ${error.message}`);
      continue;
    }

    if (!Array.isArray(found) || !found.length) {
      say("  nichts. Ein anderes Wort versuchen — „noch einmal“ statt „nochmal“.");
      continue;
    }

    for (const pictogram of found.slice(0, 5)) {
      const keywords = (pictogram.keywords ?? []).map((k) => k.keyword?.trim()).filter(Boolean);
      say(`  ${String(pictogram._id).padEnd(7)} ${rate(pictogram, word).padEnd(9)} `
        + `${keywords.slice(0, 4).join(" / ")}`);
    }

    /* The line that earns this tool — and it asks about the candidates shown,
     * not about the first one: ARASAAC's ranking puts a sheltered-workshop map
     * above the two pictograms actually keyworded „mehr".
     *
     * An exact match can still be the wrong sense — „weg" finds the footpath —
     * so the keywords above are what to read, not the rating. */
    if (!found.slice(0, 5).some((one) => rate(one, word) === "genau")) {
      say("  ↑ keiner trägt das Wort selbst. Was hier steht, ist eine Ersetzung —");
      say("    und gehört dann als Satz in symbolNotes.");
    }
  }
  say("");
  say("Bilder ansehen: https://arasaac.org/pictograms/de/<nummer>");
}

/* ----------------------------------------------------------------- said --- */

if (verb === "neu") neu(rest[0]);
else if (verb === "symbol") await symbol(rest);
else {
  say("npm run entry -- neu <id>            eine neue Sammlung anlegen");
  say("npm run entry -- symbol <wort> …     Nummern bei ARASAAC suchen");
  process.exit(1);
}
