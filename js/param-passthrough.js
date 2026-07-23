/**
 * param-passthrough.js
 * Appends fbclid + utm_* params from the current page URL — plus a forced
 * `nf_geo=stay` — to every outbound link pointing at get.nancyflow.com,
 * preserving existing query params and hash.
 *
 * `nf_geo=stay` is the storefront's geo opt-out: it keeps bridge/ad traffic ON
 * get.nancyflow.com and stops the cross-domain hop to a country-code store
 * (.co.uk / .ca / .co.nz). The .com store still applies its own local-currency
 * path prefixes (/gb, /se, /dk …), so buyers keep their currency/language
 * without leaving the .com domain. See ../GEO-DOMAIN-ROUTING.md.
 *
 * Also patches inline window.location assignments on buttons (quiz page) via
 * a click-capture listener so late-added or dynamically-set hrefs are covered.
 */
(function () {
  var STORE_HOST = 'get.nancyflow.com';

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
  function augmentUrl(href, params) {
    if (!href) return href;
    // Only touch absolute URLs aimed at the store
    if (href.indexOf('https://' + STORE_HOST) !== 0 &&
        href.indexOf('http://' + STORE_HOST) !== 0) {
      return href;
    }
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
    // tracking ones) so a param we're adding — e.g. nf_geo — is never appended
    // twice if the target URL already carries it.
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

    // Force nf_geo=stay onto every store link so bridge/ad traffic is never
    // bounced off get.nancyflow.com onto a country-code domain (.co.uk/.ca/
    // .co.nz). This is added even when there are NO fbclid/utm params to
    // forward, so we can't early-return on an empty tracking set anymore.
    params.nf_geo = 'stay';

    // --- Patch <a> elements ---
    function patchAnchors(root) {
      var anchors = (root || document).querySelectorAll('a[href]');
      for (var i = 0; i < anchors.length; i++) {
        var a = anchors[i];
        var patched = augmentUrl(a.getAttribute('href'), params);
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
              var url = augmentUrl(m[1], params);
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
