import assert from "node:assert/strict"
import { createRequire } from "node:module"
import test from "node:test"

const require = createRequire(import.meta.url)
const pricingHandler = require("../api/lem-pricing.js")

function responseRecorder() {
  return {
    body: null,
    headers: {},
    statusCode: null,
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value
    },
    status(code) {
      this.statusCode = code
      return this
    },
    json(body) {
      this.body = body
      return this
    },
  }
}

test("bridge ccTLDs pin pricing country ahead of edge geolocation", () => {
  assert.equal(
    pricingHandler.requestCountry({
      headers: {
        host: "www.nancyflow.ca",
        "x-vercel-ip-country": "GB",
      },
    }),
    "ca"
  )
  assert.equal(
    pricingHandler.requestCountry({
      headers: {
        "x-forwarded-host": "nancyflow.co.uk:443",
        "x-vercel-ip-country": "CA",
      },
    }),
    "gb"
  )
})

test("the default bridge uses Vercel country detection with a US fallback", () => {
  assert.equal(
    pricingHandler.requestCountry({
      headers: { host: "nancyflow.com", "x-vercel-ip-country": "DK" },
    }),
    "dk"
  )
  assert.equal(
    pricingHandler.requestCountry({ headers: { host: "localhost:4175" } }),
    "us"
  )
})

test("the pricing endpoint returns live Medusa amounts and calculated savings", async (t) => {
  process.env.MEDUSA_PUBLISHABLE_KEY = "pk_test"
  const originalFetch = globalThis.fetch
  t.after(() => {
    globalThis.fetch = originalFetch
    delete process.env.MEDUSA_PUBLISHABLE_KEY
  })

  globalThis.fetch = async (url, options) => {
    assert.equal(options.headers["x-publishable-api-key"], "pk_test")
    if (String(url).endsWith("/store/regions")) {
      return new Response(JSON.stringify({
        regions: [{
          id: "reg_eu",
          currency_code: "eur",
          countries: [{ iso_2: "de" }],
        }],
      }))
    }

    const productUrl = new URL(url)
    assert.equal(productUrl.pathname, "/store/products")
    assert.equal(productUrl.searchParams.get("handle"), "lem")
    assert.equal(productUrl.searchParams.get("region_id"), "reg_eu")
    return new Response(JSON.stringify({
      products: [{
        variants: [{
          calculated_price: {
            calculated_amount: 59,
            original_amount: 128.95,
            currency_code: "eur",
          },
        }],
      }],
    }))
  }

  const response = responseRecorder()
  await pricingHandler(
    { method: "GET", headers: { host: "nancyflow.de" } },
    response
  )

  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.body, {
    country: "de",
    currency: "eur",
    price: 59,
    compareAt: 128.95,
    savings: 69.95,
    savingsPercent: 54,
    source: "medusa",
  })
  assert.equal(response.headers["cache-control"], "no-store")
  assert.equal(response.headers.vary, "X-Vercel-IP-Country")
})

test("the pricing endpoint fails closed when its backend key is unavailable", async () => {
  delete process.env.MEDUSA_PUBLISHABLE_KEY
  const response = responseRecorder()
  await pricingHandler(
    { method: "GET", headers: { host: "nancyflow.com" } },
    response
  )

  assert.equal(response.statusCode, 503)
  assert.deepEqual(response.body, { error: "pricing_unavailable" })
  assert.equal(response.headers["cache-control"], "no-store")
})
