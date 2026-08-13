import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import { join, relative } from "node:path"
import test from "node:test"

const root = new URL("..", import.meta.url).pathname

function htmlFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if ([".git", ".vercel", "node_modules"].includes(entry.name)) return []
    const path = join(directory, entry.name)
    return entry.isDirectory()
      ? htmlFiles(path)
      : entry.name.endsWith(".html")
        ? [path]
        : []
  })
}

test("every Lem bridge handoff uses the guarded live storefront route", () => {
  const guardedPages = []
  const advertorialPages = []

  for (const file of htmlFiles(root)) {
    const html = readFileSync(file, "utf8")
    const relativePath = relative(root, file)

    assert.doesNotMatch(
      html,
      /(?:href\s*=\s*|window\.location\s*=\s*)["'](?:\.\/)?lem\.html(?:[?#][^"']*)?["']/i,
      `${relativePath} still navigates to the local mock Lem page`,
    )

    const hasLemHandoff = /https:\/\/get\.nancyflow\.[^\s"'<>]+\/products\/lem(?:[?#\s"'<>]|$)/i.test(html)
    if (!hasLemHandoff) continue
    guardedPages.push(relativePath)

    assert.match(
      html,
      /<script\b[^>]*\bsrc=["'][^"']*js\/param-passthrough\.js["'][^>]*>/i,
      `${relativePath} bypasses the centralized storefront handoff`,
    )
    assert.doesNotMatch(
      html,
      /https:\/\/get\.nancyflow\.(?:dk|it)(?:[\/?#"'])/i,
      `${relativePath} points directly at a storefront host that is not live`,
    )

    // Advertorial language is content, not geography. Its static/no-JS
    // fallback must keep language explicit but let the .com storefront choose
    // country/currency from the visitor's actual location. The runtime can
    // still replace .com with a market host when the bridge itself is served
    // from a market ccTLD.
    if (relativePath.startsWith("advertorial/")) {
      advertorialPages.push(relativePath)
      const locale = html.match(/<html\b[^>]*\blang=["']([^"']+)["']/i)?.[1]?.toLowerCase()
      assert.ok(locale, `${relativePath} has no document language`)
      const productUrls = [...html.matchAll(
        /https:\/\/get\.nancyflow\.(?:com|co\.uk|ca|co\.nz|de|nl|fr|it|se|dk)(?:\/[a-z-]+){0,2}\/products\/lem/gi,
      )].map((match) => match[0])
      assert.ok(productUrls.length > 0, `${relativePath} has no Lem fallback URL`)
      assert.deepEqual(
        [...new Set(productUrls)],
        [`https://get.nancyflow.com/${locale}/products/lem`],
        `${relativePath} hard-codes content language as a shopper market`,
      )
    }
  }

  assert.equal(guardedPages.length, 57, "expected every bridge-to-Lem page")
  assert.equal(advertorialPages.length, 47, "expected every advertorial locale")
})
