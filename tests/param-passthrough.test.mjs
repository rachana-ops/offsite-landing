import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import vm from "node:vm"

const source = readFileSync(new URL("../js/param-passthrough.js", import.meta.url), "utf8")

function runBridge({ search, href = "https://get.nancyflow.com/products/lem#details" }) {
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
    readyState: "complete",
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
      hostname: "nancyflow.com",
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
  return { anchor, cookies, cookieWrites, listeners, body }
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
