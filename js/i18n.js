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
   * Language BRIDGE domains — one dedicated domain per top language, mirroring
   * the storefront's language markets (GEO_MARKETS in the storefront's
   * src/i18n/routing.ts — keep in sync). When LIVE:
   *   - a language domain PINS its language (no browser detection);
   *   - window.i18n.setLocale('de') navigates to the domain instead of
   *     reloading in place.
   * Flip LANG_DOMAINS_LIVE to true only when every domain below serves this
   * site over HTTPS — otherwise visitors would be bounced onto dead domains.
   *
   * `it` and `da` deliberately have NO domain: nancyflow.it was never
   * registered and nancyflow.dk is undelegated, so both stay on nancyflow.com
   * and hand off to get.nancyflow.com with the /<locale>/<country>/ path
   * prefix, exactly as before.
   */
  var LANG_DOMAINS_LIVE = false;
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

  var STORAGE_KEY = "nancy_locale";
  var STOREFRONT_COOKIE = "NEXT_LOCALE";
  var EXPLICIT_LOCALE_COOKIE = "NANCY_LOCALE_MANUAL";
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
      // Store the locale in the intent marker too. Unlike NEXT_LOCALE this
      // cookie did not exist in legacy deployments, so an old host-only
      // NEXT_LOCALE=en cannot beat the newer parent-domain choice by ordering.
      document.cookie = EXPLICIT_LOCALE_COOKIE + "=" + encodeURIComponent(loc) + suffix;
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

  /** Read ?lang= override from the current URL, normalised to a supported locale. */
  function langFromQuery() {
    var m = /[?&]lang=([^&#]+)/.exec(window.location.search);
    if (!m) return null;
    try {
      return localeFromLanguageTag(decodeURIComponent(m[1]));
    } catch (e) {
      // A malformed campaign URL must never abort the bridge runtime (which
      // would also prevent the guarded storefront handoff from initializing).
      return null;
    }
  }

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
   *   1. ?lang= URL override
   *   2. a language-specific bridge hostname
   *   3. a deliberate storefront choice shared by cookie
   *   4. a previously remembered bridge choice (localStorage)
   *   5. browser languages
   * Defaults to "en".
   */
  function resolveLocale() {
    var q = langFromQuery();
    if (q) {
      rememberLocale(q);
      return q;
    }
    // A language domain IS the language choice — pin it, ignoring any stale
    // localStorage/browser signal. (?lang above stays as an explicit escape.)
    var pinned = localeFromHost();
    if (pinned) {
      writeStorefrontLocaleCookie(pinned);
      return pinned;
    }
    // A choice made on get.nancyflow.com is shared back to this sibling host.
    // Only trust it with the explicit marker: older storefront deployments
    // auto-seeded NEXT_LOCALE=en for every visitor.
    var explicit = readCookie(EXPLICIT_LOCALE_COOKIE);
    var shared = SUPPORTED.indexOf(explicit) !== -1
      ? explicit
      : (explicit === "1" ? readCookie(STOREFRONT_COOKIE) : "");
    if (shared && SUPPORTED.indexOf(shared) !== -1) {
      try { localStorage.setItem(STORAGE_KEY, shared); } catch (e) {}
      return shared;
    }
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved && SUPPORTED.indexOf(saved) !== -1) {
        // Backfill the shared cookie for choices saved before the storefront
        // handoff existed.
        writeStorefrontLocaleCookie(saved);
        return saved;
      }
    } catch (e) {}
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
    /** Programmatically switch locale (persists + reloads). */
    setLocale: function (loc) {
      if (SUPPORTED.indexOf(loc) === -1) return;
      rememberLocale(loc);
      // Choosing a language that has a live dedicated domain navigates THERE
      // (path + query preserved); other languages reload in place as before.
      // Choosing a domain-less language while ON a language domain returns to
      // nancyflow.com (which serves every language client-side).
      var target = LANG_DOMAINS_LIVE && LANG_DOMAINS[loc] ? LANG_DOMAINS[loc] : null;
      var here = localeFromHost();
      if (target && window.location.hostname.toLowerCase().replace(/^www\./, "") !== target) {
        window.location.assign("https://" + target + window.location.pathname + stripLangParam(window.location.search) + window.location.hash);
        return;
      }
      if (!target && here) {
        window.location.assign("https://nancyflow.com" + window.location.pathname + withLangParam(stripLangParam(window.location.search), loc) + window.location.hash);
        return;
      }
      window.location.reload();
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

  // Never geo/language-redirect a visitor who landed on nancyflow.com. Their
  // locale is rendered in place; a domain hop only happens after they actively
  // choose a language through setLocale above.

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
