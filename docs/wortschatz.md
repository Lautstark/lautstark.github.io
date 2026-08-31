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
one."

The plug point is already designed. bildquelle's `ResolveOptions` carries

```ts
prefer?: (key: string) => Candidate[] | null
```

documented as where "a host's own dictionary plugs in … without this package
having to know that such a thing exists". A personal layer *is* that function —
which is also the proof that the closed `ProviderId` union does not have to be
opened for this. bildhaft's override dictionary is the invisible prototype.

## It shifts priority — it never blocks

The rule that keeps this simple, and it is one rule, not two:

> **The Wortschatz is a source that comes first in search. It seeds the default.
> It forbids nothing.**

- While typing, a personal entry sets the **suggestion** — *Oma* arrives with
  your photograph.
- In the picker it stands **at the top, grouped** („aus deinem Wortschatz"),
  and underneath it ARASAAC and METACOM as always. The generic *Oma* symbol is
  two clicks away, forever.
- Nothing is ever locked, nothing silently replaced.

This collapses what looked like two mechanisms — a correction dictionary and
own pictures — into one: **ranking**. An own picture and a corrected symbol
choice are the same act from the person's side, and neither takes an option
away.

### Two honest intentions when saving

„Oma Angela" is not the same wish as „Oma". At the moment of saving, the
question is worth asking once:

- **„für ‚Oma' merken"** — moves the default for the generic word
- **„als eigenes Wort ‚Oma Angela'"** — then *Oma* stays generic and both exist
  side by side

A small question at the right moment, instead of a rule nobody can undo later.

## The entry shape

Small enough to be honest — this is an interchange shape, **not** a replacement
for any product's internal model:

```
Wortschatz = name · person? · language · entries[] · groups[]
Eintrag    = text · spoken form? · parts[]
Teil       = token · symbol{arasaac?, metacom?}? · own picture? · negated? · word class?
```

Symbols stay **per source**, the way bildhaft models them, so ARASAAC travels
universally and METACOM only resolves for a licence holder.

## Wort, Satz, Text — derived, not declared

The three shapes are not three types anybody has to choose between. They fall
out of **how many symbols came back**:

| shape | | treatment |
|---|---|---|
| **Wort** | one part | a tile, a card, fills a single target zone |
| **Satz** | several parts | a row, a strip, fills a row target |
| **Text** | a named, ordered group of entries | pages, a booklet, fills a page sequence |

This is why „komm mal" is a **Wort**: the pipeline resolves it to one concept,
so it behaves like one. Nobody has to declare that, and nothing new has to be
stored — `slots.length` is already there. An override for edge cases („treat
this as a row anyway") is imaginable; do not build it until somebody asks.

The derivation is not cosmetic. **It is the compatibility rule** that keeps the
promise never to transform anything: a one-part entry may be offered where a
single zone waits, a multi-part entry where a row waits, a group where a page
sequence waits — and nowhere else. Never convert, only offer what fits.

### Consequence for the products, and for the glossary

The two products need opposite things, and that is correct:

- **mitreden** — a row is **one recording**, whether it is a word, a sentence or
  a whole song. The shape is invisible there; the interface should simply stop
  saying „Satz". Two facts checked in the code: the composer splits on `\n`
  (`box.value.split('\n')`), which is exactly why pasting a word list already
  works and must not break; and `slug()` truncates by words and characters with
  a fallback, so a whole text yields a sane filename
  (`alle-voegel-sind-schon-da.mp3`) rather than a monster. What is left is one
  real mechanic: how to say „these lines are **one** entry". Suggested: keep
  one-line-one-entry as the default and show a second button beside the record
  button — **„als einen Text"** — only while the box holds more than one line.
  A blank-line convention would be a hidden rule, and it would destroy the word
  list case.
- **bildhaft** — the shape decides the layout, so it must be visible. Do not
  rename anything there on its own: the vocabulary hangs off the visual
  treatment, and that is being redesigned anyway with the material work.

`design/docs/design.md` §3.6 settles the glossary as **Satz** — "the stored
utterance; never Zeile", because *Zeile* leaks a print artefact into the data.
Going neutral therefore touches the shared glossary. The suggestion is **not to
repurpose anything but to add a parent**: the three shapes are *Wort / Satz /
Text*, and the term above them is **Äußerung** — the word the field uses, and
the one design.md already uses in English. *Satz* survives as one shape rather
than as the whole. Each product may still call its rows what they are in that
product: mitreden honestly says **Aufnahme**, because there a row *is* an audio
file.

## Where Wortschätze live

Two different things were hiding under one word; they have different answers,
and one of them is "nowhere".

### Thematic ones: there is nothing to manage

A shelf Wortschatz is **not something you own — it is something you pour in.**
Next to the composer, where a person already stands when content should go in,
a quiet second path: **„oder Wortschatz vom Regal holen"** → list → chosen →
the entries land as rows or cards in the open Sammlung. After that you manage
what you always manage: your Sammlung. Contributing one is likewise nothing
new — you **publish a Sammlung** to the shelf. No second object in the sidebar,
no second mental model.

### The personal layer: one list, device-wide, grows by itself

By `conventions.md` §3.10's own test — "does this setting's answer change when
something else is selected?" — it belongs in **Einstellungen**: Oma's picture is
the same whichever Sammlung is open, and it applies *forward*, to the next thing
made. That is exactly the semantics described there.

- **Einstellungen → panel „Mein Wortschatz"**, which per design.md §3.4 states
  its status before offering a control: „47 Wörter · zuletzt geändert vor 3
  Tagen" → **„Wörter ansehen"**
- That opens a wide sheet: a grid of word plus picture, a search field, click
  opens the familiar picker, remove per entry. Nothing is *created* here.
- **Creation happens while working**: a correction in the picker, an own picture
  for a word the library does not know — bildhaft's `unmatched` state is the
  natural on-ramp, because that is exactly where the proper nouns stand (Oma,
  Bello, Kita Sonnenschein, Papas Auto). Maintenance as a by-product, not an
  errand.
- **At the point of use**, a tile showing a personal picture says so, with a
  click to change or release it.

### The case that breaks it

A therapist with eight children: eight „Mama" photographs, one browser. One
device-wide layer cannot hold that. The escape would be to make the personal
Wortschatz **nameable and switchable** („Lenas Wortschatz"), which turns it from
a setting into a document and probably lifts it into the sidebar. Overhead for a
family, necessary for a professional. Build the simple version, ship file
export/import as the valve, and let use decide whether the named variant is
really needed.

## The hard part: origins — verified 2026-08-31

Cross-product automatic sharing is not a code problem, it is a browser problem.
The CNAMEs say:

```
bildhaft.lautstark.tech · mitreden.lautstark.tech
editor.lautstark.tech · vorlaut.lautstark.tech · lautstark.tech
```

**Four subdomains, four origins, four separate IndexedDB.** The family already
names databases as if they were shared — `bildquelle`, `lautstark-sicherung` —
but since the domain move on 2026-08-28 those are **four copies**, not one
store. (Side finding: the comment in `bildquelle/src/storage.ts` justifying its
versionless open with "bildhaft and vorlaut are both served from
lautstark.github.io" is now stale. The caution is harmless; the reason is gone.)

So „just put everything under one `lautstark` database" is the right instinct
and the browser forbids it. Three honest routes:

1. **One origin, paths instead of subdomains.** Exactly the instinct, no
   cleverness, and `BASE_PATH` already exists in the products' Vite configs.
   Price: one Pages site means **coupled releases** where today every product
   ships on its own — and the move itself would **empty everybody's storage a
   second time**, which is precisely the incident `sicherung`'s `held` state was
   invented for.
2. **A hub iframe on `lautstark.tech`.** Technically better than its reputation:
   all products are **same-site** (one registrable domain), so storage
   partitioning would *not* break it. But it needs the network at boot, and that
   breaks the offline promise mitreden actively guards with an e2e test that
   greps the built bundle for unknown hosts. Out.
3. **The Sicherung folder** — and here is the turn that makes it simple for a
   person: the Wortschatz does not travel *beside* the backup, it travels
   **inside** it. Every product already writes into one folder chosen once. A
   shared `wortschatz-aktuell.json` in it, read at boot and written on change,
   and there is no new concept to learn: "the folder holds your things, all the
   tools read it." Price stays: Chromium desktop only, and for `sicherung` a
   **new inlet**, which its own rule makes a major version.

Suggested order: build the personal layer **per product first** (immediate
value, no infrastructure — in bildhaft three quarters of it exists already),
then the folder as the bridge, with file export as the universal fallback.

## The boundary that must be structural

Shelf Wortschätze are generic. The personal layer holds **photographs of real
people** — the most private data anywhere in this family. Publishing must
therefore **refuse or strip** entries carrying own pictures, the way bildhaft's
`portable()` already removes the METACOM pin from a shared file. Same format,
opposite intent, one audited door between them.

### Blast radius

Everything visual is safe to personalise as often as anyone likes; nothing hangs
off it. The **spoken form** is the expensive field: mitreden's recordings are
keyed by a fingerprint over text and voice, so changing it invalidates audio.
The personal layer should therefore carry **the picture only**, and touching the
spoken form should be a separate, deliberate act that says what it costs
("12 recordings become stale").

## What the shelf would need

Today an entry names exactly one product:

```
"product": "vorlaut-app" | "vorlaut-talker" | "bildhaft" | "mitreden"
```

A Wortschatz is product-neutral by definition — that is the point of it. So the
schema needs a way to say *all of them* (a `wortschatz` kind, or `product`
accepting a list), and the page's product filter needs to show such an entry
under every product. Everything else about an entry — the id, the payload beside
it, no symbol committed, numbers fetched at build time — stays as it is.

## Open questions

1. **Is the personal layer per device/household or per person?** Oma is the same
   Oma for both children — until a professional has eight.
2. **Does bildhaft's override dictionary *become* the personal layer** —
   visible, browsable, exportable — or live on beside it? It is the prototype
   that already serves people, only invisibly.
3. **Where is a Wortschatz authored?** Authoring in bildhaft and consuming
   everywhere avoids building the same surface three times; vorlaut-editor is
   the counter-argument, since it is the only product that knows word classes.
4. **Is a shared origin thinkable at all**, or is the folder bridge the ceiling?

## Related

- The print-material work this came out of is archived at
  [`Lautstark/druckwerk`](https://github.com/Lautstark/druckwerk); its
  `mocks/index.html` holds the material designs (Tagesplan, Auswahltafel,
  Kommunikationstafel) and the "duplicate as" matrix.
- `@lautstark/design`'s `docs/conventions.md` is where the parts of this that
  become binding belong, once they are — including the glossary amendment.
