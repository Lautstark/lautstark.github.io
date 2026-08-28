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

## Working on it

```bash
npm install && npm run build
```

Then open `dist/index.html` — the pages need no server and no base path.
