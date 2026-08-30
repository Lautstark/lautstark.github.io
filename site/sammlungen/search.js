/* Typing to narrow the shelf.
 *
 * The only script on this site, and it is an addition rather than a
 * requirement. Every card is written into the page at build time and the
 * product filter is radio inputs and a sibling selector, so without this file
 * the page is complete and still filters. What it adds is free text, which CSS
 * cannot do.
 *
 * That is why the field is `hidden` in the markup and revealed here: a search
 * box that cannot search is worse than no search box.
 *
 * It hides and shows, and the radios it only ever sets once, on arrival: a
 * link from another page may name a product — sammlungen/index.html?produkt=
 * mitreden — and an address is the one thing CSS cannot read. Without this file
 * such a link opens the shelf on „Alle", which is everything and never a wrong
 * answer. Otherwise both mechanisms only ever hide, so a card has to survive
 * both to be seen, and the two combine without either knowing about the other.
 */

(() => {
  const box = document.getElementById("suche");
  const shelf = document.getElementById("regal");
  if (!box || !shelf) return;

  const cards = [...shelf.querySelectorAll(".karte")];
  const nothing = document.getElementById("nichts");
  const count = document.getElementById("anzahl");
  const all = count ? count.textContent : "";

  box.closest(".suchzeile").hidden = false;

  /* The product a link asked for, if that product is on this shelf at all.
     A name with no entries has no radio to check — the shelf then opens whole,
     which is the same thing an unfiltered visit shows. */
  const asked = new URLSearchParams(location.search).get("produkt");
  const chosen = asked && document.getElementById(`p-${asked}`);
  if (chosen) chosen.checked = true;

  /* The same folding the haystack was built with, so „wörter", "worter" and
   * "woerter" all reach the same card. See tools/sammlungen.mjs. */
  const fold = (value) => value.toLowerCase().replaceAll("ß", "ss")
    .normalize("NFD").replace(/\p{M}/gu, "");

  function narrow() {
    const words = fold(box.value).trim().split(/\s+/).filter(Boolean);

    for (const card of cards) {
      // Every word has to appear somewhere in the card, which is what makes
      // typing more words narrow rather than widen.
      card.hidden = !words.every((word) => card.dataset.text.includes(word));
    }

    /* Counted from what is actually on screen rather than from what this
     * function just decided: the radios hide cards too, and asking the
     * computed style is the only way to know what survived both. */
    const shown = cards.filter((card) => getComputedStyle(card).display !== "none").length;
    if (nothing) nothing.hidden = shown > 0;
    if (count) count.textContent = shown === cards.length ? all : `${shown} von ${cards.length}`;
  }

  box.addEventListener("input", narrow);
  // The radios move what is on screen without this file hearing about it, so
  // the count and the empty state have to be recomputed when one changes.
  for (const radio of document.querySelectorAll(".wahl")) {
    radio.addEventListener("change", narrow);
  }
  narrow();
})();
