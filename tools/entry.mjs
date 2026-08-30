/*
 * Making an entry by hand, until the editor can export one.
 *
 *     npm run entry -- neu <id>              a folder with the two files in it
 *     npm run entry -- symbol <wort> …       what ARASAAC has, and how well
 *     npm run entry -- aus <datei> [id]      an export from a product, converted
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

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

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

/* ------------------------------------------------------------------ aus --- */

/**
 * An export from one of the products, as an entry.
 *
 * ## What it does with the symbols
 *
 * A bildhaft slot carries a `concept` — the lemma it was looked up under — and
 * a `choice` per provider. Somebody working in METACOM has only the METACOM
 * half, and that half may not be published: it is a filename out of a licensed
 * folder. So the concept is looked up at ARASAAC instead, here, once per
 * concept rather than once per slot.
 *
 * **A confident answer is one that carries the word itself.** Anything else is
 * left empty and listed at the end, because a wrong symbol on a board reads
 * fine until somebody uses it — and 272 concepts is exactly the scale at which
 * "close enough" gets waved through. What comes out is an entry that is right
 * as far as it goes and honest about the rest.
 *
 * ## What it drops
 *
 * Ids, timestamps, the collection uuid, the candidate lists, and every METACOM
 * path. None of them is anybody's business on a shelf, and the last would fail
 * the check anyway.
 */
async function aus(path, wantedId) {
  if (!path || !existsSync(path)) { say(`No such file: ${path}`); process.exit(1); }

  // "PK", where every zip starts and no JSON does — a talker Sammlung exported
  // „für ein anderes Programm".
  const head = readFileSync(path).subarray(0, 2);
  if (head[0] === 0x50 && head[1] === 0x4b) return ausTalker(path, wantedId);

  const file = JSON.parse(readFileSync(path, "utf8"));

  if (file.format !== "bildhaft.collection") {
    say("Only a bildhaft export so far — its slots carry a concept, which is what");
    say("makes this possible at all. A mitreden export is a list of texts and needs");
    say("no conversion; a vorlaut board carries no concept to look anything up by.");
    process.exit(1);
  }

  const name = file.collection?.name ?? basename(path);
  const id = wantedId || slug(name);
  const dir = join(ROOT, "sammlungen", "entries", id);
  if (existsSync(dir)) { say(`${id} is already there.`); process.exit(1); }

  /* One lookup per concept, not per slot: the same word turns up in a dozen
   * sentences and ARASAAC does not need asking a dozen times. */
  const concepts = new Map();
  for (const sentence of file.sentences ?? []) {
    for (const slot of sentence.slots ?? []) {
      const key = slot.concept || slot.sourceToken;
      if (key && !concepts.has(key)) concepts.set(key, null);
    }
  }

  say(`${concepts.size} Begriffe bei ARASAAC nachschlagen …`);
  const unsure = [];
  let at = 0;
  const keys = [...concepts.keys()];
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (at < keys.length) {
      const key = keys[at++];
      const found = await lookup(key);
      if (found) concepts.set(key, found);
      else unsure.push(key);
    }
  }));

  const sentences = (file.sentences ?? []).map((sentence) => ({
    text: sentence.rawInput ?? "",
    slots: (sentence.slots ?? []).map((slot) => {
      const key = slot.concept || slot.sourceToken;
      const number = concepts.get(key);
      return {
        token: slot.sourceToken ?? key,
        concept: key,
        ...(number ? { arasaac: number } : {}),
      };
    }),
  }));

  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "saetze.json"), `${JSON.stringify({ sentences }, null, 2)}\n`);
  const entry = SKELETON(id);
  entry.product = "bildhaft";
  entry.name = name;
  entry.payload = "saetze.json";
  writeFileSync(join(dir, "entry.json"), `${JSON.stringify(entry, null, 2)}\n`);

  const slots = sentences.reduce((n, s) => n + s.slots.length, 0);
  const filled = sentences.reduce((n, s) => n + s.slots.filter((x) => x.arasaac).length, 0);

  say("");
  say(`sammlungen/entries/${id}/  —  ${sentences.length} Sätze, ${slots} Felder`);
  say(`  ${filled} haben eine ARASAAC-Nummer, ${slots - filled} nicht.`);
  if (unsure.length) {
    say("");
    say(`Ohne Nummer, weil kein Piktogramm das Wort selbst trägt (${unsure.length}):`);
    say(`  ${unsure.sort().join(", ")}`);
    say("");
    say("Für jedes davon: npm run entry -- symbol <wort>   und die Nummer eintragen,");
    say("mit einem Satz in symbolNotes, warum sie eine Ersetzung ist.");
  }
  say("");
  say("Dann: entry.json braucht noch description und tags. npm run check sagt, was fehlt.");
}

/* ---------------------------------------------------------- aus, talker --- */

/**
 * A talker Sammlung: five sets of four keys, exported „für ein anderes
 * Programm" — Open Board Format, one board per set, symbols as names and no
 * pixels in it at all.
 *
 * That export is the one that works for a Sammlung drawn in METACOM:
 * checkLicensing() refuses METACOM *pixels* and permits a reference, so the
 * file names each symbol without carrying it. The names are dropped here, as
 * they must be; what is kept is the words, the sets and the order.
 *
 * ## The concept is the label, stripped
 *
 * A talker key has no lemma behind it — somebody typed „Komm her!" and picked a
 * picture. So the first guess is the label with its punctuation off, and it is
 * only a guess: „Guck mal!" and „Raus gehen." are phrases, and the report at the
 * end is where they land for a person to decide.
 */
function ausTalker(path, wantedId) {
  /* `unzip -p`, and not a zip reader written here: node ships no unzip, this is
   * an authoring tool somebody runs by hand on a Mac or a Linux box, and forty
   * lines of central-directory parsing to save a shell call is forty lines to
   * keep right. Nothing in CI runs this verb. */
  const read = (member) => JSON.parse(execFileSync("unzip", ["-p", path, member], {
    encoding: "utf8", maxBuffer: 32 * 1024 * 1024,
  }));

  const manifest = read("manifest.json");
  const boards = manifest.paths?.boards ?? {};
  const order = Object.keys(boards).sort();
  if (!order.length) { say("No boards in that file."); process.exit(1); }

  const sets = order.map((key) => {
    const board = read(boards[key]);
    const byId = new Map((board.buttons ?? []).map((b) => [b.id, b]));
    /* grid.order is where the positions are. Two things in it are not keys:
     * the null in the top left, which is the hole the speaker sits in
     * (obf.ts's grid(), docs/hardware.md), and the button carrying load_board,
     * which is the set key that switches to the next set. Four are left, which
     * is what a set is. */
    const keys = [];
    let name = board.name ?? key;
    for (const id of (board.grid?.order ?? []).flat()) {
      const button = id ? byId.get(id) : null;
      if (!button) continue;
      if (button.load_board) { name = button.label || name; continue; }
      const text = button.vocalization || button.label || "";
      keys.push({ text, concept: conceptOf(text) });
    }
    return { name, concept: conceptOf(name), keys };
  });

  const id = wantedId || slug(sets[0]?.name ?? basename(path));
  const dir = join(ROOT, "sammlungen", "entries", id);
  if (existsSync(dir)) { say(`${id} is already there.`); process.exit(1); }

  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "saetze.json"), `${JSON.stringify({ sets }, null, 2)}\n`);
  const entry = SKELETON(id);
  entry.product = "vorlaut-talker";
  entry.name = "";
  entry.payload = "saetze.json";
  writeFileSync(join(dir, "entry.json"), `${JSON.stringify(entry, null, 2)}\n`);

  const words = sets.flatMap((s) => s.keys.filter(Boolean));
  say(`sammlungen/entries/${id}/  —  ${sets.length} Sets, ${words.length} Tasten`);
  say("");
  for (const set of sets) {
    say(`  ${set.name.padEnd(14)} ${set.keys.filter(Boolean).map((k) => k.text).join(" · ")}`);
  }
  say("");
  say("Keine Nummern: eine Taste trägt einen Satz, kein Lemma, und was „Guck mal!“");
  say("heißen soll ist eine Entscheidung. npm run entry -- symbol <wort> für jede.");
}

/** A first guess at what a key is about: the label without what it ends in. */
const conceptOf = (text) => text.trim().replace(/[!.?…]+$/u, "").trim().toLowerCase();

/** A confident number for one concept, or null. See aus() for what confident
 *  means and why nothing less is written into a file. */
async function lookup(word) {
  try {
    const answer = await fetch(
      `https://api.arasaac.org/v1/pictograms/de/search/${encodeURIComponent(word)}`);
    if (!answer.ok) return null;
    const found = await answer.json();
    if (!Array.isArray(found)) return null;
    const exact = found.find((one) => rate(one, word) === "genau");
    return exact ? exact._id : null;
  } catch {
    return null;
  }
}

/** „Kommunikationsfächer" -> „kommunikationsfaecher". The same shape ids have. */
const slug = (name) => name.toLowerCase()
  .replaceAll("ä", "ae").replaceAll("ö", "oe").replaceAll("ü", "ue").replaceAll("ß", "ss")
  .normalize("NFD").replace(/\p{M}/gu, "")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/* ----------------------------------------------------------------- said --- */

if (verb === "neu") neu(rest[0]);
else if (verb === "symbol") await symbol(rest);
else if (verb === "aus") await aus(rest[0], rest[1]);
else {
  say("npm run entry -- neu <id>            eine neue Sammlung anlegen");
  say("npm run entry -- symbol <wort> …     Nummern bei ARASAAC suchen");
  say("npm run entry -- aus <datei> [id]    einen Export umwandeln");
  process.exit(1);
}
