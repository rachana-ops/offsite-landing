import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"

const root = fileURLToPath(new URL("..", import.meta.url))
const rootHtml = readFileSync(join(root, "index.html"), "utf8")
const unlockHtml = readFileSync(join(root, "unlock", "index.html"), "utf8")
const bridgeHtml = readFileSync(join(root, "bridge-page", "index.html"), "utf8")

test("the /unlock landing page is the live root page", () => {
  assert.equal(rootHtml, unlockHtml, "the root and /unlock entries must stay in sync")
  assert.match(rootHtml, /<div id=["']root["']><\/div>/)
  assert.match(rootHtml, /src=["']\/unlock\/assets\/index-[^"']+\.js["']/)
  assert.match(rootHtml, /href=["']\/unlock\/assets\/index-[^"']+\.css["']/)
  assert.doesNotMatch(rootHtml, /Rediscover Your/)
})

test("the previous root page is preserved at /bridge-page", () => {
  assert.match(bridgeHtml, /<title>Unlock the Lem<\/title>/)
  assert.match(bridgeHtml, /Rediscover Your .*Sensual.* Side/s)
  assert.match(
    bridgeHtml,
    /href=["']https:\/\/get\.nancyflow\.com\/en\/products\/lem["']/,
  )
  assert.match(bridgeHtml, /src=["']\/js\/param-passthrough\.js["']/)
  assert.doesNotMatch(bridgeHtml, /src=["']js\/param-passthrough\.js["']/)
})

test("PostHog initializes once on the live landing page with cross-domain handoff", () => {
  assert.equal(rootHtml.split("posthog.init(PH_TOKEN, config)").length - 1, 1)
  assert.equal(
    rootHtml.split("phc_tidb5pyk3fbAfNR4jRPdBFQKYgPSH4opmbmPtzsz9Bdd").length - 1,
    1,
  )
  assert.match(rootHtml, /api_host:\s*["']https:\/\/us\.i\.posthog\.com["']/)
  assert.match(rootHtml, /person_profiles:\s*["']identified_only["']/)
  assert.match(rootHtml, /cross_subdomain_cookie:\s*true/)
  assert.match(rootHtml, /get_distinct_id\(\)/)
  assert.match(rootHtml, /get_session_id\(\)/)
  assert.match(rootHtml, /h\.set\(["']distinct_id["'], did\)/)
  assert.match(rootHtml, /h\.set\(["']session_id["'], sid\)/)
  assert.match(rootHtml, /IN_SCOPE\s*=\s*\[[^\]]*["']nancyflow\.com["']/s)
  assert.match(rootHtml, /targetRoot === scopeRoot\(location\.hostname\)/)
})
