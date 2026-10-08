import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const requestedSource = process.argv[2] || 'src/wellness/index.template';
const SOURCE = fs.existsSync(path.resolve(ROOT, requestedSource))
  ? path.resolve(ROOT, requestedSource)
  : path.resolve(process.cwd(), '.worktrees/posthog-cost-quicklp-20261008/src/domains/herdailyinsight/partials/posthog.hbs');
const html = fs.readFileSync(SOURCE, 'utf8');
const script = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)]
  .find(match => match[1].includes('posthog.init('))?.[1];
assert.ok(script, 'representative landing page has a PostHog init');
const initialId = 'b1111111-2222-4333-8444-555555555555';
const arrivedId = 'a1111111-2222-4333-8444-555555555555';
const sessionTime = Date.now().toString(16).padStart(12, '0');
const sessionId = sessionTime.slice(0, 8) + '-' + sessionTime.slice(8) + '-7333-8444-555555555555';

function run(url, values = {}) {
  const storage = new Map(Object.entries(values));
  const listeners = new Map();
  let config;
  let current = new URL(url);
  let registered;
  const ph = {
    __loaded: true,
    init(token, options) { config = options; options.loaded(ph); },
    register(properties) { registered = properties; },
    get_distinct_id() { return config.bootstrap.distinctID; },
    get_session_id() { return config.bootstrap.sessionID || sessionId; },
    identify() { assert.fail('anonymous funnels must never identify visitors'); },
    alias() { assert.fail('anonymous funnels must never alias visitors'); },
  };
  const context = {
    URL, URLSearchParams, Math, Object, JSON,
    posthog: ph,
    localStorage: { getItem(key) { return storage.get(key) || null; }, setItem(key, value) { storage.set(key, value); } },
    history: { replaceState(_state, _title, url) { current = new URL(url); } },
    document: { addEventListener(name, fn) { listeners.set(name, fn); } },
    window: { posthog: ph, crypto: { randomUUID() { return initialId; } } },
  };
  Object.defineProperty(context, 'location', { get() { return current; } });
  vm.runInNewContext(script, context);
  return {
    config, registered, storage, current, ph,
    click(href) {
      const anchor = { getAttribute() { return href; }, setAttribute(_key, value) { href = value; } };
      listeners.get('click')({ target: { closest() { return anchor; } } });
      return new URL(href, current);
    },
  };
}

test('legacy profiled persistence and unmarked inbound IDs cannot migrate into the anonymous namespace', () => {
  const result = run('https://herdailyinsight.com/pages/stress?utm_source=taboola&fbclid=keep#distinct_id=' + arrivedId, {
    ph_phc_tidb5pyk3fbAfNR4jRPdBFQKYgPSH4opmbmPtzsz9Bdd_posthog: JSON.stringify({ distinct_id: arrivedId, '$user_state': 'identified' }),
  });
  assert.equal(result.config.person_profiles, 'never');
  assert.equal(result.config.persistence_name, 'nancy_anon_v1');
  assert.equal(result.config.bootstrap.distinctID, initialId);
  assert.equal(result.config.bootstrap.isIdentifiedID, false);
  assert.equal(result.registered.initial_landing_path, '/pages/stress');
  assert.equal(result.registered.initial_utm_source, 'taboola');
  assert.equal(result.current.searchParams.get('fbclid'), 'keep');
  for (const key of ['autocapture', 'capture_dead_clicks', 'capture_pageleave', 'capture_performance', 'capture_heatmaps', 'rageclick']) assert.equal(result.config[key], false, key);
  assert.equal(result.config.capture_pageview, true);
  assert.equal(result.config.advanced_disable_feature_flags, true);
  assert.equal(result.config.session_recording.sampleRate, 0.01);
});

test('marked anonymous arrival overrides existing destination identity and retains origin attribution/session', () => {
  const carrier = new URLSearchParams({ distinct_id: arrivedId, session_id: sessionId, ph_cost_v: '1', ph_landing_url: 'https://feelnancy.com/blog/lem.html?email=private#old', ph_utm_source: 'pinterest', ph_utm_campaign: 'lem-sale', section: 'offer' });
  const result = run('https://nancyflow.com/lem?utm_content=keep#' + carrier, { nancy_ph_anon_v1: initialId });
  assert.equal(result.config.bootstrap.distinctID, arrivedId);
  assert.equal(result.config.bootstrap.sessionID, sessionId);
  assert.equal(result.registered.initial_landing_url, 'https://feelnancy.com/blog/lem.html');
  assert.equal(result.registered.initial_utm_source, 'pinterest');
  assert.equal(result.current.hash, '#section=offer');
  assert.equal(result.current.searchParams.get('utm_content'), 'keep');
  const next = result.click('https://get.nancyflow.com/us/products/lem?utm_content=preserve#view=cart');
  const hash = new URLSearchParams(next.hash.slice(1));
  assert.equal(hash.get('distinct_id'), arrivedId);
  assert.equal(hash.get('session_id'), sessionId);
  assert.equal(hash.get('ph_cost_v'), '1');
  assert.equal(hash.get('ph_landing_url'), 'https://feelnancy.com/blog/lem.html');
  assert.equal(hash.get('ph_utm_source'), 'pinterest');
  assert.equal(hash.get('view'), 'cart');
  assert.equal(next.searchParams.get('utm_content'), 'preserve');
});

test('all pageviews and conversion milestones retain origin props and external destinations remain untouched', () => {
  const result = run('https://feelnancy.com/blog/lem.html?utm_source=reddit');
  for (const event of ['$pageview', 'advertorial_cta_click', 'bridge_handoff_started', 'Purchase']) {
    const payload = result.config.before_send({ event, properties: { value: 42 } });
    assert.equal(payload.event, event);
    assert.equal(payload.properties.value, 42);
    assert.equal(payload.properties.initial_landing_host, 'feelnancy.com');
    assert.equal(payload.properties.initial_utm_source, 'reddit');
  }
  assert.equal(result.click('https://example.com/path?utm_source=keep#offer').href, 'https://example.com/path?utm_source=keep#offer');
});

test('reloads keep an anonymous identity and first touch; identity-shaped handoffs are rejected', () => {
  const storedTouch = JSON.stringify({ initial_landing_url: 'https://herdailyinsight.com/original', initial_landing_host: 'herdailyinsight.com', initial_landing_path: '/original', initial_utm_source: 'taboola' });
  const result = run('https://nancyflow.com/return#ph_cost_v=1&distinct_id=person%40example.com', { nancy_ph_anon_v1: arrivedId, nancy_ph_first_touch_v1: storedTouch });
  assert.equal(result.config.bootstrap.distinctID, arrivedId);
  assert.equal(result.registered.initial_landing_path, '/original');
  assert.equal(result.storage.get('nancy_ph_anon_v1'), arrivedId);
});

test('plain anchors survive a complete cross-domain handoff and pre-SDK clicks retain the seeded identity', () => {
  const source = run('https://feelnancy.com/start');
  source.ph.get_distinct_id = () => undefined;
  source.ph.get_session_id = () => undefined;
  const next = source.click('https://nancyflow.com/lem#details');
  const carrier = new URLSearchParams(next.hash.slice(1));
  assert.equal(carrier.get('distinct_id'), initialId);
  assert.equal(carrier.get('ph_anchor'), 'details');
  const destination = run(next.href, { nancy_ph_anon_v1: arrivedId });
  assert.equal(destination.current.hash, '#details');
  assert.equal(destination.config.bootstrap.distinctID, initialId);
});

test('unsupported, stale and future session IDs are omitted without losing the visitor funnel', () => {
  for (const badSession of [initialId, '00000000-0000-7333-8444-555555555555', 'ffffffff-ffff-7333-8444-555555555555']) {
    const carrier = new URLSearchParams({ ph_cost_v: '1', distinct_id: arrivedId, session_id: badSession });
    const result = run('https://nancyflow.com/lem#' + carrier);
    assert.equal(result.config.bootstrap.distinctID, arrivedId);
    assert.equal(result.config.bootstrap.sessionID, undefined);
  }
});

test('Legacy receivers cannot promote fresh anonymous funnel IDs to billable person profiles', () => {
  const source = run('https://feelnancy.com/start');
  for (const host of ['bestadulttoys.com', 'www.bestadulttoys.com', 'read.modernwellnessinsider.com', 'nancylem.manus.space', 'try.hellonancy.com', 'officialnancy.com', 'shophellonancy.com', 'www.shophellonancy.com']) {
    const href = 'https://' + host + '/offer?utm_source=keep&fbclid=keep#details';
    assert.equal(source.click(href).href, href);
  }
  const supported = source.click('https://shop.hellonancy.com/products/lem?utm_source=keep#details');
  assert.equal(new URLSearchParams(supported.hash.slice(1)).get('ph_cost_v'), '1');
});
