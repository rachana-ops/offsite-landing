import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import vm from "node:vm"

const source = readFileSync(
  new URL("../js/bridge-cro.js", import.meta.url),
  "utf8",
)

const expectedCtas = [
  ["hero_primary", "hero"],
  ["proof_primary", "proof"],
  ["product_primary", "product_offer"],
  ["sticky_primary", "sticky"],
]

const expectedSections = [
  "hero",
  "press_logos",
  "benefits",
  "customer_reviews",
  "product_story",
  "proof_cta",
  "comparison",
  "testimonials",
  "product_offer",
]

function textContent(html) {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim()
}

for (const relativePath of ["../index.html", "../lem-lander/index.html"]) {
  test(`${relativePath} exposes the exact four Lem CTA contracts`, () => {
    const html = readFileSync(new URL(relativePath, import.meta.url), "utf8")
    const ctas = [...html.matchAll(
      /<a\b([^>]*\bdata-bridge-cta-id="([^"]+)"[^>]*)>([\s\S]*?)<\/a>/gi,
    )]

    assert.equal(ctas.length, 4)
    assert.deepEqual(
      ctas.map((match) => {
        const attributes = match[1]
        const id = match[2]
        const location = attributes.match(/\bdata-bridge-cta-location="([^"]+)"/i)?.[1]
        const href = attributes.match(/\bhref="([^"]+)"/i)?.[1]
        return [id, location, href, textContent(match[3]).replace(/\s*→\s*$/, "")]
      }),
      expectedCtas.map(([id, location]) => [
        id,
        location,
        "https://get.nancyflow.com/en/products/lem",
        "Choose Your Lem",
      ]),
    )

    assert.match(html, /data-bridge-page="lem_lander"/)
    assert.match(html, /data-bridge-variant="lem_lander_v1"/)
    assert.equal((html.match(/>Choose Your Lem</g) ?? []).length, 4)
    assert.doesNotMatch(html, /<p class="cta-p[^"]*">(?:Add to Cart|Order Now[^<]*)<\/p>/i)
    assert.equal((html.match(/src="\/js\/bridge-cro\.js"/g) ?? []).length, 1)
    assert.ok(
      html.indexOf('src="/js/bridge-cro.js"') < html.indexOf("posthog.init("),
      "privacy hook must exist before PostHog initializes",
    )
    assert.match(html, /autocapture:\s*false/)
    assert.match(html, /before_send:\s*window\.NancyBridgeCroBeforeSend/)
    assert.doesNotMatch(
      html,
      /posthog\.capture\(['"]bridge_cta_click['"][^\n]*destination:/,
      "the legacy raw destination capture must be removed",
    )

    const sectionIds = [...html.matchAll(/data-bridge-section-id="([^"]+)"/g)]
      .map((match) => match[1])
    assert.deepEqual(sectionIds, expectedSections)
    assert.equal((html.match(/data-bridge-important="true"/g) ?? []).length, 5)
  })
}

function createElement({
  tagName = "DIV",
  attributes = {},
  rect = { top: 1200, bottom: 1260, height: 60 },
} = {}) {
  const element = {
    tagName,
    parentElement: null,
    attributes: { ...attributes },
    rect: { ...rect },
    getAttribute(name) {
      return this.attributes[name] ?? null
    },
    setAttribute(name, value) {
      this.attributes[name] = value
    },
    getBoundingClientRect() {
      return { ...this.rect }
    },
    closest(selector) {
      if (selector === "[data-bridge-cta-id]" && this.attributes["data-bridge-cta-id"]) {
        return this
      }
      return this.parentElement?.closest?.(selector) ?? null
    },
  }
  return element
}

function listenerRegistry() {
  const entries = new Map()
  return {
    add(name, listener, options) {
      const current = entries.get(name) ?? []
      current.push({ listener, options })
      entries.set(name, current)
    },
    listeners(name) {
      return entries.get(name) ?? []
    },
    fire(name, event = {}) {
      for (const entry of entries.get(name) ?? []) entry.listener(event)
    },
  }
}

function runTracker() {
  const captures = []
  const sequence = []
  const documentListeners = listenerRegistry()
  const windowListeners = listenerRegistry()

  const ctas = expectedCtas.map(([id, location], index) => createElement({
    tagName: "A",
    attributes: {
      href: index === 0
        ? "https://get.nancyflow.com/en/products/lem?utm_source=meta&fbclid=SECRET_CLICK&_fbp=fb.1.secret#buy"
        : "https://get.nancyflow.com/en/products/lem",
      "data-bridge-cta-id": id,
      "data-bridge-cta-location": location,
    },
    rect: index === 0
      ? { top: 250, bottom: 310, height: 60 }
      : { top: 1400 + index * 100, bottom: 1460 + index * 100, height: 60 },
  }))

  const sections = expectedSections.map((id, index) => createElement({
    attributes: { "data-bridge-section-id": id },
    rect: index === 0
      ? { top: 0, bottom: 800, height: 800 }
      : { top: 1600 + index * 500, bottom: 2000 + index * 500, height: 400 },
  }))

  const documentElement = createElement({
    tagName: "HTML",
    attributes: {
      lang: "en",
      "data-bridge-page": "lem_lander",
      "data-bridge-variant": "lem_lander_v1",
    },
  })
  documentElement.scrollHeight = 3000
  documentElement.clientHeight = 1000
  documentElement.scrollTop = 0

  const body = createElement({ tagName: "BODY" })
  body.scrollHeight = 3000
  body.scrollTop = 0
  for (const element of [...ctas, ...sections]) element.parentElement = body

  const document = {
    body,
    documentElement,
    readyState: "complete",
    visibilityState: "visible",
    referrer: "https://ads.example/path?email=drop@example.com#private",
    hasFocus() { return true },
    querySelectorAll(selector) {
      if (selector === "[data-bridge-cta-id]") return ctas
      if (selector === "[data-bridge-section-id]") return sections
      return []
    },
    addEventListener(name, listener, options) {
      documentListeners.add(name, listener, options)
    },
  }

  const location = {
    origin: "https://nancyflow.com",
    protocol: "https:",
    host: "nancyflow.com",
    hostname: "nancyflow.com",
    pathname: "/lem-lander/",
    search: "?utm_source=meta&fbclid=SECRET_CLICK",
  }
  const window = {
    document,
    location,
    innerHeight: 1000,
    pageYOffset: 0,
    posthog: {
      capture(event, properties, options) {
        sequence.push(`capture:${event}`)
        captures.push({ event, properties, options })
      },
    },
    addEventListener(name, listener, options) {
      windowListeners.add(name, listener, options)
    },
    requestAnimationFrame(callback) {
      callback()
      return 1
    },
    setTimeout(callback) {
      callback()
      return 1
    },
    setInterval() { return 1 },
  }

  vm.runInNewContext(source, {
    Date,
    Math,
    Number,
    Object,
    URL,
    document,
    isFinite,
    window,
  })

  return {
    body,
    captures,
    ctas,
    document,
    documentElement,
    documentListeners,
    sections,
    sequence,
    window,
    windowListeners,
  }
}

function events(result, eventName) {
  return result.captures.filter((capture) => capture.event === eventName)
}

test("CTA impression/view and click events are finite, deduplicated, and privacy-safe", () => {
  const result = runTracker()

  assert.equal(events(result, "bridge_cta_impression").length, 1)
  assert.equal(events(result, "bridge_cta_viewed").length, 1)
  result.window.NancyBridgeCro.refresh()
  result.window.NancyBridgeCro.refresh()
  assert.equal(events(result, "bridge_cta_impression").length, 1)
  assert.equal(events(result, "bridge_cta_viewed").length, 1)

  const clickRegistration = result.documentListeners.listeners("click")[0]
  assert.equal(clickRegistration.options, true, "handoff listener must run in capture phase")
  let prevented = 0
  let stopped = 0
  result.sequence.push("click:start")
  clickRegistration.listener({
    target: result.ctas[0],
    isTrusted: true,
    preventDefault() { prevented += 1 },
    stopPropagation() { stopped += 1 },
  })
  result.sequence.push("click:return")

  assert.equal(prevented, 0)
  assert.equal(stopped, 0)
  assert.equal(events(result, "bridge_cta_click").length, 1)
  assert.equal(events(result, "bridge_handoff_started").length, 1)
  assert.equal(events(result, "bridge_handoff_completed").length, 0)
  assert.deepEqual(
    result.sequence.slice(-4),
    [
      "click:start",
      "capture:bridge_cta_click",
      "capture:bridge_handoff_started",
      "click:return",
    ],
    "both sendBeacon captures must be queued synchronously before navigation continues",
  )

  for (const eventName of ["bridge_cta_click", "bridge_handoff_started"]) {
    const capture = events(result, eventName)[0]
    assert.equal(capture.properties.schema_version, "bridge_cro_v1")
    assert.equal(capture.properties.bridge_variant, "lem_lander_v1")
    assert.equal(capture.properties.cta_id, "hero_primary")
    assert.equal(capture.properties.cta_location, "hero")
    assert.equal(capture.properties.destination_host, "get.nancyflow.com")
    assert.equal(capture.properties.destination_path, "/en/products/lem")
    assert.equal(capture.options.transport, "sendBeacon")
    assert.equal(capture.options.send_instantly, true)
    const serialized = JSON.stringify(capture.properties)
    assert.doesNotMatch(serialized, /SECRET_CLICK|fbclid|_fbp|\?utm_|#buy/)
    assert.equal(Object.hasOwn(capture.properties, "destination"), false)
  }
})

test("section and scroll reach events deduplicate and final summary flushes once", () => {
  const result = runTracker()
  assert.equal(events(result, "section_viewed").length, 1)
  assert.equal(events(result, "important_content_viewed").length, 0)

  const benefits = result.sections[2]
  benefits.rect = { top: 100, bottom: 800, height: 700 }
  result.window.pageYOffset = 2000
  result.window.NancyBridgeCro.refresh()
  result.window.NancyBridgeCro.refresh()

  assert.equal(
    events(result, "section_viewed").filter((event) => event.properties.section_id === "benefits").length,
    1,
  )
  assert.equal(
    events(result, "important_content_viewed").filter(
      (event) => event.properties.content_id === "benefits",
    ).length,
    1,
  )
  assert.deepEqual(
    events(result, "scroll_depth_reached").map((event) => event.properties.scroll_depth_percent),
    [25, 50, 75, 90, 100],
  )

  result.windowListeners.fire("pagehide", { persisted: false })
  result.windowListeners.fire("pagehide", { persisted: false })
  const summaries = events(result, "page_engagement_summary")
  assert.equal(summaries.length, 1)
  assert.equal(summaries[0].properties.is_final_summary, true)
  assert.equal(summaries[0].properties.summary_reason, "pagehide")
  assert.equal(summaries[0].properties.important_content_reached, true)
  assert.equal(summaries[0].properties.max_scroll_percent, 100)
  assert.equal(summaries[0].options.transport, "sendBeacon")
  assert.equal(summaries[0].options.send_instantly, true)
})

test("before_send removes raw destinations and query-bearing URL properties", () => {
  const result = runTracker()
  const sanitized = result.window.NancyBridgeCro.sanitizeCapture({
    event: "bridge_cta_click",
    properties: {
      $current_url: "https://nancyflow.com/lem-lander/?fbclid=SECRET#private",
      $referrer: "https://ads.example/path?email=private@example.com",
      $elements: [{ text: "private rendered text" }],
      destination: "https://get.nancyflow.com/en/products/lem?fbclid=SECRET",
      destination_host: "get.nancyflow.com",
      destination_path: "/en/products/lem?fbclid=SECRET#private",
      $fbclid: "SECRET_CLICK_ID",
      $initial_gclid: "SECRET_INITIAL_CLICK_ID",
      utm_source: "meta",
      $initial_utm_medium: "paid-social",
      utm_campaign: "unsafe campaign value",
    },
  })

  assert.equal(sanitized.properties.$current_url, "https://nancyflow.com/lem-lander")
  assert.equal(sanitized.properties.$referrer, "https://ads.example/path")
  assert.equal(sanitized.properties.destination_host, "get.nancyflow.com")
  assert.equal(sanitized.properties.destination_path, "/en/products/lem")
  assert.equal(sanitized.properties.utm_source, "meta")
  assert.equal(sanitized.properties.$initial_utm_medium, "paid-social")
  assert.equal(Object.hasOwn(sanitized.properties, "utm_campaign"), false)
  assert.equal(Object.hasOwn(sanitized.properties, "$fbclid"), false)
  assert.equal(Object.hasOwn(sanitized.properties, "$initial_gclid"), false)
  assert.equal(Object.hasOwn(sanitized.properties, "$elements"), false)
  assert.equal(Object.hasOwn(sanitized.properties, "destination"), false)
  assert.equal(
    result.window.NancyBridgeCro.sanitizeCapture({ event: "$autocapture", properties: {} }),
    null,
  )
})
