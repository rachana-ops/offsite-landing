import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"

const root = fileURLToPath(new URL("..", import.meta.url))
const checker = join(root, "scripts", "check-no-legacy-navigation.mjs")
const BRIDGE_TAG =
  '<script data-cfasync="false" defer src="https://sub.hellonancy.com/bridge/v1.js"></script>'
const NANCY_POSTHOG_TOKEN = "phc_tidb5pyk3fbAfNR4jRPdBFQKYgPSH4opmbmPtzsz9Bdd"

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

function count(haystack, needle) {
  return haystack.split(needle).length - 1
}

test("every page loads the Hello Nancy bridge relay exactly once, verbatim, in <head>", () => {
  const pages = htmlFiles(root)
  assert.equal(pages.length, 71, "expected every bridge page")

  for (const file of pages) {
    const html = readFileSync(file, "utf8")
    const path = relative(root, file)

    assert.equal(count(html, BRIDGE_TAG), 1, `${path} must contain the verbatim bridge tag once`)
    assert.equal(count(html, "sub.hellonancy.com"), 1, `${path} references the relay more than once`)
    assert.equal(
      (html.match(/<script\b[^>]*\bsrc=["'][^"']*bridge\/v1\.js/gi) ?? []).length,
      1,
      `${path} must have exactly one bridge <script> element`,
    )
    const tagAt = html.indexOf(BRIDGE_TAG)
    assert.ok(tagAt > html.search(/<head\b/i), `${path} loads the relay before <head>`)
    assert.ok(tagAt < html.indexOf("</head>"), `${path} loads the relay outside <head>`)
  }
})

test("every page initializes the Nancy PostHog project exactly once", () => {
  for (const file of htmlFiles(root)) {
    const html = readFileSync(file, "utf8")
    const path = relative(root, file)
    assert.equal(count(html, "posthog.init("), 1, `${path} must call posthog.init once`)
    assert.equal(count(html, NANCY_POSTHOG_TOKEN), 1, `${path} must carry the Nancy token once`)
    assert.deepEqual(
      [...new Set(html.match(/phc_[A-Za-z0-9]+/g))],
      [NANCY_POSTHOG_TOKEN],
      `${path} must not load another PostHog project`,
    )
  }
})

function runChecker(files) {
  const directory = mkdtempSync(join(tmpdir(), "legacy-navigation-"))
  try {
    for (const [name, content] of Object.entries(files)) {
      mkdirSync(dirname(join(directory, name)), { recursive: true })
      writeFileSync(join(directory, name), content)
    }
    return spawnSync(process.execPath, [checker], { cwd: directory, encoding: "utf8" })
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

test("the legacy-navigation check passes on this repository", () => {
  const result = spawnSync(process.execPath, [checker], { cwd: root, encoding: "utf8" })
  assert.equal(result.status, 0, result.stderr)
})

test("the legacy-navigation check exempts only the exact bridge relay script source", () => {
  const page = (head, body = "") =>
    `<!doctype html><html><head>${head}</head><body>${body}</body></html>`

  assert.equal(runChecker({ "index.html": page(BRIDGE_TAG) }).status, 0)
  assert.equal(
    runChecker({
      "a/index.html": page(
        "<script defer src='https://sub.hellonancy.com/bridge/v1.js'></script>",
      ),
    }).status,
    0,
  )

  const forbidden = {
    "a link to the relay URL": page(
      "",
      '<a href="https://sub.hellonancy.com/bridge/v1.js">x</a>',
    ),
    "the relay URL with a query": page(
      '<script defer src="https://sub.hellonancy.com/bridge/v1.js?v=2"></script>',
    ),
    "another relay path": page(
      '<script defer src="https://sub.hellonancy.com/bridge/v2.js"></script>',
    ),
    "a protocol-relative relay URL": page(
      '<script defer src="//sub.hellonancy.com/bridge/v1.js"></script>',
    ),
    "a plain-http relay URL": page(
      '<script defer src="http://sub.hellonancy.com/bridge/v1.js"></script>',
    ),
    "the relay path on another hellonancy host": page(
      '<script defer src="https://hellonancy.com/bridge/v1.js"></script>',
    ),
    "a data-src attribute": page(
      '<script data-src="https://sub.hellonancy.com/bridge/v1.js"></script>',
    ),
    "an image source": page("", '<img src="https://sub.hellonancy.com/bridge/v1.js">'),
    "store navigation next to the relay": page(
      BRIDGE_TAG,
      '<a href="https://hellonancy.com/products/lem">Buy</a>',
    ),
  }
  for (const [label, html] of Object.entries(forbidden)) {
    const result = runChecker({ "index.html": html })
    assert.equal(result.status, 1, `${label} must be rejected`)
    assert.match(result.stderr, /hellonancy\.com/, `${label} must be reported`)
  }

  const script = runChecker({
    "js/loader.js": 'var s = "https://sub.hellonancy.com/bridge/v1.js"',
  })
  assert.equal(script.status, 1, "the relay URL in JavaScript must be rejected")
})
