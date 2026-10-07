import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"

const root = fileURLToPath(new URL("..", import.meta.url))
const html = readFileSync(join(root, "unlock/index.html"), "utf8")
const script = html.match(/src=["'](\/unlock\/assets\/index-[^"']+\.js)["']/)?.[1]
const stylesheet = html.match(/href=["'](\/unlock\/assets\/index-[^"']+\.css)["']/)?.[1]
const bundle = readFileSync(join(root, script), "utf8")
const copy = readFileSync(join(root, "src/wellness/Home.tsx"), "utf8")

test("the Wellness entry is a self-contained production build", () => {
  assert.match(html, /<html\s+lang=["']en["']/i)
  assert.match(html, /<title>Nancy's Lem - Personal Wellness Guide<\/title>/)
  assert.ok(script)
  assert.ok(stylesheet)
  assert.ok(existsSync(join(root, stylesheet)))
  assert.doesNotMatch(html, /%VITE_|manus-runtime|data-loc/)
  for (const image of [...copy.matchAll(/(?:src="|src: ")(\/unlock\/[^"']+)/g)].map(m => m[1])) {
    assert.ok(existsSync(join(root, image)), `Missing image: ${image}`)
  }
})

test("the entire guide avoids explicit headline wording, fake scarcity, and unsupported medical claims", () => {
  assert.match(bundle, /A Fresh Take on Self-Care/)
  assert.doesNotMatch(copy + html, /orgasms?|vibrators?|estrogen|atrophy|physiotherapy|countdown|showTimer|timeLeft|visitorCount|limited.time|Summer Sale|14,907|1M\+|Award.Winn/i)
  assert.doesNotMatch(copy, /promot(?:es|ing) health|improve tissue|increases blood flow|prevents tissue|nerve pathways active|sleep better|zero irritation|without side effects|3.Minute Miracle/i)
  assert.match(copy, /not a medical treatment/)
  assert.match(copy, /Experiences vary/)
  assert.match(copy, /<th scope="col"/)
  assert.doesNotMatch(copy, /Cream|Doctor Recommended/)
})

test("all product links go directly to HelloNancy with the dedicated parameter helper", () => {
  assert.equal(bundle.split("https://hellonancy.com/products/lem").length - 1, 4)
  assert.doesNotMatch(bundle + html, /https:\/\/get\.nancyflow\.com\/.*products\/lem/)
  assert.match(html, /src=["']\/js\/wellness-attribution\.js["']/)
  assert.doesNotMatch(html, /src=["']\/js\/param-passthrough\.js["']/)
  const config = JSON.parse(readFileSync(join(root, "vercel.wellness.json")))
  assert.deepEqual(config.rewrites, [{ source: "/", destination: "/unlock/index.html" }])
})

test("Taboola initializes once for account 2079308 and the existing relay remains installed", () => {
  assert.equal(html.split("name: 'page_view'").length - 1, 1)
  assert.equal(html.split("cdn.taboola.com/libtrc/unip/2079308/tfa.js").length - 1, 1)
  assert.match(html, /if \(!window\.__wellnessTaboolaPageView\)/)
  assert.match(html, /<script data-cfasync="false" async src="https:\/\/sub\.hellonancy\.com\/bridge\/v1\.js"><\/script>/)
  const helper = readFileSync(join(root, "js/wellness-attribution.js"), "utf8")
  assert.match(helper, /name: 'lem_product_click', id: 2079308/)
  assert.doesNotMatch(helper, /name: ['"]purchase['"]|name: ['"]add_to_cart['"]/)
})
