/* A material's pictures, large: a page of its PDF or the app, over the page.
 *
 * An addition, like search.js: every picture is a link to its own file, so
 * without this a click opens the picture on its own, as large as it is. With
 * it the click opens a <dialog> instead, and the page stays where it was.
 * Arrows go from picture to picture, Esc, ✕ or a click closes it — the dialog
 * gives Esc and the focus back for free.
 */

(() => {
  const links = [...document.querySelectorAll("a[data-gross]")];
  if (!links.length || !window.HTMLDialogElement) return;

  const dialog = document.createElement("dialog");
  dialog.className = "gross";
  dialog.innerHTML = `<img alt="">
    <button type="button" class="gross__zu" aria-label="Schließen">✕</button>
    <button type="button" class="gross__vor" aria-label="Vorheriges Bild">‹</button>
    <button type="button" class="gross__nach" aria-label="Nächstes Bild">›</button>`;
  document.body.append(dialog);
  const img = dialog.querySelector("img");
  let at = 0;

  const show = (i) => {
    at = (i + links.length) % links.length;
    img.src = links[at].href;
    img.alt = links[at].querySelector("img")?.alt ?? "";
    dialog.classList.toggle("gross--eins", links.length === 1);
  };

  links.forEach((link, i) => link.addEventListener("click", (event) => {
    event.preventDefault();
    show(i);
    dialog.showModal();
  }));
  dialog.querySelector(".gross__zu").addEventListener("click", () => dialog.close());
  dialog.querySelector(".gross__vor").addEventListener("click", () => show(at - 1));
  dialog.querySelector(".gross__nach").addEventListener("click", () => show(at + 1));
  // A click on the picture or around it closes; the buttons have their own.
  dialog.addEventListener("click", (event) => { if (event.target === dialog || event.target === img) dialog.close(); });
  dialog.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") show(at - 1);
    if (event.key === "ArrowRight") show(at + 1);
  });
})();
