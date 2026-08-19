import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const root = new URL("..", import.meta.url)

function read(relative) {
  return readFileSync(new URL(relative, `${root.href}/`), "utf8")
}

function dictionary(relative) {
  return JSON.parse(read(relative))
}

test("shared upsell image and unit labels are attached to i18n keys", () => {
  const rosabella = read("upsell.html")
  assert.doesNotMatch(rosabella, /\$27\s*\/ea|alt="thumb\s+\d/i)
  assert.match(rosabella, /data-i18n="offer\.unitPrice"/)
  assert.equal((rosabella.match(/data-i18n-alt="offer\.thumb\dAlt"/g) || []).length, 3)

  const nancy = read("nancy-flow/nancy-upsell.html")
  assert.doesNotMatch(nancy, /alt="Lolly Mini Wand"/)
  assert.equal((nancy.match(/data-i18n-alt="product\.imgAlt"/g) || []).length, 3)
})

test("previously untranslated catalogue phrases remain localized", () => {
  const checks = [
    ["i18n/ko/lem.json", ["beginners.card3.title", "howto.step1.title", "couples.title", "comparison.row4", "faq.a3"], /One-button|Charge it up|Better Together|Whisper-quiet|Pleasure Guarantee/i],
    ["i18n/ro/lem.json", ["doctor.attribution", "beginners.card2.title", "howto.title", "comparison.row4"], /Clinical Sexologist|Whisper-quiet|Simple 5-Step Process/i],
    ["i18n/pt/lem.json", ["pdp.title", "beginners.card2.title", "comparison.row4"], /Clitoral Massager|Whisper-quiet/i],
    ["i18n/pl/thank-you.json", ["catalog.lem.name", "catalog.lem.sub"], /Clitoral Massager|Pocket-sized air-pulse/i],
    ["i18n/pt/thank-you.json", ["catalog.lem.name", "catalog.lem.sub"], /Clitoral Massager|Pocket-sized air-pulse/i],
    ["i18n/ro/thank-you.json", ["catalog.lem.name", "catalog.lem.sub", "catalog.discreet.sub"], /Clitoral Massager|Pocket-sized air-pulse|Plain box/i],
    ["i18n/ko/thank-you.json", ["catalog.discreet.sub"], /Plain box|neutral sender/i],
    ["i18n/ro/rosabella.json", ["hero.cta", "products.title"], /Best Seller/i],
    ["i18n/ro/bridge-3-editorial.json", ["meta.title"], /^Bridge\b/i],
  ]

  for (const [file, keys, forbidden] of checks) {
    const values = dictionary(file)
    for (const key of keys) {
      assert.doesNotMatch(values[key], forbidden, `${file}:${key} contains untranslated English`)
    }
  }
})
