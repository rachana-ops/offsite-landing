/**
 * Route an advertorial's English/default URL to an existing translated page.
 *
 * Locale-specific paths are deliberate choices and never redirect. `?lang=`
 * is also explicit: a supported variant is selected, while an unavailable one
 * leaves the current page unchanged rather than inventing a translation.
 */
(function () {
  "use strict";

  var match = window.location.pathname.match(/^(.*\/advertorial\/[^/]+\/)([a-z-]+)(\/.*)?$/i);
  if (!match) return;

  var current = match[2].toLowerCase();
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
    // These match the shared bridge fallback choices, but only when the
    // advertorial family actually contains that target page.
    if ((base === "no" || base === "nb" || base === "nn") && available.indexOf("da") !== -1) return "da";
    if ((base === "ca" || base === "gl") && available.indexOf("es") !== -1) return "es";
    return null;
  }

  var query = new URLSearchParams(window.location.search).get("lang");
  if (query !== null) {
    var requested = map(query);
    if (requested && requested !== current) redirect(requested);
    return;
  }

  // A locale segment other than `en` is an explicit/manual URL and stays put.
  if (current !== "en") return;

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
    params.delete("lang");
    var search = params.toString();
    window.location.replace(nextPath + (search ? "?" + search : "") + window.location.hash);
  }
})();
