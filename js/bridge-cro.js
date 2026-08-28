/**
 * Privacy-safe CRO instrumentation for the live Lem bridge aliases.
 *
 * The event contract deliberately uses finite authored ids. It never captures
 * rendered copy, form values, raw hrefs, query strings, URL fragments, or ad
 * click ids. PostHog's existing consent/opt-out behavior remains authoritative:
 * this module does not create storage, identify visitors, or change consent.
 */
(function (window, document) {
  'use strict';

  if (!window || !document || window.NancyBridgeCro) return;

  var SCHEMA_VERSION = 'bridge_cro_v1';
  var DEFAULT_PAGE = 'lem_lander';
  var DEFAULT_VARIANT = 'lem_lander_v1';
  var SCROLL_CHECKPOINTS = [25, 50, 75, 90, 100];
  var ENGAGEMENT_CHECKPOINTS = [10, 30, 60, 120];
  var ACTIVE_IDLE_AFTER_MS = 30000;
  var MAX_SECTION_IDS = 20;

  var EVENT_NAMES = {
    bridge_page_viewed: true,
    bridge_cta_impression: true,
    bridge_cta_viewed: true,
    bridge_cta_click: true,
    bridge_handoff_started: true,
    section_viewed: true,
    important_content_viewed: true,
    scroll_depth_reached: true,
    page_engagement_checkpoint: true,
    page_engagement_summary: true
  };

  // These are the only CTA ids/locations the tracker will emit. The matching
  // data attributes in index.html are documentation and selector hooks; this
  // finite map is the data-quality boundary.
  var CTA_CONFIG = {
    hero_primary: { location: 'hero', index: 1 },
    proof_primary: { location: 'proof', index: 2 },
    product_primary: { location: 'product_offer', index: 3 },
    sticky_primary: { location: 'sticky', index: 4 }
  };

  // Section order is stable across the / and /lem-lander/ aliases. Important
  // sections answer whether visitors reached the value proof, social proof,
  // and final product offer rather than merely scrolling past the hero.
  var SECTION_CONFIG = {
    hero: { index: 1, important: false },
    press_logos: { index: 2, important: false },
    benefits: { index: 3, important: true, importantIndex: 1 },
    customer_reviews: { index: 4, important: true, importantIndex: 2 },
    product_story: { index: 5, important: false },
    proof_cta: { index: 6, important: false },
    comparison: { index: 7, important: true, importantIndex: 3 },
    testimonials: { index: 8, important: true, importantIndex: 4 },
    product_offer: { index: 9, important: true, importantIndex: 5 }
  };

  var STORE_HOST_RE = /^get\.nancyflow\.(?:com|co\.uk|co\.nz|ca|de|nl|fr|se)$/i;
  var SAFE_TOKEN_RE = /^[a-z0-9][a-z0-9_-]{0,79}$/;
  var URL_PROPERTIES = {
    '$current_url': true,
    '$initial_current_url': true,
    '$session_entry_url': true,
    '$session_entry_current_url': true,
    '$entry_current_url': true,
    '$referrer': true,
    '$initial_referrer': true,
    '$session_entry_referrer': true,
    '$entry_referrer': true
  };
  var RAW_DOM_PROPERTIES = {
    '$elements': true,
    '$elements_chain': true,
    '$el_text': true,
    '$element_text': true,
    elements_chain: true
  };
  var RAW_DESTINATION_PROPERTIES = {
    destination: true,
    destination_url: true,
    destination_href: true,
    href: true
  };
  var CLICK_ID_PROPERTY_RE = /^\$?(?:(?:initial|session|session_entry|entry)_)?(?:fbclid|gclid|dclid|gbraid|wbraid|msclkid|ttclid|rdt_cid|fbc|fbp|epik|irclickid)$/i;
  var CAMPAIGN_PROPERTY_RE = /^\$?(?:(?:initial|session|session_entry|entry)_)?utm_(?:source|medium|campaign|content|term)$/i;

  var startedAt = Date.now();
  var lastTickAt = startedAt;
  var lastActivityAt = startedAt;
  var activeTimeMs = 0;
  var windowFocused = initialFocusState();
  var started = false;
  var pageLoaded = document.readyState === 'complete';
  var viewportEvaluationScheduled = false;
  var ctaObserver = null;
  var mutationObserver = null;
  var exitCaptureMode = false;
  var finalSummarySent = false;

  var state = {
    maxScroll: 0,
    scrollCheckpoints: {},
    engagementCheckpoints: {},
    ctaRecords: [],
    sectionRecords: [],
    reachedSections: [],
    reachedImportantSections: [],
    ctaImpressionCount: 0,
    ctaViewCount: 0,
    ctaClickCount: 0,
    handoffStartedCount: 0,
    checkpointSequence: 0,
    summarySequence: 0
  };

  function getAttribute(element, name) {
    if (!element || typeof element.getAttribute !== 'function') return '';
    try {
      return element.getAttribute(name) || '';
    } catch (error) {
      return '';
    }
  }

  function safeToken(value) {
    var normalized = String(value || '').trim().toLowerCase().replace(/-/g, '_');
    return SAFE_TOKEN_RE.test(normalized) ? normalized : '';
  }

  function normalizePath(pathname) {
    var path = String(pathname || '/').split('?')[0].split('#')[0];
    if (path.charAt(0) !== '/') path = '/' + path;
    path = path.replace(/\/{2,}/g, '/');
    path = path.replace(/\/index\.html?$/i, '/');
    path = path.replace(/\.html?$/i, '');
    if (path.length > 1) path = path.replace(/\/+$/, '');
    return path || '/';
  }

  function normalizeLocale(value) {
    var locale = String(value || '').trim().toLowerCase().replace(/_/g, '-');
    if (!/^[a-z]{2,3}(?:-[a-z0-9]{2,8})?$/.test(locale)) return 'unknown';
    if (locale.indexOf('zh-') === 0) {
      return /(?:hant|tw|hk|mo)$/.test(locale) ? 'zh-hant' : 'zh-hans';
    }
    return locale.split('-')[0];
  }

  function safeBridgePage() {
    var authored = safeToken(getAttribute(document.documentElement, 'data-bridge-page'));
    return authored === DEFAULT_PAGE ? authored : DEFAULT_PAGE;
  }

  function safeBridgeVariant() {
    var authored = safeToken(getAttribute(document.documentElement, 'data-bridge-variant'));
    return authored === DEFAULT_VARIANT ? authored : DEFAULT_VARIANT;
  }

  function safeAbsoluteUrl(rawValue) {
    try {
      var baseOrigin = window.location && window.location.origin
        ? window.location.origin
        : String(window.location.protocol || 'https:') + '//' +
          String(window.location.host || window.location.hostname || 'nancyflow.com');
      var url = new URL(String(rawValue || '/'), baseOrigin);
      if (!/^https?:$/.test(url.protocol)) return '/';
      return url.origin + normalizePath(url.pathname);
    } catch (error) {
      return '/';
    }
  }

  function safeReferrer() {
    var referrer = String(document.referrer || '');
    return referrer ? safeAbsoluteUrl(referrer) : '$direct';
  }

  function safeCampaignValue(value) {
    var text = String(value || '').trim().slice(0, 160);
    return /^[A-Za-z0-9._~-]+$/.test(text) ? text : '';
  }

  function isUrlPropertyKey(key) {
    var normalized = String(key || '')
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .toLowerCase();
    return /(^|_)(url|href)$/.test(normalized);
  }

  /**
   * Last-mile sanitizer for both automatic and custom PostHog events on the
   * Lem bridge. It preserves standard UTM dimensions while removing URL query
   * strings/fragments and legacy raw destination/DOM properties.
   */
  function sanitizePropertyBag(source) {
    var input = source && typeof source === 'object' ? source : {};
    var output = {};
    var keys = Object.keys(input);

    for (var index = 0; index < keys.length; index++) {
      var key = keys[index];
      var value = input[key];
      if (RAW_DOM_PROPERTIES[key] || RAW_DESTINATION_PROPERTIES[key]) continue;
      if (CLICK_ID_PROPERTY_RE.test(key)) continue;

      if (CAMPAIGN_PROPERTY_RE.test(key)) {
        var campaignValue = safeCampaignValue(value);
        if (campaignValue) output[key] = campaignValue;
        continue;
      }

      if (URL_PROPERTIES[key]) {
        output[key] = value === '$direct' ? '$direct' : safeAbsoluteUrl(value);
        continue;
      }
      if (key === '$pathname' || key === '$initial_pathname' ||
        key === '$session_entry_pathname') {
        output[key] = normalizePath(value);
        continue;
      }
      if (key === 'destination_path') {
        output[key] = normalizePath(value);
        continue;
      }
      if (key === 'destination_host') {
        var destinationHost = String(value || '').toLowerCase();
        if (STORE_HOST_RE.test(destinationHost)) output[key] = destinationHost;
        continue;
      }
      if (typeof value === 'string' && isUrlPropertyKey(key)) {
        output[key] = safeAbsoluteUrl(value);
        continue;
      }
      output[key] = value;
    }
    return output;
  }

  function beforeSend(captureResult) {
    if (!captureResult) return null;
    // Custom finite click events replace noisy DOM autocapture on this bridge.
    if (captureResult.event === '$autocapture') return null;

    var sanitized = Object.assign({}, captureResult, {
      properties: sanitizePropertyBag(captureResult.properties)
    });
    if (captureResult.$set && typeof captureResult.$set === 'object') {
      sanitized.$set = sanitizePropertyBag(captureResult.$set);
    }
    if (captureResult.$set_once && typeof captureResult.$set_once === 'object') {
      sanitized.$set_once = sanitizePropertyBag(captureResult.$set_once);
    }
    return sanitized;
  }

  function commonProperties() {
    var route = normalizePath(window.location && window.location.pathname);
    var origin = window.location && window.location.origin
      ? window.location.origin
      : String(window.location.protocol || 'https:') + '//' +
        String(window.location.host || window.location.hostname || 'nancyflow.com');
    var runtimeLocale = window.i18n && window.i18n.locale;
    var authoredLocale = getAttribute(document.documentElement, 'lang');
    return {
      schema_version: SCHEMA_VERSION,
      bridge_page: safeBridgePage(),
      bridge_variant: safeBridgeVariant(),
      bridge_route: route,
      content_locale: normalizeLocale(runtimeLocale || authoredLocale),
      '$current_url': origin + route,
      '$pathname': route,
      '$referrer': safeReferrer()
    };
  }

  function capture(eventName, properties, forceBeacon) {
    if (!EVENT_NAMES[eventName]) return false;
    if (!window.posthog || typeof window.posthog.capture !== 'function') return false;
    var payload = Object.assign({}, commonProperties(), properties || {});
    try {
      var options = exitCaptureMode || forceBeacon
        ? { transport: 'sendBeacon', send_instantly: true }
        : undefined;
      window.posthog.capture(eventName, payload, options);
      return true;
    } catch (error) {
      return false;
    }
  }

  function safeDestination(rawHref) {
    if (!rawHref) return null;
    try {
      var baseOrigin = window.location && window.location.origin
        ? window.location.origin
        : String(window.location.protocol || 'https:') + '//' +
          String(window.location.host || window.location.hostname || 'nancyflow.com');
      var url = new URL(String(rawHref), baseOrigin + normalizePath(window.location.pathname));
      var host = String(url.hostname || '').toLowerCase();
      if (url.protocol !== 'https:' || !STORE_HOST_RE.test(host)) return null;
      return {
        destination_host: host,
        destination_path: normalizePath(url.pathname)
      };
    } catch (error) {
      return null;
    }
  }

  function ctaRecordForElement(element) {
    if (!element) return null;
    for (var index = 0; index < state.ctaRecords.length; index++) {
      if (state.ctaRecords[index].element === element) return state.ctaRecords[index];
    }

    var id = safeToken(getAttribute(element, 'data-bridge-cta-id'));
    var config = CTA_CONFIG[id];
    if (!config) return null;
    var record = {
      element: element,
      id: id,
      location: config.location,
      index: config.index,
      impressed: false,
      viewed: false,
      clicked: false
    };
    state.ctaRecords.push(record);
    if (ctaObserver) ctaObserver.observe(element);
    return record;
  }

  function destinationProperties(element, destinationOverride) {
    var destination = safeDestination(
      destinationOverride || getAttribute(element, 'href')
    );
    return destination || {};
  }

  function ctaProperties(record, destinationOverride) {
    return Object.assign({
      cta_id: record.id,
      cta_location: record.location,
      cta_index: record.index,
      cta_count: Object.keys(CTA_CONFIG).length,
      is_sticky: record.location === 'sticky'
    }, destinationProperties(record.element, destinationOverride));
  }

  function markCtaImpression(record, visibilityRatio, source) {
    if (!record || record.impressed) return;
    record.impressed = true;
    state.ctaImpressionCount += 1;
    capture('bridge_cta_impression', Object.assign(
      ctaProperties(record),
      {
        visibility_ratio: roundedRatio(visibilityRatio),
        view_source: source,
        time_to_reach_seconds: elapsedSeconds()
      }
    ));
  }

  function markCtaViewed(record, visibilityRatio, source) {
    if (!record || record.viewed) return;
    record.viewed = true;
    state.ctaViewCount += 1;
    capture('bridge_cta_viewed', Object.assign(
      ctaProperties(record),
      {
        visibility_ratio: roundedRatio(visibilityRatio),
        view_threshold: '50_percent',
        view_source: source,
        time_to_reach_seconds: elapsedSeconds()
      }
    ));
  }

  function closestCta(target) {
    if (!target) return null;
    if (typeof target.closest === 'function') {
      return target.closest('[data-bridge-cta-id]');
    }
    var current = target;
    while (current && current !== document.body) {
      if (getAttribute(current, 'data-bridge-cta-id')) return current;
      current = current.parentElement;
    }
    return null;
  }

  function trackCtaClick(element, destinationOverride, trigger, trusted) {
    var record = ctaRecordForElement(element);
    if (!record) return false;
    markActivity();
    // A genuine click proves the CTA was available and visible even if the
    // observer callback has not run yet (fast click during initial rendering).
    markCtaImpression(record, 1, 'click_fallback');
    markCtaViewed(record, 1, 'click_fallback');

    var destination = safeDestination(
      destinationOverride || getAttribute(element, 'href')
    );
    var properties = Object.assign(
      ctaProperties(record, destinationOverride),
      {
        interaction_trigger: safeToken(trigger) || 'delegated_click',
        interaction_source: trusted === false ? 'programmatic' : 'user',
        time_to_click_seconds: elapsedSeconds()
      }
    );
    record.clicked = true;
    state.ctaClickCount += 1;
    capture('bridge_cta_click', properties, true);

    if (destination && /\/products\/lem(?:\/|$)/i.test(destination.destination_path)) {
      state.handoffStartedCount += 1;
      capture('bridge_handoff_started', Object.assign({}, properties, {
        handoff_method: 'cta_click',
        navigation_target: 'storefront_pdp'
      }), true);
    }
    return true;
  }

  function onDocumentClick(event) {
    var element = closestCta(event && event.target);
    if (!element) return;
    trackCtaClick(
      element,
      null,
      'delegated_click',
      event && event.isTrusted !== false
    );
    // Intentionally do not preventDefault, stop propagation, or mutate href.
    // param-passthrough.js remains the sole owner of routing/attribution.
  }

  function scanCtas() {
    if (!document.querySelectorAll) return;
    var elements = document.querySelectorAll('[data-bridge-cta-id]');
    for (var index = 0; index < elements.length; index++) {
      ctaRecordForElement(elements[index]);
    }
  }

  function sectionRecordForElement(element) {
    if (!element) return null;
    for (var index = 0; index < state.sectionRecords.length; index++) {
      if (state.sectionRecords[index].element === element) return state.sectionRecords[index];
    }
    var id = safeToken(getAttribute(element, 'data-bridge-section-id'));
    var config = SECTION_CONFIG[id];
    if (!config) return null;
    var record = {
      element: element,
      id: id,
      index: config.index,
      important: !!config.important,
      importantIndex: config.importantIndex || 0,
      reached: false
    };
    state.sectionRecords.push(record);
    return record;
  }

  function scanSections() {
    if (!document.querySelectorAll) return;
    var elements = document.querySelectorAll('[data-bridge-section-id]');
    for (var index = 0; index < elements.length; index++) {
      sectionRecordForElement(elements[index]);
    }
  }

  function roundedRatio(value) {
    var numeric = Number(value || 0);
    if (!isFinite(numeric)) numeric = 0;
    return Math.round(Math.max(0, Math.min(1, numeric)) * 100) / 100;
  }

  function visibilityForElement(element) {
    if (!element || typeof element.getBoundingClientRect !== 'function') return null;
    try {
      var rect = element.getBoundingClientRect();
      var viewportHeight = Math.max(0, Number(window.innerHeight || 0));
      var height = Math.max(0, Number(rect.height || rect.bottom - rect.top || 0));
      var visibleHeight = Math.max(
        0,
        Math.min(Number(rect.bottom || 0), viewportHeight) - Math.max(Number(rect.top || 0), 0)
      );
      var sectionDenominator = Math.min(height, viewportHeight);
      return {
        elementRatio: height > 0 ? Math.min(1, visibleHeight / height) : 0,
        viewportCoverage: sectionDenominator > 0
          ? Math.min(1, visibleHeight / sectionDenominator)
          : 0
      };
    } catch (error) {
      return null;
    }
  }

  function evaluateCtasWithoutObserver() {
    if (ctaObserver) return;
    for (var index = 0; index < state.ctaRecords.length; index++) {
      var record = state.ctaRecords[index];
      var visibility = visibilityForElement(record.element);
      if (!visibility || visibility.elementRatio <= 0) continue;
      markCtaImpression(record, visibility.elementRatio, 'viewport');
      if (visibility.elementRatio >= 0.5) {
        markCtaViewed(record, visibility.elementRatio, 'viewport');
      }
    }
  }

  function setupCtaObserver() {
    if (typeof window.IntersectionObserver !== 'function') return;
    ctaObserver = new window.IntersectionObserver(function (entries) {
      for (var index = 0; index < entries.length; index++) {
        var entry = entries[index];
        var record = ctaRecordForElement(entry.target);
        if (!record || !entry.isIntersecting) continue;
        var ratio = Number(entry.intersectionRatio || 0);
        markCtaImpression(record, ratio, 'intersection_observer');
        if (ratio >= 0.5) markCtaViewed(record, ratio, 'intersection_observer');
      }
    }, { threshold: [0, 0.5, 1] });
    for (var index = 0; index < state.ctaRecords.length; index++) {
      ctaObserver.observe(state.ctaRecords[index].element);
    }
  }

  function markSectionViewed(record, visibility) {
    if (!record || record.reached || !visibility || visibility.viewportCoverage < 0.5) return;
    record.reached = true;
    state.reachedSections.push(record.id);
    var properties = {
      section_id: record.id,
      section_index: record.index,
      section_count: Object.keys(SECTION_CONFIG).length,
      is_important_content: record.important,
      viewport_coverage_ratio: roundedRatio(visibility.viewportCoverage),
      visibility_ratio: roundedRatio(visibility.elementRatio),
      time_to_reach_seconds: elapsedSeconds()
    };
    capture('section_viewed', properties);

    if (record.important) {
      state.reachedImportantSections.push(record.id);
      capture('important_content_viewed', Object.assign({}, properties, {
        content_id: record.id,
        important_content_index: record.importantIndex,
        important_content_count: importantSectionCount(),
        content_type: 'section'
      }));
    }
  }

  function evaluateSections() {
    for (var index = 0; index < state.sectionRecords.length; index++) {
      var record = state.sectionRecords[index];
      if (record.reached) continue;
      markSectionViewed(record, visibilityForElement(record.element));
    }
  }

  function importantSectionCount() {
    var count = 0;
    var keys = Object.keys(SECTION_CONFIG);
    for (var index = 0; index < keys.length; index++) {
      if (SECTION_CONFIG[keys[index]].important) count += 1;
    }
    return count;
  }

  function currentScrollDepth(allowShortPageCompletion) {
    var root = document.documentElement || {};
    var body = document.body || {};
    var viewport = Number(window.innerHeight || root.clientHeight || 0);
    var height = Math.max(Number(root.scrollHeight || 0), Number(body.scrollHeight || 0));
    var distance = Math.max(0, height - viewport);
    if (distance <= 1) return pageLoaded || allowShortPageCompletion ? 100 : 0;
    var scrolled = Number(window.pageYOffset || root.scrollTop || body.scrollTop || 0);
    return Math.max(0, Math.min(100, Math.round((scrolled / distance) * 100)));
  }

  function evaluateScroll(allowShortPageCompletion) {
    var depth = currentScrollDepth(allowShortPageCompletion);
    if (depth > state.maxScroll) state.maxScroll = depth;
    for (var index = 0; index < SCROLL_CHECKPOINTS.length; index++) {
      var checkpoint = SCROLL_CHECKPOINTS[index];
      if (depth < checkpoint || state.scrollCheckpoints[checkpoint]) continue;
      state.scrollCheckpoints[checkpoint] = true;
      capture('scroll_depth_reached', {
        scroll_depth_percent: checkpoint,
        max_scroll_percent: state.maxScroll,
        sections_viewed_count: state.reachedSections.length,
        important_content_reached: state.reachedImportantSections.length > 0,
        time_to_reach_seconds: elapsedSeconds()
      });
    }
  }

  function evaluateViewport() {
    scanCtas();
    scanSections();
    evaluateCtasWithoutObserver();
    evaluateSections();
    evaluateScroll(false);
  }

  function scheduleViewportEvaluation() {
    markActivity();
    if (viewportEvaluationScheduled) return;
    viewportEvaluationScheduled = true;
    var run = function () {
      viewportEvaluationScheduled = false;
      evaluateViewport();
    };
    if (typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(run);
    } else {
      window.setTimeout(run, 50);
    }
  }

  function elapsedSeconds() {
    return Math.max(0, Math.round((Date.now() - startedAt) / 1000));
  }

  function activeSeconds() {
    return Math.max(0, Math.round(activeTimeMs / 1000));
  }

  function initialFocusState() {
    try {
      return typeof document.hasFocus === 'function' ? document.hasFocus() : true;
    } catch (error) {
      return true;
    }
  }

  function pageVisible() {
    return document.visibilityState !== 'hidden' && windowFocused;
  }

  function markActivity() {
    lastActivityAt = Date.now();
  }

  function tickEngagement() {
    var now = Date.now();
    var delta = Math.max(0, Math.min(now - lastTickAt, 2000));
    if (pageVisible() && now - lastActivityAt <= ACTIVE_IDLE_AFTER_MS) {
      activeTimeMs += delta;
    }
    lastTickAt = now;

    var seconds = activeSeconds();
    for (var index = 0; index < ENGAGEMENT_CHECKPOINTS.length; index++) {
      var checkpoint = ENGAGEMENT_CHECKPOINTS[index];
      if (seconds < checkpoint || state.engagementCheckpoints[checkpoint]) continue;
      state.engagementCheckpoints[checkpoint] = true;
      state.checkpointSequence += 1;
      capture('page_engagement_checkpoint', {
        checkpoint_sequence: state.checkpointSequence,
        checkpoint_seconds: checkpoint,
        active_time_seconds: seconds,
        elapsed_time_seconds: elapsedSeconds(),
        max_scroll_percent: state.maxScroll,
        sections_viewed_count: state.reachedSections.length,
        important_content_reached: state.reachedImportantSections.length > 0,
        cta_view_count: state.ctaViewCount
      });
    }
  }

  function sectionSummary() {
    return {
      sections_viewed: state.reachedSections.slice(0, MAX_SECTION_IDS),
      sections_viewed_count: state.reachedSections.length,
      important_sections_reached: state.reachedImportantSections.slice(0, MAX_SECTION_IDS),
      important_sections_reached_count: state.reachedImportantSections.length,
      important_section_count: importantSectionCount(),
      important_content_reached: state.reachedImportantSections.length > 0,
      last_section_id: state.reachedSections.length
        ? state.reachedSections[state.reachedSections.length - 1]
        : null
    };
  }

  function engagementSummary(reason, isFinal, forceBeacon) {
    if (isFinal && finalSummarySent) return;
    tickEngagement();
    evaluateSections();
    evaluateScroll(!!isFinal);
    if (isFinal) finalSummarySent = true;
    state.summarySequence += 1;
    capture('page_engagement_summary', Object.assign({
      summary_sequence: state.summarySequence,
      summary_reason: safeToken(reason) || 'unknown',
      is_final_summary: !!isFinal,
      elapsed_time_seconds: elapsedSeconds(),
      active_time_seconds: activeSeconds(),
      max_scroll_percent: state.maxScroll,
      scroll_checkpoints_reached: Object.keys(state.scrollCheckpoints).map(function (value) {
        return Number(value);
      }),
      cta_impression_count: state.ctaImpressionCount,
      cta_view_count: state.ctaViewCount,
      cta_click_count: state.ctaClickCount,
      handoff_started_count: state.handoffStartedCount
    }, sectionSummary()), forceBeacon);
  }

  function attachLifecycleListeners() {
    window.addEventListener('scroll', scheduleViewportEvaluation, { passive: true });
    window.addEventListener('resize', scheduleViewportEvaluation, { passive: true });
    window.addEventListener('load', function () {
      pageLoaded = true;
      scheduleViewportEvaluation();
    });
    window.addEventListener('focus', function () {
      tickEngagement();
      windowFocused = true;
      markActivity();
    });
    window.addEventListener('blur', function () {
      tickEngagement();
      windowFocused = false;
    });
    document.addEventListener('visibilitychange', function () {
      tickEngagement();
      if (document.visibilityState === 'visible') {
        markActivity();
      } else {
        engagementSummary('visibility_hidden', false, true);
      }
    });
    var activityEvents = ['pointerdown', 'keydown', 'touchstart'];
    for (var index = 0; index < activityEvents.length; index++) {
      document.addEventListener(activityEvents[index], markActivity, { passive: true });
    }
    window.addEventListener('pagehide', function (event) {
      exitCaptureMode = true;
      engagementSummary(event && event.persisted ? 'bfcache' : 'pagehide', true, true);
    });
    window.addEventListener('pageshow', function (event) {
      if (!event || !event.persisted) return;
      exitCaptureMode = false;
      finalSummarySent = false;
      lastTickAt = Date.now();
      markActivity();
      scheduleViewportEvaluation();
    });
  }

  function setupMutationObserver() {
    if (typeof window.MutationObserver !== 'function' || !document.body) return;
    mutationObserver = new window.MutationObserver(function () {
      scanCtas();
      scanSections();
      scheduleViewportEvaluation();
    });
    mutationObserver.observe(document.body, { childList: true, subtree: true });
  }

  function start() {
    if (started) return;
    started = true;
    scanCtas();
    scanSections();
    setupCtaObserver();
    setupMutationObserver();
    attachLifecycleListeners();
    capture('bridge_page_viewed', {
      cta_count: Object.keys(CTA_CONFIG).length,
      section_count: Object.keys(SECTION_CONFIG).length,
      important_section_count: importantSectionCount()
    });
    evaluateViewport();
    window.setInterval(tickEngagement, 1000);
  }

  // Capture-phase registration happens in <head>, before the CTA markup exists,
  // so even a very early hero click is observed. This listener only reads the
  // authored destination host/path; param-passthrough.js remains free to repair
  // locale and attribution later in the same click dispatch before navigation.
  document.addEventListener('click', onDocumentClick, true);

  window.NancyBridgeCroBeforeSend = beforeSend;
  window.NancyBridgeCro = {
    __schemaVersion: 1,
    refresh: evaluateViewport,
    getContext: function () { return Object.assign({}, commonProperties()); },
    sanitizeCapture: beforeSend,
    trackHandoff: function (element, destination, trigger) {
      return trackCtaClick(element, destination, trigger || 'explicit_handoff', true);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})(window, document);
