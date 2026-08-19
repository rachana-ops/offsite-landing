import assert from "node:assert/strict"
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { dirname, join } from "node:path"
import test from "node:test"
import vm from "node:vm"

const source = readFileSync(new URL("../js/advertorial-locale.js", import.meta.url), "utf8")
const advertorialRoot = new URL("../advertorial/", import.meta.url).pathname

function runRouter({
  pathname = "/advertorial/fiftieslifestyle/en/",
  search = "",
  hash = "",
  languages = ["en-US"],
  alternates = ["en", "de", "nl", "fr", "it", "da", "x-default"],
} = {}) {
  let redirect = null
  const window = {
    location: {
      pathname,
      search,
      hash,
      replace(url) { redirect = url },
    },
  }
  const document = {
    querySelectorAll() {
      return alternates.map((locale) => ({
        getAttribute(name) { return name === "hreflang" ? locale : null },
      }))
    },
  }

  vm.runInNewContext(source, {
    URLSearchParams,
    document,
    navigator: { languages, language: languages[0] },
    window,
  })
  return redirect
}

test("English advertorial routes select the first available browser language", () => {
  assert.equal(
    runRouter({ languages: ["de-AT", "en-US"], search: "?utm_source=test", hash: "#story" }),
    "/advertorial/fiftieslifestyle/de/?utm_source=test#story",
  )
  assert.equal(runRouter({ languages: ["nb-NO", "en-US"] }), "/advertorial/fiftieslifestyle/da/")
})

test("advertorial routing never invents an unavailable translation", () => {
  assert.equal(
    runRouter({ languages: ["it-IT", "sv-SE"], alternates: ["en", "de", "nl", "fr", "sv", "x-default"] }),
    "/advertorial/fiftieslifestyle/sv/",
  )
  assert.equal(
    runRouter({ languages: ["ja-JP", "en-US"], alternates: ["en", "de", "fr", "x-default"] }),
    null,
  )
})

test("explicit advertorial locale paths remain stable", () => {
  assert.equal(
    runRouter({ pathname: "/advertorial/fiftieslifestyle/fr/", languages: ["de-DE"] }),
    null,
  )
})

test("a supported lang query is explicit and preserves unrelated URL state", () => {
  assert.equal(
    runRouter({ search: "?lang=fr&utm_campaign=spring", hash: "#offer", languages: ["de-DE"] }),
    "/advertorial/fiftieslifestyle/fr/?utm_campaign=spring#offer",
  )
  assert.equal(
    runRouter({ search: "?lang=ja&utm_campaign=spring", languages: ["de-DE"] }),
    null,
    "an unavailable explicit locale must not silently select a different language",
  )
})

function indexFiles(directory) {
  return readdirSync(directory).flatMap((name) => {
    const file = join(directory, name)
    return statSync(file).isDirectory()
      ? indexFiles(file)
      : name === "index.html" ? [file] : []
  })
}

test("every shipped advertorial runs the router synchronously after its hreflang block", () => {
  const files = indexFiles(advertorialRoot)
  assert.equal(files.length, 47)

  for (const file of files) {
    const html = readFileSync(file, "utf8")
    const router = '<script src="../../../js/advertorial-locale.js"></script>'
    const routerIndex = html.indexOf(router)
    assert.notEqual(routerIndex, -1, `${file} does not load the advertorial router`)
    assert.equal(routerIndex, html.lastIndexOf(router), `${file} loads the advertorial router more than once`)
    assert.ok(routerIndex < html.search(/<body\b/i), `${file} loads the router after body content begins`)

    const alternateTags = [...html.matchAll(/<link\b[^>]*\bhreflang="[^"]+"[^>]*>/gi)]
    assert.ok(alternateTags.length > 0, `${file} has no hreflang block`)
    const lastAlternate = alternateTags.at(-1)
    const between = html.slice(lastAlternate.index + lastAlternate[0].length, routerIndex)
    assert.equal(between.trim(), "", `${file} does not run the router immediately after its hreflang block`)

    const familyDirectory = dirname(dirname(file))
    const currentLocale = dirname(file).split("/").pop()
    const alternates = [...html.matchAll(/hreflang="([^"]+)"/g)].map((match) => match[1])
    assert.ok(alternates.includes(currentLocale), `${file} does not advertise its own locale`)
    for (const locale of alternates.filter((value) => value !== "x-default")) {
      assert.ok(existsSync(join(familyDirectory, locale, "index.html")), `${file} advertises missing locale ${locale}`)
    }
  }
})
