# Wortschatz

**Status: a proposal, not a decision.** Written 2026-08-31 from a long design
conversation; nothing here is built. It lives in this repository rather than in
a product's `adr/` because it spans all of them, and rather than in
`@lautstark/design`'s `conventions.md` because that document describes what the
products have *settled* — this has not. If it gets built, the parts that turn
out to be binding graduate there; the shelf half lands here as a schema change.

## What it is

Every product already holds a version of the same noun, in its own dialect:

| | what it holds | what is missing |
|---|---|---|
| **bildhaft** | `Slot`: concept, symbol choice **per source**, label, negation, own picture. Overrides remember corrections. | the corrections are invisible and ungrouped — there is no pot |
| **mitreden** | `Phrase`: text, voice, audio | **no symbols at all** |
| **vorlaut-editor** | `Slot` / `AppButton`: label, **vocalization**, symbol, **word class**, negation | every field is searched for on its own; nothing accumulates |

Three products, three dialects of one thing, and nothing can hand anything to
anything — except one accident: mitreden already reads bildhaft's files and
throws away everything but the text.

A **Wortschatz** is that noun made explicit and portable: a named pot of
entries, where an entry is a text with the pictures that belong to it.

## Two halves, and they have different physics

### 1 · Shelf Wortschätze — nearly free

Generic, unpersonalised pots published on `lautstark.tech/sammlungen/`:
*Frühstück*, *Kleidung*, *Gefühle*, *Kerntafel 60 Wörter*. In every product a
**„Wortschatz hinzufügen"** pulls one in.

The machinery exists. `@lautstark/werkzeuge/sammlung` already fetches an entry
by id (`?sammlung=<id>`) and all three products use it; the address carries an
id and never a URL, which is the whole attack surface. What is missing is a
browser inside the product (a list rather than a link) and, per product, an
answer to what *adding* means:

- **bildhaft / print material** — entries become rows, or cards
- **mitreden** — entries become phrases, recordable in one voice
- **vorlaut-editor** — entries fill board buttons instead of being searched one
  by one

A copy on adding, never a reference. Import adds and never overwrites, as
everywhere else in this family.

### 2 · The personal layer — the interesting half

„I change Oma's picture, and the next time I use Oma anywhere, it is the new
one." That is bildhaft's override dictionary, made visible, given own pictures,
and shared across products.

The plug point is already designed. bildquelle's `ResolveOptions` carries

```ts
prefer?: (key: string) => Candidate[] | null
```

documented as where "a host's own dictionary plugs in … without this package
having to know that such a thing exists". A personal layer *is* that function.
Every product that uses the pipeline gets it for nothing.

## The entry shape

Small enough to be honest — this is an interchange shape, **not** a replacement
for any product's internal model:

```
Wortschatz = name · person? · language · entries[] · groups[]
Eintrag    = text · spoken form? · parts[]
Teil       = token · symbol{arasaac?, metacom?}? · own picture? · negated? · word class?
```

- A **word** is an entry with one part.
- A **sentence** is an entry with several — bildhaft's `Slot[]`, one to one.
- A **text** (a song, a picture book translated line by line) is a named,
  ordered *group* of entries. Everything inside a text stays individually
  pickable: correct *Grüffelo* once in the book, and the word — with its
  corrected picture — is there when a board is built.

Symbols stay **per source**, the way bildhaft models them, so ARASAAC travels
universally and METACOM only resolves for a licence holder.

## „Bild" is one concept, two storage shapes

From the person's side there is one question — *which picture belongs to this
word* — and whether the answer is an ARASAAC pictogram, a METACOM symbol or a
photo of the real Oma is implementation. bildhaft's picker already gets this
right at the surface: search results and „Eigenes Bild" are one dialog, one
decision.

Underneath they behave differently and must stay apart:

- an **own picture** is source-independent and always wins — one value;
- a **symbol choice** is per source ("for *Oma* use this in ARASAAC, that in
  METACOM") — one value per source, which is why a correction survives
  switching source and switching back.

Whoever never switches source never learns that the distinction exists.

### Blast radius

Everything visual is safe to personalise as often as anyone likes; nothing
hangs off it. The **spoken form** is the expensive field: mitreden's recordings
are keyed by a fingerprint over text and voice, so changing it invalidates
audio. The personal layer should therefore carry **the picture only**, and
touching the spoken form should be a separate, deliberate act that says what it
costs ("12 recordings become stale").

## The hard part: origins

Cross-product automatic sharing is not a code problem, it is a browser problem.
If the move recorded in `@lautstark/sicherung` is what it looks like — four
sites moved to new domains on 2026-08-28 and per-origin storage came up empty —
the products now sit on **separate subdomains**, and therefore on separate
IndexedDB. `bildhaft.…` cannot see `editor.…`'s storage. **Verify this before
designing around it.**

Three honest routes, no server and no cleverness:

1. **One origin, paths instead of subdomains** (`lautstark.tech/bildhaft/`, …).
   Then the products share storage — exactly the situation bildquelle's own
   database is already built for (opened versionless, additive-only schema).
   Seamless, but it reverses the domain move.
2. **The Sicherung folder as the carrier.** `@lautstark/sicherung` already
   writes into a folder the user picked. One shared `wortschatz-aktuell.json`
   in it, read at boot and written on change, gives exactly "change it here,
   it is there next time". Uses proven machinery. **Price:** Chromium desktop
   only — the package's own boundary, "a tablet must never be shown a backup
   story it cannot have" — and it is a **new inlet** into a package whose rule
   is that a new inlet is always a major version. A real contract change, not a
   detail.
3. **An explicit file.** Works everywhere, and is not the "it is simply there"
   this is about.

Suggested order: build the personal layer **per product first** (immediate
value, no infrastructure — in bildhaft three quarters of it exists already),
then the folder as a bridge, with file export as the universal fallback.

## The loop that makes it self-sustaining

bildhaft has an `unmatched` state — "there is nothing for this word". That is
the moment to offer **„eigenes Bild" → into your Wortschatz**: exactly where a
symbol library fails, the proper nouns are standing — Oma, Bello, Kita
Sonnenschein, Papas Auto. From then on it applies everywhere by itself.
Personalisation as a by-product of ordinary work, rather than as an errand.

## The boundary that must be structural

Shelf Wortschätze are generic. The personal layer holds **photographs of real
people** — the most private data anywhere in this family. Publishing must
therefore **refuse or strip** entries carrying own pictures, the way bildhaft's
`portable()` already removes the METACOM pin from a shared file. Same format,
opposite intent, one audited door between them.

## What the shelf would need

Today an entry names exactly one product:

```
"product": "vorlaut-app" | "vorlaut-talker" | "bildhaft" | "mitreden"
```

A Wortschatz is product-neutral by definition — that is the point of it. So the
schema needs a way to say *all of them* (a `wortschatz` kind, or `product`
accepting a list), and the page's product filter needs to show such an entry
under every product. Everything else about an entry — the id, the payload
beside it, no symbol committed, numbers fetched at build time — stays as it is.

## Open questions

1. **Are the products really on separate origins?** If so: is the folder bridge
   acceptable (Chromium desktop only), or is a shared origin thinkable?
2. **Is the personal layer per device/household or per person?** Oma is the same
   Oma for both children.
3. **Does bildhaft's override dictionary *become* the personal layer** —
   visible, browsable, exportable — or live on beside it? It is the prototype
   that already serves people, only invisibly.
4. **Where is a Wortschatz authored?** Authoring it in bildhaft and consuming it
   everywhere avoids building the same surface three times; vorlaut-editor is
   the counter-argument, since it is the only product that knows word classes.

## Related

- The print-material work this came out of is archived at
  [`Lautstark/druckwerk`](https://github.com/Lautstark/druckwerk); its
  `mocks/index.html` holds the material designs (Tagesplan, Auswahltafel,
  Kommunikationstafel) and the "duplicate as" matrix.
- `@lautstark/design`'s `docs/conventions.md` is where the parts of this that
  become binding belong, once they are.
