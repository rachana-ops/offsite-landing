/**
 * Mobile-only visibility controller for the Lem bridge sticky CTA.
 *
 * The button becomes available once the hero CTA has scrolled above the
 * viewport, then leaves before the product-offer section would pass under it.
 * Analytics remain owned by bridge-cro.js: changing the authored `is-active`
 * class makes the existing IntersectionObserver emit the finite
 * bridge_cro_v1 impression/view events, while the existing delegated click
 * listener retains click and handoff tracking.
 */
(function (window, document) {
  'use strict';

  if (!window || !document || window.NancyBridgeStickyCta) return;

  var MOBILE_QUERY = '(max-width: 767px)';
  var MIN_OVERLAP_GUARD_PX = 72;
  var sticky = null;
  var stickyLink = null;
  var heroCta = null;
  var productOffer = null;
  var mobileMedia = null;
  var originalTabIndex = null;
  var hadOriginalTabIndex = false;
  var evaluationScheduled = false;
  var started = false;
  var active = false;

  function safeRect(element) {
    if (!element || typeof element.getBoundingClientRect !== 'function') return null;
    try {
      return element.getBoundingClientRect();
    } catch (error) {
      return null;
    }
  }

  function viewportHeight() {
    var root = document.documentElement || {};
    return Math.max(0, Number(window.innerHeight || root.clientHeight || 0));
  }

  function setActive(nextActive) {
    if (!sticky || !stickyLink) return;
    active = !!nextActive;

    if (sticky.classList) {
      if (active) sticky.classList.add('is-active');
      else sticky.classList.remove('is-active');
    }

    sticky.setAttribute('data-sticky-state', active ? 'visible' : 'hidden');
    sticky.setAttribute('aria-hidden', active ? 'false' : 'true');

    if (active) {
      sticky.removeAttribute('inert');
      if (hadOriginalTabIndex) stickyLink.setAttribute('tabindex', originalTabIndex);
      else stickyLink.removeAttribute('tabindex');
    } else {
      sticky.setAttribute('inert', '');
      stickyLink.setAttribute('tabindex', '-1');
    }
  }

  function shouldActivate() {
    if (!mobileMedia || !mobileMedia.matches) return false;

    var height = viewportHeight();
    var heroRect = safeRect(heroCta);
    var offerRect = safeRect(productOffer);
    var stickyRect = safeRect(sticky);
    if (!height || !heroRect || !offerRect || !stickyRect) return false;

    var stickyHeight = Math.max(
      MIN_OVERLAP_GUARD_PX,
      Math.max(0, Number(stickyRect.height || stickyRect.bottom - stickyRect.top || 0))
    );
    var heroHasPassed = Number(heroRect.bottom) <= 0;
    var offerWouldOverlap = Number(offerRect.top) <= height - stickyHeight;

    return heroHasPassed && !offerWouldOverlap;
  }

  function evaluate() {
    evaluationScheduled = false;
    setActive(shouldActivate());
    return active;
  }

  function scheduleEvaluation() {
    if (evaluationScheduled) return;
    evaluationScheduled = true;
    if (typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(evaluate);
    } else {
      window.setTimeout(evaluate, 16);
    }
  }

  function onMediaChange() {
    scheduleEvaluation();
  }

  function start() {
    if (started) return;
    started = true;

    sticky = document.querySelector('[data-btn="sticky-atc"]');
    stickyLink = document.querySelector('[data-bridge-cta-id="sticky_primary"]');
    heroCta = document.querySelector('[data-bridge-cta-id="hero_primary"]');
    productOffer = document.querySelector('[data-bridge-section-id="product_offer"]');
    mobileMedia = typeof window.matchMedia === 'function'
      ? window.matchMedia(MOBILE_QUERY)
      : null;

    if (!sticky || !stickyLink) return;

    hadOriginalTabIndex = stickyLink.hasAttribute('tabindex');
    originalTabIndex = hadOriginalTabIndex ? stickyLink.getAttribute('tabindex') : null;
    setActive(false);

    if (!heroCta || !productOffer || !mobileMedia) return;

    window.addEventListener('scroll', scheduleEvaluation, { passive: true });
    window.addEventListener('resize', scheduleEvaluation, { passive: true });
    window.addEventListener('pageshow', scheduleEvaluation);

    if (typeof mobileMedia.addEventListener === 'function') {
      mobileMedia.addEventListener('change', onMediaChange);
    } else if (typeof mobileMedia.addListener === 'function') {
      mobileMedia.addListener(onMediaChange);
    }

    evaluate();
  }

  window.NancyBridgeStickyCta = {
    __version: 1,
    refresh: evaluate,
    isActive: function () { return active; }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})(window, document);
