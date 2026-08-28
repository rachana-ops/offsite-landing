import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"

const root = fileURLToPath(new URL("..", import.meta.url))
const rootHtml = readFileSync(join(root, "index.html"), "utf8")
const lemLanderHtml = readFileSync(join(root, "lem-lander", "index.html"), "utf8")
const unlockHtml = readFileSync(join(root, "unlock", "index.html"), "utf8")
const bridgeHtml = readFileSync(join(root, "bridge-page", "index.html"), "utf8")

test("the Lem lander remains mirrored at both live aliases", () => {
  assert.equal(rootHtml, lemLanderHtml, "the root and /lem-lander/ must remain equivalent")
  assert.match(rootHtml, /data-bridge-page=["']lem_lander["']/)
  assert.equal((rootHtml.match(/>Choose Your Lem</g) ?? []).length, 4)
  assert.match(rootHtml, /src=["']\/js\/param-passthrough\.js["']/)
  assert.match(rootHtml, /src=["']\/js\/bridge-cro\.js["']/)
})

test("the previous pink bridge remains available at /bridge-page", () => {
  assert.match(bridgeHtml, /<title\b[^>]*>Unlock the Lem<\/title>/)
  assert.match(bridgeHtml, /Rediscover Your .*Sensual.* Side/s)
  assert.match(bridgeHtml, /src=["']\/js\/param-passthrough\.js["']/)
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
