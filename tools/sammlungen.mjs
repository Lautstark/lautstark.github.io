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
 * none in this repository to show. A card says it has METACOM too; the
 * material's own page has the switch, which says where they are: in bildhaft,
 * with a licence of one's own.
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
  return slots.length > 0 && slots.every((slot) => (slot.arasaac || slot.eigen) && slot.metacom);
};

const bildhaftFacts = (payload) => ({
  ...sentenceFacts(payload),
  words: slotsOf(payload).length,
  metacom: bothSources(payload),
  ...(payload.kind ? { kind: payload.kind } : {}),
  ...(payload.kind === "tafel" ? {
    tafel: true,
    grid: `${payload.board.cols} × ${payload.board.rows}`,
    filled: payload.board.cells.filter((cell) => cell !== null).length,
  } : {}),
  ...(payload.kind === "lied" ? {
    strophen: payload.song.parts.filter((part) => part.kind === "strophe").length,
    refrain: payload.song.parts.some((part) => part.kind === "refrain"),
  } : {}),
  ...(payload.kind === "rezept" ? {
    zutaten: payload.sentences.filter((row) => row.part === "zutat").length,
    schritte: payload.sentences.filter((row) => row.part === "schritt").length,
  } : {}),
  ...(payload.kind === "spiel" ? {
    reihen: payload.game.rows.length,
    karten: payload.game.rows.flatMap((row) => row.zellen).filter((zelle) => zelle.platz).length,
  } : {}),
});

/** The templates the shelf knows by name; a payload without a kind is Satzstreifen. */
const KINDS = { tafel: "Tafel", lied: "Lied", rezept: "Rezept", einkaufsliste: "Einkaufsliste", spiel: "Spiel" };

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
      druck: printed(join(dir, name), entry.id),
    });
  }

  found.sort((a, b) => a.meta.id.localeCompare(b.meta.id));
  return found;
}

/**
 * What bildhaft made of an entry: `druck/` beside the payload, exported from
 * bildhaft itself — the PDF its „⤓ PDF“ saves (ARASAAC), each of its pages as
 * a picture (`a-1.png` …), and the app with the material open (`app.png`).
 * The shelf shows these and draws no sheet of its own, so there is one layout,
 * bildhaft's, and not a second one here to keep in step with it. Until
 * 2026-10-29 the shelf did draw them, from bildhaft's numbers, one drawing per
 * template; a sheet that changed in bildhaft was wrong here until somebody
 * noticed.
 */
function printed(at, id) {
  const dir = join(at, "druck");
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir);
  const size = (name) => { const png = readFileSync(join(dir, name)); return { w: png.readUInt32BE(16), h: png.readUInt32BE(20) }; };
  const number = (f) => Number(f.match(/^a-(\d+)\.png$/)[1]);
  const pages = files.filter((f) => /^a-\d+\.png$/.test(f)).sort((a, b) => number(a) - number(b))
    .map((f) => ({ file: f, ...size(f) }));
  return {
    dir, id, pages,
    pdf: files.includes(`${id}.pdf`) ? `${id}.pdf` : null,
    app: files.includes("app.png") ? { file: "app.png", ...size("app.png") } : null,
  };
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
  : meta.art ?? KINDS[meta.facts.kind] ?? "Satzstreifen";

function factLine(meta) {
  const f = meta.facts;
  if (meta.product === "vorlaut-app") {
    return `${f.grid} · ${f.filled} von ${f.cells} Tasten belegt · `
      + (f.pages === 1 ? "eine Seite" : `${f.pages} Seiten`);
  }
  if (meta.product === "vorlaut-talker") return `${f.sets} Sets · ${f.filled} Tasten belegt`;
  if (f.tafel) return `Tafel · ${f.grid} · ${f.filled} Felder`;
  if (f.kind === "lied") {
    return `Lied · ${f.refrain ? "Refrain und " : ""}${f.strophen} ${f.strophen === 1 ? "Strophe" : "Strophen"}`;
  }
  if (f.kind === "rezept") return `Rezept · ${f.zutaten} Zutaten · ${f.schritte} Schritte`;
  if (f.kind === "einkaufsliste") return `Einkaufsliste · ${f.sentences} Karten`;
  if (f.kind === "spiel") return `Spiel · ${f.reihen} Reihen · ${f.karten} Karten zum Legen`;
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
 *
 * „Ansehen" stood beside it until 2026-10-29: now the whole card is that link
 * where there is a page to see (card()), and a link saying so as well was a
 * second way to the same place.
 */
function actions(meta, links, primary = false) {
  const key = OPENS[meta.product];
  if (!key) return '<span class="dazu">Kommt noch</span>';
  /* A bildhaft material is opened first and downloaded second: the button. */
  const open = `<a${primary ? ' class="btn primary"' : ""} href="${esc(links[key])}?sammlung=${esc(meta.id)}" target="_blank" rel="noopener">`
    + `In ${esc(PROGRAMS[key])} öffnen</a>`;
  return open;
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

/** How many pictures a Wortliste's wall holds before it says how many more. */
const WALL = 17;

/** The papers of a material: one page of it as bildhaft printed it. */
const sheet = (entry, page) => `<img class="papier" width="${page.w}" height="${page.h}" `
  + `src="druck/${esc(entry.meta.id)}/${page.file}" alt="" style="aspect-ratio: ${page.w} / ${page.h}">`;

/** How many pages a card fans out: enough to see there are more. */
const FAN = 3;

/**
 * The top of a bildhaft card: its PDF, the pages fanned a little, the first in
 * front — so a card shows what you get and how much of it. A Wortliste is words
 * to build from rather than a sheet to print, so it shows the app with them
 * open; a wall of its pictures where there is not even that.
 */
function bildhaftTop(entry) {
  const { meta, payload, druck } = entry;
  if (druck?.app && !druck.pages.length) {
    return `<div class="oben"><img class="oben__app" width="${druck.app.w}" height="${druck.app.h}" `
      + `src="druck/${esc(meta.id)}/app.png" alt=""></div>`;
  }
  if (hasPage(entry)) {
    const pages = druck.pages.slice(0, FAN);
    return `<div class="oben"><div class="faecher">${pages.map((page, i) =>
      `<div class="faecher__blatt" style="--i: ${i}; --n: ${pages.length}; --seite: ${page.w} / ${page.h}">${sheet(entry, page)}</div>`)
      .reverse().join("")}</div></div>`;
  }
  const numbers = [...new Set(slotsOf(payload).map((slot) => slot.arasaac).filter(Boolean))];
  const more = meta.facts.words - Math.min(WALL, numbers.length);
  return `<div class="oben oben--woerter"><div class="wand">${numbers.slice(0, WALL).map((n) => `<span>${picture(n, 40)}</span>`).join("")}`
    + (more > 0 ? `<span class="wand__mehr">+${more}</span>` : "") + "</div></div>";
}

/** What the PDF is, in a line: how many pages, on which paper. */
const pdfLine = ({ payload, druck }) => {
  const n = druck.pages.length;
  const across = druck.pages[0].w > druck.pages[0].h;
  return `${n} ${n === 1 ? "Seite" : "Seiten"} · ${(payload.print?.paper ?? "a4").toUpperCase()} ${across ? "quer" : "hoch"}`;
};

/** Which products show what is inside before you take it. A product with no
 *  preview simply has none; the fact line still says how much there is. */
const PREVIEW = { "vorlaut-app": boardPreview, "vorlaut-talker": setsPreview };

function card(entry, links) {
  const { meta, payload } = entry;
  const product = PRODUCTS[meta.product];
  const tags = (meta.tags ?? []).map((t) => `<span class="marke">${esc(t)}</span>`).join("");
  const seeAlso = (meta.seeAlso ?? []).length
    ? `<span class="marke">siehe auch: ${meta.seeAlso.length}</span>` : "";

  const haystack = searchable(
    [meta.name, meta.description, ...(meta.tags ?? []), product.label, meta.facts.grid ?? ""]
      .join(" "));

  /* Where there is a page to see, the card is the way there: the name is the
     link, and its ::after spreads it over the whole card (site.css,
     .karte__ansehen). The other links on the card stand above it. */
  const name = hasPage(entry)
    ? `<a class="karte__ansehen" href="${esc(meta.id)}.html">${esc(meta.name)}</a>` : esc(meta.name);
  /* „bildhaft · Rezept“, as on every other card and on the material's page. */
  const who = esc([product.label, kindLabel(meta)].filter(Boolean).join(" · "));
  const text = hasPage(entry) ? `<p class="karte__wer"><span class="punkt"></span>${who}</p>
        <h3>${name}</h3>
        <p class="karte__zahlen">${esc(entry.druck.pages.length ? pdfLine(entry) : factLine(meta))}</p>
        <p class="karte__tun">${actions(meta, links, true)}${entry.druck.pdf && entry.druck.pages.length
          ? ` <a class="karte__pdf" href="druck/${esc(meta.id)}/${esc(entry.druck.pdf)}" download="${esc(meta.name)}.pdf">⤓ PDF</a>` : ""}</p>`
    : `<p class="karte__wer"><span class="punkt"></span>${who}</p>
        <h3>${name}</h3>
        ${PREVIEW[meta.product]?.(payload, meta.id) ?? ""}
        <p class="karte__was">${esc(meta.description)}</p>
        <p class="karte__zahlen">${esc(factLine(meta))}</p>
        <p class="marken">${tags}${seeAlso}</p>
        ${credit(meta)}
        <p class="karte__tun">${actions(meta, links, meta.product === "bildhaft")}</p>`;

  /* A bildhaft card opens on what it looks like, the way a book is shown by
     its cover; the rest of the shelf on its words. */
  const bildhaft = meta.product === "bildhaft";
  const art = artOf(meta);
  return `      <article class="karte produkt ${esc(product.hue)}${bildhaft ? " karte--blatt" : ""}${hasPage(entry) ? " karte--ansehen" : ""}" data-produkt="${esc(meta.product)}"${art ? ` data-art="${esc(art)}"` : ""}
        data-text="${esc(haystack)}">
        ${bildhaft ? `${bildhaftTop(entry)}\n        <div class="karte__text">${text}</div>` : text}
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

  /* The shelf opens on bildhaft (her call, 2026-10-29): for now it is what
     the shelf mostly holds and what is worth opening. The others are a chip
     away, and a link with ?produkt= still opens on its own. */
  const opens = counts.has("bildhaft") ? "bildhaft" : "alle";
  const inputs = [`<input type="radio" name="produkt" id="p-alle" class="wahl"${opens === "alle" ? " checked" : ""}>`];
  const chips = ['<label class="chip" for="p-alle">Alle</label>'];
  for (const [product, n] of counts) {
    inputs.push(`<input type="radio" name="produkt" id="p-${esc(product)}" class="wahl"${product === opens ? " checked" : ""}>`);
    chips.push(`<label class="chip" for="p-${esc(product)}">${esc(PRODUCTS[product].label)}`
      + `<span class="n">${n}</span></label>`);
  }

  /* The second row: what a material is, for the day the shelf held more Spiele
     than everything else together (2026-10-29). Its own group of radios, so it
     narrows whatever „Für" chose rather than replacing it. */
  const arts = new Map();
  for (const { meta } of entries) {
    const art = artOf(meta);
    if (art) arts.set(art, { label: kindLabel(meta), n: (arts.get(art)?.n ?? 0) + 1 });
  }
  const artInputs = ['<input type="radio" name="vorlage" id="v-alle" class="wahl" checked>'];
  const artChips = ['<label class="chip" for="v-alle">Alle</label>'];
  for (const [art, { label, n }] of [...arts].sort((a, b) => b[1].n - a[1].n)) {
    artInputs.push(`<input type="radio" name="vorlage" id="v-${esc(art)}" class="wahl">`);
    artChips.push(`<label class="chip" for="v-${esc(art)}">${esc(label)}<span class="n">${n}</span></label>`);
  }

  return `${inputs.join("\n    ")}
    ${arts.size > 1 ? artInputs.join("\n    ") : ""}
    <fieldset class="filter">
      <legend>Für</legend>
      ${chips.join("\n      ")}
    </fieldset>${arts.size > 1 ? `
    <fieldset class="filter filter--vorlage">
      <legend>Vorlage</legend>
      ${artChips.join("\n      ")}
    </fieldset>` : ""}`;
}

/** What a material is, as a filter's id: its template's name, folded. */
const artOf = (meta) => (meta.product === "bildhaft" ? fold(kindLabel(meta)) : "");

/** The rules that hide what a chosen radio excludes, written for the products
 *  actually present so the stylesheet never names one that is not here. */
function filterRules(entries) {
  const chosen = (id) => `#${id}:checked ~ .filter .chip[for="${id}"] `
    + "{ background: var(--accent-soft); color: var(--accent-strong); font-weight: 600; }";

  const rules = [chosen("p-alle"), chosen("v-alle")];
  for (const product of new Set(entries.map((e) => e.meta.product))) {
    rules.push(chosen(`p-${product}`));
    rules.push(`#p-${product}:checked ~ section .karte:not([data-produkt="${product}"]) `
      + "{ display: none; }");
  }
  /* A Vorlage is bildhaft's: the row stands, and a chosen one narrows, only
     where bildhaft cards are on the shelf — under „Alle" and „bildhaft".
     Under another product it would leave nothing, and say why nowhere. */
  const products = new Set(entries.map((e) => e.meta.product));
  for (const product of products) {
    if (product !== "bildhaft") rules.push(`#p-${product}:checked ~ .filter--vorlage { display: none; }`);
  }
  for (const art of new Set(entries.map((e) => artOf(e.meta)).filter(Boolean))) {
    rules.push(chosen(`v-${art}`));
    for (const where of ["p-alle", "p-bildhaft"]) {
      rules.push(`#${where}:checked ~ #v-${art}:checked ~ section .karte:not([data-art="${art}"]) { display: none; }`);
    }
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
        <p>Die Materialien für bildhaft zeigen hier ARASAAC-Symbole. Die sind frei, und mit ihnen funktioniert jedes Material. Viele sind zusätzlich schon mit METACOM ausgesucht, Feld für Feld. Hast du eine METACOM-Lizenz, öffne das Material in bildhaft und wähle dort einmal deinen METACOM-Ordner.</p>
      </div>
    </div>`;

/** Which entries have a page of their own: a bildhaft material bildhaft has printed. */
const hasPage = (entry) => entry.meta.product === "bildhaft" && Boolean(entry.druck?.pages.length || entry.druck?.app);

/**
 * A material's own page, the same for every template: on the left what to do
 * with it — open it in bildhaft first, with the app as it will look under the
 * button — and, where it has both, that METACOM works too. On the right the
 * PDF, its pages one under the other, with its download over them.
 */
function materialPage(entry, links) {
  const { meta, payload, druck } = entry;
  const open = `${esc(links.bildhaft)}?sammlung=${esc(meta.id)}`;
  /* One page large, the others small beside it to pick from: all of them
     under each other made a long material a long scroll. A radio before each
     page, as the filter does it — no script; the labels in the strip check
     them. Each page a link to its own file: gross.js shows it larger still,
     and without it the click opens the file. */
  const many = druck.pages.length > 1;
  const name = `seite-${esc(meta.id)}`;
  const pages = druck.pages.map((page, i) => (many
    ? `<input type="radio" class="wahl" name="${name}" id="${name}-${i + 1}"${i ? "" : " checked"}>` : "")
    + `<figure class="material__seite"><a href="druck/${esc(meta.id)}/${page.file}" data-gross>${sheet(entry, page)}</a>`
    + `<figcaption>Seite ${i + 1} von ${druck.pages.length}</figcaption></figure>`).join("");
  const strip = many ? `<div class="material__daumen" aria-label="Seiten">${druck.pages.map((page, i) =>
    `<label for="${name}-${i + 1}"><img width="${page.w}" height="${page.h}" src="druck/${esc(meta.id)}/${page.file}" alt="Seite ${i + 1}">`
    + `<span>${i + 1}</span></label>`).join("")}</div>` : "";
  return {
    titel: esc(meta.name),
    art: esc(kindLabel(meta)),
    beschreibung: esc(meta.description),
    titelbild: payload.title?.arasaac ? picture(payload.title.arasaac, 56) : "",
    zahlen: esc(factLine(meta)),
    // The card's tags, on the page as on the card.
    marken: (meta.tags ?? []).length
      ? `<p class="marken">${meta.tags.map((t) => `<span class="marke">${esc(t)}</span>`).join("")}</p>` : "",
    oeffnen: open,
    bildschirm: druck.app && druck.pages.length
      ? `<a class="material__app" href="druck/${esc(meta.id)}/app.png" data-gross><img width="${druck.app.w}" height="${druck.app.h}" `
        + `src="druck/${esc(meta.id)}/app.png" alt="So sieht ${esc(meta.name)} in bildhaft aus"></a>` : "",
    metacom: bothSources(payload) ? METACOM_BOX : "",
    seiten: !druck.pages.length
      ? `<a class="material__app material__app--gross" href="druck/${esc(meta.id)}/app.png" data-gross><img width="${druck.app.w}" `
        + `height="${druck.app.h}" src="druck/${esc(meta.id)}/app.png" alt="So sieht ${esc(meta.name)} in bildhaft aus"></a>`
      : `${druck.pdf ? `<div class="material__pdf"><span class="karte__zahlen">PDF · ${esc(pdfLine(entry))}</span>`
      + `<a class="btn" href="druck/${esc(meta.id)}/${esc(druck.pdf)}" download="${esc(meta.name)}.pdf">⤓ PDF herunterladen</a></div>` : ""}`
      + `<div class="material__seiten${many ? "" : " material__seiten--eine"}"><div class="material__buehne">${pages}</div>${strip}</div>`,
    quelle: esc(meta.attribution),
  };
}

/** That METACOM works too, on a material that has both: what to do, and what it takes. */
const METACOM_BOX = `<div class="material__metacom">
          <p class="material__metacom-titel">Mit METACOM-Lizenz: alles in METACOM</p>
          <ol><li><span>1</span>In bildhaft öffnen</li><li><span>2</span>Einmal deinen METACOM-Ordner wählen</li></ol>
          <p class="hm-klein">Hier siehst du ARASAAC. Mit deiner eigenen METACOM-Lizenz zeigt bildhaft jedes Symbol in METACOM.</p>
        </div>`;

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
    if (one.druck) cpSync(one.druck.dir, join(dist, "sammlungen", "druck", one.meta.id), { recursive: true });
  }

  const count = `${entries.length} ${entries.length === 1 ? "Material" : "Materialien"}`;
  return {
    filter: filter(entries),
    filterRules: filterRules(entries),
    karten: entries.map((one) => card(one, links)).join("\n"),
    beides: entries.some((one) => one.meta.facts.metacom) ? BOTH : "",
    /* One page per Tafel, from site/sammlungen/_tafel.html; build.mjs writes
       them, because it is what knows how a page is filled. */
    tafeln: entries.filter(hasPage)
      .map((one) => ({ out: `sammlungen/${one.meta.id}.html`, holes: materialPage(one, links) })),
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
    /* `eigen` is a picture of our own (sammlungen/eigene-bilder/), drawn
       where ARASAAC has nothing that fits: the Becherküche's five cups, which
       ARASAAC draws as two. bildhaft takes it as an own picture of the file's
       and shows it in ARASAAC's place. */
    choice: {
      ...(slot.eigen ? { arasaac: `own:${slot.eigen}` } : slot.arasaac ? { arasaac: String(slot.arasaac) } : {}),
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

    /* Each row a millisecond after the one before it, in the entry's order.
       bildhaft orders a Rezept's rows, and its cards to cut, by when they were
       made; rows that arrived without a time all took the moment of the
       import, and a Pfannkuchen came out with its steps in whatever order the
       database kept them. */
    const made = Date.parse("2026-01-01T00:00:00Z");
    const sentences = (payload.sentences ?? []).map((sentence, n) => ({
      id: `s${n}`,
      createdAt: made + n,
      rawInput: sentence.text ?? "",
      normalizedInput: (sentence.text ?? "").toLowerCase(),
      slots: (sentence.slots ?? []).map((slot, m) => slotOf(slot, `s${n}-${m}`)),
      // A Rezept's rows say which of its parts they are in.
      ...(sentence.part ? { part: sentence.part } : {}),
    }));
    // A Tafel's title picture is a row of its own, on no field.
    if (payload.title) {
      sentences.push({
        id: "titel", rawInput: "", normalizedInput: "", part: "titel",
        slots: [slotOf(payload.title, "titel-0")],
      });
    }

    const own = [...new Set(slotsOf(payload).map((slot) => slot.eigen).filter(Boolean))].map((name) => ({
      id: name,
      name,
      type: "image/svg+xml",
      data: `data:image/svg+xml;base64,${readFileSync(join(root, "sammlungen", "eigene-bilder", `${name}.svg`)).toString("base64")}`,
      createdAt: made,
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
        ...(payload.kind ? { kind: payload.kind } : {}),
        // The grid names its cards by row number in the entry, and by id here.
        ...(payload.board ? {
          board: { ...payload.board,
            cells: payload.board.cells.map((at) => (at === null ? null : `s${at}`)) },
        } : {}),
        // A Spiel's cells name their cards by row number too.
        ...(payload.game ? {
          game: {
            rows: payload.game.rows.map((row, i) => ({
              id: `r${i}`, zellen: row.zellen.map((zelle) => ({ karte: `s${zelle.karte}`, platz: zelle.platz })) })),
          },
        } : {}),
        // The title on the paper, where it is not the name: a Spiel's question without its level.
        ...(payload.heading ? { title: payload.heading } : {}),
        // A Lied's parts name their rows by number in the entry, and by id here.
        ...(payload.song ? {
          song: {
            parts: payload.song.parts.map((part, i) => ({
              id: `p${i}`, kind: part.kind, lines: part.lines.map((at) => `s${at}`) })),
            order: (payload.song.order ?? payload.song.parts.map((_, i) => i)).map((i) => `p${i}`),
          },
        } : {}),
        ...(payload.print ? { print: payload.print } : {}),
      },
      sentences,
      ...(own.length ? { ownImages: own } : {}),
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
