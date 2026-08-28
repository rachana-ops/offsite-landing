import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import vm from "node:vm"

const source = readFileSync(new URL("../js/param-passthrough.js", import.meta.url), "utf8")
const supportedLocales = [
  "en", "it", "de", "zh-hans", "zh-hant", "nl", "ko", "pt", "es",
  "sv", "ja", "fr", "da", "fi", "ro", "pl", "cs", "hu", "el", "hr",
]

function runBridge({
  search = "",
  href = "https://get.nancyflow.com/products/lem#details",
  hostname = "nancyflow.com",
  locale = "en",
  readyState = "complete",
} = {}) {
  const cookies = new Map()
  const cookieWrites = []
  const listeners = new Map()
  const anchor = {
    tagName: "A",
    parentElement: null,
    attributes: { href },
    getAttribute(name) {
      return this.attributes[name] ?? null
    },
    setAttribute(name, value) {
      this.attributes[name] = value
    },
  }
  const body = {}
  anchor.parentElement = body
  const document = {
    body,
    documentElement: { lang: locale },
    readyState,
    querySelectorAll(selector) {
      return selector === "a[href]" ? [anchor] : []
    },
    addEventListener(name, listener) {
      listeners.set(name, listener)
    },
  }
  Object.defineProperty(document, "cookie", {
    get() {
      return [...cookies].map(([name, value]) => `${name}=${value}`).join("; ")
    },
    set(value) {
      cookieWrites.push(value)
      const pair = value.split(";", 1)[0]
      const separator = pair.indexOf("=")
      cookies.set(pair.slice(0, separator), pair.slice(separator + 1))
    },
  })

  const window = {
    crypto: { getRandomValues(values) { values[0] = 1234567890; return values } },
    location: {
      hostname,
      protocol: "https:",
      search,
    },
  }
  vm.runInNewContext(source, {
    Date,
    Math,
    URLSearchParams,
    Uint32Array,
    document,
    window,
  })
  return { anchor, cookies, cookieWrites, listeners, body, window }
}

test("forwards Meta and major ad attribution parameters without arbitrary query data", () => {
  const result = runBridge({
    search: "?fbclid=PAc_Click.Id&fbc=fb.1.123.PAc_Click.Id&fbp=fb.1.123.456&utm_source=meta&utm_campaign=launch&gclid=google-1&gbraid=braid-1&wbraid=web-1&ttclid=tiktok-1&msclkid=bing-1&twclid=x-1&li_fat_id=linkedin-1&sccid=snap-1&rdt_cid=reddit-1&private=drop-me",
  })
  const url = new URL(result.anchor.attributes.href)

  for (const name of [
    "fbclid", "fbc", "fbp", "utm_source", "utm_campaign", "gclid",
    "gbraid", "wbraid", "ttclid", "msclkid", "twclid", "li_fat_id",
    "sccid", "rdt_cid", "_fbc", "_fbp",
  ]) {
    assert.ok(url.searchParams.has(name), `${name} should be carried`)
  }
  assert.equal(url.searchParams.has("private"), false)
  assert.equal(url.hash, "#details")
  assert.match(result.cookies.get("_fbc"), /^fb\.1\.\d+\.PAc_Click\.Id$/)
  assert.match(result.cookies.get("_fbp"), /^fb\.1\.\d+\.456$/)
  assert.ok(result.cookieWrites.every((cookie) => cookie.includes("Domain=.nancyflow.com")))
})

test("mints Meta cookies when the pixel is blocked and carries them to the store", () => {
  const result = runBridge({ search: "?utm_medium=paid-social" })
  const url = new URL(result.anchor.attributes.href)

  assert.match(result.cookies.get("_fbp"), /^fb\.1\.\d+\.\d+$/)
  assert.equal(result.cookies.has("_fbc"), false)
  assert.equal(url.searchParams.get("_fbp"), result.cookies.get("_fbp"))
  assert.equal(url.searchParams.get("utm_medium"), "paid-social")
})

test("patches anchors added after initial page load using fresh cookie carriers", () => {
  const result = runBridge({ search: "?fbclid=late-click" })
  const dynamicAnchor = {
    tagName: "A",
    parentElement: result.body,
    attributes: { href: "https://get.nancyflow.com/products/lem?offer=1" },
    getAttribute(name) { return this.attributes[name] ?? null },
    setAttribute(name, value) { this.attributes[name] = value },
  }

  result.listeners.get("click")({ target: dynamicAnchor })
  const url = new URL(dynamicAnchor.attributes.href)
  assert.equal(url.searchParams.get("offer"), "1")
  assert.equal(url.searchParams.get("fbclid"), "late-click")
  assert.equal(url.searchParams.get("_fbc"), result.cookies.get("_fbc"))
  assert.equal(url.searchParams.get("_fbp"), result.cookies.get("_fbp"))
})

test("a CTA clicked before DOMContentLoaded still leaves with attribution", () => {
  // Regression: on a script-heavy lander the authored hrefs are still bare
  // while the page is parsing. Both the anchor rewrite AND the click fallback
  // used to be deferred to DOMContentLoaded, so an early click navigated to
  // the storefront with no utm_*, no click id and no Meta cookies at all.
  const result = runBridge({
    search: "?utm_source=facebook&fbclid=early-click",
    readyState: "loading",
  })

  // Bulk patching has NOT run yet - this is the state an early clicker sees.
  assert.equal(result.anchor.attributes.href, "https://get.nancyflow.com/products/lem#details")

  // ...but the interceptor is already armed, and repairs the click in flight.
  result.listeners.get("click")({ target: result.anchor })
  const url = new URL(result.anchor.attributes.href)
  assert.equal(url.searchParams.get("utm_source"), "facebook")
  assert.equal(url.searchParams.get("fbclid"), "early-click")
  assert.match(url.searchParams.get("_fbc"), /^fb\.1\.\d+\.early-click$/)
  assert.ok(url.searchParams.has("_fbp"))

  // And DOMContentLoaded still patches the rest of the page as before.
  result.listeners.get("DOMContentLoaded")()
  assert.ok(new URL(result.anchor.attributes.href).searchParams.has("utm_source"))
})

test("Meta cookies are minted before DOMContentLoaded", () => {
  const result = runBridge({ search: "?fbclid=early-mint", readyState: "loading" })
  assert.match(result.cookies.get("_fbc"), /^fb\.1\.\d+\.early-mint$/)
  assert.match(result.cookies.get("_fbp"), /^fb\.1\.\d+\.\d+$/)
})

test("quiz buttons navigate to the guarded localized Lem handoff", () => {
  const result = runBridge({
    hostname: "nancyflow.ca",
    locale: "fr",
    search: "?utm_source=quiz",
  })
  const button = {
    tagName: "BUTTON",
    parentElement: result.body,
    attributes: {
      onclick: "window.location='https://get.nancyflow.com/products/lem'",
    },
    getAttribute(name) { return this.attributes[name] ?? null },
    setAttribute(name, value) { this.attributes[name] = value },
  }
  let prevented = false
  let stopped = false

  result.listeners.get("click")({
    target: button,
    preventDefault() { prevented = true },
    stopImmediatePropagation() { stopped = true },
  })

  const url = new URL(result.window.location)
  assert.equal(url.origin + url.pathname, "https://get.nancyflow.ca/fr/products/lem")
  assert.equal(url.searchParams.get("utm_source"), "quiz")
  assert.equal(button.attributes.onclick, "")
  assert.equal(prevented, true)
  assert.equal(stopped, true)
})

test("every live bridge market reaches the matching live Lem storefront", () => {
  const cases = [
    ["nancyflow.com", "get.nancyflow.com"],
    ["nancyflow.co.uk", "get.nancyflow.co.uk"],
    ["nancyflow.ca", "get.nancyflow.ca"],
    ["nancyflow.co.nz", "get.nancyflow.co.nz"],
    ["nancyflow.de", "get.nancyflow.de"],
    ["nancyflow.nl", "get.nancyflow.nl"],
    ["nancyflow.fr", "get.nancyflow.fr"],
    ["nancyflow.se", "get.nancyflow.se"],
  ]

  for (const [hostname, storeHost] of cases) {
    for (const locale of supportedLocales) {
      const result = runBridge({ hostname, locale })
      const url = new URL(result.anchor.attributes.href)
      assert.equal(url.host, storeHost, `${hostname} / ${locale}`)
      assert.equal(url.pathname, `/${locale}/products/lem`, `${hostname} / ${locale}`)
    }
  }
})

test("the bridge language is explicit on the Lem handoff for every catalog", () => {
  for (const locale of supportedLocales) {
    const result = runBridge({ locale })
    const url = new URL(result.anchor.attributes.href)
    assert.equal(url.pathname, `/${locale}/products/lem`, locale)
  }
})

test("unavailable storefront hosts fail over to the geo-aware .com Lem route", () => {
  for (const [href, locale, expectedPath] of [
    ["https://get.nancyflow.dk/products/lem", "en", "/en/products/lem"],
    ["https://get.nancyflow.it/products/lem", "it", "/it/products/lem"],
  ]) {
    const result = runBridge({ href, locale })
    const url = new URL(result.anchor.attributes.href)
    assert.equal(url.host, "get.nancyflow.com")
    assert.equal(url.pathname, expectedPath)
  }

  const danishBridge = runBridge({
    hostname: "nancyflow.dk",
    locale: "da",
  })
  const danishUrl = new URL(danishBridge.anchor.attributes.href)
  assert.equal(danishUrl.host, "get.nancyflow.com")
  assert.equal(danishUrl.pathname, "/da/dk/products/lem")
})

test("the serving bridge market and rendered language override stale authored paths", () => {
  const result = runBridge({
    hostname: "nancyflow.de",
    locale: "de",
    href: "https://get.nancyflow.com/da/dk/products/lem?offer=bridge#buy",
  })
  const url = new URL(result.anchor.attributes.href)

  assert.equal(url.host, "get.nancyflow.de")
  assert.equal(url.pathname, "/de/products/lem")
  assert.equal(url.searchParams.get("offer"), "bridge")
  assert.equal(url.hash, "#buy")
})

test("content language never masquerades as shopper geography", () => {
  const cases = [
    {
      hostname: "nancyflow.com",
      locale: "fr",
      href: "https://get.nancyflow.fr/products/lem",
      expected: "https://get.nancyflow.com/fr/products/lem",
    },
    {
      hostname: "nancyflow.ca",
      locale: "fr",
      href: "https://get.nancyflow.fr/products/lem",
      expected: "https://get.nancyflow.ca/fr/products/lem",
    },
    {
      hostname: "nancyflow.de",
      locale: "da",
      href: "https://get.nancyflow.com/da/dk/products/lem",
      expected: "https://get.nancyflow.de/da/products/lem",
    },
    {
      hostname: "offsite-landing-git-preview.vercel.app",
      locale: "nl",
      href: "https://get.nancyflow.nl/products/lem",
      expected: "https://get.nancyflow.com/nl/products/lem",
    },
  ]

  for (const { hostname, locale, href, expected } of cases) {
    const result = runBridge({ hostname, locale, href })
    const url = new URL(result.anchor.attributes.href)
    assert.equal(url.origin + url.pathname, expected)
  }
})
