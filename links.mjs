/*
 * Every address this page points at, in one place — the same rule the vorlaut
 * site keeps, and for the same reason: a product's address is the thing that
 * moves, and this page is meant to be the one that does not.
 */

export const links = {
  // The editor and the app, which vorlaut.html sends people to.
  editor: "https://editor.lautstark.tech/",
  editorSource: "https://github.com/Lautstark/vorlaut-editor",
  appDownload: "https://github.com/Lautstark/vorlaut-app/releases/latest",
  appSource: "https://github.com/Lautstark/vorlaut-app",

  // The talker: the page that sends a board down the cable, and what somebody
  // building one has to read first.
  loader: "https://talker.lautstark.tech/",
  talkerParts:
    "https://github.com/Lautstark/vorlaut-diy-talker/blob/main/docs/hardware.md",
  talkerCase:
    "https://github.com/Lautstark/vorlaut-diy-talker/blob/main/case/building.md",
  talkerFirmware:
    "https://github.com/Lautstark/vorlaut-diy-talker/tree/main/firmware",
  talkerRepository: "https://github.com/Lautstark/vorlaut-diy-talker",

  // Named because the symbol search sends a word there, and the site says so.
  arasaac: "https://arasaac.org/",
  /* Their own addresses, not the repository-named ones. Both of those answer
     301 to these, and a redirect that works today is exactly the thing this
     file exists to stop being relied on. */
  mitreden: "https://mitreden.lautstark.tech/",
  bildhaft: "https://bildhaft.lautstark.tech/",
  /* Seit dem 2. September 2026 unter eigener Adresse; vorher lag es unter
     lautstark.tech/Wochenwerk/ und teilte sich den Origin mit dieser Seite. */
  wochenwerk: "https://wochenwerk.lautstark.tech/",
  quelltext: "https://github.com/Lautstark",
  meldungen: "https://github.com/Lautstark/lautstark.github.io/issues",
  post: "mailto:steffi@lautstark.tech",
};
