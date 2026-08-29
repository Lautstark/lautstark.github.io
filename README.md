# lautstark.github.io

The organisation site: the front door for `vorlaut`, `mitreden` and `bildhaft`,
written for the people who would use them rather than for developers. Published
at <https://lautstark.github.io/>.

**German only**, like the products' own explainer pages. Code, comments and
commit messages stay English, per the organisation's convention.

## Why a site of its own

The three products each have an address, and each of those addresses contains
the name of a repository — which is the thing that moves. This page does not
name one, so it is the address worth writing down. Every outbound address is
written once in [`links.mjs`](links.mjs); [`tools/check.mjs`](tools/check.mjs)
fails the build on a placeholder with no entry, on an entry no page uses, and
on a bare `http(s)` address written into a page.

## The three accents

No token file carries three accents at once: each product's file in
`@lautstark/design` derives every grey from its own hue. vorlaut's tokens are
the ground here, and each product section overrides only `--accent` and
`--accent-strong` with the values from that product's own token file. If this
stays, those six lines belong in a neutral `lautstark.css` generated in
`Lautstark/design` the way the others are.

## The Sammlungen shelf

`lautstark.tech/sammlungen/` is a shelf of ready-made Sammlungen: entries hold
words, places and ARASAAC numbers, `dist/sammlungen/index.json` is what the
programs will fetch, and one page renders the lot for a person to look through.

**No symbol is committed.** The entries hold numbers; `npm run downloads`
fetches the pixels at build time into `dist/`, cached under `.cache/`. Neither
is in git — which keeps this repository's "no symbols" posture true and is why
an entry is kilobytes.

**The product filter needs no JavaScript.** It is radio inputs and a sibling
selector, and the rules that hide what a chosen radio excludes are generated for
the products actually present — so the page filters with the script absent.

`site/sammlungen/search.js` is the one script on this site, and it is an
addition rather than a requirement: it reveals a search field and narrows by
free text, which CSS cannot do. Without it the page is complete and still
filters, which is why the field is `hidden` in the markup until it runs.

### An entry

```
sammlungen/entries/<id>/entry.json     what it is called and who it is for
sammlungen/entries/<id>/<payload>      what it holds, read only by that product
```

| field in `entry.json` | |
|---|---|
| `schema` | `1`. A program skips an entry whose schema it does not know. |
| `id` | lower-case words joined by hyphens, and the folder's own name |
| `product` | `vorlaut-app`, `vorlaut-talker`, `bildhaft` or `mitreden` |
| `name`, `description` | the editorial half — prose, changed without re-exporting |
| `tags` | free text, shown on the card |
| `language`, `symbols` | `de`, `arasaac` |
| `attribution` | travels into the downloaded file |
| `seeAlso` | ids of entries written to go with this one, named on both sides |
| `payload` | the file name beside this one |
| `symbolNotes` | why a symbol is a substitution rather than a match |

A `vorlaut-app` payload holds `grid`, `home`, `firstColumnShared` and `pages`,
each button carrying `row`, `col`, `text`, `wordclass`, and — where one is known
— a `concept`, the `terms` to find it under, and an `arasaac` number. The terms
are what let a reader with their own METACOM folder resolve the same button; the
number is what everyone else gets.

**Nothing is interoperable and nothing needs to be.** An entry names one product
and carries a payload only that product reads. `seeAlso` is how two entries say
they were written for each other, without any format knowing about it.

### Adding one

Until the editor can export one, an entry is written by hand — and the numbers
are the part worth having help with.

```bash
npm run entry -- neu essen-und-trinken     # the folder, with both files in it
npm run entry -- symbol mehr weg nochmal   # what ARASAAC has, and how well
npm run check                              # what is still missing
```

`symbol` prints candidates rather than picking one, and says whether a hit
carries the word itself or merely contains it. Read the keywords, not the
rating: `weg` returns an exact match for the *noun* — a footpath — and
`nochmal` returns nothing at all until you ask for `noch einmal`. Where the
number you choose is a substitution rather than a match, say why in
`symbolNotes`; that sentence is the entry's most useful line.

Pictures are at `arasaac.org/pictograms/de/<nummer>`.

### What the check enforces

`npm run check` fails on a METACOM name anywhere under `sammlungen/`, on a
picture committed there, on an ARASAAC number that is not a number, on a
`seeAlso` that does not point back, and on an id that does not match its folder.
`npm run check -- --online` additionally asks ARASAAC whether every number still
resolves; CI runs that, and again every Monday.

## Working on it

```bash
npm install && npm run build
```

Then open `dist/index.html` — the pages need no server and no base path.
