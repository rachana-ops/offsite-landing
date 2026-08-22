/**
 * i18n.js — client-side translation runtime for the Nancy bridge pages.
 *
 * These pages are static HTML hosted without a server-side locale runtime.
 * Language is selected only by the selector-owned V2 preference shared with
 * the storefront. A first-time visitor on every market host sees English;
 * browser language, market hostname, legacy state, and bare URL parameters
 * never switch the page.
 *
 * English is the source of truth: every translatable element keeps its English
 * text baked into the markup as the always-present fallback. For a non-English
 * visitor we fetch a per-page/per-locale JSON dictionary and swap text/attrs.
 *
 * HOW TO INSTRUMENT A PAGE
 *   1. Add to <head> (relative to the page's depth):  <script src="js/i18n.js"></script>
 *   2. Add  data-i18n-page="<pageKey>"  to the <html> element.
 *   3. Add  data-i18n="<key>"  to each element whose innerHTML is translatable.
 *      For attributes use  data-i18n-<attr>="<key>"  e.g.
 *        data-i18n-placeholder, data-i18n-alt, data-i18n-aria-label,
 *        data-i18n-title, data-i18n-content (for <meta name=description>).
 *   4. Translations live at  i18n/<locale>/<pageKey>.json  (flat { key: html }).
 *      English needs NO file — it is the markup fallback.
 *   5. For text built by inline JS, call  window.i18n.t(key, englishFallback)
 *      and wrap the render in  window.i18n.ready.then(render).
 *
 * The runtime is included synchronously in <head> so it can hide the body
 * (visibility only — no layout shift) BEFORE first paint for non-English
 * visitors, preventing a flash of English. A hard safety timeout always reveals
 * the page, so a slow/failed fetch can never leave it blank.
 */
(function () {
  "use strict";

  // Locales we ship translations for. English is the baked-in fallback.
  // Every locale available across the storefront catalogs.
  var SUPPORTED = [
    "en", "nl", "de", "it", "fr", "sv", "da", "es", "cs", "el",
    "fi", "hr", "hu", "ja", "ko", "pl", "pt", "ro", "zh-hans", "zh-hant"
  ];

  // BCP-47 base language -> our locale. Mirrors the storefront's intent
  // (e.g. Norwegian visitors are served Danish, as no->da in the storefront).
  var LANG_TO_LOCALE = {
    en: "en",
    nl: "nl", // Dutch (also Flemish/Belgium)
    de: "de", // German (also at/ch)
    it: "it",
    fr: "fr",
    sv: "sv", // Swedish
    da: "da", // Danish
    no: "da", nb: "da", nn: "da", // Norwegian -> Danish (storefront parity)
    es: "es", // Spanish (all variants)
    ca: "es", gl: "es", // Catalan/Galician -> Spanish
    cs: "cs",
    el: "el",
    fi: "fi",
    hr: "hr",
    hu: "hu",
    ja: "ja",
    ko: "ko",
    pl: "pl",
    pt: "pt",
    ro: "ro",
    zh: "zh-hans" // Bare Chinese defaults to Simplified Chinese.
  };

  /** Map a BCP-47 language tag to one of our locale catalogues. */
  function localeFromLanguageTag(value) {
    var raw = String(value || "").toLowerCase().replace(/_/g, "-");
    if (!raw) return null;
    if (SUPPORTED.indexOf(raw) !== -1) return raw;

    // Chinese requires script/region-aware routing: Taiwan, Hong Kong and
    // Macau use Traditional; mainland China, Singapore and Malaysia use
    // Simplified. An explicit script subtag always wins over the region.
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

    return LANG_TO_LOCALE[raw.split("-")[0]] || null;
  }

  // These V2 keys are written only by setLocale (the authored selector). The
  // legacy nancy_locale / NANCY_LOCALE_MANUAL keys are intentionally never
  // read: older host, path, and query routing could create them without a click.
  var STORAGE_KEY = "nancy_locale_selected_v2";
  var STOREFRONT_COOKIE = "NEXT_LOCALE";
  var SELECTED_LOCALE_COOKIE = "NANCY_LOCALE_SELECTED_V2";
  var COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
  var COOKIE_APEXES = [
    "nancyflow.com", "nancyflow.co.uk", "nancyflow.ca", "nancyflow.co.nz",
    "nancyflow.de", "nancyflow.nl", "nancyflow.fr", "nancyflow.se"
  ];
  var HIDE_STYLE_ID = "i18n-hide-style";
  var REVEAL_TIMEOUT_MS = 1500;

  /** Resolve the production apex shared by a bridge and its get.* storefront. */
  function cookieApex() {
    var host = window.location.hostname.toLowerCase().replace(/^www\./, "");
    for (var i = 0; i < COOKIE_APEXES.length; i++) {
      var apex = COOKIE_APEXES[i];
      if (host === apex || host.slice(-(apex.length + 1)) === "." + apex) {
        return apex;
      }
    }
    return null;
  }

  /** Share an explicit bridge-language choice with get.nancyflow.*. */
  function writeStorefrontLocaleCookie(loc) {
    // Preview/localhost hosts get a host-only cookie. Production bridge hosts
    // use their apex so the get.nancyflow.* subdomain receives the same choice.
    var suffix =
      "; Path=/; Max-Age=" + COOKIE_MAX_AGE + "; SameSite=Lax";
    var apex = cookieApex();
    if (apex) suffix += "; Domain=." + apex;
    if (window.location.protocol === "https:") suffix += "; Secure";
    try {
      document.cookie = STOREFRONT_COOKIE + "=" + encodeURIComponent(loc) + suffix;
      document.cookie = SELECTED_LOCALE_COOKIE + "=" + encodeURIComponent(loc) + suffix;
    } catch (e) {}
  }

  function rememberLocale(loc) {
    try { localStorage.setItem(STORAGE_KEY, loc); } catch (e) {}
    writeStorefrontLocaleCookie(loc);
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

  /** Return only a preference previously written by the language selector. */
  function selectedLocale() {
    var selected = localeFromLanguageTag(readCookie(SELECTED_LOCALE_COOKIE));
    if (selected && SUPPORTED.indexOf(selected) !== -1) return selected;
    try {
      selected = localeFromLanguageTag(localStorage.getItem(STORAGE_KEY));
      if (selected && SUPPORTED.indexOf(selected) !== -1) return selected;
    } catch (e) {}
    return null;
  }

  /** Read a selector transport value, normalised to a supported locale. */
  function langFromQuery() {
    var m = /[?&]lang=([^&#]+)/.exec(window.location.search);
    if (!m) return null;
    try {
      return localeFromLanguageTag(decodeURIComponent(m[1]));
    } catch (e) {
      // A malformed campaign URL must never abort the bridge runtime.
      return null;
    }
  }

  /**
   * Resolve the active locale from selector-owned V2 state only. `?lang=` is
   * transport for setLocale and is accepted only when it agrees with that
   * state; a stale/bare campaign parameter is never a language choice.
   */
  function resolveLocale() {
    var selected = selectedLocale();
    if (!selected) return "en";
    var q = langFromQuery();
    return q === selected ? q : selected;
  }

  /** Absolute site root derived from this script's own URL (.../js/i18n.js). */
  function siteRoot() {
    var src = (document.currentScript && document.currentScript.src) || "";
    // Strip a trailing "/js/i18n.js" (with optional ?query) to get the root.
    var clean = src.replace(/[?#].*$/, "");
    var idx = clean.lastIndexOf("/js/i18n.js");
    if (idx !== -1) return clean.slice(0, idx);
    // Fallback: directory of the document.
    return window.location.origin;
  }

  var ROOT = siteRoot();
  var LOCALE = resolveLocale();
  var PAGE = (document.documentElement.getAttribute("data-i18n-page") || "").trim();

  // Expose a minimal API immediately so inline page scripts can rely on it.
  var dict = {};
  var resolveReady;
  var api = {
    locale: LOCALE,
    page: PAGE,
    /** Translate a key; returns englishFallback (or the key) when missing.
     *  Supports simple {token} interpolation via the optional params object. */
    t: function (key, englishFallback, params) {
      var val = (dict && dict[key] != null) ? dict[key] : (englishFallback != null ? englishFallback : key);
      if (params) {
        val = String(val).replace(/\{(\w+)\}/g, function (_, k) {
          return params[k] != null ? params[k] : "{" + k + "}";
        });
      }
      return val;
    },
    /** Resolves once translations are loaded (immediately for English). */
    ready: new Promise(function (res) { resolveReady = res; }),
    /** Programmatically switch locale (persists + reloads). */
    setLocale: function (loc) {
      if (SUPPORTED.indexOf(loc) === -1) return;
      rememberLocale(loc);
      // A language choice changes content only. Relative navigation deliberately
      // preserves the current market hostname and therefore its currency.
      window.location.assign(
        window.location.pathname +
        withLangParam(stripLangParam(window.location.search), loc) +
        window.location.hash
      );
    },
    supported: SUPPORTED.slice()
  };
  window.i18n = api;

  /** Drop any lang=… pair from a search string (keeps every other param). */
  function stripLangParam(search) {
    if (!search) return "";
    var kept = search.replace(/^\?/, "").split("&").filter(function (pair) {
      return pair && pair.split("=")[0] !== "lang";
    });
    return kept.length ? "?" + kept.join("&") : "";
  }

  /** Append lang=<loc> to a search string. */
  function withLangParam(search, loc) {
    return (search ? search + "&" : "?") + "lang=" + loc;
  }

  // Language never changes the current market hostname.

  // --- No-FOUC: hide the body for non-English visitors until we swap text. ---
  var needsTranslation = LOCALE !== "en" && SUPPORTED.indexOf(LOCALE) !== -1;
  var revealed = false;

  function injectHideStyle() {
    if (document.getElementById(HIDE_STYLE_ID)) return;
    var style = document.createElement("style");
    style.id = HIDE_STYLE_ID;
    // visibility (not display) keeps layout stable — no reflow when revealed.
    style.textContent = "html.i18n-pending body{visibility:hidden!important}";
    (document.head || document.documentElement).appendChild(style);
  }

  function reveal() {
    if (revealed) return;
    revealed = true;
    document.documentElement.classList.remove("i18n-pending");
  }

  if (needsTranslation) {
    document.documentElement.classList.add("i18n-pending");
    injectHideStyle();
    // Safety net: never leave the page blank, even if fetch hangs or errors.
    window.setTimeout(reveal, REVEAL_TIMEOUT_MS);
  }

  // Always reflect the explicitly resolved locale on <html lang> for a11y and
  // for the localized storefront handoff.
  try { document.documentElement.lang = LOCALE; } catch (e) {}

  /** Apply the loaded dictionary to all instrumented nodes in `root`. */
  function applyTranslations(root) {
    var scope = root || document;
    // innerHTML translations
    var nodes = scope.querySelectorAll("[data-i18n]");
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var key = el.getAttribute("data-i18n");
      if (key && dict[key] != null) el.innerHTML = dict[key];
    }
    // attribute translations: data-i18n-<attr>="key"
    var attrNodes = scope.querySelectorAll("*");
    for (var j = 0; j < attrNodes.length; j++) {
      var node = attrNodes[j];
      if (!node.attributes) continue;
      for (var a = 0; a < node.attributes.length; a++) {
        var attr = node.attributes[a];
        var name = attr.name;
        if (name.indexOf("data-i18n-") !== 0) continue;
        if (name === "data-i18n-page") continue;
        var realAttr = name.slice("data-i18n-".length); // e.g. placeholder, alt
        var k = attr.value;
        if (k && dict[k] != null) {
          node.setAttribute(realAttr, dict[k]);
        }
      }
    }
  }

  function finish() {
    // Apply once the DOM is parsed (we may be called from <head>).
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function () {
        try { applyTranslations(document); } catch (e) {}
        reveal();
      });
    } else {
      try { applyTranslations(document); } catch (e) {}
      reveal();
    }
  }

  if (!needsTranslation || !PAGE) {
    // English (or an un-keyed page): nothing to fetch.
    if (resolveReady) resolveReady(api);
    reveal();
    return;
  }

  // Fetch the per-page/per-locale dictionary, then apply.
  var url = ROOT + "/i18n/" + LOCALE + "/" + PAGE + ".json";
  fetch(url, { credentials: "omit" })
    .then(function (r) { return r.ok ? r.json() : {}; })
    .catch(function () { return {}; })
    .then(function (json) {
      dict = json || {};
      if (resolveReady) resolveReady(api);
      finish();
    });
})();
