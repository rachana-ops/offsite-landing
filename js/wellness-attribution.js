/** URL parameter forwarding for the Wellness guide's HelloNancy product links. */
(function () {
  if (window.__wellnessAttributionInstalled) return;
  window.__wellnessAttributionInstalled = true;
  var storageKey = 'wellness-guide-attribution-v1';
  var current = new URLSearchParams(window.location.search);
  var params = current;
  try {
    // A new tagged landing replaces the previous campaign in this tab.
    if (current.size) sessionStorage.setItem(storageKey, current.toString());
    else params = new URLSearchParams(sessionStorage.getItem(storageKey) || '');
  } catch (_) { /* URL forwarding still works when storage is unavailable. */ }

  // The existing CAPI relay carries these cookie identifiers in hn_at and
  // removes their raw forms. Re-adding them would cause competing observers.
  var relayCookieParams = new Set(['fbc', 'fbp', '_fbc', '_fbp', 'hn_fbc', 'hn_fbp', '_hn_fbc', '_hn_fbp', 'hn_at']);
  function decorate(href) {
    var url;
    try { url = new URL(href, window.location.href); } catch (_) { return href; }
    if (!/^(?:www\.)?hellonancy\.com$/i.test(url.hostname) && !/^get\.nancyflow\.com$/i.test(url.hostname)) return href;
    if (!/^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?products\/lem\/?$/i.test(url.pathname)) return href;
    url.protocol = 'https:';
    url.hostname = 'hellonancy.com';
    url.port = '';
    url.pathname = '/products/lem';
    var keys = new Set();
    params.forEach(function (_, key) { keys.add(key); });
    keys.forEach(function (key) {
      if (relayCookieParams.has(key.toLowerCase())) return;
      // Keep authored product selections and discount codes. Incoming campaign
      // values take precedence over authored UTM defaults.
      if (!/^utm_/i.test(key) && url.searchParams.has(key)) return;
      var incoming = params.getAll(key);
      if (JSON.stringify(url.searchParams.getAll(key)) === JSON.stringify(incoming)) return;
      url.searchParams.delete(key);
      incoming.forEach(function (value) { url.searchParams.append(key, value); });
    });
    return url.href;
  }
  function patch(anchor) {
    if (!anchor || !anchor.getAttribute) return;
    var before = anchor.getAttribute('href');
    if (!before) return;
    var after = decorate(before);
    if (after !== before) anchor.setAttribute('href', after);
  }
  function patchTree(root) {
    if (!root || !root.querySelectorAll) return;
    if (root.matches && root.matches('a[href]')) patch(root);
    root.querySelectorAll('a[href]').forEach(patch);
  }
  ['click', 'auxclick', 'pointerdown', 'contextmenu', 'focusin'].forEach(function (type) {
    document.addEventListener(type, function (event) {
      var anchor = event.target.closest && event.target.closest('a[href]');
      if (!anchor) return;
      patch(anchor);
      if ((type === 'click' || type === 'auxclick') && event.button <= 1 && /^https:\/\/hellonancy\.com\/products\/lem(?:[?#]|$)/.test(anchor.href)) {
        window._tfa = window._tfa || [];
        window._tfa.push({ notify: 'event', name: 'lem_product_click', id: 2079308 });
      }
    }, true);
  });
  function install() {
    patchTree(document);
    new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        if (mutation.type === 'attributes') patch(mutation.target);
        mutation.addedNodes.forEach(patchTree);
      });
    }).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['href'] });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();
