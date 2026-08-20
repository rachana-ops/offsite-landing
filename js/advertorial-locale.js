/**
 * Route only an advertorial's English/default URL to the best translated page
 * for the browser. A locale already present in the path is authoritative.
 *
 * Language query parameters and legacy cookie/storage preferences are ignored:
 * this runtime performs automatic localization only and exposes no manual
 * switching or persistence behavior.
 */
(function () {
  "use strict";

  var match = window.location.pathname.match(/^(.*\/advertorial\/[^/]+\/)([a-z-]+)(\/.*)?$/i);
  if (!match) return;

  var current = match[2].toLowerCase();
  if (current !== "en") return;

  var suffix = match[3] || "/";
  var available = [];
  var alternates = document.querySelectorAll('link[rel="alternate"][hreflang]');
  for (var i = 0; i < alternates.length; i++) {
    var locale = String(alternates[i].getAttribute("hreflang") || "").toLowerCase();
    if (locale && locale !== "x-default" && available.indexOf(locale) === -1) {
      available.push(locale);
    }
  }
  if (!available.length) return;

  function map(value) {
    var raw = String(value || "").toLowerCase().replace(/_/g, "-");
    if (available.indexOf(raw) !== -1) return raw;
    var base = raw.split("-")[0];
    if (available.indexOf(base) !== -1) return base;
    if ((base === "no" || base === "nb" || base === "nn") && available.indexOf("da") !== -1) return "da";
    if ((base === "ca" || base === "gl") && available.indexOf("es") !== -1) return "es";
    return null;
  }

  var languages = navigator.languages && navigator.languages.length
    ? navigator.languages
    : [navigator.language || navigator.userLanguage || "en"];
  for (var j = 0; j < languages.length; j++) {
    var detected = map(languages[j]);
    if (detected) {
      if (detected !== current) redirect(detected);
      return;
    }
  }

  function redirect(locale) {
    var nextPath = match[1] + locale + suffix;
    var params = new URLSearchParams(window.location.search);
    // `lang` used to be a hidden manual switch. Do not carry it into the
    // automatically selected destination; preserve every unrelated parameter.
    params.delete("lang");
    var search = params.toString();
    window.location.replace(nextPath + (search ? "?" + search : "") + window.location.hash);
  }
})();
