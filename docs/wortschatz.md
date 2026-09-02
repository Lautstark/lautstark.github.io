# Wortschatz

**Status: a proposal, with one product now deciding on its own half.** Written
2026-08-31 from a long design conversation; **updated 2026-09-02**, when two
things that this document treated as obstacles turned out to be solved or
shipped — see *origins* below, which no longer says what it said. bildhaft has
taken the first product-level decision out of this
([`bildhaft/adr/0002`](https://github.com/Lautstark/bildhaft/blob/main/adr/0002-the-wortschatz-is-a-place-and-material-has-a-kind.md));
the cross-product half is still a proposal. It lives in this repository rather than in
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
| **wochenwerk** | a calendar whose entries are symbols | the same words as everywhere else, resolved a fourth time |

Four products, four dialects of one thing, and nothing can hand anything to
anything — except one accident: mitreden already reads bildhaft's files and
throws away everything but the text.

Since the domain move each of them also resolves the same words against the same
sources under a different origin, so *Oma* is corrected four times by the same
household, and four times again on the next device.

A **Wortschatz** is that noun made explicit and portable: a named pot of
entries, where an entry is a text with the pictures that belong to it.

## Two halves, and they have different physics

### 1 · Shelf Wortschätze — nearly free

Generic, unpersonalised pots published on `lautstark.tech/sammlungen/`:
*Frühstück*, *Kleidung*, *Gefühle*, *Kerntafel 60 Wörter*. In every product a
**„Wörter hinzufügen"** pulls one in.

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

**Naming, because it is easy to get wrong:** *shelf* is a word for code
comments only. What people are shown is what the products already say —
`lautstark.tech/sammlungen` is headed **„Fertige Sammlungen"**, bildhaft says
„Eine **fertige Sammlung holen**", vorlaut says „wenn du eine **von
lautstark.tech holst**". A German „Regal" appears nowhere and should not start
now. The dialog is therefore **„Wörter hinzufügen"** (what happens) with the
sources named as they already are: *Fertige Sammlungen · Mein Wortschatz ·
Meine Sammlungen*. Which also means a thematic Wortschatz needs **no new kind
of shelf entry** — it is a fertige Sammlung that happens to hold words, and the
only change the shelf needs is product-neutrality.

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

## Tags — lenses, not folders

A pot of three hundred entries needs a way to be looked at, and the shape it
takes decides how much work a person has to do before the pot is useful.

**Tags, not folders.** A word carries any number of them; a tag is a filter over
one list, not a container holding its own copy. The alternative forces *Apfel*
into *Essen* or into *Kita* and asks the person who wanted both to keep two
apples — which is two answers to what an apple looks like, the exact thing a
Wortschatz exists to prevent.

**Derived first, own second.** ARASAAC hands back, per pictogram, a
`categories` list (`['fruit', 'core vocabulary-feeding']`), `tags`, and
`keywords[].type` — 2 for a noun, 3 for a verb. Wortart, Thema and
Kernwortschatz can therefore be filled in from responses the products already
make, which matters more than it sounds: a person who has to tag three hundred
words by hand tags none of them. The person's own tags (*Kita*, *Oma*, *Urlaub*)
sit beside the derived ones and are the ones worth pinning where they can be
seen.

**A tag can be a row in the sidebar**, which is how bildhaft is taking it: „Alle
Wörter" plus the pinned tags, each row one lens over one list. A word in no tag
is not lost — it is in „Alle Wörter", where it always was.

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
a quiet second path: **„Wörter hinzufügen"** → list → chosen →
the entries land as rows or cards in the open Sammlung. After that you manage
what you always manage: your Sammlung. Contributing one is likewise nothing
new — you **publish a Sammlung** to the shelf. No second object in the sidebar,
no second mental model.

### The personal layer: one list, and it outgrows Einstellungen

By `conventions.md` §3.10's own test — "does this setting's answer change when
something else is selected?" — it starts in **Einstellungen**: Oma's picture is
the same whichever Sammlung is open, and it applies *forward*, to the next thing
made. That is exactly the semantics described there, and it is where bildhaft's
panel „Mein Wörterbuch" already stands and works: it counts the entries in its
heading, lists them, lets one be removed.

§3.10 decides *where a setting goes*. It does not decide whether something is a
setting, and this one stops being one at the point where a person goes looking
for it on purpose — to see what they have, to file a word before they need it,
to look at one tag. A thing with tags, a filter and its own empty state is a
place, and a place belongs in the sidebar. That is bildhaft's ADR 0002: the
panel keeps working and stops being the only door.

- The panel per design.md §3.4 states its status before offering a control: „47
  Wörter · zuletzt geändert vor 3 Tagen".
- The place it opens into: word plus **picture** (a list of words pointing at
  labels is a record of what was decided; the pictures are the thing itself), a
  search field, tag chips as filters, click opens the familiar picker, remove
  per entry.
- **Creation happens while working**: a correction in the picker, an own picture
  for a word the library does not know — bildhaft's `unmatched` state is the
  natural on-ramp, because that is exactly where the proper nouns stand (Oma,
  Bello, Kita Sonnenschein, Papas Auto). Maintenance as a by-product, not an
  errand.
- **At the point of use**, a tile showing a personal picture says so, with a
  click to change or release it.
- Nothing here is a precondition. Typing sentences into a new Sammlung, with an
  empty Wortschatz and no tags, stays a complete way to use the product — the
  Wortschatz is what use leaves behind, not what it demands up front.

### The case that breaks it

A therapist with eight children: eight „Mama" photographs, one browser. One
device-wide layer cannot hold that. The escape would be to make the personal
Wortschatz **nameable and switchable** („Lenas Wortschatz"), which turns it from
a setting into a document and probably lifts it into the sidebar. Overhead for a
family, necessary for a professional. Build the simple version, ship file
export/import as the valve, and let use decide whether the named variant is
really needed.

## The part that was hard: origins — verified 2026-08-31, answered 2026-09-02

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
   **inside** it. Every product already writes into one folder chosen once. No
   new concept to learn: "the folder holds your things, all the tools read it."

### Route 3 is no longer hypothetical

When this was written, the folder route was priced as "a new inlet for
`sicherung`, which its own rule makes a major version". That inlet was built for
another reason and has shipped:
[`sicherung/adr/0001 — a folder can be the store`](https://github.com/Lautstark/sicherung/blob/main/adr/0001-a-folder-can-be-the-store.md).
The **Ablage** is a folder that *is* a product's store rather than a copy of it:
one record per file named by its id, each carrying `updatedAt`, the folder the
truth and the browser's copy a mirror, conflicts reported and never merged. It
is namespaced `<folder>/<app>/<kind>/<id>.json`, and binary files sit beside the
records.

A folder is not bound to an origin. **That is the whole answer to the four
subdomains** — not a workaround for them, the thing itself. And bildhaft is
already there: its overrides are written through `src/db/folder.ts` under the
kind `woerterbuch`, one file per entry, in a folder the household picked. The
store a shared Wortschatz needs exists and has records in it.

The price that remains is the one route 3 always carried — **Chromium on the
desktop**, deliberately, per that ADR: not a progressive enhancement, a stated
scope. Everywhere else, file export/import stays the valve.

### The one gap left

`AblageOptions.app` keys **both** the subtree under the folder **and** the
remembered folder handle. A product asking for a second, shared `wortschatz`
compartment beside its own would therefore ask the household to **pick the same
folder twice**, under two names that look alike — which `ablage.ts`'s own
`handle()` doc names as the thing it exists to spare people. The fix is small
and additive: a way to seed an Ablage from an existing `handle()`. That is the
only package change this proposal now needs.

Suggested order, revised: build the personal layer **per product first**
(immediate value, no infrastructure — in bildhaft most of it exists already),
then close the `handle()` gap, then let the second product read the same
compartment. File export stays the universal fallback throughout.

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
2. ~~Does bildhaft's override dictionary *become* the personal layer?~~
   **Answered: it becomes it.** It was always keyed `lang:provider:token` and
   never by Sammlung, so it was household-wide before anybody called it a
   Wortschatz. It grows visibility, pictures and tags rather than being replaced
   (bildhaft ADR 0002).
3. **Where is a Wortschatz authored?** Authoring in bildhaft and consuming
   everywhere avoids building the same surface three times; vorlaut-editor is
   the counter-argument, since it is the only product that knows word classes.
   Leaning bildhaft, which is becoming the material creator — a household holds
   words with tags and makes things out of them: Karten, Satzkarten, Tafeln,
   Kommunikationsfächer, Plauderbücher.
4. ~~Is a shared origin thinkable at all, or is the folder bridge the ceiling?~~
   **Answered: the folder is the bridge**, and it is built. The origins stay
   four; the store stops being four.
5. **Who writes it when two products are open at once?** The Ablage reports
   conflicts and never merges them, which is the right default — but a
   Wortschatz edited in bildhaft while wochenwerk has it open is the first case
   where two *products* conflict on one record rather than two devices.

## Related

- The print-material work this came out of is archived at
  [`Lautstark/druckwerk`](https://github.com/Lautstark/druckwerk); its
  `mocks/index.html` holds the material designs (Tagesplan, Auswahltafel,
  Kommunikationstafel) and the "duplicate as" matrix.
- [`bildhaft/adr/0002`](https://github.com/Lautstark/bildhaft/blob/main/adr/0002-the-wortschatz-is-a-place-and-material-has-a-kind.md)
  — the first product decision taken out of this document: two nouns in the
  sidebar, tags as lenses, a kind per material, and material still makeable
  without a Wortschatz.
- [`sicherung/adr/0001`](https://github.com/Lautstark/sicherung/blob/main/adr/0001-a-folder-can-be-the-store.md)
  — the Ablage, which is what turned the origins problem from a blocker into a
  scope statement.
- `@lautstark/design`'s `docs/conventions.md` is where the parts of this that
  become binding belong, once they are — including the glossary amendment.
