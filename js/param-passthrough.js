/**
 * param-passthrough.js
 * Appends fbclid + utm_* params from the current page URL to every outbound
 * link pointing at get.nancyflow.com, preserving existing query params and hash.
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

    // Parse existing query string
    var qIdx = href.indexOf('?');
    var base = qIdx === -1 ? href : href.slice(0, qIdx);
    var existingSearch = qIdx === -1 ? '' : href.slice(qIdx + 1);
    var existing = collectParams('?' + existingSearch);

    var qs = existingSearch;
    for (var k = 0; k < keys.length; k++) {
      var key = keys[k];
      if (!(key in existing)) {
        qs += (qs ? '&' : '') + key + '=' + params[key];
      }
    }

    return base + (qs ? '?' + qs : '') + hash;
  }

  function run() {
    var params = collectParams(window.location.search);

    // Nothing to forward — skip all DOM work
    if (!Object.keys(params).length) return;

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
                e.stopPropagation();
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
