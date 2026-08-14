import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"

const root = fileURLToPath(new URL("..", import.meta.url))
const unlockDirectory = join(root, "unlock")
const html = readFileSync(join(unlockDirectory, "index.html"), "utf8")

function localUnlockFile(url) {
  assert.match(url, /^\/unlock\//, `${url} is not rooted at /unlock/`)
  return join(unlockDirectory, url.slice("/unlock/".length))
}

test("the /unlock entry is a self-contained production build of the English landing page", () => {
  assert.match(html, /<html\s+lang=["']en["']/i)
  assert.match(html, /<title>Nancy's Lem - Menopause Wellness<\/title>/)
  assert.doesNotMatch(html, /%VITE_[A-Z0-9_]+%/)
  assert.match(
    html,
    /<link\b[^>]*rel=["']icon["'][^>]*href=["']\/unlock\/wellness-insider-logo\.png["']/i,
  )
  assert.doesNotMatch(html, /id=["']manus-runtime["']|\bdata-loc=/i)

  const scriptUrl = html.match(
    /<script\b[^>]*\bsrc=["'](\/unlock\/assets\/index-[^"']+\.js)["'][^>]*>/i,
  )?.[1]
  const stylesheetUrl = html.match(
    /<link\b[^>]*\bhref=["'](\/unlock\/assets\/index-[^"']+\.css)["'][^>]*>/i,
  )?.[1]

  assert.ok(scriptUrl, "the route has no /unlock production JavaScript entry")
  assert.ok(stylesheetUrl, "the route has no /unlock production stylesheet")
  assert.ok(existsSync(localUnlockFile(scriptUrl)), `${scriptUrl} is missing`)
  assert.ok(existsSync(localUnlockFile(stylesheetUrl)), `${stylesheetUrl} is missing`)

  const bundle = readFileSync(localUnlockFile(scriptUrl), "utf8")
  assert.match(bundle, /1M\+ Orgasms Later/)
  assert.match(bundle, /fixed top-\[65px\] md:top-\[73px\]/)
  assert.doesNotMatch(bundle, /fixed top-14/)
  assert.doesNotMatch(bundle, /Page Not Found/)
  assert.doesNotMatch(bundle, /\bdata-loc\b/)

  assert.match(bundle, /\/api\/lem-pricing/)
  assert.match(bundle, /data-unlock-price/)
  assert.match(bundle, /grid-cols-\[minmax\(0,1fr\)_auto\]/)
  assert.match(bundle, /text-\[11px\] leading-none text-white\/75 line-through sm:text-sm/)
  assert.match(bundle, /space-y-5 p-4 sm:space-y-6 sm:p-8/)
  assert.match(bundle, /flex-col items-center justify-center gap-1 sm:flex-row/)
  assert.match(bundle, /h-auto min-h-14 w-full whitespace-normal/)
  assert.match(bundle, /Shop Now —/)
  assert.doesNotMatch(bundle, /rotate-12 translate-x-8 -translate-y-2/)
  for (const layoutHook of [
    "sticky-pricing",
    "sticky-compare",
    "sticky-savings",
    "offer-savings-badge",
    "offer-timer",
    "offer-price",
    "offer-cta",
  ]) {
    assert.equal(
      bundle.split(layoutHook).length - 1,
      1,
      `${layoutHook} must identify exactly one responsive pricing element`,
    )
  }
  assert.match(
    bundle,
    /USD:\{currencyCode:"USD",current:69,compareAt:159\}/,
    "the USD fallback must match the current Lem offer",
  )
  assert.match(
    bundle,
    /EUR:\{currencyCode:"EUR",current:59,compareAt:128\.95\}/,
    "the EUR fallback must match the current Lem offer",
  )
  assert.doesNotMatch(bundle, /\$89|SAVE \$70|\$0\.24\/day|Save \$70 \(44% off\)/)
  assert.match(bundle, /\$50-150/)
  assert.match(bundle, /\$30-50\/month/)

  const ctaUrl = "https://get.nancyflow.com/en/products/lem"
  assert.equal(bundle.split(ctaUrl).length - 1, 4, "expected all four Lem CTAs")
  assert.doesNotMatch(bundle, /https:\/\/hellonancy\.com\/products\/lem/i)

  const expectedImages = [
    "/unlock/PDP.jpg",
    "/unlock/PDP-1.jpg",
    "/unlock/PDP-2.jpg",
    "/unlock/PDP-3.jpg",
    "/unlock/PDP-4.jpg",
    "/unlock/PDP-5.jpg",
    "/unlock/PDP-6.jpg",
    "/unlock/PDP-7.jpg",
    "/unlock/discretion_illustration.png",
    "/unlock/wellness-insider-logo.png",
    "/unlock/timeout_logo.webp",
    "/unlock/tatler_logo.webp",
    "/unlock/sarasense_logo.webp",
    "/unlock/zenify_logo.webp",
    "/unlock/vocal_logo.webp",
    "/unlock/assets/clitoral-anatomy.png",
    "/unlock/assets/menopause-blood-flow.png",
  ]

  for (const imageUrl of expectedImages) {
    assert.match(bundle + html, new RegExp(imageUrl.replaceAll(".", "\\.")))
    assert.ok(existsSync(localUnlockFile(imageUrl)), `${imageUrl} is missing`)
  }
  assert.doesNotMatch(bundle, /files\.manuscdn\.com/i)
})

test("the /unlock bridge loads attribution handling and retains source analytics", () => {
  assert.match(
    html,
    /<script\b[^>]*\bsrc=["']\/js\/param-passthrough\.js["'][^>]*><\/script>/i,
  )

  for (const analyticsMarker of [
    "googletagmanager.com/gtag/js?id=AW-11033179838",
    "clarity.ms/tag/",
    "posthog.init(PH_TOKEN, config)",
    "sc-static.net/scevent.min.js",
    "cdn.taboola.com/libtrc/unip/2079308/tfa.js",
  ]) {
    assert.ok(html.includes(analyticsMarker), `${analyticsMarker} tracking is missing`)
  }
})
