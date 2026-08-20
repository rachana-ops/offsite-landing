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
  hostname = "nancyflow.com",
  storage = new Map(),
  session = new Map(),
  cookieJar = new Map(),
} = {}) {
  let redirect = null
  const window = {
    location: {
      pathname,
      search,
      hash,
      hostname,
      protocol: "https:",
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
  Object.defineProperty(document, "cookie", {
    get() {
      return [...cookieJar].map(([name, value]) => `${name}=${value}`).join("; ")
    },
    set(value) {
      const pair = value.split(";", 1)[0]
      const separator = pair.indexOf("=")
      cookieJar.set(pair.slice(0, separator), pair.slice(separator + 1))
    },
  })
  const localStorage = {
    getItem(key) { return storage.get(key) ?? null },
    setItem(key, value) { storage.set(key, value) },
  }
  const sessionStorage = {
    getItem(key) { return session.get(key) ?? null },
    setItem(key, value) { session.set(key, value) },
    removeItem(key) { session.delete(key) },
  }

  vm.runInNewContext(source, {
    URLSearchParams,
    document,
    localStorage,
    sessionStorage,
    navigator: { languages, language: languages[0] },
    window,
  })
  return { cookieJar, redirect, session, storage }
}

test("browser language never switches an English advertorial", () => {
  for (const languages of [["de-AT", "en-US"], ["nb-NO", "en-US"], ["fr-FR"]]) {
    const result = runRouter({
      languages,
      search: "?utm_source=test",
      hash: "#story",
    })
    assert.equal(result.redirect, null, languages[0])
    assert.equal(result.cookieJar.size, 0, languages[0])
    assert.equal(result.storage.size, 0, languages[0])
  }
  assert.doesNotMatch(source, /navigator\.(?:languages|language|userLanguage)/)
  assert.doesNotMatch(source, /nancy_auto_locale_redirect|sessionStorage/)
})

test("a direct localized advertorial path remains stable and persists manually", () => {
  const result = runRouter({
    pathname: "/advertorial/fiftieslifestyle/fr/",
    languages: ["de-DE", "en-US"],
  })

  assert.equal(result.redirect, null)
  assert.equal(result.cookieJar.get("NEXT_LOCALE"), "fr")
  assert.equal(result.cookieJar.get("NANCY_LOCALE_MANUAL"), "fr")
  assert.equal(result.storage.get("nancy_locale"), "fr")
})

test("explicit advertorial locale paths remain stable", () => {
  assert.equal(
    runRouter({ pathname: "/advertorial/fiftieslifestyle/fr/", languages: ["de-DE"] }).redirect,
    null,
  )
})

test("a supported lang query is explicit and preserves unrelated URL state", () => {
  assert.equal(
    runRouter({ search: "?lang=fr&utm_campaign=spring", hash: "#offer", languages: ["de-DE"] }).redirect,
    "/advertorial/fiftieslifestyle/fr/?utm_campaign=spring#offer",
  )
  assert.equal(
    runRouter({ search: "?lang=ja&utm_campaign=spring", languages: ["de-DE"] }).redirect,
    null,
    "an unavailable explicit locale must not silently select a different language",
  )
})

test("an explicit English choice persists and keeps the default route English", () => {
  const storage = new Map()
  const cookieJar = new Map()
  const selected = runRouter({
    search: "?lang=en&utm_campaign=spring",
    languages: ["de-DE"],
    storage,
    cookieJar,
  })

  assert.equal(selected.redirect, null)
  assert.equal(storage.get("nancy_locale"), "en")
  assert.equal(cookieJar.get("NEXT_LOCALE"), "en")
  assert.equal(cookieJar.get("NANCY_LOCALE_MANUAL"), "en")

  // Prove the shared cookie works independently of localStorage on a later
  // advertorial family.
  storage.clear()
  const nextPage = runRouter({
    pathname: "/advertorial/menopause/en/",
    languages: ["de-DE"],
    alternates: ["en", "de", "nl", "fr", "sv", "x-default"],
    storage,
    cookieJar,
  })
  assert.equal(nextPage.redirect, null)
})

test("a remembered manual cookie routes an English advertorial", () => {
  const cookieJar = new Map([
    ["NEXT_LOCALE", "fr"],
    ["NANCY_LOCALE_MANUAL", "fr"],
  ])
  const result = runRouter({
    languages: ["de-DE"],
    cookieJar,
    search: "?utm_source=test",
  })

  assert.equal(result.redirect, "/advertorial/fiftieslifestyle/fr/?utm_source=test")
})

test("a locale path persists across advertorial families through localStorage", () => {
  const storage = new Map()
  const cookieJar = new Map()
  const selected = runRouter({
    pathname: "/advertorial/fiftieslifestyle/fr/",
    languages: ["de-DE"],
    storage,
    cookieJar,
  })

  assert.equal(selected.redirect, null)
  assert.equal(storage.get("nancy_locale"), "fr")

  // Prove localStorage works independently of the shared cookie and routes a
  // later English/default advertorial family.
  cookieJar.clear()
  const nextPage = runRouter({
    pathname: "/advertorial/menopause/en/",
    languages: ["de-DE"],
    alternates: ["en", "de", "nl", "fr", "sv", "x-default"],
    storage,
    cookieJar,
  })
  assert.equal(nextPage.redirect, "/advertorial/menopause/fr/")
})

test("an unavailable remembered locale keeps the English fallback", () => {
  const storage = new Map([["nancy_locale", "ja"]])
  const result = runRouter({
    languages: ["de-DE"],
    alternates: ["en", "de", "fr", "x-default"],
    storage,
  })

  assert.equal(result.redirect, null)
})

test("the authored manual language control remains visible", () => {
  const html = readFileSync(
    new URL("../advertorial/menopause-fifty/en/index.html", import.meta.url),
    "utf8",
  )

  assert.match(html, /data-slot="dropdown-menu-trigger"/)
  assert.match(html, /lucide lucide-globe/)
  assert.match(html, />Switch language</)
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
