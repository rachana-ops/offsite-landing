import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import vm from "node:vm"

const source = readFileSync(
  new URL("../js/bridge-sticky-cta.js", import.meta.url),
  "utf8",
)

function listenerRegistry() {
  const entries = new Map()
  return {
    add(name, listener) {
      const listeners = entries.get(name) ?? []
      listeners.push(listener)
      entries.set(name, listeners)
    },
    fire(name, event = {}) {
      for (const listener of entries.get(name) ?? []) listener(event)
    },
  }
}

function createElement({ attributes = {}, classes = [], rect }) {
  const attributeMap = new Map(Object.entries(attributes))
  const classSet = new Set(classes)
  return {
    rect: { ...rect },
    classList: {
      add(name) { classSet.add(name) },
      remove(name) { classSet.delete(name) },
      contains(name) { return classSet.has(name) },
    },
    getAttribute(name) { return attributeMap.get(name) ?? null },
    hasAttribute(name) { return attributeMap.has(name) },
    setAttribute(name, value) { attributeMap.set(name, String(value)) },
    removeAttribute(name) { attributeMap.delete(name) },
    getBoundingClientRect() { return { ...this.rect } },
  }
}

function runController({ mobile = true, includeOffer = true } = {}) {
  const windowListeners = listenerRegistry()
  const documentListeners = listenerRegistry()
  const mediaListeners = listenerRegistry()
  const animationFrames = []

  const sticky = createElement({
    attributes: {
      "data-btn": "sticky-atc",
      "data-sticky-state": "hidden",
      "aria-hidden": "true",
      inert: "",
    },
    classes: ["sticky-atc"],
    rect: { top: 720, bottom: 800, height: 80 },
  })
  const stickyLink = createElement({
    attributes: { "data-bridge-cta-id": "sticky_primary" },
    rect: { top: 728, bottom: 784, height: 56 },
  })
  const heroCta = createElement({
    attributes: { "data-bridge-cta-id": "hero_primary" },
    rect: { top: 240, bottom: 300, height: 60 },
  })
  const productOffer = includeOffer
    ? createElement({
        attributes: { "data-bridge-section-id": "product_offer" },
        rect: { top: 2200, bottom: 3000, height: 800 },
      })
    : null

  const selectors = new Map([
    ['[data-btn="sticky-atc"]', sticky],
    ['[data-bridge-cta-id="sticky_primary"]', stickyLink],
    ['[data-bridge-cta-id="hero_primary"]', heroCta],
    ['[data-bridge-section-id="product_offer"]', productOffer],
  ])
  const document = {
    readyState: "complete",
    documentElement: { clientHeight: 800 },
    querySelector(selector) { return selectors.get(selector) ?? null },
    addEventListener(name, listener) { documentListeners.add(name, listener) },
  }
  const media = {
    matches: mobile,
    addEventListener(name, listener) { mediaListeners.add(name, listener) },
    setMatches(matches) {
      this.matches = matches
      mediaListeners.fire("change", { matches })
    },
  }
  const window = {
    document,
    innerHeight: 800,
    matchMedia(query) {
      assert.equal(query, "(max-width: 767px)")
      return media
    },
    addEventListener(name, listener) { windowListeners.add(name, listener) },
    requestAnimationFrame(callback) {
      animationFrames.push(callback)
      return animationFrames.length
    },
    setTimeout(callback) {
      animationFrames.push(callback)
      return animationFrames.length
    },
  }

  vm.runInNewContext(source, { Number, document, window })

  return {
    animationFrames,
    document,
    heroCta,
    media,
    productOffer,
    sticky,
    stickyLink,
    window,
    windowListeners,
    flushFrame() {
      const callback = animationFrames.shift()
      assert.ok(callback, "expected a scheduled viewport evaluation")
      callback()
    },
  }
}

function assertHidden(result) {
  assert.equal(result.window.NancyBridgeStickyCta.isActive(), false)
  assert.equal(result.sticky.classList.contains("is-active"), false)
  assert.equal(result.sticky.getAttribute("data-sticky-state"), "hidden")
  assert.equal(result.sticky.getAttribute("aria-hidden"), "true")
  assert.equal(result.sticky.hasAttribute("inert"), true)
  assert.equal(result.stickyLink.getAttribute("tabindex"), "-1")
}

function assertVisible(result) {
  assert.equal(result.window.NancyBridgeStickyCta.isActive(), true)
  assert.equal(result.sticky.classList.contains("is-active"), true)
  assert.equal(result.sticky.getAttribute("data-sticky-state"), "visible")
  assert.equal(result.sticky.getAttribute("aria-hidden"), "false")
  assert.equal(result.sticky.hasAttribute("inert"), false)
  assert.equal(result.stickyLink.hasAttribute("tabindex"), false)
}

test("mobile sticky activates after the hero and hides before the product offer overlaps", () => {
  const result = runController()
  assertHidden(result)

  result.heroCta.rect = { top: -61, bottom: -1, height: 60 }
  result.productOffer.rect = { top: 721, bottom: 1521, height: 800 }
  result.windowListeners.fire("scroll")
  result.windowListeners.fire("scroll")
  assert.equal(result.animationFrames.length, 1, "scroll work must be animation-frame deduplicated")
  result.flushFrame()
  assertVisible(result)

  // The sticky is 80px tall in an 800px viewport. Hide once the offer would
  // enter the bottom 80px and remain hidden throughout/after the offer.
  result.productOffer.rect = { top: 720, bottom: 1520, height: 800 }
  result.windowListeners.fire("scroll")
  result.flushFrame()
  assertHidden(result)

  result.productOffer.rect = { top: -900, bottom: -100, height: 800 }
  result.windowListeners.fire("scroll")
  result.flushFrame()
  assertHidden(result)
})

test("sticky hides above the hero and whenever the viewport leaves mobile", () => {
  const result = runController({ mobile: false })
  result.heroCta.rect = { top: -61, bottom: -1, height: 60 }
  assertHidden(result)

  result.media.setMatches(true)
  result.flushFrame()
  assertVisible(result)

  result.media.setMatches(false)
  result.flushFrame()
  assertHidden(result)

  result.media.setMatches(true)
  result.flushFrame()
  assertVisible(result)
  result.heroCta.rect = { top: 0, bottom: 60, height: 60 }
  result.windowListeners.fire("scroll")
  result.flushFrame()
  assertHidden(result)
})

test("missing authored boundaries fail closed", () => {
  const result = runController({ includeOffer: false })
  assertHidden(result)
  assert.equal(result.window.NancyBridgeStickyCta.refresh(), false)
})
