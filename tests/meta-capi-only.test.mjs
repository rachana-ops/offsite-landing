import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import { extname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"

const root = fileURLToPath(new URL("..", import.meta.url))
const metaPixelId = "428782" + "8478137575"

function browserAssets(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if ([".git", ".vercel", "api", "node_modules", "scripts", "tests"].includes(entry.name)) {
      return []
    }

    const path = join(directory, entry.name)
    if (entry.isDirectory()) return browserAssets(path)
    return [".html", ".js"].includes(extname(entry.name)) ? [path] : []
  })
}

const forbiddenBrowserMeta = [
  ["Meta dataset ID", new RegExp(metaPixelId, "i")],
  ["Meta-hosted browser library", /connect\.facebook\.net\//i],
  ["Meta browser API", /\bfbq\s*\(/i],
  ["Meta tracking image", /(?:www\.)?facebook\.com\/tr(?:[/?]|$)/i],
  ["direct Meta Graph request", /graph\.facebook\.com\//i],
]

test("the Nancy Meta dataset remains CAPI-only", () => {
  const assets = browserAssets(root)
  assert.ok(assets.length > 0, "expected browser assets to inspect")

  for (const file of assets) {
    const source = readFileSync(file, "utf8")
    const path = relative(root, file)

    for (const [label, pattern] of forbiddenBrowserMeta) {
      assert.doesNotMatch(source, pattern, `${path} contains forbidden ${label}`)
    }
  }
})
