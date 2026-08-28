/**
 * Route an advertorial's English/default URL to an existing translated page.
 *
 * A locale-specific path renders directly but never creates preference state.
 * Only the selector-owned V2 preference shared with the bridge/storefront can
 * route a later English x-default URL. Browser language, market hostname,
 * legacy state, and bare `?lang=` parameters never switch an advertorial.
 */
(function () {
  "use strict";

  var KNOWN_LOCALES = [
    "en", "nl", "de", "it", "fr", "sv", "da", "es", "cs", "el",
    "fi", "hr", "hu", "ja", "ko", "pl", "pt", "ro", "zh-hans", "zh-hant"
  ];
  var STORAGE_KEY = "nancy_locale_selected_v2";
  var SELECTED_LOCALE_COOKIE = "NANCY_LOCALE_SELECTED_V2";

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

  function normalizeKnownLocale(value) {
    var raw = String(value || "").toLowerCase().replace(/_/g, "-");
    if (!raw) return null;
    if (KNOWN_LOCALES.indexOf(raw) !== -1) return raw;
    if (raw === "zh" || raw.indexOf("zh-") === 0) {
      var parts = raw.split("-");
      if (parts.indexOf("hant") !== -1) return "zh-hant";
      if (parts.indexOf("hans") !== -1) return "zh-hans";
      for (var i = 1; i < parts.length; i++) {
        if (parts[i] === "tw" || parts[i] === "hk" || parts[i] === "mo") {
          return "zh-hant";
        }
      }
      return "zh-hans";
    }
    var base = raw.split("-")[0];
    if (base === "no" || base === "nb" || base === "nn") return "da";
    if (base === "ca" || base === "gl") return "es";
    return KNOWN_LOCALES.indexOf(base) !== -1 ? base : null;
  }

  function readCookie(name) {
    var prefix = name + "=";
    var cookies = String(document.cookie || "").split(";");
    for (var i = 0; i < cookies.length; i++) {
      var item = cookies[i].replace(/^\s+/, "");
      if (item.slice(0, prefix.length) === prefix) {
        try { return decodeURIComponent(item.slice(prefix.length)); }
        catch (e) { return item.slice(prefix.length); }
      }
    }
    return "";
  }

  function selectedLocale() {
    var normalized = normalizeKnownLocale(readCookie(SELECTED_LOCALE_COOKIE));
    if (normalized) return normalized;
    try {
      normalized = normalizeKnownLocale(localStorage.getItem(STORAGE_KEY));
      if (normalized) return normalized;
    } catch (e) {}
    return null;
  }

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

  // A localized path renders as authored but is not evidence of a selector
  // click and therefore must not affect a later English ad visit.
  if (current !== "en") {
    return;
  }

  // A selector choice made on another bridge/storefront page may route this
  // English URL. `?lang=` is only transport and cannot create or replace that
  // choice; when it is stale, the selector-owned marker remains authoritative.
  var selected = selectedLocale();
  if (selected) {
    var query = normalizeKnownLocale(new URLSearchParams(window.location.search).get("lang"));
    var requested = query === selected ? query : selected;
    var target = map(requested);
    if (target && target !== current) redirect(target);
    return;
  }

  function redirect(locale) {
    var nextPath = match[1] + locale + suffix;
    var params = new URLSearchParams(window.location.search);
    params.delete("lang");
    var search = params.toString();
    window.location.replace(nextPath + (search ? "?" + search : "") + window.location.hash);
  }
})();
