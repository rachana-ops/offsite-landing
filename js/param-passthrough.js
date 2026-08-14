/**
 * param-passthrough.js
 * Resolves every bridge -> storefront handoff to a live Nancyflow market,
 * carries the bridge page's language into the Lem PDP URL, migrates any
 * legacy *.hellonancy.com navigation, then appends attribution params from
 * the current page URL. Existing query params and hashes are preserved.
 *
 * Exact Lem PDP links follow the market of the bridge domain; on the default
 * .com bridge they stay on .com so storefront geo can choose country/currency.
 * Other storefront links retain their explicit authored market. The storefront
 * never performs an automatic cross-domain geo redirect.
 *
 * Also patches inline window.location assignments on buttons (quiz page) via
 * a click-capture listener so late-added or dynamically-set hrefs are covered.
 */
(function () {
  // Every recognized nancyflow STORE host. The two non-live hosts (.it/.dk)
  // are included so an accidental or stale Lem link can be repaired to the
  // live .com storefront before exact handoff normalization.
  // Keep in sync with GEO_MARKETS in the storefront's src/i18n/routing.ts.
  var STORE_HOST_RE = /^https?:\/\/get\.nancyflow\.(com|co\.uk|ca|co\.nz|de|nl|fr|it|se|dk)(\/|\?|#|$)/i;
  var LEGACY_STORE_RE = /^https?:\/\/(?:[a-z0-9-]+\.)*hellonancy\.com(?=\/|\?|#|$)/i;
  var STORE_ORIGIN_RE = /^(https?:\/\/)(get\.nancyflow\.(?:com|co\.uk|ca|co\.nz|de|nl|fr|it|se|dk))(?=[\/?#]|$)/i;
  var SUPPORTED_LOCALES = {
    en: true, it: true, de: true, 'zh-hans': true, 'zh-hant': true,
    nl: true, ko: true, pt: true, es: true, sv: true, ja: true,
    fr: true, da: true, fi: true, ro: true, pl: true, cs: true,
    hu: true, el: true, hr: true
  };
  var FBC_COOKIE = '_fbc';
  var FBP_COOKIE = '_fbp';
  var FBC_MAX_AGE = 60 * 60 * 24 * 90;
  var FBP_MAX_AGE = 60 * 60 * 24 * 365 * 2;
  var FBCLID_RE = /^[A-Za-z0-9._-]+$/;
  var FBC_RE = /^fb\.\d+\.\d+\.[A-Za-z0-9._-]+$/;
  var FBP_RE = /^fb\.\d+\.\d+\.[A-Za-z0-9._-]+$/;

  // Explicit allowlist: carry attribution, never arbitrary visitor-provided
  // query parameters. utm_* is handled separately below.
  var TRACKING_PARAMS = {
    fbclid: true,
    fbc: true,
    fbp: true,
    _fbc: true,
    _fbp: true,
    gclid: true,
    dclid: true,
    gbraid: true,
    wbraid: true,
    ttclid: true,
    msclkid: true,
    twclid: true,
    li_fat_id: true,
    sccid: true,
    rdt_cid: true
  };

  /**
   * Bridge domain → the store host a visitor on it must land on.
   *
   * The market bridges share their pages with .com, and the shared ones
   * (index, quiz, editorial, manifesto, testimonial) hardcode
   * get.nancyflow.com — so without this a visitor who arrived on
   * nancyflow.se would lose that explicit market signal during the handoff.
   * The DOMAIN is the market signal: land on .se, buy on get.nancyflow.se.
   *
   * nancyflow.com maps explicitly to the default store, which keeps its
   * existing geo + path-prefix behavior.
   */
  var DEFAULT_STORE_TARGET = { host: 'get.nancyflow.com' };
  var BRIDGE_TO_STORE = {
    'nancyflow.com': DEFAULT_STORE_TARGET,
    'nancyflow.de': { host: 'get.nancyflow.de' },
    'nancyflow.nl': { host: 'get.nancyflow.nl' },
    'nancyflow.fr': { host: 'get.nancyflow.fr' },
    'nancyflow.se': { host: 'get.nancyflow.se' },
    'nancyflow.co.uk': { host: 'get.nancyflow.co.uk' },
    'nancyflow.ca': { host: 'get.nancyflow.ca' },
    'nancyflow.co.nz': { host: 'get.nancyflow.co.nz' },
    // There is no live get.nancyflow.dk host. Keep a visitor who reaches the
    // bridge on the live .com store and make Denmark explicit in the path.
    'nancyflow.dk': {
      host: 'get.nancyflow.com',
      country: 'dk',
      defaultLocale: 'da'
    },
    // Safe ahead-of-launch behavior if the currently unregistered bridge is
    // ever attached before a matching storefront host exists.
    'nancyflow.it': {
      host: 'get.nancyflow.com',
      country: 'it',
      defaultLocale: 'it'
    }
  };

  // Store hosts which are deliberately unavailable. Repair them instead of
  // allowing a customer to click through to DNS/certificate errors.
  var UNAVAILABLE_STORE_FALLBACKS = {
    'get.nancyflow.dk': true,
    'get.nancyflow.it': true
  };

  /**
   * The market pinned by the CURRENT bridge domain. The default bridge and
   * previews hand off through .com so the storefront edge can choose the
   * visitor's real country/currency instead of inferring it from page language.
   */
  function pinnedStoreTarget() {
    var host = String(window.location.hostname || '').toLowerCase().replace(/^www\./, '');
    return BRIDGE_TO_STORE[host] || DEFAULT_STORE_TARGET;
  }

  /** Normalise the language already rendered on this bridge page. */
  function bridgeLocale() {
    var runtimeLocale = window.i18n && window.i18n.locale;
    var htmlLocale = document.documentElement && document.documentElement.lang;
    var raw = String(runtimeLocale || htmlLocale || '').toLowerCase().replace(/_/g, '-');
    if (SUPPORTED_LOCALES[raw]) return raw;

    var parts = raw.split('-');
    if (parts[0] === 'zh') {
      if (parts.indexOf('hant') !== -1) return 'zh-hant';
      if (parts.indexOf('hans') !== -1) return 'zh-hans';
      if (parts.indexOf('tw') !== -1 || parts.indexOf('hk') !== -1 || parts.indexOf('mo') !== -1) {
        return 'zh-hant';
      }
      return 'zh-hans';
    }
    return SUPPORTED_LOCALES[parts[0]] ? parts[0] : '';
  }

  /** Split a store URL's path from its query/hash without re-encoding either. */
  function splitRest(rest) {
    var queryIdx = rest.indexOf('?');
    var hashIdx = rest.indexOf('#');
    var suffixIdx = queryIdx === -1
      ? hashIdx
      : (hashIdx === -1 ? queryIdx : Math.min(queryIdx, hashIdx));
    return {
      path: suffixIdx === -1 ? rest : rest.slice(0, suffixIdx),
      suffix: suffixIdx === -1 ? '' : rest.slice(suffixIdx)
    };
  }

  /** Repair links aimed at a known unavailable storefront host. */
  function repairUnavailableStore(href) {
    var match = href.match(STORE_ORIGIN_RE);
    if (!match) return href;
    if (!UNAVAILABLE_STORE_FALLBACKS[match[2].toLowerCase()]) return href;
    var rest = href.slice(match[0].length);
    return match[1] + 'get.nancyflow.com' + rest;
  }

  /**
   * Resolve an exact Lem PDP link from first principles:
   *   - current bridge domain selects an explicit market when there is one;
   *   - otherwise .com lets storefront geo select country/currency;
   *   - rendered bridge language is always explicit in the path.
   *
   * This intentionally replaces any market encoded in a static advertorial
   * URL. Content language is not shopper geography: a French-speaking Canadian
   * must reach CAD on .ca, not EUR on .fr.
   */
  function resolveLemHandoff(href, target, locale) {
    var match = href.match(STORE_ORIGIN_RE);
    if (!match) return href;
    var rest = href.slice(match[0].length);
    var parts = splitRest(rest);
    var segments = parts.path.split('/').filter(function (segment) { return !!segment; });
    var productIdx = -1;
    for (var i = 0; i < segments.length - 1; i++) {
      if (segments[i].toLowerCase() === 'products' && segments[i + 1].toLowerCase() === 'lem') {
        productIdx = i;
        break;
      }
    }
    if (productIdx === -1 || productIdx !== segments.length - 2) return href;

    var resolvedLocale = locale || target.defaultLocale || 'en';
    var destination = [resolvedLocale];
    if (target.country) destination.push(target.country);
    destination.push('products', 'lem');
    return match[1] + target.host + '/' + destination.join('/') + parts.suffix;
  }

  function readCookie(name) {
    var prefix = name + '=';
    var cookies = String(document.cookie || '').split(';');
    for (var i = 0; i < cookies.length; i++) {
      var item = cookies[i].replace(/^\s+/, '');
      if (item.slice(0, prefix.length) === prefix) {
        return item.slice(prefix.length);
      }
    }
    return '';
  }

  /** Return the known Nancyflow apex domain shared by bridge + storefront. */
  function cookieDomain() {
    var host = String(window.location.hostname || '').toLowerCase().replace(/^www\./, '');
    if (host === 'nancyflow.com' || BRIDGE_TO_STORE[host]) return host;
    return '';
  }

  function writeCookie(name, value, maxAge) {
    var cookie = name + '=' + value + '; Path=/; Max-Age=' + maxAge + '; SameSite=Lax';
    var domain = cookieDomain();
    if (domain) cookie += '; Domain=.' + domain;
    if (window.location.protocol === 'https:') cookie += '; Secure';
    document.cookie = cookie;
  }

  function fbcTail(value) {
    if (!FBC_RE.test(value || '')) return '';
    return value.split('.').slice(3).join('.');
  }

  function randomFbpSuffix() {
    try {
      var values = new Uint32Array(1);
      window.crypto.getRandomValues(values);
      return String(1000000000 + (values[0] % 9000000000));
    } catch (e) {
      return String(1000000000 + Math.floor(Math.random() * 9000000000));
    }
  }

  /**
   * Ensure first-party Meta cookies exist on the bridge apex. Domain=.nancyflow.*
   * makes them available to get.nancyflow.*; the URL carriers below are a
   * second line of defence for ccTLD hops and browsers/pixels that behave
   * differently. Existing valid identifiers are preserved.
   */
  function ensureMetaCookies(search) {
    var query = new URLSearchParams(search || '');
    var now = Date.now();

    var existingFbc = readCookie(FBC_COOKIE);
    var fbclid = query.get('fbclid');
    var carriedFbc = query.get(FBC_COOKIE) || query.get('fbc');
    var fbc = FBC_RE.test(existingFbc) ? existingFbc : '';
    if (fbclid && FBCLID_RE.test(fbclid)) {
      if (fbcTail(fbc) !== fbclid) fbc = 'fb.1.' + now + '.' + fbclid;
    } else if (!fbc && FBC_RE.test(carriedFbc || '')) {
      fbc = carriedFbc;
    }
    if (fbc) writeCookie(FBC_COOKIE, fbc, FBC_MAX_AGE);

    var existingFbp = readCookie(FBP_COOKIE);
    var carriedFbp = query.get(FBP_COOKIE) || query.get('fbp');
    var fbp = FBP_RE.test(existingFbp)
      ? existingFbp
      : (FBP_RE.test(carriedFbp || '')
        ? carriedFbp
        : 'fb.1.' + now + '.' + randomFbpSuffix());
    writeCookie(FBP_COOKIE, fbp, FBP_MAX_AGE);

    return { _fbc: fbc, _fbp: fbp };
  }

  /** Extract supported attribution params and Meta cookie carriers. */
  function collectParams(search, metaCookies) {
    var out = {};
    var pairs = String(search || '').replace(/^\?/, '').split('&');
    for (var i = 0; i < pairs.length; i++) {
      if (!pairs[i]) continue;
      var idx = pairs[i].indexOf('=');
      var key = idx === -1 ? pairs[i] : pairs[i].slice(0, idx);
      var val = idx === -1 ? '' : pairs[i].slice(idx + 1);
      var normalizedKey = key.toLowerCase();
      if (TRACKING_PARAMS[normalizedKey] || normalizedKey.slice(0, 4) === 'utm_') {
        out[key] = val;
      }
    }

    // The storefront accepts these canonical carrier names, persists them as
    // first-party cookies, then removes them from the visible address bar.
    if (metaCookies && metaCookies._fbc && !out._fbc) out._fbc = metaCookies._fbc;
    if (metaCookies && metaCookies._fbp && !out._fbp) out._fbp = metaCookies._fbp;
    return out;
  }

  /**
   * Append tracking params to a URL string that points at STORE_HOST.
   * Leaves the host/path/hash untouched; preserves any pre-existing query
   * params on the target URL; never duplicates keys.
   */
  function augmentUrl(href, params, target, locale) {
    if (!href) return href;
    // A shared last line of defence for all bridge/editorial pages: even if a
    // future static template accidentally carries an old-store URL, visitors
    // are moved to Nancyflow before market pinning and attribution run.
    href = href.replace(LEGACY_STORE_RE, 'https://get.nancyflow.com');
    href = repairUnavailableStore(href);
    // Only touch absolute URLs aimed at a nancyflow store host
    if (!STORE_HOST_RE.test(href)) {
      return href;
    }
    // Market and locale pinning run before tracking so params are appended to
    // the exact live PDP URL the customer will open.
    href = resolveLemHandoff(href, target, locale);
    var keys = Object.keys(params);
    if (!keys.length) return href;

    // Split off the hash so we can re-attach it at the end
    var hashIdx = href.indexOf('#');
    var hash = '';
    if (hashIdx !== -1) {
      hash = href.slice(hashIdx);
      href = href.slice(0, hashIdx);
    }

    // Parse existing query string. We track ALL existing keys (not just the
    // tracking ones) so a param we're adding is never appended twice if the
    // target URL already carries it.
    var qIdx = href.indexOf('?');
    var base = qIdx === -1 ? href : href.slice(0, qIdx);
    var existingSearch = qIdx === -1 ? '' : href.slice(qIdx + 1);
    var existingKeys = {};
    if (existingSearch) {
      var epairs = existingSearch.split('&');
      for (var e = 0; e < epairs.length; e++) {
        if (!epairs[e]) continue;
        var eidx = epairs[e].indexOf('=');
        existingKeys[eidx === -1 ? epairs[e] : epairs[e].slice(0, eidx)] = true;
      }
    }

    var qs = existingSearch;
    for (var k = 0; k < keys.length; k++) {
      var key = keys[k];
      if (!(key in existingKeys)) {
        qs += (qs ? '&' : '') + key + '=' + params[key];
      }
    }

    return base + (qs ? '?' + qs : '') + hash;
  }

  function run() {
    var metaCookies = ensureMetaCookies(window.location.search);
    var params = collectParams(window.location.search, metaCookies);
    // Which store this bridge domain hands off to (see BRIDGE_TO_STORE).
    var target = pinnedStoreTarget();
    var locale = bridgeLocale();

    // --- Patch <a> elements ---
    function patchAnchors(root) {
      var anchors = (root || document).querySelectorAll('a[href]');
      for (var i = 0; i < anchors.length; i++) {
        var a = anchors[i];
        var patched = augmentUrl(a.getAttribute('href'), params, target, locale);
        if (patched !== a.getAttribute('href')) {
          a.setAttribute('href', patched);
        }
      }
    }

    patchAnchors(document);

    // --- Click-capture fallback for dynamic anchors + inline buttons ---
    // Re-read cookies at click time because Meta's pixel loads asynchronously.
    // This also covers anchors injected after DOMContentLoaded.
    //
    // Why stopImmediatePropagation + setAttribute('onclick', ''):
    //   stopPropagation() in the capture phase does NOT prevent the button's own
    //   inline onclick attribute from executing — that fires in the target/bubble
    //   phase and is not a propagation-path listener that stopPropagation blocks.
    //   The inline onclick's bare window.location assignment would then overwrite
    //   our augmented URL (last assignment wins).
    //   Fix: null out the onclick attribute before navigating so it never runs,
    //   and call stopImmediatePropagation() to prevent any other capture listeners
    //   from also firing.
    document.addEventListener('click', function (e) {
      var el = e.target;
      var currentParams = collectParams(window.location.search, {
        _fbc: readCookie(FBC_COOKIE),
        _fbp: readCookie(FBP_COOKIE)
      });
      // Walk up in case the click landed on a child element.
      while (el && el !== document.body) {
        if (el.tagName === 'A' && el.getAttribute('href')) {
          var currentHref = el.getAttribute('href');
          var currentPatched = augmentUrl(currentHref, currentParams, target, bridgeLocale());
          if (currentPatched !== currentHref) el.setAttribute('href', currentPatched);
          return;
        }
        if (el.tagName === 'BUTTON') {
          var oc = el.getAttribute('onclick');
          if (oc) {
            // Match patterns: window.location='URL' or window.location="URL"
            var m = oc.match(/window\.location\s*=\s*['"]([^'"]+)['"]/);
            if (m) {
              var url = augmentUrl(m[1], currentParams, target, bridgeLocale());
              if (url !== m[1]) {
                e.preventDefault();
                // Null out the inline onclick so it cannot overwrite our
                // augmented URL after this handler returns.
                el.setAttribute('onclick', '');
                // Stop other capture-phase listeners; does not block onclick
                // (already cleared above), but is correct defensive practice.
                e.stopImmediatePropagation();
                window.location = url;
                return;
              }
            }

            // An authored inline button handler owns navigation when it does
            // not match the Lem handoff above, so do not continue into a
            // surrounding link.
            break;
          }

          // React bridge CTAs commonly render a presentational <button>
          // inside an <a>. With no inline navigation of its own, keep walking
          // so the parent anchor still receives market + attribution guards.
        }
        el = el.parentElement;
      }
    }, true /* capture phase — fires before onclick */);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
