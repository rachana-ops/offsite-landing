/**
 * Route an advertorial's English/default URL to an existing translated page.
 *
 * Locale-specific paths and `?lang=` are deliberate choices. They are shared
 * with later advertorial/bridge pages through the same cookie and localStorage
 * keys as the bridge i18n runtime. A remembered manual choice can route the
 * English x-default URL; otherwise it remains English. Browser language never
 * switches an advertorial.
 */
(function () {
  "use strict";

  var KNOWN_LOCALES = [
    "en", "nl", "de", "it", "fr", "sv", "da", "es", "cs", "el",
    "fi", "hr", "hu", "ja", "ko", "pl", "pt", "ro", "zh-hans", "zh-hant"
  ];
  var STORAGE_KEY = "nancy_locale";
  var STOREFRONT_COOKIE = "NEXT_LOCALE";
  var EXPLICIT_LOCALE_COOKIE = "NANCY_LOCALE_MANUAL";
  var COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
  var COOKIE_APEXES = [
    "nancyflow.com", "nancyflow.co.uk", "nancyflow.ca", "nancyflow.co.nz",
    "nancyflow.de", "nancyflow.nl", "nancyflow.fr", "nancyflow.se"
  ];

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

  function cookieApex() {
    var host = String(window.location.hostname || "").toLowerCase().replace(/^www\./, "");
    for (var i = 0; i < COOKIE_APEXES.length; i++) {
      var apex = COOKIE_APEXES[i];
      if (host === apex || host.slice(-(apex.length + 1)) === "." + apex) return apex;
    }
    return null;
  }

  function rememberLocale(locale) {
    try { localStorage.setItem(STORAGE_KEY, locale); } catch (e) {}
    var suffix = "; Path=/; Max-Age=" + COOKIE_MAX_AGE + "; SameSite=Lax";
    var apex = cookieApex();
    if (apex) suffix += "; Domain=." + apex;
    if (window.location.protocol === "https:") suffix += "; Secure";
    try {
      document.cookie = STOREFRONT_COOKIE + "=" + encodeURIComponent(locale) + suffix;
      document.cookie = EXPLICIT_LOCALE_COOKIE + "=" + encodeURIComponent(locale) + suffix;
    } catch (e) {}
  }

  function rememberedLocale() {
    var explicit = readCookie(EXPLICIT_LOCALE_COOKIE);
    var cookieLocale = explicit === "1" ? readCookie(STOREFRONT_COOKIE) : explicit;
    var normalized = normalizeKnownLocale(cookieLocale);
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

  var query = new URLSearchParams(window.location.search).get("lang");
  if (query !== null) {
    var explicitLocale = normalizeKnownLocale(query);
    if (explicitLocale) rememberLocale(explicitLocale);
    var requested = map(explicitLocale);
    if (requested && requested !== current) redirect(requested);
    return;
  }

  // A locale segment other than `en` is an explicit/manual URL and stays put.
  if (current !== "en") {
    var currentLocale = normalizeKnownLocale(current);
    if (currentLocale && available.indexOf(currentLocale) !== -1) {
      rememberLocale(currentLocale);
    }
    return;
  }

  // A deliberate choice made on another advertorial or bridge page may route
  // this English URL. If it is unavailable here, keep the English fallback.
  var remembered = rememberedLocale();
  if (remembered) {
    var rememberedTarget = map(remembered);
    if (rememberedTarget && rememberedTarget !== current) redirect(rememberedTarget);
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
