/**
 * i18n.js — client-side translation runtime for the Nancy bridge pages.
 *
 * These pages are static HTML hosted on GitHub Pages (no server / no edge), so
 * unlike the Next storefront — which detects the visitor's country at the edge
 * (x-vercel-ip-country / cf-ipcountry) and server-renders the matching locale —
 * we detect language CLIENT-SIDE from navigator.languages. That mirrors the
 * storefront's accept-language signal (see pickLocaleFromAcceptLanguage in the
 * storefront middleware) using the same supported-locale set.
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

  /**
   * Language bridge domains pin the automatically rendered language. This is
   * host routing, not a visitor-controlled language switch. The shared .com
   * and market hosts continue to use the browser language instead.
   */
  var LANG_DOMAINS = {
    da: "nancyflow.dk",
    de: "nancyflow.de",
    nl: "nancyflow.nl",
    fr: "nancyflow.fr",
    sv: "nancyflow.se"
  };

  /** Locale pinned by the current hostname, or null off the language domains. */
  function localeFromHost() {
    var host = window.location.hostname.toLowerCase().replace(/^www\./, "");
    for (var loc in LANG_DOMAINS) {
      if (LANG_DOMAINS[loc] === host) return loc;
    }
    return null;
  }

  var HIDE_STYLE_ID = "i18n-hide-style";
  var REVEAL_TIMEOUT_MS = 1500;

  /** Walk navigator.languages in priority order; first mapped locale wins. */
  function langFromBrowser() {
    var langs = (navigator.languages && navigator.languages.length)
      ? navigator.languages
      : [navigator.language || navigator.userLanguage || "en"];
    for (var i = 0; i < langs.length; i++) {
      if (!langs[i]) continue;
      var locale = localeFromLanguageTag(langs[i]);
      if (locale) return locale;
    }
    return "en";
  }

  /**
   * Resolve the active locale. Priority:
   *   1. a language-specific bridge hostname
   *   2. browser languages
   *
   * Legacy query, cookie, and browser-storage preferences are deliberately
   * ignored. Localization is automatic and cannot be manually switched.
   * Defaults to "en".
   */
  function resolveLocale() {
    var pinned = localeFromHost();
    if (pinned) return pinned;
    return langFromBrowser();
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
    supported: SUPPORTED.slice()
  };
  window.i18n = api;

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

  // Always reflect the active locale on <html lang> (helps a11y + the store's
  // own detection stays consistent because both read the same browser signal).
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
