const MEDUSA_BASE_URL = "https://nancycheckout.medusajs.app"
const LEM_HANDLE = "lem"

const COUNTRY_BY_BRIDGE_HOST = {
  "nancyflow.ca": "ca",
  "nancyflow.co.uk": "gb",
  "nancyflow.co.nz": "nz",
  "nancyflow.de": "de",
  "nancyflow.nl": "nl",
  "nancyflow.fr": "fr",
  "nancyflow.se": "se",
  "nancyflow.dk": "dk",
  "nancyflow.it": "it",
}

function firstHeader(value) {
  return String(Array.isArray(value) ? value[0] : value || "")
    .split(",", 1)[0]
    .trim()
}

function requestCountry(request) {
  const rawHost = firstHeader(
    request.headers?.["x-forwarded-host"] || request.headers?.host
  )
  const host = rawHost.toLowerCase().replace(/^www\./, "").replace(/:\d+$/, "")
  const pinnedCountry = COUNTRY_BY_BRIDGE_HOST[host]
  if (pinnedCountry) return pinnedCountry

  const geoCountry = firstHeader(request.headers?.["x-vercel-ip-country"])
    .toLowerCase()
  return /^[a-z]{2}$/.test(geoCountry) ? geoCountry : "us"
}

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

async function medusaJson(path, publishableKey) {
  const response = await fetch(`${MEDUSA_BASE_URL}${path}`, {
    headers: {
      "x-publishable-api-key": publishableKey,
      "x-medusa-locale": "en",
    },
    signal: AbortSignal.timeout(5000),
  })

  if (!response.ok) {
    throw new Error(`Medusa returned ${response.status}`)
  }

  return response.json()
}

async function loadLemPricing(country, publishableKey) {
  const { regions = [] } = await medusaJson("/store/regions", publishableKey)
  const region = regions.find((candidate) =>
    candidate.countries?.some(
      (item) => String(item?.iso_2 || "").toLowerCase() === country
    )
  )

  if (!region) {
    if (country !== "us") return loadLemPricing("us", publishableKey)
    throw new Error("No Medusa region found for the pricing request")
  }

  const query = new URLSearchParams({
    handle: LEM_HANDLE,
    region_id: region.id,
    fields: "id,handle,*variants.calculated_price",
    limit: "1",
  })
  const { products = [] } = await medusaJson(
    `/store/products?${query.toString()}`,
    publishableKey
  )
  const calculatedPrice = products[0]?.variants?.find((variant) =>
    Number.isFinite(variant?.calculated_price?.calculated_amount)
  )?.calculated_price

  const price = Number(calculatedPrice?.calculated_amount)
  const original = Number(calculatedPrice?.original_amount)
  if (!Number.isFinite(price)) {
    throw new Error("Lem has no calculated price for the requested region")
  }

  const compareAt = Number.isFinite(original) && original > price ? original : price
  const savings = roundMoney(Math.max(0, compareAt - price))

  return {
    country,
    currency: String(calculatedPrice?.currency_code || region.currency_code || "usd")
      .toLowerCase(),
    price: roundMoney(price),
    compareAt: roundMoney(compareAt),
    savings,
    savingsPercent: compareAt > price
      ? Math.round((savings / compareAt) * 100)
      : 0,
    source: "medusa",
  }
}

async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET")
    return response.status(405).json({ error: "method_not_allowed" })
  }

  const publishableKey = process.env.MEDUSA_PUBLISHABLE_KEY
  if (!publishableKey) {
    response.setHeader("Cache-Control", "no-store")
    return response.status(503).json({ error: "pricing_unavailable" })
  }

  try {
    const pricing = await loadLemPricing(requestCountry(request), publishableKey)
    response.setHeader(
      "Cache-Control",
      "public, max-age=0, s-maxage=300, stale-while-revalidate=3600"
    )
    response.setHeader("Vary", "X-Vercel-IP-Country")
    response.setHeader("X-Content-Type-Options", "nosniff")
    return response.status(200).json(pricing)
  } catch {
    response.setHeader("Cache-Control", "no-store")
    return response.status(502).json({ error: "pricing_unavailable" })
  }
}

module.exports = handler
module.exports.requestCountry = requestCountry
module.exports.loadLemPricing = loadLemPricing
