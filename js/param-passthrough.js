/**
 * param-passthrough.js
 * Appends fbclid + utm_* params from the current page URL to every outbound
 * link pointing at ANY get.nancyflow.*
 * store host (.com and the market ccTLDs incl. the language domains
 * .de/.nl/.fr/.it/.se/.dk), preserving existing query params and hash.
 *
 * Links to .com keep the .com path-prefix behavior; links to a language store
 * domain keep that explicit market choice. The storefront never performs an
 * automatic cross-domain geo redirect.
 *
 * Also patches inline window.location assignments on buttons (quiz page) via
 * a click-capture listener so late-added or dynamically-set hrefs are covered.
 */
(function () {
  // Every nancyflow STORE host: .com + market ccTLDs (English-currency AND
  // language domains). Keep in sync with GEO_MARKETS in the storefront's
  // src/i18n/routing.ts (single source of truth).
  var STORE_HOST_RE = /^https?:\/\/get\.nancyflow\.(com|co\.uk|ca|co\.nz|de|nl|fr|it|se|dk)(\/|\?|#|$)/;

  /**
   * Bridge domain → the store host a visitor on it must land on.
   *
   * The market bridges share their pages with .com, and the shared ones
   * (index, quiz, editorial, manifesto, testimonial) hardcode
   * get.nancyflow.com — so without this a visitor who arrived on
   * nancyflow.se would be handed to the .com/USD store the moment they
   * clicked anything outside a Swedish advertorial. The DOMAIN is the
   * market signal: land on .se, buy on get.nancyflow.se.
   *
   * nancyflow.com is absent on purpose — it is the default and keeps its
   * existing geo + path-prefix behavior.
   */
  var BRIDGE_TO_STORE = {
    'nancyflow.de': 'get.nancyflow.de',
    'nancyflow.nl': 'get.nancyflow.nl',
    'nancyflow.fr': 'get.nancyflow.fr',
    'nancyflow.se': 'get.nancyflow.se',
    'nancyflow.dk': 'get.nancyflow.dk',
    // Listed ahead of these bridges going live; harmless until then.
    'nancyflow.co.uk': 'get.nancyflow.co.uk',
    'nancyflow.ca': 'get.nancyflow.ca',
    'nancyflow.co.nz': 'get.nancyflow.co.nz'
  };

  /** The store host pinned by the CURRENT bridge domain, or '' on .com/previews. */
  function pinnedStoreHost() {
    var host = String(window.location.hostname || '').toLowerCase().replace(/^www\./, '');
    return BRIDGE_TO_STORE[host] || '';
  }

  /**
   * Re-point a DEFAULT-store (.com) link at the pinned store host. Links that
   * already name a market ccTLD, and .com links carrying a market path prefix,
   * are left untouched — both already express a market.
   */
  function pinStoreHost(href, pin) {
    if (!pin) return href;
    var m = href.match(/^(https?:\/\/)get\.nancyflow\.com(?=[\/?#]|$)/);
    if (!m) return href;
    var rest = href.slice(m[0].length);
    return m[1] + pin + rest;
  }

  /** Extract fbclid + utm_* params from the given search string. */
  function collectParams(search) {
    var out = {};
    if (!search) return out;
    var pairs = search.replace(/^\?/, '').split('&');
    for (var i = 0; i < pairs.length; i++) {
      if (!pairs[i]) continue;
      var idx = pairs[i].indexOf('=');
      var key = idx === -1 ? pairs[i] : pairs[i].slice(0, idx);
      var val = idx === -1 ? '' : pairs[i].slice(idx + 1);
      if (key === 'fbclid' || key.slice(0, 4) === 'utm_') {
        out[key] = val;
      }
    }
    return out;
  }

  /**
   * Append tracking params to a URL string that points at STORE_HOST.
   * Leaves the host/path/hash untouched; preserves any pre-existing query
   * params on the target URL; never duplicates keys.
   */
  function augmentUrl(href, params, pin) {
    if (!href) return href;
    // Only touch absolute URLs aimed at a nancyflow store host
    if (!STORE_HOST_RE.test(href)) {
      return href;
    }
    // Market pinning first so tracking params are appended to the final host.
    href = pinStoreHost(href, pin);
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
    var params = collectParams(window.location.search);
    // Which store this bridge domain hands off to (see BRIDGE_TO_STORE).
    var pin = pinnedStoreHost();

    // --- Patch <a> elements ---
    function patchAnchors(root) {
      var anchors = (root || document).querySelectorAll('a[href]');
      for (var i = 0; i < anchors.length; i++) {
        var a = anchors[i];
        var patched = augmentUrl(a.getAttribute('href'), params, pin);
        if (patched !== a.getAttribute('href')) {
          a.setAttribute('href', patched);
        }
      }
    }

    patchAnchors(document);

    // --- Click-capture fallback for buttons with inline window.location ---
    // Handles the quiz page where <button onclick="window.location='...'"> is used.
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
      // Walk up to a button in case the click landed on a child element
      while (el && el !== document.body) {
        if (el.tagName === 'BUTTON') {
          var oc = el.getAttribute('onclick');
          if (oc) {
            // Match patterns: window.location='URL' or window.location="URL"
            var m = oc.match(/window\.location\s*=\s*['"]([^'"]+)['"]/);
            if (m) {
              var url = augmentUrl(m[1], params, pin);
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
          }
          break;
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
