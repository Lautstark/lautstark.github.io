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
  return slots.length > 0 && slots.every((slot) => slot.arasaac && slot.metacom);
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
 * What bildhaft itself printed, where an entry carries it: `druck/` beside the
 * payload, written by hand from bildhaft's own „⤓ PDF“ — the PDF (ARASAAC),
 * each of its pages as a picture (`a-1.png` …), and each page again in
 * METACOM (`m-1.png` …), 80 px wide and blurred: enough to see that METACOM
 * looks different, too little to print from. Where it is there, the shelf
 * shows these instead of drawing the sheet itself, so there is one layout —
 * bildhaft's — and not a second one here to keep in step with it.
 */
function printed(at, id) {
  const dir = join(at, "druck");
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir);
  const number = (f) => Number(f.match(/-(\d+)\.png$/)[1]);
  const pages = files.filter((f) => /^a-\d+\.png$/.test(f)).sort((a, b) => number(a) - number(b))
    .map((f) => {
      const size = (name) => { const png = readFileSync(join(dir, name)); return [png.readUInt32BE(16), png.readUInt32BE(20)]; };
      const m = `m-${number(f)}.png`;
      const [w, h] = size(f);
      return { a: f, m: files.includes(m) ? { file: m, size: size(m) } : null, w, h };
    });
  return { dir, id, pdf: files.includes(`${id}.pdf`) ? `${id}.pdf` : null, pages };
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
function actions(meta, links) {
  const key = OPENS[meta.product];
  if (!key) return '<span class="dazu">Kommt noch</span>';
  const open = `<a href="${esc(links[key])}?sammlung=${esc(meta.id)}" target="_blank" rel="noopener">`
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
 * That a card has METACOM too, said and not offered. The card had the switch
 * until 2026-10-29, and its hint did not fit a card: it was cut off at the top
 * of every small cover. A switch on a card is also a control inside a link.
 * So the card says it, the way it says how big a Tafel is, and the switch with
 * its two steps lives on the material's own page, which has the room.
 */
const METACOM_MARK = '<p class="auch-m"><b>ARASAAC</b> · auch mit METACOM</p>';

/** How many pictures a Wortliste's wall holds before it says how many more. */
const WALL = 17;

/**
 * The top of a bildhaft card: what comes out of the printer, the first page of
 * it — or for a Wortliste, which is words to build from and prints as nothing
 * yet, a wall of its pictures. Over its corner, where it has both, that it
 * comes with METACOM as well.
 */
function bildhaftTop(entry) {
  const { meta, payload } = entry;
  const sheet = sheetOf(entry);
  let top;
  if (sheet) {
    top = coverOf(entry);
  } else {
    const numbers = [...new Set(slotsOf(payload).map((slot) => slot.arasaac).filter(Boolean))];
    const more = meta.facts.words - Math.min(WALL, numbers.length);
    top = `<div class="wand">${numbers.slice(0, WALL).map((n) => `<span>${picture(n, 40)}</span>`).join("")}`
      + (more > 0 ? `<span class="wand__mehr">+${more}</span>` : "") + "</div>";
  }
  return `<div class="oben${sheet ? "" : " oben--woerter"}">${bothSources(payload) ? METACOM_MARK : ""}${top}</div>`;
}

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
  const name = hasPage(meta)
    ? `<a class="karte__ansehen" href="${esc(meta.id)}.html">${esc(meta.name)}</a>` : esc(meta.name);
  const text = `<p class="karte__wer"><span class="punkt"></span>${esc([product.label, kindLabel(meta)].filter(Boolean).join(" · "))}</p>
        <h3>${name}</h3>
        ${PREVIEW[meta.product]?.(payload, meta.id) ?? ""}
        <p class="karte__was">${esc(meta.description)}</p>
        <p class="karte__zahlen">${esc(factLine(meta))}</p>
        <p class="marken">${tags}${seeAlso}</p>
        ${credit(meta)}
        <p class="karte__tun">${actions(meta, links)}</p>`;

  /* A bildhaft card opens on what it looks like, the way a book is shown by
     its cover; the rest of the shelf on its words. */
  const bildhaft = meta.product === "bildhaft";
  const art = artOf(meta);
  return `      <article class="karte produkt ${esc(product.hue)}${bildhaft ? " karte--blatt" : ""}${hasPage(meta) ? " karte--ansehen" : ""}" data-produkt="${esc(meta.product)}"${art ? ` data-art="${esc(art)}"` : ""}
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

/* ------------------------------------------- Lied, Rezept, Einkaufsliste --- */

/*
 * The other templates' sheets, measured off the same file in bildhaft as the
 * Tafel's — print.css's song, recipe and shopping rules and sheetBlocks() in
 * printSheet.ts. A block a page does not break inside goes to the next page
 * whole, which is where bildhaft breaks it too. A word that wraps to a second
 * line can move a break by a block; the sizes are bildhaft's.
 */

/** A sheet of paper: its things, the credit at its foot, as bildhaft prints every page. */
function paperSheet(W, H, inner, attribution, label, bg = "#fff") {
  return {
    label,
    html: `<div class="blatt" style="--breite: ${W}; aspect-ratio: ${W} / ${H}; background: ${esc(bg)}" role="img" `
      + `aria-label="So sieht es gedruckt aus">${inner}<span class="blatt__fuss" style="left: ${mm(10)}; bottom: ${mm(6)}; `
      + `width: ${mm(W - 20)}; font-size: ${mm(6.5 * PT)}">${esc(attribution.replace(/\.$/, ""))}${esc(MADE_WITH)}</span></div>`,
  };
}

/** One card of a row, .ps-card: the symbol in its cut margin, the word under it. */
function rowCard(slot, x, y, sym, cut, labelPt, look = "") {
  const w = sym + 2 * cut;
  const h = w + 1 + labelPt * PT * 1.15;
  return { w, h, html: `<span class="blatt__karte blatt__karte--klein" style="${box(x, y, w, h)}; padding: ${mm(cut)}; ${look}">`
    + `<img width="64" height="64" src="bilder/${esc(slot.arasaac)}.png" alt="">`
    + `<span style="font-size: ${mm(labelPt * PT)}">${esc(slot.label || slot.token)}</span></span>` };
}

/** Lays blocks of known height onto pages: `draw(y)` puts a block at y and returns its parts. */
function paginate(W, H, attribution, label, blocks, bg) {
  const foot = H - 6 - creditMm(attribution, W - 20);
  const pages = [[]];
  let y = 10;
  for (const block of blocks) {
    if (y + block.h > foot && pages.at(-1).length > 0) { pages.push([]); y = 10; }
    pages.at(-1).push(block.draw(y));
    y += block.h + (block.after ?? 0);
  }
  return pages.map((parts, n) => paperSheet(W, H, parts.join(""),
    attribution, `${label}${pages.length > 1 ? ` · Blatt ${n + 1} von ${pages.length}` : ""}`, bg));
}

/** The name at the top, with its picture where it has one: bildhaft's .ps-title. */
function titleBlock(name, p, colour, picture) {
  const size = p.titleSizePt ?? 12;
  const pic = 3 * size * PT;
  const h = picture ? Math.max(size * PT * 1.3, pic) : size * PT * 1.3;
  return { h, after: 4, draw: (y) => `<span class="blatt__titel" style="${box(10, y, 190, h)}; font-size: ${mm(size * PT)}; `
    + `color: ${esc(colour)}; font-weight: 700">`
    + (picture ? `<span class="blatt__titelbild" style="width: ${mm(pic)}; height: ${mm(pic)}">`
      + `<img width="64" height="64" src="bilder/${esc(picture.arasaac)}.png" alt=""></span>` : "")
    + `<span>${esc(name)}</span></span>` };
}

const paperLabel = (p) => `${(p.paper ?? "a4").toUpperCase()} ${p.orientation === "landscape" ? "quer" : "hoch"}`;

export function liedPages(payload, name, attribution) {
  const p = { paper: "a4", orientation: "portrait", symbolSizeMm: 18, cutMarginMm: 1, labelSizePt: 9,
    accentColour: "#2c66c8", titleSizePt: 15, ...(payload.print ?? {}) };
  const [W, H] = sheetSize(p);
  const accent = p.titleColour ?? p.accentColour;
  const sym = p.symbolSizeMm; const cut = p.cutMarginMm; const lab = p.labelSizePt;
  const cardH = sym + 2 * cut + 1 + lab * PT * 1.15;
  const headH = 9 * PT * 1.3 + 1;
  const tint = `color-mix(in srgb, ${esc(p.accentColour)} 14%, #fff)`;
  const blocks = p.showCollectionTitle === false ? [] : [titleBlock(name, p, accent, payload.title)];

  const parts = payload.song.parts;
  const order = payload.song.order ?? parts.map((_, i) => i);
  const seen = new Set(); let strophe = 0;
  const numbers = new Map();
  for (const at of order) {
    if (parts[at].kind === "strophe" && !numbers.has(at)) numbers.set(at, ++strophe);
  }
  for (const at of order) {
    const part = parts[at]; const first = !seen.has(at); seen.add(at);
    const refrain = part.kind === "refrain";
    if (p.songRefrainOnce && refrain && !first) {
      const h = 3 + 10 * PT * 1.3;
      blocks.push({ h, after: 3, draw: (y) => `<span style="${box(10, y, W - 20, h)}; background: ${tint}; `
        + `border-radius: ${mm(2)}; color: ${esc(p.accentColour)}; font-weight: 700; font-size: ${mm(10 * PT)}; `
        + `padding: ${mm(1.5)} ${mm(2)}">↻ Refrain</span>` });
      continue;
    }
    const groups = [];
    for (const row of part.lines) {
      const line = payload.sentences[row]; const last = groups.at(-1);
      if (p.songRepeats && last && last.line.text === line.text) last.times += 1;
      else groups.push({ line, times: 1 });
    }
    const h = 3 + (p.songHeadings === false ? 0 : headH) + groups.length * cardH;
    blocks.push({ h, after: 3, draw: (y) => {
      const out = [`<span style="${box(10, y, W - 20, h)}; background: ${refrain ? tint : "#f2f1f0"}; border-radius: ${mm(2)}"></span>`];
      let ly = y + 1.5;
      if (p.songHeadings !== false) {
        out.push(`<span style="${box(12, ly, 80, headH)}; font-size: ${mm(9 * PT)}; font-weight: 700; `
          + `color: ${refrain ? esc(p.accentColour) : "#666"}">${refrain ? "Refrain" : `Strophe ${numbers.get(at)}`}</span>`);
        ly += headH;
      }
      for (const { line, times } of groups) {
        let x = 12;
        for (const slot of line.slots) { const c = rowCard(slot, x, ly, sym, cut, lab); out.push(c.html); x += c.w; }
        if (times > 1) {
          out.push(`<span style="${box(x + 2, ly + 1, 0.6, cardH - 2)}; background: ${esc(p.accentColour)}"></span>`
            + `<span style="${box(x + 4, ly + cardH / 2 - 3, 14, 6)}; font-size: ${mm(14 * PT)}; font-weight: 800; `
            + `line-height: 1; color: ${esc(p.accentColour)}">${times}×</span>`);
        }
        ly += cardH;
      }
      return out.join("");
    } });
  }
  return paginate(W, H, attribution, paperLabel(p), blocks);
}

export function rezeptPages(payload, name, attribution) {
  const p = { paper: "a4", orientation: "portrait", symbolSizeMm: 19, cutMarginMm: 1.5, labelSizePt: 9,
    accentColour: "#e3262b", titleSizePt: 15, ...(payload.print ?? {}) };
  const [W, H] = sheetSize(p);
  const red = esc(p.accentColour);
  const sym = p.symbolSizeMm; const cut = p.cutMarginMm; const lab = p.labelSizePt;
  const cardW = sym + 2 * cut; const cardH = cardW + 1 + lab * PT * 1.15;
  const bandH = 11 * PT * 1.3 + 2;
  const band = (y, text) => `<span style="${box(10, y, W - 20, bandH)}; background: ${red}; color: #fff; `
    + `border-radius: ${mm(1.2)}; padding: ${mm(1)} ${mm(3)}; font-size: ${mm(11 * PT)}; font-weight: 700">${text}</span>`;
  const blocks = p.showCollectionTitle === false ? [] : [titleBlock(name, p, p.titleColour ?? p.accentColour, payload.title)];

  for (const [part, head] of [["zutat", "Zutaten"], ["hilfsmittel", "Hilfsmittel"]]) {
    const slots = payload.sentences.filter((row) => (row.part ?? "zutat") === part).map((row) => row.slots[0]);
    if (!slots.length) continue;
    const perRow = Math.max(1, Math.floor((W - 20 + 1.5) / (cardW + 1.5)));
    const rows = Math.ceil(slots.length / perRow);
    const h = bandH + 2 + rows * cardH + (rows - 1) * 1.5;
    blocks.push({ h, after: 4, draw: (y) => band(y, head) + slots.map((slot, i) => rowCard(slot,
      10 + (i % perRow) * (cardW + 1.5), y + bandH + 2 + Math.floor(i / perRow) * (cardH + 1.5), sym, cut, lab,
      `border: ${mm(0.3)} dotted ${red}; border-radius: ${mm(1)}`).html).join("") });
  }
  payload.sentences.filter((row) => row.part === "schritt").forEach((row, n) => {
    const top = n === 0 ? bandH + 2 : 0;
    const perRow = Math.max(1, Math.floor((W - 20 - 9) / cardW));
    const h = top + Math.ceil(row.slots.length / perRow) * cardH + 1.5;
    blocks.push({ h, after: 1.5, draw: (y) => (n === 0 ? band(y, "Schritte") : "")
      + `<span style="${box(10, y + top + cardH / 2 - 3.5, 7, 7)}; border-radius: 50%; background: ${red}; color: #fff; `
      + `font-weight: 700; font-size: ${mm(11 * PT)}; display: grid; place-items: center">${n + 1}</span>`
      + row.slots.map((slot, i) => rowCard(slot, 19 + (i % perRow) * cardW, y + top + Math.floor(i / perRow) * cardH,
        sym, cut, lab).html).join("")
      + `<span style="${box(10, y + h - 0.3, W - 20, 0)}; border-bottom: ${mm(0.3)} dotted ${red}"></span>` });
  });
  return paginate(W, H, attribution, paperLabel(p), blocks);
}

/*
 * A Spiel's two kinds of sheet, bildhaft's (src/ui/printSheet.ts, gameRaster()
 * and gameGeometry(); src/styles/print.css, .ps-spiel): the Spielblatt — the
 * Ablage left, a quiet dashed block with a dot per card to lay, the fence of
 * accent dots, and the rows, each on its rose ground, the fixed cards framed
 * in the accent and a dashed field for each card to lay — and the Kartenbogen,
 * the cards to cut out. A4 across, punched at the top, one field of 30 mm, five
 * rows under each other; the rest is the same arithmetic in fewer lines.
 */
const GAME_FIELD = 30;
const GAME_ASPECT = 42 / 50;

export function spielPages(payload, name, attribution) {
  const p = { paper: "a4", orientation: "landscape", punch: "top", cutMarginMm: 3, showLabel: false,
    labelSizePt: 11, accentColour: "#e0558c", gameGroundColour: "#fdeef3", titleSizePt: 15, titleLine: true,
    ...(payload.print ?? {}) };
  const [W, H] = sheetSize(p);
  const k = p.paper === "a5" ? 0.62 : 1;
  const accent = esc(p.titleColour ?? p.accentColour);
  const top = p.punch === "top" ? 20 : 10; const left = p.punch === "left" ? 20 : 10;
  const width = W - left - 10;
  const line = p.titleSizePt * PT * 1.3;
  const titled = p.showCollectionTitle !== false;
  const titleH = titled ? line + (p.titleLine ? 2.1 : 0) : 0;
  const titleRoom = titled ? titleH + 4 + 4 : 0;
  const height = H - top - 6 - titleRoom - creditMm(attribution, width);
  const label = p.showLabel ? p.labelSizePt * k * PT * 1.4 + k : 0;
  const pad = 2 * k; const rowGap = 3 * k; const gap = 6 * k;

  const card = (index) => payload.sentences[index].slots[0];
  const rows = payload.game.rows.map((row) => row.zellen.map((zelle) => ({ slot: card(zelle.karte), platz: zelle.platz })));
  const laid = rows.flatMap((row) => row.filter((cell) => cell.platz).map((cell) => cell.slot));
  const zellen = Math.max(1, ...rows.map((row) => row.length));
  const measure = (reihen) => {
    const spielCols = Math.ceil(rows.length / reihen);
    const lagerCols = Math.ceil(Math.max(1, laid.length) / reihen);
    const fixed = (p.punch === "left" ? 21 : 28) * k + (spielCols - 1) * 13 * k;
    const gaps = (lagerCols - 1) * gap + spielCols * (zellen - 1) * gap;
    const wLimit = (width - fixed - gaps) / (lagerCols + spielCols * zellen);
    const hLimit = ((height - k - (reihen - 1) * rowGap) / reihen - 2 * pad - label) / GAME_ASPECT;
    return { reihen, lagerCols, fieldW: Math.min(GAME_FIELD * k, wLimit, hLimit) };
  };
  let best = measure(Math.max(1, Math.floor((height - k + rowGap) / (GAME_FIELD * k * GAME_ASPECT + label + 2 * pad + rowGap) + 1e-9)));
  for (let reihen = best.reihen + 1; best.fieldW < GAME_FIELD * k - 1e-6 && reihen <= rows.length; reihen += 1) {
    const taller = measure(reihen);
    if (taller.fieldW > best.fieldW) best = taller;
  }
  const { reihen, lagerCols, fieldW } = best;
  const fieldH = fieldW * GAME_ASPECT + label;
  const rowH = fieldH + 2 * pad;
  const sym = Math.max(8, Math.min(fieldW - 4 - 2 * k, fieldH - 4 - label - 3 * k));

  const img = (slot) => `<img width="64" height="64" src="bilder/${esc(slot.arasaac)}.png" alt="" `
    + `style="width: ${mm(sym)}; height: ${mm(sym)}">`;
  const word = (slot) => (p.showLabel ? `<span style="font-size: ${mm(p.labelSizePt * k * PT)}">${esc(slot.label || slot.token)}</span>` : "");
  const dot = (x, y, ring) => `<span class="blatt__punkt" style="${box(x - 4.5 * k, y - 4.5 * k, 9 * k, 9 * k)}; `
    + `border-width: ${mm(0.35 * k)}; border-color: ${ring}"></span>`;
  const y0 = top + titleRoom;
  const title = titled ? `<span class="blatt__titel" style="${box(left, top, width, titleH)}; font-size: ${mm(p.titleSizePt * PT)}; `
    + `color: ${accent}; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis`
    + `${p.titleLine ? `; border-bottom: ${mm(0.6)} solid ${accent}` : ""}">${esc(payload.heading ?? name)}</span>` : "";

  // The Ablage: a dot per card to lay, column by column from the top.
  const lagerX = left + 2.5 * k;
  const lagerW = lagerCols * fieldW + (lagerCols - 1) * gap;
  const parts = [title, `<span style="${box(lagerX - 1 * k, y0 - 1 * k, lagerW + 2 * k, reihen * rowH + (reihen - 1) * rowGap + 2 * k)}; `
    + `border: ${mm(0.25)} dashed #c4bcb6; border-radius: ${mm(3 * k)}"></span>`];
  laid.forEach((_, i) => {
    const c = Math.floor(i / reihen); const r = i % reihen;
    parts.push(dot(lagerX + c * (fieldW + gap) + fieldW / 2, y0 + r * (rowH + rowGap) + rowH / 2, "#cfc8c1"));
  });

  // The fence, then the rows on their ground.
  const fenceX = lagerX + lagerW + 2.5 * k;
  const fenceW = (p.punch === "left" ? 7 : 14) * k;
  parts.push(`<span style="${box(fenceX, y0, fenceW, reihen * rowH + (reihen - 1) * rowGap)}; `
    + `background-image: radial-gradient(circle, ${esc(p.accentColour)} ${mm(0.8 * k)}, transparent ${mm(0.8 * k + 0.15)}); `
    + `background-size: ${mm(2 * k)} ${mm(5 * k)}; background-repeat: repeat-y; background-position: center top"></span>`);
  const thin = (n) => `color-mix(in srgb, ${esc(p.accentColour)} ${n}%, #fff)`;
  let colX = fenceX + fenceW;
  for (let c = 0; c * reihen < rows.length; c += 1) {
    const these = rows.slice(c * reihen, (c + 1) * reihen);
    let widest = 0;
    these.forEach((row, r) => {
      const y = y0 + r * (rowH + rowGap);
      const w = 2 * pad + row.length * fieldW + (row.length - 1) * gap;
      widest = Math.max(widest, w);
      parts.push(`<span style="${box(colX, y, w, rowH)}; background: ${esc(p.gameGroundColour)}; border-radius: ${mm(3 * k)}"></span>`);
      row.forEach((cell, i) => {
        const x = colX + pad + i * (fieldW + gap);
        parts.push(cell.platz
          ? `<span style="${box(x, y + pad, fieldW, fieldH)}; background: #fff; border: ${mm(0.3 * k)} dashed ${thin(65)}; border-radius: ${mm(2)}"></span>`
            + dot(x + fieldW / 2, y + pad + fieldH / 2, thin(35))
          : `<span class="blatt__karte" style="${box(x, y + pad, fieldW, fieldH)}; border: ${mm(0.4 * k)} solid ${esc(p.accentColour)}; `
            + `border-radius: ${mm(2)}; background: #fff; padding: ${mm(1 * k)}">${img(cell.slot)}${word(cell.slot)}</span>`);
      });
    });
    colX += widest + 8 * k;
  }
  const paper = `${paperLabel(p)}`;
  const sheets = [paperSheet(W, H, parts.join(""), attribution, `${paper} · Spielblatt`)];

  // The Kartenbogen: the cards to lay, the laminate's seam smaller, air round each.
  const cutW = Math.max(10, fieldW - 4); const cutH = Math.max(10, fieldH - 4);
  const air = p.cutMarginMm * k;
  const cutArea = [W - left - 10, H - top - 6 - creditMm(attribution, width)];
  const cols = Math.max(1, Math.floor(cutArea[0] / (cutW + 2 * air) + 1e-6));
  const perPage = cols * Math.max(1, Math.floor(cutArea[1] / (cutH + 2 * air)));
  for (let at = 0; at < laid.length; at += perPage) {
    sheets.push(paperSheet(W, H, laid.slice(at, at + perPage).map((slot, i) =>
      `<span class="blatt__zone blatt__schnitt" style="${box(left + (i % cols) * (cutW + 2 * air), top + Math.floor(i / cols) * (cutH + 2 * air), cutW + 2 * air, cutH + 2 * air)}; `
      + `padding: ${mm(air)}"><span class="blatt__karte" style="width: 100%; height: 100%; border: ${mm(0.4 * k)} solid ${esc(p.accentColour)}; `
      + `border-radius: ${mm(2)}; background: #fff">${img(slot)}${word(slot)}</span></span>`).join(""),
    attribution, `${paper} · Karten zum Ausschneiden`));
  }
  return sheets;
}

/** bildhaft's SHOPPING: the list's zones, the cart's zones, and the paper's factor on all of it. */
const SHOPPING = { list: [3, 5], cart: [5, 3] };
const SHOPPING_SCALE = { a5: 0.7, a4: 1, a3: 1.4 };
const GUIDE = ["Alles laminieren. Nur die Karten auf diesem Blatt ausschneiden.",
  "Klett hinten auf jede Karte, das Gegenstück in jeden Kreis auf dem Einkaufsbrett und auf jeden Platz im Blatt mit den Wörtern.",
  "Was fehlt, auf die Liste. Im Laden in den Wagen, zu Hause zurück an seinen Platz."];

export function einkaufPages(payload, name, attribution) {
  const p = { paper: "a4", ...(payload.print ?? {}) };
  const k = SHOPPING_SCALE[p.paper] ?? 1;
  const [W, H] = sheetSize({ paper: p.paper, orientation: "landscape" });
  const sym = Math.round(20 * k); const cut = Math.round(3 * k * 2) / 2; const lab = Math.round(11 * k * 2) / 2;
  const card = sym + 2 * cut; const zone = card + 3 * k; const gap = 2 * k;
  const foot = H - 6 - creditMm(attribution, W - 20);
  const label = `${p.paper.toUpperCase()} quer`;
  const slots = payload.sentences.map((row) => row.slots[0]);
  const img = (slot) => `<img width="64" height="64" src="bilder/${esc(slot.arasaac)}.png" alt="">`;
  const zones = (x0, y0, [cols, rows]) => Array.from({ length: cols * rows }, (_, i) =>
    `<span class="blatt__zone blatt__platz" style="${box(x0 + (i % cols) * (zone + gap), y0 + Math.floor(i / cols) * (zone + gap), zone, zone)}; `
    + `border: ${mm(0.3)} solid #c9c9c9; border-radius: ${mm(2 * k)}; background: #fff"><span class="blatt__punkt" `
    + `style="width: ${mm(5 * k)}; height: ${mm(5 * k)}; border-width: ${mm(0.3)}"></span></span>`).join("");

  // The board: the list, and the cart drawn round its zones.
  const titleH = p.showCollectionTitle === false ? 0 : (p.titleSizePt ?? 12) * PT * 1.3 + 8 * k;
  const listW = SHOPPING.list[0] * zone + (SHOPPING.list[0] - 1) * gap;
  const cartW = SHOPPING.cart[0] * zone + (SHOPPING.cart[0] - 1) * gap;
  const cartH = SHOPPING.cart[1] * zone + (SHOPPING.cart[1] - 1) * gap;
  const cx = 10 + listW + 24 * k; const cy = 10 + titleH + 18 * k;
  const cart = `<svg class="blatt__wagen" style="left: ${mm(cx)}; top: ${mm(cy)}; width: ${mm(cartW)}; height: ${mm(cartH)}" `
    + `viewBox="0 0 ${cartW} ${cartH}" preserveAspectRatio="none" aria-hidden="true">`
    + `<path d="M ${-5 * k} ${-5 * k} H ${cartW + 5 * k} V ${cartH + 5 * k} H ${-5 * k} Z"/>`
    + `<path d="M ${-5 * k} ${-5 * k} L ${-13 * k} ${-14 * k} H ${-22 * k}"/>`
    + `<path d="M ${-5 * k} ${cartH + 5 * k} L ${4 * k} ${cartH + 16 * k} H ${cartW - 7 * k}"/>`
    + `<circle cx="${24 * k}" cy="${cartH + 22 * k}" r="${6 * k}"/><circle cx="${cartW - 21 * k}" cy="${cartH + 22 * k}" r="${6 * k}"/></svg>`;
  const board = (titleH ? `<span class="blatt__titel" style="${box(10, 10, W - 20, titleH - 8 * k)}; `
    + `font-size: ${mm((p.titleSizePt ?? 12) * PT)}; color: ${esc(p.titleColour ?? "#000")}; font-weight: 600">${esc(name)}</span>` : "")
    + zones(10, 10 + titleH, SHOPPING.list) + cart + zones(cx, cy, SHOPPING.cart);
  const sheets = [paperSheet(W, H, board, attribution, `${label} · das Brett`)];

  // The places: a zone each, the word under the card.
  const placeH = card + lab * 0.85 * PT * 1.1 + 1 * k;
  const perRow = Math.floor((W - 20 + gap) / (zone + gap));
  const rowsPerPage = Math.max(1, Math.floor((foot - 10 + gap) / (placeH + gap)));
  for (let at = 0; at < slots.length; at += perRow * rowsPerPage) {
    sheets.push(paperSheet(W, H, slots.slice(at, at + perRow * rowsPerPage).map((slot, i) =>
      `<span class="blatt__zone blatt__platz blatt__platz--wort" style="${box(10 + (i % perRow) * (zone + gap), 10 + Math.floor(i / perRow) * (placeH + gap), zone, placeH)}; `
      + `border: ${mm(0.3)} solid #c9c9c9; border-radius: ${mm(2 * k)}; padding: ${mm(cut)} ${mm(cut)} ${mm(1 * k)}">${img(slot)}`
      + `<span style="font-size: ${mm(lab * 0.85 * PT)}">${esc(slot.label || slot.token)}</span></span>`).join(""),
    attribution, `${label} · die Plätze`));
  }

  // The cards to cut, no word; under the first sheet of them, what the sheets are for.
  const cols = Math.floor((W - 20) / card);
  const guideH = 10 * k + 11 * k * PT * 1.4 + 2 * k + 3 * 9 * k * PT * 1.4 * 2;
  let at = 0; let first = true;
  while (at < slots.length) {
    const rows = Math.max(1, Math.floor((foot - 10 - (first ? guideH : 0)) / card));
    const these = slots.slice(at, at + rows * cols);
    let inner = these.map((slot, i) => `<span class="blatt__zone blatt__schnitt" style="${box(10 + (i % cols) * card, 10 + Math.floor(i / cols) * card, card, card)}; `
      + `padding: ${mm(cut)}">${img(slot)}</span>`).join("");
    if (first) {
      const gy = 10 + Math.ceil(these.length / cols) * card + 10 * k;
      inner += `<span class="blatt__anleitung" style="${box(10, gy, 190 * k, guideH)}; font-size: ${mm(9 * k * PT)}">`
        + `<strong style="font-size: ${mm(11 * k * PT)}">So geht’s</strong><ol>${GUIDE.map((g) => `<li>${esc(g)}</li>`).join("")}</ol></span>`;
    }
    sheets.push(paperSheet(W, H, inner, attribution, `${label} · Karten zum Ausschneiden`));
    at += these.length; first = false;
  }
  return sheets;
}

/** Every printed page of an entry, where it is a thing to print: not a Wortliste, which is words to build from. */
export function pagesOf({ meta, payload, druck }) {
  if (meta.product !== "bildhaft" || meta.art === "Wortliste") return null;
  if (druck?.pages.length) return druck.pages.map((page, n) => ({
    label: `${paperLabel(payload.print ?? {})}${druck.pages.length > 1 ? ` · Blatt ${n + 1} von ${druck.pages.length}` : ""}`,
    html: `<div class="blatt blatt--bild" style="aspect-ratio: ${page.w} / ${page.h}" role="img" aria-label="So sieht es gedruckt aus">`
      + `<img class="blatt__a" width="${page.w}" height="${page.h}" src="druck/${esc(druck.id)}/${page.a}" alt="">`
      + (page.m ? `<img class="blatt__m" width="${page.m.size[0]}" height="${page.m.size[1]}" src="druck/${esc(druck.id)}/${page.m.file}" alt="">` : "")
      + "</div>",
  }));
  switch (payload.kind) {
    case "tafel": return [printPreview(payload, meta.name, meta.attribution)];
    case "lied": return liedPages(payload, meta.name, meta.attribution);
    case "rezept": return rezeptPages(payload, meta.name, meta.attribution);
    case "einkaufsliste": return einkaufPages(payload, meta.name, meta.attribution);
    case "spiel": return spielPages(payload, meta.name, meta.attribution);
    default: return [stripPreview(payload, meta.attribution)];
  }
}

/** The first of them, which is what a card shows. */
export const sheetOf = (entry) => pagesOf(entry)?.[0] ?? null;

/** Which entries have a page of their own: every template the shelf draws. */
const hasPage = (meta) => meta.product === "bildhaft" && meta.art !== "Wortliste" && meta.facts.kind in KINDS;

/**
 * What a card shows on top. An Einkaufsliste's first sheet is its empty board,
 * which says nothing about it on its own: the places lie behind it, askew, so
 * a shelf sees the pictures belong.
 */
function coverOf(entry) {
  const pages = pagesOf(entry);
  /* Every cover in the same frame, whatever the paper: the sheet as large as
     the frame lets it be, upright or across. The ratio is the sheet's own. */
  const [, w, h] = pages[0].html.match(/aspect-ratio: ([\d.]+) \/ ([\d.]+)/);
  const inner = entry.payload.kind === "einkaufsliste" && pages.length > 1
    ? `<div class="stapel"><div class="stapel__hinten"><div class="druck__papier">${pages[1].html}</div></div>`
      + `<div class="stapel__vorn"><div class="druck__papier">${pages[0].html}</div></div></div>`
    : `<div class="druck__papier">${pages[0].html}</div>`;
  return `<div class="deckel" style="--seite: ${w} / ${h}">${inner}</div>`;
}

const METACOM_STEPS = (open, id) => `<div class="tafel__metacom">
          <div>
            <h2>So bekommst du METACOM</h2>
            <ol><li><span>1</span>In bildhaft öffnen</li><li><span>2</span>Einmal deinen METACOM-Ordner wählen</li></ol>
            <p class="hm-klein">Dafür brauchst du eine eigene METACOM-Lizenz.</p>
            <p class="tafel__tun"><a class="btn primary" href="${open}" target="_blank" rel="noopener">In bildhaft öffnen</a> <label for="q-${esc(id)}-a">Zurück zu ARASAAC</label></p>
          </div>
        </div>`;

/**
 * A material's own page. A Tafel shows its board as on screen and its sheet
 * under it; every other template is its sheets, all of them, side by side.
 */
function materialPage(entry, links) {
  const { meta, payload } = entry;
  const pages = pagesOf(entry);
  const open = `${esc(links.bildhaft)}?sammlung=${esc(meta.id)}`;
  const both = bothSources(payload);
  const groups = payload.kind === "tafel" ? [...new Set(payload.board.zones ?? [])]
    .map((zone) => payload.board.styles?.[zone]?.name).filter(Boolean) : [];
  const sheets = `<div class="seiten">${pages.map((sheet) => `<figure><div class="druck__papier">${sheet.html}</div>`
    + `<figcaption>${esc(sheet.label)}</figcaption></figure>`).join("")}</div>`;
  const body = payload.kind === "tafel"
    ? `<div class="tafelbild">
        <div class="tafel" style="--spalten: ${payload.board.cols}">
          ${payload.board.cells.map((_, i) => field(payload, i)).join("\n          ")}
        </div>
        ${both ? METACOM_STEPS(open, meta.id) : ""}
      </div>
      <section class="druck"><h2>Gedruckt</h2>${sheets}</section>`
    : `<div class="tafelbild tafelbild--blaetter">${sheets}${both ? METACOM_STEPS(open, meta.id) : ""}</div>`;
  return {
    titel: esc(meta.name),
    art: esc(kindLabel(meta)),
    beschreibung: esc(meta.description),
    titelbild: payload.title?.arasaac ? picture(payload.title.arasaac, 56) : "",
    zahlen: esc(factLine(meta) + (groups.length ? ` · Gruppen: ${groups.join(", ")}` : "")),
    // The card's tags, on the page as on the card.
    marken: (meta.tags ?? []).length
      ? `<span class="marken">${meta.tags.map((t) => `<span class="marke">${esc(t)}</span>`).join("")}</span>` : "",
    oeffnen: open,
    pdf: entry.druck?.pdf
      ? `<a class="btn" href="druck/${esc(meta.id)}/${esc(entry.druck.pdf)}" download="${esc(meta.name)}.pdf">⤓ PDF</a>` : "",
    tafel: `${both ? symbolSwitch(meta.id) : ""}
      ${body}`,
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
    tafeln: entries.filter((one) => hasPage(one.meta))
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
