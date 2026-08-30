/*
 * The Sammlungen section: reading the entries, drawing the page, and building
 * the file somebody downloads.
 *
 * Lives beside build.mjs rather than in its own repository because it needs
 * three things this one already has and none of them is worth having twice: an
 * Impressum reachable from every page, the footer that carries it, and the rule
 * that every outbound address comes out of links.mjs.
 *
 * ## No JavaScript, on purpose
 *
 * The filter is radio inputs and a sibling selector. It was a script once, and
 * a script bought two things: typing to search, and filtering without a
 * repaint. At this size the first is what the browser's own find already does
 * and the second is not a wait anybody notices — and the cost was that this
 * page could not live here, on a site whose pages carry no JavaScript at all.
 * The trade only looks close until you notice the filter still works with the
 * script that is not there.
 *
 * Radios rather than buttons is also the better answer for a single-select
 * filter: a screen reader announces a group with one chosen, which is what this
 * is, instead of eight independent things that happen to be pressed.
 *
 * ## No picture is committed
 *
 * The entries hold ARASAAC numbers. `downloads()` fetches the pixels at build
 * time, straight into dist/, and the cache under .cache/ is not committed
 * either. The board previews on the page carry Aufschriften rather than
 * pictograms — which is the more useful preview anyway, and means this page
 * owes no attribution: that is a licence obligation wherever the pictograms
 * appear, and here none does.
 */

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync }
  from "node:fs";
import { dirname, join } from "node:path";

const SCHEMA = 1;

export const PRODUCTS = {
  "vorlaut-app": { label: "vorlaut", hue: "vorlaut" },
  "vorlaut-talker": { label: "Talker", hue: "vorlaut" },
  bildhaft: { label: "bildhaft", hue: "bildhaft" },
  mitreden: { label: "mitreden", hue: "mitreden" },
};

const esc = (value) => String(value)
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

/* ---------------------------------------------------------------- reading --- */

const boardFacts = (payload) => {
  const { rows, columns } = payload.grid ?? {};
  return {
    grid: `${rows}×${columns}`,
    cells: rows * columns,
    filled: (payload.pages ?? []).reduce((n, page) => n + (page.buttons?.length ?? 0), 0),
    pages: (payload.pages ?? []).length,
  };
};
const sentenceFacts = (payload) => ({ sentences: (payload.sentences ?? []).length });

const factsFor = {
  "vorlaut-app": boardFacts,
  "vorlaut-talker": (payload) => ({
    sets: (payload.sets ?? []).length,
    filled: (payload.sets ?? []).reduce((n, s) => n + (s.keys?.filter(Boolean).length ?? 0), 0),
  }),
  bildhaft: sentenceFacts,
  mitreden: sentenceFacts,
};

/** Every entry, sorted by id so a rebuild with nothing changed is the same bytes. */
export function readEntries(root) {
  const dir = join(root, "sammlungen", "entries");
  if (!existsSync(dir)) return [];
  const found = [];

  for (const name of readdirSync(dir)) {
    if (!statSync(join(dir, name)).isDirectory()) continue;
    const entry = JSON.parse(readFileSync(join(dir, name, "entry.json"), "utf8"));
    const payload = JSON.parse(readFileSync(join(dir, name, entry.payload), "utf8"));
    found.push({
      meta: {
        ...entry,
        facts: (factsFor[entry.product] ?? (() => ({})))(payload),
        payload: `entries/${entry.id}/${entry.payload}`,
      },
      payload,
      from: join(dir, name, entry.payload),
    });
  }

  found.sort((a, b) => a.meta.id.localeCompare(b.meta.id));
  return found;
}

/* ---------------------------------------------------------------- drawing --- */

/** A board as its Aufschriften and its empty cells. Not the artwork: see the
 *  head of this file for why that is the better picture and not only the
 *  cheaper one. */
function boardPreview(payload) {
  const { rows, columns } = payload.grid;
  const home = payload.pages.find((p) => p.id === payload.home) ?? payload.pages[0];
  const at = new Map(home.buttons.map((b) => [`${b.row},${b.col}`, b]));
  const cells = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < columns; col += 1) {
      const button = at.get(`${row},${col}`);
      if (!button) { cells.push('<span class="zelle zelle--frei"></span>'); continue; }
      const shared = payload.firstColumnShared && col === 0;
      cells.push(`<span class="zelle${shared ? " zelle--spalte" : ""}">${esc(button.text)}</span>`);
    }
  }
  return `<div class="brett" style="--spalten: ${columns}">${cells.join("")}</div>`;
}

function factLine(meta) {
  const f = meta.facts;
  if (meta.product === "vorlaut-app") {
    return `${f.grid} · ${f.filled} von ${f.cells} Tasten belegt · `
      + (f.pages === 1 ? "eine Seite" : `${f.pages} Seiten`);
  }
  if (meta.product === "vorlaut-talker") return `${f.sets} Sets · ${f.filled} Tasten belegt`;
  return `${f.sentences} Sätze`;
}

/* Somebody typing "worter" or "woerter" means „Wörter", and a catalogue in
 * German that answers neither has a trick to it. Folded on both sides — here
 * into the haystack, and in search.js into what was typed. */
const fold = (value) => value.toLowerCase().replaceAll("ß", "ss")
  .normalize("NFD").replace(/\p{M}/gu, "");
const spelt = (value) => value.toLowerCase()
  .replaceAll("ä", "ae").replaceAll("ö", "oe").replaceAll("ü", "ue").replaceAll("ß", "ss");
const searchable = (value) => `${fold(value)} ${fold(spelt(value))}`;

/**
 * What a card offers.
 *
 * The editor takes an id in the address and opens that Sammlung straight away.
 * The address itself comes from links.mjs through build.mjs rather than being
 * written here: the substitution pass does not rescan its own output, so a
 * {{editor}} left in a generated card would ship as four literal braces.
 *
 * Only the tablet Sammlungen have a file yet. The others say so rather than
 * offering a link that would answer 404.
 */
/* Which programs take a Sammlung from the address, and what each calls itself
 * in „In … öffnen". A product missing here still offers its file; the button
 * arrives when that program learns to read ?sammlung=. */
const OPENS = { "vorlaut-app": "editor", mitreden: "mitreden", bildhaft: "bildhaft" };

/**
 * Which products have a file to hand over.
 *
 * Every product in OPENS must be here too: the link a card offers fetches the
 * same file the download does. bildhaft was in one and not the other for a day,
 * so its card promised a door with nothing behind it — the entry did not exist
 * yet when that was written, and then it did.
 */
const FILES = new Set(["vorlaut-app", "mitreden", "bildhaft"]);
for (const product of Object.keys(OPENS)) {
  if (!FILES.has(product)) {
    throw new Error(`${product} can be opened from a link but has no file to open.`);
  }
}
const downloadable = (meta) => FILES.has(meta.product);

/**
 * What a card offers: the file, and — where the program can take it — the link
 * that skips the file entirely.
 *
 * A new tab, because this page is a shelf: somebody comparing three Sammlungen
 * should not lose the shelf to try one. The download is left alone; `download`
 * does not navigate, and a tab that opens and closes again is a flash.
 */
function actions(meta, links) {
  const file = downloadable(meta)
    ? `<a href="download/${esc(meta.id)}.json" download>Herunterladen</a>`
    : "";
  const key = OPENS[meta.product];
  const open = key
    ? `<a href="${esc(links[key])}?sammlung=${esc(meta.id)}" target="_blank" rel="noopener">`
      + `In ${esc(PRODUCTS[meta.product].label)} öffnen</a>`
    : "";

  const both = [open, file].filter(Boolean);
  if (!both.length) return '<span class="dazu">Kommt noch</span>';
  return both.join('<span class="dazu"> · </span>');
}

/**
 * Whose work an entry is made of, where it is somebody else's.
 *
 * On the card and not only in the file, because the card is where somebody
 * decides to take it — and a credit that only travels inside the download is a
 * credit nobody reads before they have already helped themselves.
 */
const credit = (meta) => meta.source
  ? `<p class="quelle">Nach <a href="${esc(meta.source.url)}" target="_blank" rel="noopener">`
    + `${esc(meta.source.title)}</a> von ${esc(meta.source.by)}`
    + (meta.source.publisher ? `, ${esc(meta.source.publisher)}` : "") + "</p>"
  : "";

function card({ meta, payload }, links) {
  const product = PRODUCTS[meta.product];
  const tags = (meta.tags ?? []).map((t) => `<span class="marke">${esc(t)}</span>`).join("");
  const seeAlso = (meta.seeAlso ?? []).length
    ? `<span class="marke">siehe auch: ${meta.seeAlso.length}</span>` : "";

  const haystack = searchable(
    [meta.name, meta.description, ...(meta.tags ?? []), product.label, meta.facts.grid ?? ""]
      .join(" "));

  return `      <article class="karte produkt ${esc(product.hue)}" data-produkt="${esc(meta.product)}"
        data-text="${esc(haystack)}">
        <p class="karte__wer"><span class="punkt"></span>${esc(product.label)}</p>
        <h3>${esc(meta.name)}</h3>
        ${meta.product === "vorlaut-app" ? boardPreview(payload) : ""}
        <p class="karte__was">${esc(meta.description)}</p>
        <p class="karte__zahlen">${esc(factLine(meta))}</p>
        <p class="marken">${tags}${seeAlso}</p>
        ${credit(meta)}
        <p class="karte__tun">${actions(meta, links)}</p>
      </article>`;
}

/**
 * The filter, as radio inputs that precede everything they act on.
 *
 * „Für“ is always drawn, even holding one value: it is what this page is
 * organised by, and a row that appears the day a second product lands leaves
 * somebody hunting for a control that was never there.
 *
 * The ids are what the rest of the site links against: another page sends
 * ?produkt=<id> and search.js checks the radio of that name. A product with no
 * entries has no radio here, and such a link simply opens the whole shelf.
 */
function filter(entries) {
  const counts = new Map();
  for (const { meta } of entries) counts.set(meta.product, (counts.get(meta.product) ?? 0) + 1);

  const inputs = ['<input type="radio" name="produkt" id="p-alle" class="wahl" checked>'];
  const chips = ['<label class="chip" for="p-alle">Alle</label>'];
  for (const [product, n] of counts) {
    inputs.push(`<input type="radio" name="produkt" id="p-${esc(product)}" class="wahl">`);
    chips.push(`<label class="chip" for="p-${esc(product)}">${esc(PRODUCTS[product].label)}`
      + `<span class="n">${n}</span></label>`);
  }

  return `${inputs.join("\n    ")}
    <fieldset class="filter">
      <legend>Für</legend>
      ${chips.join("\n      ")}
    </fieldset>`;
}

/** The rules that hide what a chosen radio excludes, written for the products
 *  actually present so the stylesheet never names one that is not here. */
function filterRules(entries) {
  const chosen = (id) => `#${id}:checked ~ .filter .chip[for="${id}"] `
    + "{ background: var(--accent-soft); color: var(--accent-strong); font-weight: 600; }";

  const rules = [chosen("p-alle")];
  for (const product of new Set(entries.map((e) => e.meta.product))) {
    rules.push(chosen(`p-${product}`));
    rules.push(`#p-${product}:checked ~ section .karte:not([data-produkt="${product}"]) `
      + "{ display: none; }");
  }
  return rules.join("\n");
}

/* -------------------------------------------------------------- assembly --- */

/** The page's three holes, and the index the programs will fetch. */
export function sammlungen(root, dist, links) {
  const entries = readEntries(root);
  if (!entries.length) return null;

  mkdirSync(join(dist, "sammlungen"), { recursive: true });
  writeFileSync(
    join(dist, "sammlungen", "index.json"),
    `${JSON.stringify({
      schema: SCHEMA,
      generatedAt: new Date().toISOString(),
      entries: entries.map((one) => one.meta),
    }, null, 2)}\n`,
  );
  for (const one of entries) {
    const at = join(dist, "sammlungen", one.meta.payload);
    mkdirSync(dirname(at), { recursive: true });
    cpSync(one.from, at);
  }

  const count = `${entries.length} ${entries.length === 1 ? "Sammlung" : "Sammlungen"}`;
  return {
    filter: filter(entries),
    filterRules: filterRules(entries),
    karten: entries.map((one) => card(one, links)).join("\n"),
    anzahl: count,
    stand: new Date().toISOString().slice(0, 10).split("-").reverse().join("."),
  };
}

/* ------------------------------------------------------------- downloads --- */

const symbolName = (id) => `arasaac-${id}.png`;

async function pictogram(cache, id) {
  const at = join(cache, `${id}.png`);
  if (existsSync(at)) return readFileSync(at);
  const answer = await fetch(`https://static.arasaac.org/pictograms/${id}/${id}_500.png`);
  if (!answer.ok) throw new Error(`ARASAAC ${id}: HTTP ${answer.status}`);
  const bytes = Buffer.from(await answer.arrayBuffer());
  mkdirSync(cache, { recursive: true });
  writeFileSync(at, bytes);
  return bytes;
}

/**
 * One of this repository's boards as the editor's own AppLayout.
 *
 * The shapes differ on purpose. An entry holds a concept and the words to find
 * it by, which is what makes it resolvable in whatever symbol source the reader
 * has; an AppLayout holds a file name, because by then the question is
 * answered. This is where the answering happens.
 */
function toLayout(payload) {
  const button = (b, index) => ({
    id: `b${index}`,
    row: b.row,
    col: b.col,
    label: b.text,
    vocalization: "",
    symbol: b.arasaac ? symbolName(b.arasaac) : "",
    wordClass: b.wordclass ?? "",
    act: b.act === "home" ? { kind: "home" } : { kind: "append" },
  });

  let index = 0;
  const firstColumn = [];
  const pages = payload.pages.map((page) => ({
    id: page.id,
    name: page.name ?? "",
    buttons: page.buttons.filter((b) => {
      if (payload.firstColumnShared && b.col === 0) { firstColumn.push(button(b, index++)); return false; }
      return true;
    }).map((b) => button(b, index++)),
  }));

  return {
    target: "app",
    language: payload.language ?? "de",
    symbolSource: "arasaac",
    grid: payload.grid,
    pages,
    ...(firstColumn.length ? { firstColumn } : {}),
    home: payload.home,
  };
}

/**
 * The file somebody downloads, as a Sicherung of exactly one Sammlung.
 *
 * Not an .obz, and that is not a preference. The editor's importBoard() sends
 * anything zip-shaped to obf.importObz(), which builds a DiyLayout of four
 * slots to a set — a 4×7 board throws „exactly 4 are allowed" rather than
 * degrading. A Sicherung is the only shape that becomes a tablet Sammlung.
 */
export async function downloads(root, dist) {
  const entries = readEntries(root).filter((one) => downloadable(one.meta));
  if (!entries.length) return [];

  const cache = join(root, ".cache", "arasaac");
  const to = join(dist, "sammlungen", "download");
  mkdirSync(to, { recursive: true });
  const written = [];

  /* mitreden reads `sentences` — or `items`, or a bare list — and takes
   * `collection` as the name to file them under. So its file is the payload
   * with a name on it, and mitreden needs to learn nothing. */
  for (const { meta, payload } of entries.filter((one) => one.meta.product === "mitreden")) {
    const at = join(to, `${meta.id}.json`);
    writeFileSync(at, `${JSON.stringify({
      collection: meta.name,
      /* Travels with the file as well as standing on the card: a file gets
         forwarded, and the credit has to survive that. */
      ...(meta.source ? { quelle: `Nach „${meta.source.title}“ von ${meta.source.by}`
        + (meta.source.publisher ? `, ${meta.source.publisher}` : "")
        + ` — ${meta.source.url}` } : {}),
      sentences: (payload.sentences ?? []).map(({ text }) => ({ text })),
    }, null, 2)}\n`);
    written.push({ id: meta.id, what: `${(payload.sentences ?? []).length} Sätze`,
      bytes: readFileSync(at).length });
  }

  /* bildhaft reads its own export and passes a sentence through as it stands,
   * so the file is that shape with the ARASAAC half of each slot filled in and
   * the METACOM half absent — which is the whole point: whoever opens it in
   * METACOM has their own, and this one may not carry theirs. */
  for (const { meta, payload } of entries.filter((one) => one.meta.product === "bildhaft")) {
    const sentences = (payload.sentences ?? []).map((sentence, n) => ({
      id: `s${n}`,
      rawInput: sentence.text ?? "",
      normalizedInput: (sentence.text ?? "").toLowerCase(),
      slots: (sentence.slots ?? []).map((slot, m) => ({
        id: `s${n}-${m}`,
        sourceToken: slot.token ?? slot.concept ?? "",
        concept: slot.concept ?? "",
        origin: "lemma",
        // A number the shelf published, as the string a provider id is. An
        // empty slot travels as one: the word is there and the picture is not,
        // which is what „leer statt falsch" looks like in a file.
        choice: slot.arasaac ? { arasaac: String(slot.arasaac) } : {},
        candidates: {},
      })),
    }));

    const at = join(to, `${meta.id}.json`);
    writeFileSync(at, `${JSON.stringify({
      format: "bildhaft.collection",
      version: 3,
      exportedAt: new Date().toISOString(),
      /* The language travels with the Sammlung, because the symbol search has
         to be asked in it: somebody reading the interface in English still
         needs „Zähne putzen" looked up in German, or no correction they make
         can find the right picture. */
      collection: {
        name: meta.name,
        language: meta.language,
        sentenceIds: sentences.map((s) => s.id),
      },
      sentences,
      notice: [meta.attribution, meta.source && `Nach „${meta.source.title}" von ${meta.source.by}`]
        .filter(Boolean).join(" "),
    }, null, 2)}\n`);
    written.push({ id: meta.id, what: `${sentences.length} Sätze`, bytes: readFileSync(at).length });
  }

  for (const { meta, payload } of entries.filter((one) => one.meta.product === "vorlaut-app")) {
    const numbers = [...new Set(payload.pages
      .flatMap((page) => page.buttons.map((b) => b.arasaac).filter(Boolean)))];

    const symbols = [];
    for (const id of numbers) {
      symbols.push({ name: symbolName(id), data: (await pictogram(cache, id)).toString("base64") });
    }

    const layout = toLayout(payload);
    /* The invariants the editor's importer relies on, asserted here rather than
     * discovered by somebody whose board arrived with grey crosses on it. This
     * cannot prove the editor accepts the file — only running its code does —
     * but it catches every way the mapping above could drift from what that
     * code reads. */
    const named = [...layout.pages.flatMap((p) => p.buttons), ...(layout.firstColumn ?? [])]
      .map((b) => b.symbol).filter(Boolean);
    const have = new Set(symbols.map((s) => s.name));
    for (const name of named) {
      if (!have.has(name)) throw new Error(`${meta.id}: a button names ${name}, which is not in the file.`);
    }
    if (!named.length) throw new Error(`${meta.id}: no button carries a symbol.`);

    const at = join(dist, "sammlungen", "download", `${meta.id}.json`);
    writeFileSync(at, `${JSON.stringify({
      format: "vorlaut-backup",
      version: 2,
      exportedAt: new Date().toISOString(),
      boards: [{ id: meta.id, name: meta.name, layout }],
      current: null,
      symbols,
      settings: { activeProvider: "arasaac" },
      notice: `${meta.name} — ${meta.attribution}`,
    })}\n`);
    written.push({ id: meta.id, what: `${symbols.length} Bilder`, bytes: readFileSync(at).length });
  }

  return written;
}
