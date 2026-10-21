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
 * either. The talker previews carry Aufschriften rather than pictograms. A
 * bildhaft Sammlung shows its ARASAAC pictures — a Tafel is what it looks
 * like — so the shelf credits ARASAAC wherever one appears.
 *
 * ## METACOM by name, never by picture
 *
 * A bildhaft field can name its METACOM symbol beside its ARASAAC number: the
 * path under somebody's own METACOM folder, which bildhaft resolves on a
 * machine that has one. The page never shows a METACOM picture — there is
 * none in this repository to show — and offers the switch to say where they
 * are: in bildhaft, with a licence of one's own.
 */

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync }
  from "node:fs";
import { dirname, join } from "node:path";

const SCHEMA = 1;

export const PRODUCTS = {
  /* Both are talkers and both are built in vorlaut; what differs is what they
     run on. „vorlaut" as a label said which program rather than which device,
     and stopped being an answer the day a second kind of Sammlung landed
     beside it — see PROGRAMS for the other half of that split. */
  "vorlaut-app": { label: "Talker (Android)", hue: "vorlaut" },
  "vorlaut-talker": { label: "Talker (DIY)", hue: "vorlaut" },
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

/** Every field of a bildhaft payload, the title picture's included. */
export const slotsOf = (payload) => [
  ...(payload.title ? [payload.title] : []),
  ...(payload.sentences ?? []).flatMap((sentence) => sentence.slots ?? []),
];

/** Whether every field has both: the one promise the switch makes. */
export const bothSources = (payload) => {
  const slots = slotsOf(payload);
  return slots.length > 0 && slots.every((slot) => slot.arasaac && slot.metacom);
};

const bildhaftFacts = (payload) => ({
  ...sentenceFacts(payload),
  words: slotsOf(payload).length,
  metacom: bothSources(payload),
  ...(payload.kind === "tafel" ? {
    tafel: true,
    grid: `${payload.board.cols} × ${payload.board.rows}`,
    filled: payload.board.cells.filter((cell) => cell !== null).length,
  } : {}),
});

const factsFor = {
  "vorlaut-app": boardFacts,
  "vorlaut-talker": (payload) => ({
    sets: (payload.sets ?? []).length,
    filled: (payload.sets ?? []).reduce((n, s) => n + (s.keys?.filter(Boolean).length ?? 0), 0),
  }),
  bildhaft: bildhaftFacts,
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
/**
 * One page of a preview at a time, with an arrow either side.
 *
 * The alternative was every page stacked, which is what the talker card did for
 * an afternoon: five little grids down a card, so a shelf of them scrolled past
 * anything you could compare. A card should show what the Sammlung opens on and
 * let you look further if you want to.
 *
 * No script, like the filter above it. A radio per page, each immediately
 * followed by the page it shows, and `.wahl:checked + .seite` — which is why
 * the order below is input, page, input, page rather than the two lists apart.
 * That also leaves the pages reachable from the keyboard for free: the radios
 * are a group, and a group answers arrow keys whether or not anything drew it.
 *
 * The ring wraps at both ends. On the talker that is literally the device — the
 * set key cycles — and on a board of pages it is the shorter way back to the
 * first from the last.
 *
 * The arrows are aria-hidden, which is the point of them rather than an
 * oversight: a <label for> lends its text to the control it names, so two of
 * them pointing at one radio would call that page „Weiter Zurück". Hidden, they
 * still take the click, the radios stay a keyboard group, and what a reader
 * hears when one is chosen is the page itself — which says „Sprechen · 1 von 5"
 * in so many words.
 */
function pager(id, pages) {
  if (pages.length <= 1) return pages[0]?.html ?? "";

  const at = (n) => `bl-${id}-${(n + pages.length) % pages.length}`;
  return `<div class="blaettern">${pages.map((page, n) => `
        <input type="radio" name="bl-${esc(id)}" id="${esc(at(n))}" class="wahl"${n ? "" : " checked"}>
        <div class="seite">${page.html}
          <p class="blaettern__zeile">
            <label class="pfeil" for="${esc(at(n - 1))}" title="Zurück" aria-hidden="true">‹</label>
            <span>${esc(page.label)} · ${n + 1} von ${pages.length}</span>
            <label class="pfeil" for="${esc(at(n + 1))}" title="Weiter" aria-hidden="true">›</label>
          </p>
        </div>`).join("")}
      </div>`;
}

/** A tablet board, a page at a time — the one it opens on first. */
function boardPreview(payload, id) {
  const { rows, columns } = payload.grid;
  const home = payload.pages.find((p) => p.id === payload.home);
  const pages = [home, ...payload.pages.filter((p) => p !== home)].filter(Boolean);

  return pager(id, pages.map((page, n) => {
    const at = new Map(page.buttons.map((b) => [`${b.row},${b.col}`, b]));
    const cells = [];
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < columns; col += 1) {
        const button = at.get(`${row},${col}`);
        if (!button) { cells.push('<span class="zelle zelle--frei"></span>'); continue; }
        const shared = payload.firstColumnShared && col === 0;
        cells.push(`<span class="zelle${shared ? " zelle--spalte" : ""}">${esc(button.text)}</span>`);
      }
    }
    return {
      label: page.name || `Seite ${n + 1}`,
      html: `<div class="brett" style="--spalten: ${columns}">${cells.join("")}</div>`,
    };
  }));
}

/**
 * What kind of thing a bildhaft Sammlung is, beside the product on the card —
 * always, because the template is what somebody opens. A Tafel says so by its
 * payload, and a payload without a kind opens as Satzstreifen. A list of words says so by `art` in its
 * entry, because in bildhaft it opens as rows like any other Sammlung — and
 * „Einkaufsliste" on its own read as the template of that name, which it is
 * not: it is the words to make one from.
 */
const kindLabel = (meta) => meta.product !== "bildhaft" ? ""
  : meta.art ?? (meta.facts.tafel ? "Tafel" : "Satzstreifen");

function factLine(meta) {
  const f = meta.facts;
  if (meta.product === "vorlaut-app") {
    return `${f.grid} · ${f.filled} von ${f.cells} Tasten belegt · `
      + (f.pages === 1 ? "eine Seite" : `${f.pages} Seiten`);
  }
  if (meta.product === "vorlaut-talker") return `${f.sets} Sets · ${f.filled} Tasten belegt`;
  if (f.tafel) return `Tafel · ${f.grid} · ${f.filled} Felder`;
  if (meta.art === "Wortliste") return `${f.words} Wörter in ${f.sentences} Gruppen`;
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
const OPENS = {
  "vorlaut-app": "editor", "vorlaut-talker": "editor",
  mitreden: "mitreden", bildhaft: "bildhaft",
};

/* What „In … öffnen" names, which is the program and not the Sammlung.
 *
 * The two are the same word for three of the four and were written as one for
 * a while, until the talker entry landed and the button read „In Talker
 * öffnen" — pointing at vorlaut. „Talker" is the kind of Sammlung, the chip on
 * the filter row; the door it opens is vorlaut either way. */
const PROGRAMS = { editor: "vorlaut", mitreden: "mitreden", bildhaft: "bildhaft" };

/**
 * Which products have a file to hand over.
 *
 * Every product in OPENS must be here too: the link a card offers fetches the
 * same file the download does. bildhaft was in one and not the other for a day,
 * so its card promised a door with nothing behind it — the entry did not exist
 * yet when that was written, and then it did.
 */
const FILES = new Set(["vorlaut-app", "vorlaut-talker", "mitreden", "bildhaft"]);
for (const product of Object.keys(OPENS)) {
  if (!FILES.has(product)) {
    throw new Error(`${product} can be opened from a link but has no file to open.`);
  }
}
const downloadable = (meta) => FILES.has(meta.product);

/**
 * What a card offers: one link, into the program that reads it.
 *
 * There was a „Herunterladen" beside it, from when no program could take a link
 * and a file was the only way across. All three can now, and the file is what
 * the link fetches — so the button offered a second, longer route to the same
 * place, and asked somebody to think about file management to get there.
 *
 * The files stay published. They are what these links fetch, and somebody who
 * wants one can still take it from the address the link uses.
 *
 * A new tab, because this page is a shelf: somebody comparing three Sammlungen
 * should not lose the shelf to try one.
 */
function actions(meta, links) {
  const key = OPENS[meta.product];
  if (!key) return '<span class="dazu">Kommt noch</span>';
  const open = `<a href="${esc(links[key])}?sammlung=${esc(meta.id)}" target="_blank" rel="noopener">`
    + `In ${esc(PROGRAMS[key])} öffnen</a>`;
  return meta.facts.tafel
    ? `<a href="${esc(meta.id)}.html">Ansehen</a> <span class="dazu">·</span> ${open}`
    : open;
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

/**
 * One set of a talker, drawn the way the device is.
 *
 * Two rows of three with the top left empty, because that is where the speaker
 * is — obf.ts's grid() and docs/hardware.md, and the same picture the export
 * writes. Somebody who has held one recognises it; somebody who has not learns
 * from the card that four keys and a set key is the whole of the thing.
 */
function setsPreview(payload, id) {
  return pager(id, (payload.sets ?? []).map((set) => {
    const keys = (set.keys ?? []).map((k) => `<span class="zelle">${esc(k.text)}</span>`);
    const cells = [
      '<span class="zelle zelle--frei"></span>', keys[0] ?? "", keys[1] ?? "",
      `<span class="zelle zelle--spalte">${esc(set.name)}</span>`, keys[2] ?? "", keys[3] ?? "",
    ];
    return {
      label: set.name,
      html: `<div class="brett" style="--spalten: 3">${cells.join("")}</div>`,
    };
  }));
}

/** Where the shelf keeps the pictures it shows; downloads() puts them there. */
const picture = (number, size, prefix = "") =>
  `<img width="${size}" height="${size}" src="${prefix}bilder/${esc(number)}.png" alt="">`;

/**
 * ARASAAC | METACOM, as two radios and their labels.
 *
 * The radios come first and what they switch follows as their siblings, the
 * same mechanism as the filter. Nothing is fetched on METACOM: there is no
 * METACOM picture here to fetch. What the switch shows instead is where they
 * are, and the stylesheet decides which half is visible.
 */
function symbolSwitch(id) {
  return `<input type="radio" name="q-${esc(id)}" id="q-${esc(id)}-a" class="wahl sym-a" checked>
        <input type="radio" name="q-${esc(id)}" id="q-${esc(id)}-m" class="wahl sym-m">
        <p class="symbolwahl"><label for="q-${esc(id)}-a">ARASAAC</label><label for="q-${esc(id)}-m">METACOM</label></p>`;
}

/**
 * What METACOM is, said where somebody asked for it: in the place of the
 * pictures, as the two steps that get them. The licence is the small print,
 * because whoever has one knows, and whoever has none learns it once.
 */
const METACOM_HINT = `<div class="hinweis-m"><div>
          <p class="hm-titel">So bekommst du METACOM</p>
          <ol><li><span>1</span>In bildhaft öffnen</li><li><span>2</span>Einmal deinen METACOM-Ordner wählen</li></ol>
          <p class="hm-klein">Dafür brauchst du eine eigene METACOM-Lizenz.</p>
        </div></div>`;

/** How many pictures a Wortliste's wall holds before it says how many more. */
const WALL = 23;

/**
 * The top of a bildhaft card: what comes out of the printer, the first page of
 * it — or for a Wortliste, which is words to build from and prints as nothing
 * yet, a wall of its pictures. Over it the switch, and under the switch where
 * METACOM is.
 */
function bildhaftTop(entry) {
  const { meta, payload } = entry;
  const sheet = sheetOf(entry);
  let top;
  if (sheet) {
    top = `<div class="druck__papier">${sheet.html}</div>`;
  } else {
    const numbers = [...new Set(slotsOf(payload).map((slot) => slot.arasaac).filter(Boolean))];
    const more = meta.facts.words - Math.min(WALL, numbers.length);
    top = `<div class="wand">${numbers.slice(0, WALL).map((n) => `<span>${picture(n, 40)}</span>`).join("")}`
      + (more > 0 ? `<span class="wand__mehr">+${more}</span>` : "") + "</div>";
  }
  const both = bothSources(payload);
  return `${both ? symbolSwitch(meta.id) : ""}
        <div class="oben${sheet ? "" : " oben--woerter"}">${top}${both ? METACOM_HINT : ""}</div>`;
}

/** Which products show what is inside before you take it. A product with no
 *  preview simply has none; the fact line still says how much there is. */
const PREVIEW = { "vorlaut-app": boardPreview, "vorlaut-talker": setsPreview };

function card({ meta, payload }, links) {
  const product = PRODUCTS[meta.product];
  const tags = (meta.tags ?? []).map((t) => `<span class="marke">${esc(t)}</span>`).join("");
  const seeAlso = (meta.seeAlso ?? []).length
    ? `<span class="marke">siehe auch: ${meta.seeAlso.length}</span>` : "";

  const haystack = searchable(
    [meta.name, meta.description, ...(meta.tags ?? []), product.label, meta.facts.grid ?? ""]
      .join(" "));

  const text = `<p class="karte__wer"><span class="punkt"></span>${esc([product.label, kindLabel(meta)].filter(Boolean).join(" · "))}</p>
        <h3>${esc(meta.name)}</h3>
        ${PREVIEW[meta.product]?.(payload, meta.id) ?? ""}
        <p class="karte__was">${esc(meta.description)}</p>
        <p class="karte__zahlen">${esc(factLine(meta))}</p>
        <p class="marken">${tags}${seeAlso}</p>
        ${credit(meta)}
        <p class="karte__tun">${actions(meta, links)}</p>`;

  /* A bildhaft card opens on what it looks like, the way a book is shown by
     its cover; the rest of the shelf on its words. */
  const bildhaft = meta.product === "bildhaft";
  return `      <article class="karte produkt ${esc(product.hue)}${bildhaft ? " karte--blatt" : ""}" data-produkt="${esc(meta.product)}"
        data-text="${esc(haystack)}">
        ${bildhaft ? `${bildhaftTop({ meta, payload })}\n        <div class="karte__text">${text}</div>` : text}
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

/**
 * Said once above the shelf, and only when a Sammlung on it has both: the
 * switch on each card is the short form of this.
 */
const BOTH = `<div class="beides">
      <p class="beides__bild" aria-hidden="true"><span>ARASAAC</span><span>METACOM</span></p>
      <div>
        <h2>Mit ARASAAC oder mit METACOM</h2>
        <p>Die Sammlungen für bildhaft zeigen hier ARASAAC-Symbole. Die sind frei, und mit ihnen funktioniert jede Sammlung. Viele sind zusätzlich schon mit METACOM ausgesucht, Feld für Feld. Hast du eine METACOM-Lizenz, öffne die Sammlung in bildhaft und wähle dort einmal deinen METACOM-Ordner.</p>
      </div>
    </div>`;

/** One field of a Tafel as the page draws it: its picture, its word, its group's colours. */
function field(payload, index) {
  const at = payload.board.cells[index];
  if (at === null || at === undefined) return '<span class="feld feld--frei"></span>';
  const slot = payload.sentences[at].slots[0];
  const style = payload.board.styles?.[payload.board.zones?.[index]] ?? {};
  const look = [style.fill && `--fill: ${style.fill}`, style.frame && `--frame: ${style.frame}`]
    .filter(Boolean).join("; ");
  return `<span class="feld"${look ? ` style="${esc(look)}"` : ""}>`
    + `${picture(slot.arasaac, 64)}<span>${esc(slot.label || slot.token)}</span></span>`;
}

/* ------------------------------------------------------- print preview --- */

/*
 * The sheet bildhaft prints, drawn from the Tafel's own print settings.
 *
 * The numbers are bildhaft's — src/ui/printSheet.ts and src/styles/print.css
 * there: the paper, its 10/10/6 mm margin, the room the name and the credit
 * line take, a field as the rest divided by the grid. Drawn here rather than
 * shot from bildhaft, because a picture of a sheet would be a picture committed
 * to this repository, and a build that runs bildhaft to take one breaks when
 * bildhaft does. What it does not copy is the exact curve where a group's
 * colour turns an inner corner; the sizes it does.
 */
const PAPER = { a5: [148, 210], a4: [210, 297], a3: [297, 420] };
const PT = 25.4 / 72;
const MADE_WITH = ", erstellt mit https://bildhaft.lautstark.tech";

function sheetSize(print) {
  const [short, long] = PAPER[print.paper] ?? PAPER.a4;
  return print.orientation === "landscape" ? [long, short] : [short, long];
}

/** bildhaft's creditAllowanceMm(): its chrome, and a line per 1.3 mm of a character. */
function creditMm(text, widthMm) {
  const perLine = Math.max(1, Math.floor(widthMm / 1.3));
  let lines = Math.max(1, Math.ceil(text.length / perLine));
  const left = perLine - (text.length % perLine || perLine);
  if (MADE_WITH.length - 2 > left) lines += 1;
  return 3 + 3.2 * lines;
}

/** A length on the sheet: millimetres, scaled to however wide it is drawn. */
const mm = (n) => `calc(${+n.toFixed(3)} * var(--mm))`;
const box = (x, y, w, h) => `left: ${mm(x)}; top: ${mm(y)}; width: ${mm(w)}; height: ${mm(h)}`;

export function printPreview(payload, name, attribution) {
  const p = payload.print ?? {};
  const [W, H] = sheetSize(p);
  const { cols, rows, cells, zones = [], styles = {} } = payload.board;
  const left = 10; const top = 10;
  const width = W - 20; const height = H - 16;
  const titled = p.showCollectionTitle !== false;
  const titleSize = p.titleSizePt ?? 12;
  const picMm = 3 * titleSize * PT;
  const titleMm = titled ? 4 + Math.max(2 * titleSize * PT * 1.3, payload.title ? picMm : 0)
    + (p.titleLine ? 2.1 : 0) : 0;
  const reserve = titleMm + creditMm(attribution, width) + (p.showPageNumbers ? 5 : 0);
  const cw = width / cols; const ch = (height - reserve) / rows;
  const gridTop = top + titleMm;

  const zoneAt = (r, c) => (r < 0 || c < 0 || r >= rows || c >= cols ? null : zones[r * cols + c] ?? null);
  const firstOf = new Map();
  zones.forEach((zone, i) => { if (zone && !firstOf.has(zone)) firstOf.set(zone, i); });

  const parts = [];
  cells.forEach((cell, i) => {
    const r = Math.floor(i / cols); const c = i % cols;
    const x = left + c * cw; const y = gridTop + r * ch;
    const zone = zones[i]; const style = zone ? styles[zone] ?? {} : null;
    if (style && (style.fill || style.frame)) {
      // Stepped in by half a 2 mm rinne where the group ends, joined where it goes on.
      const edge = { t: zoneAt(r - 1, c) !== zone, b: zoneAt(r + 1, c) !== zone,
        l: zoneAt(r, c - 1) !== zone, r: zoneAt(r, c + 1) !== zone };
      const inset = (side) => (edge[side] ? 1 : 0);
      const corner = (a, b) => (edge[a] && edge[b] ? mm(3) : "0");
      const frame = style.frame ? `border: 0 solid ${esc(style.frame)}; border-width: `
        + ["t", "r", "b", "l"].map((s) => (edge[s] ? mm(0.6) : "0")).join(" ") + "; " : "";
      parts.push(`<span class="blatt__zone" style="${box(x + inset("l"), y + inset("t"),
        cw - inset("l") - inset("r"), ch - inset("t") - inset("b"))}; `
        + `background: ${esc(style.fill ?? "transparent")}; ${frame}border-radius: `
        + `${corner("t", "l")} ${corner("t", "r")} ${corner("b", "r")} ${corner("b", "l")}"></span>`);
      if (style.name && firstOf.get(zone) === i) {
        parts.push(`<span class="blatt__schild" style="left: ${mm(x + 4.5)}; top: ${mm(y + 0.6)}; `
          + `background: ${esc(style.frame ?? "#555")}; font-size: ${mm(7.5 * PT)}">${esc(style.name)}</span>`);
      }
    }
    if (cell === null) return;
    const slot = payload.sentences[cell].slots[0];
    const cut = p.cutMarginMm ?? 3;
    const framed = (p.cardBorderMm ?? 0) > 0 || p.cardBackground != null;
    const pad = framed ? 1 + (p.cardRadiusMm ?? 0) / 3 : 0;
    const look = framed ? `background: ${esc(p.cardBackground ?? "#fff")}; border-radius: ${mm(p.cardRadiusMm ?? 0)}; `
      + `border: ${mm(p.cardBorderMm ?? 0)} solid ${esc(p.cardBorderColor ?? "#2e2e2e")}; padding: ${mm(pad)};` : "";
    const label = p.showLabel === false ? ""
      : `<span style="font-size: ${mm((p.labelSizePt ?? 11) * PT)}">${esc(slot.label || slot.token)}</span>`;
    parts.push(`<span class="blatt__karte${p.labelPosition === "above" ? " blatt__karte--oben" : ""}" `
      + `style="${box(x + cut, y + cut, cw - 2 * cut, ch - 2 * cut)}; ${look}">`
      + `<img width="64" height="64" src="bilder/${esc(slot.arasaac)}.png" alt="">${label}</span>`);
  });

  const title = !titled ? "" : `<span class="blatt__titel" style="${box(left, top, width, titleMm - 4)}; `
    + `font-size: ${mm(titleSize * PT)}; color: ${esc(p.titleColour ?? "#000000")}">`
    + (payload.title ? `<span class="blatt__titelbild" style="width: ${mm(picMm)}; height: ${mm(picMm)}">`
      + `<img width="64" height="64" src="bilder/${esc(payload.title.arasaac)}.png" alt=""></span>` : "")
    + `<span>${esc(name)}</span></span>`;
  const foot = `<span class="blatt__fuss" style="left: ${mm(left)}; bottom: ${mm(6)}; width: ${mm(width)}; `
    + `font-size: ${mm(6.5 * PT)}">${esc(attribution.replace(/\.$/, ""))}${esc(MADE_WITH)}</span>`;

  return {
    label: `${(p.paper ?? "a4").toUpperCase()} ${p.orientation === "landscape" ? "quer" : "hoch"}`,
    html: `<div class="blatt" style="--breite: ${W}; aspect-ratio: ${W} / ${H}; background: ${esc(p.pageColour ?? "#fff")}" `
      + `role="img" aria-label="So sieht die Tafel gedruckt aus">${title}${parts.join("")}${foot}</div>`,
  };
}

/**
 * The first page of Satzstreifen as bildhaft prints them with its defaults —
 * DEFAULT_PRINT_SETTINGS there: A4 hoch, 40 mm symbols in a 3 mm cut margin
 * with a dashed cut line, the word at 11 pt below, the sentence at 10 pt above,
 * 7 mm between strips. A strip wraps where the page is full, and the page ends
 * where the next strip would not fit whole: a strip never breaks.
 */
export function stripPreview(payload, attribution) {
  const p = { paper: "a4", orientation: "portrait", symbolSizeMm: 40, cutMarginMm: 3, labelSizePt: 11,
    sentenceSizePt: 10, ...(payload.print ?? {}) };
  const [W, H] = sheetSize(p);
  const left = 10; const width = W - 20;
  const foot = H - 6 - creditMm(attribution, width);
  const cardW = p.symbolSizeMm + 2 * p.cutMarginMm;
  const cardH = cardW + 1 + p.labelSizePt * PT * 1.15;
  const captionH = p.sentenceSizePt * PT * 1.3 + 0.5;
  const perRow = Math.max(1, Math.floor(width / cardW));
  const parts = [];
  let y = 10;
  for (const sentence of payload.sentences ?? []) {
    const slots = sentence.slots ?? [];
    const height = captionH + Math.ceil(slots.length / perRow) * cardH;
    if (y + height > foot) break;
    parts.push(`<span class="blatt__satz" style="${box(left, y, width, captionH)}; `
      + `font-size: ${mm(p.sentenceSizePt * PT)}">${esc(sentence.text)}</span>`);
    slots.forEach((slot, i) => {
      const x = left + (i % perRow) * cardW; const top = y + captionH + Math.floor(i / perRow) * cardH;
      parts.push(`<span class="blatt__karte blatt__karte--schnitt" style="${box(x, top, cardW, cardH)}; `
        + `padding: ${mm(p.cutMarginMm)}"><img width="64" height="64" src="bilder/${esc(slot.arasaac)}.png" alt="">`
        + `<span style="font-size: ${mm(p.labelSizePt * PT)}">${esc(slot.label || slot.token)}</span></span>`);
    });
    y += height + 7;
  }
  return {
    label: `${p.paper.toUpperCase()} ${p.orientation === "landscape" ? "quer" : "hoch"}`,
    html: `<div class="blatt" style="--breite: ${W}; aspect-ratio: ${W} / ${H}; background: #fff" `
      + `role="img" aria-label="So sehen die Satzstreifen gedruckt aus">${parts.join("")}`
      + `<span class="blatt__fuss" style="left: ${mm(left)}; bottom: ${mm(6)}; width: ${mm(width)}; `
      + `font-size: ${mm(6.5 * PT)}">${esc(attribution.replace(/\.$/, ""))}${esc(MADE_WITH)}</span></div>`,
  };
}

/** The printed first page of what an entry is, where it is a thing to print. */
export const sheetOf = ({ meta, payload }) => {
  if (meta.product !== "bildhaft" || meta.art === "Wortliste") return null;
  return payload.kind === "tafel"
    ? printPreview(payload, meta.name, meta.attribution)
    : stripPreview(payload, meta.attribution);
};

/** A Tafel's own page: the whole board, and the same switch the card has. */
function tafelPage({ meta, payload }, links) {
  const sheet = printPreview(payload, meta.name, meta.attribution);
  const { cols } = payload.board;
  const groups = [...new Set(payload.board.zones ?? [])]
    .map((zone) => payload.board.styles?.[zone]?.name).filter(Boolean);
  const open = `${esc(links.bildhaft)}?sammlung=${esc(meta.id)}`;
  return {
    titel: esc(meta.name),
    beschreibung: esc(meta.description),
    titelbild: payload.title?.arasaac ? picture(payload.title.arasaac, 56) : "",
    zahlen: esc(factLine(meta) + (groups.length ? ` · Gruppen: ${groups.join(", ")}` : "")),
    oeffnen: open,
    tafel: `${symbolSwitch(meta.id)}
      <div class="tafelbild">
        <div class="tafel" style="--spalten: ${cols}">
          ${payload.board.cells.map((_, i) => field(payload, i)).join("\n          ")}
        </div>
        <div class="tafel__metacom">
          <div>
            <h2>So bekommst du METACOM</h2>
            <ol><li><span>1</span>In bildhaft öffnen</li><li><span>2</span>Einmal deinen METACOM-Ordner wählen</li></ol>
            <p class="hm-klein">Dafür brauchst du eine eigene METACOM-Lizenz.</p>
            <p class="tafel__tun"><a class="btn primary" href="${open}" target="_blank" rel="noopener">In bildhaft öffnen</a> <label for="q-${esc(meta.id)}-a">Zurück zu ARASAAC</label></p>
          </div>
        </div>
      </div>
      <section class="druck">
        <h2>Gedruckt <span>${esc(sheet.label)}</span></h2>
        <div class="druck__papier">${sheet.html}</div>
      </section>`,
    quelle: esc(meta.attribution),
  };
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
    beides: entries.some((one) => one.meta.facts.metacom) ? BOTH : "",
    /* One page per Tafel, from site/sammlungen/_tafel.html; build.mjs writes
       them, because it is what knows how a page is filled. */
    tafeln: entries.filter((one) => one.meta.facts.tafel)
      .map((one) => ({ out: `sammlungen/${one.meta.id}.html`, holes: tafelPage(one, links) })),
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
   * so the file is that shape with each slot's choices filled in: the ARASAAC
   * number for everybody, and where the entry names one, the METACOM symbol
   * as the path under a METACOM folder. bildhaft draws whichever source the
   * reader has; a path names a picture and is not one, so somebody without
   * the folder simply gets ARASAAC. */
  const slotOf = (slot, id) => ({
    id,
    sourceToken: slot.token ?? slot.concept ?? "",
    concept: slot.concept ?? "",
    origin: "lemma",
    // A number the shelf published, as the string a provider id is. An
    // empty slot travels as one: the word is there and the picture is not,
    // which is what „leer statt falsch" looks like in a file.
    choice: {
      ...(slot.arasaac ? { arasaac: String(slot.arasaac) } : {}),
      ...(slot.metacom ? { metacom: slot.metacom } : {}),
    },
    candidates: {},
    ...(slot.label ? { label: slot.label } : {}),
    ...(slot.negated ? { negated: true } : {}),
    ...(slot.mirrored ? { mirrored: true } : {}),
  });

  /* The pictures the shelf page shows, beside it. The page is written by
     build.mjs before this runs and names them by number; they arrive here. */
  const pictures = join(dist, "sammlungen", "bilder");
  mkdirSync(pictures, { recursive: true });

  for (const { meta, payload } of entries.filter((one) => one.meta.product === "bildhaft")) {
    for (const number of new Set(slotsOf(payload).map((slot) => slot.arasaac).filter(Boolean))) {
      writeFileSync(join(pictures, `${number}.png`), await pictogram(cache, number));
    }

    const sentences = (payload.sentences ?? []).map((sentence, n) => ({
      id: `s${n}`,
      rawInput: sentence.text ?? "",
      normalizedInput: (sentence.text ?? "").toLowerCase(),
      slots: (sentence.slots ?? []).map((slot, m) => slotOf(slot, `s${n}-${m}`)),
    }));
    // A Tafel's title picture is a row of its own, on no field.
    if (payload.title) {
      sentences.push({
        id: "titel", rawInput: "", normalizedInput: "", part: "titel",
        slots: [slotOf(payload.title, "titel-0")],
      });
    }

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
        ...(payload.kind ? { kind: payload.kind } : {}),
        // The grid names its cards by row number in the entry, and by id here.
        ...(payload.board ? {
          board: { ...payload.board,
            cells: payload.board.cells.map((at) => (at === null ? null : `s${at}`)) },
        } : {}),
        ...(payload.print ? { print: payload.print } : {}),
      },
      sentences,
      notice: [meta.attribution, meta.source && `Nach „${meta.source.title}" von ${meta.source.by}`]
        .filter(Boolean).join(" "),
    }, null, 2)}\n`);
    written.push({ id: meta.id, what: `${sentences.length} Sätze`, bytes: readFileSync(at).length });
  }

  /* A talker Sammlung is a DiyLayout: sets of four slots, each naming a picture
     the file carries. Same Sicherung wrapper as the tablet boards below — it is
     the only shape that becomes a Sammlung rather than being read as a board
     with no buttons. */
  for (const { meta, payload } of entries.filter((one) => one.meta.product === "vorlaut-talker")) {
    const numbers = [...new Set((payload.sets ?? []).flatMap((set) =>
      [set.arasaac, ...(set.keys ?? []).map((k) => k.arasaac)]).filter(Boolean))];

    const symbols = [];
    for (const id of numbers) {
      symbols.push({ name: symbolName(id), data: (await pictogram(cache, id)).toString("base64") });
    }

    const layout = {
      target: "diy",
      language: meta.language,
      symbolSource: "arasaac",
      sets: (payload.sets ?? []).map((set) => ({
        name: set.name,
        symbol: set.arasaac ? symbolName(set.arasaac) : "",
        /* Four, always: the ring has four keys and a set short of them is a
           set the device cannot draw. An unfilled one travels as a slot with
           nothing in it rather than as a missing one. */
        slots: Array.from({ length: 4 }, (_, n) => {
          const slot = (set.keys ?? [])[n];
          if (!slot) return { text: "", symbol: "" };
          return { text: slot.text, symbol: slot.arasaac ? symbolName(slot.arasaac) : "" };
        }),
      })),
    };

    if (layout.sets.length > 5) throw new Error(`${meta.id}: ${layout.sets.length} Sets, the device takes five.`);
    const have = new Set(symbols.map((s) => s.name));
    for (const set of layout.sets) {
      for (const name of [set.symbol, ...set.slots.map((s) => s.symbol)].filter(Boolean)) {
        if (!have.has(name)) throw new Error(`${meta.id}: a key names ${name}, which is not in the file.`);
      }
    }

    const at = join(to, `${meta.id}.json`);
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
    written.push({ id: meta.id, what: `${layout.sets.length} Sets, ${symbols.length} Bilder`,
      bytes: readFileSync(at).length });
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
