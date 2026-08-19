import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"

const root = fileURLToPath(new URL("..", import.meta.url))
const rootHtml = readFileSync(join(root, "index.html"), "utf8")
const unlockHtml = readFileSync(join(root, "unlock", "index.html"), "utf8")
const bridgeHtml = readFileSync(join(root, "bridge-page", "index.html"), "utf8")

test("the previous pink bridge is restored at the live root", () => {
  assert.equal(rootHtml, bridgeHtml, "the root must remain the preserved bridge page")
  assert.match(rootHtml, /<title\b[^>]*>Unlock the Lem<\/title>/)
  assert.match(rootHtml, /Rediscover Your .*Sensual.* Side/s)
  assert.match(
    rootHtml,
    /href=["']https:\/\/get\.nancyflow\.com\/en\/products\/lem["']/,
  )
  assert.match(rootHtml, /src=["']\/js\/param-passthrough\.js["']/)
  assert.doesNotMatch(rootHtml, /<div id=["']root["']><\/div>/)
})

test("the Wellness landing remains available only at /unlock", () => {
  assert.match(unlockHtml, /<div id=["']root["']><\/div>/)
  assert.match(unlockHtml, /src=["']\/unlock\/assets\/index-[^"']+\.js["']/)
  assert.match(unlockHtml, /href=["']\/unlock\/assets\/index-[^"']+\.css["']/)
  assert.doesNotMatch(unlockHtml, /Rediscover Your/)
})

test("PostHog initializes once on the Wellness landing with cross-domain handoff", () => {
  assert.equal(unlockHtml.split("posthog.init(PH_TOKEN, config)").length - 1, 1)
  assert.equal(
    unlockHtml.split("phc_tidb5pyk3fbAfNR4jRPdBFQKYgPSH4opmbmPtzsz9Bdd").length - 1,
    1,
  )
  assert.match(unlockHtml, /api_host:\s*["']https:\/\/us\.i\.posthog\.com["']/)
  assert.match(unlockHtml, /person_profiles:\s*["']identified_only["']/)
  assert.match(unlockHtml, /cross_subdomain_cookie:\s*true/)
  assert.match(unlockHtml, /get_distinct_id\(\)/)
  assert.match(unlockHtml, /get_session_id\(\)/)
  assert.match(unlockHtml, /h\.set\(["']distinct_id["'], did\)/)
  assert.match(unlockHtml, /h\.set\(["']session_id["'], sid\)/)
  assert.match(unlockHtml, /IN_SCOPE\s*=\s*\[[^\]]*["']nancyflow\.com["']/s)
  assert.match(unlockHtml, /targetRoot === scopeRoot\(location\.hostname\)/)
})
