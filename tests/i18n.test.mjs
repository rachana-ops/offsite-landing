import assert from "node:assert/strict"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"
import vm from "node:vm"

const source = readFileSync(new URL("../js/i18n.js", import.meta.url), "utf8")
const locales = [
  "cs", "da", "de", "el", "es", "fi", "fr", "hr", "hu", "it",
  "ja", "ko", "nl", "pl", "pt", "ro", "sv", "zh-hans", "zh-hant",
]

function runI18n({
  languages = ["en-US"],
  search = "",
  legacySavedLocale = null,
  selectedLocale = null,
  cookies = "",
  hostname = "nancyflow.com",
}) {
  const stored = new Map()
  if (legacySavedLocale) stored.set("nancy_locale", legacySavedLocale)
  if (selectedLocale) stored.set("nancy_locale_selected_v2", selectedLocale)
  const cookieWrites = []
  let assignedUrl = null
  let reloads = 0
  const classNames = new Set()
  const documentElement = {
    lang: "en",
    getAttribute(name) {
      return name === "data-i18n-page" ? "index" : null
    },
    classList: {
      add(name) { classNames.add(name) },
      remove(name) { classNames.delete(name) },
    },
  }
  const document = {
    currentScript: { src: `https://${hostname}/js/i18n.js` },
    documentElement,
    head: { appendChild() {} },
    readyState: "complete",
    createElement() { return { id: "", textContent: "" } },
    getElementById() { return null },
    querySelectorAll() { return [] },
    addEventListener() {},
  }
  Object.defineProperty(document, "cookie", {
    get() { return cookies },
    set(value) { cookieWrites.push(value) },
  })
  const window = {
    location: {
      hostname,
      protocol: "https:",
      search,
      pathname: "/",
      hash: "",
      reload() { reloads += 1 },
      assign(url) { assignedUrl = url },
      origin: `https://${hostname}`,
    },
    setTimeout() {},
  }
  const localStorage = {
    getItem(key) { return stored.get(key) ?? null },
    setItem(key, value) { stored.set(key, value) },
  }

  vm.runInNewContext(source, {
    Promise,
    decodeURIComponent,
    document,
    fetch: async () => ({ ok: true, json: async () => ({}) }),
    localStorage,
    navigator: { languages, language: languages[0] },
    window,
  })

  return {
    get assignedUrl() { return assignedUrl },
    cookieWrites,
    documentElement,
    get reloads() { return reloads },
    stored,
    window,
  }
}

test("browser language never switches a first-time bridge visitor", () => {
  for (const tag of ["de-DE", "fr-CA", "ja-JP", "nb-NO", "zh-TW"]) {
    const result = runI18n({ languages: [tag, "en"] })
    assert.equal(result.window.i18n.locale, "en", tag)
    assert.equal(result.documentElement.lang, "en", tag)
    assert.deepEqual(result.cookieWrites, [], tag)
  }
  assert.doesNotMatch(source, /navigator\.(?:languages|language|userLanguage)/)
})

test("bare language queries never switch or persist a bridge locale", () => {
  for (const tag of ["fr", "de-AT", "nb-NO", "zh-TW"]) {
    const result = runI18n({
      languages: ["fr-FR"],
      search: `?lang=${encodeURIComponent(tag)}`,
    })
    assert.equal(result.window.i18n.locale, "en", tag)
    assert.equal(result.documentElement.lang, "en", tag)
    assert.equal(result.stored.size, 0, tag)
    assert.deepEqual(result.cookieWrites, [], tag)
  }
})

test("legacy locale state cannot override the English default", () => {
  const result = runI18n({
    languages: ["de-DE", "en"],
    search: "?lang=fr&utm_source=meta",
    legacySavedLocale: "fr",
    cookies: "NEXT_LOCALE=fr; NANCY_LOCALE_MANUAL=fr",
  })
  assert.equal(result.window.i18n.locale, "en")
  assert.equal(result.documentElement.lang, "en")
  assert.deepEqual(result.cookieWrites, [])
})

test("a malformed lang query cannot abort bridge localization", () => {
  const result = runI18n({
    languages: ["de-DE", "en"],
    search: "?lang=%E0%A4%A&utm_source=test",
  })
  assert.equal(result.window.i18n.locale, "en")
  assert.equal(result.documentElement.lang, "en")
})

test("the selector shares its V2 locale with the storefront subdomain", () => {
  const result = runI18n({ languages: ["en"] })
  result.window.i18n.setLocale("fr")
  assert.equal(result.stored.get("nancy_locale_selected_v2"), "fr")
  assert.ok(
    result.cookieWrites.some((cookie) =>
      cookie.includes("NEXT_LOCALE=fr") && cookie.includes("Domain=.nancyflow.com")
    )
  )
  assert.ok(
    result.cookieWrites.some((cookie) =>
      cookie.includes("NANCY_LOCALE_SELECTED_V2=fr") && cookie.includes("Domain=.nancyflow.com")
    )
  )
})

test("every live Nancyflow apex shares selector-owned locale cookies with its storefront", () => {
  for (const hostname of [
    "nancyflow.com",
    "nancyflow.co.uk",
    "nancyflow.ca",
    "nancyflow.co.nz",
    "nancyflow.de",
    "nancyflow.nl",
    "nancyflow.fr",
    "nancyflow.se",
  ]) {
    const result = runI18n({ languages: ["en"], hostname })
    result.window.i18n.setLocale("fr")
    for (const name of ["NEXT_LOCALE", "NANCY_LOCALE_SELECTED_V2"]) {
      assert.ok(
        result.cookieWrites.some((cookie) =>
          cookie.startsWith(`${name}=fr;`) && cookie.includes(`Domain=.${hostname}`)
        ),
        `${hostname} must share ${name} with get.${hostname}`
      )
    }
  }

  const preview = runI18n({
    languages: ["en"],
    hostname: "nancy-bridge-preview.vercel.app",
  })
  preview.window.i18n.setLocale("fr")
  assert.ok(preview.cookieWrites.every((cookie) => !cookie.includes("Domain=")))
})

test("a selector-owned storefront choice is reused on the bridge", () => {
  const result = runI18n({
    languages: ["en-US"],
    cookies: "NEXT_LOCALE=sv; NANCY_LOCALE_SELECTED_V2=sv",
  })
  assert.equal(result.window.i18n.locale, "sv")
  assert.equal(result.documentElement.lang, "sv")
})

test("the V2 selector marker wins over conflicting legacy state and query", () => {
  const result = runI18n({
    languages: ["en-US"],
    search: "?lang=de",
    legacySavedLocale: "de",
    cookies: "NEXT_LOCALE=en; NANCY_LOCALE_MANUAL=de; NANCY_LOCALE_SELECTED_V2=fr",
  })
  assert.equal(result.window.i18n.locale, "fr")
})

test("selector-owned V2 storage beats browser language", () => {
  const result = runI18n({
    languages: ["de-DE"],
    selectedLocale: "fr",
  })

  assert.equal(result.window.i18n.locale, "fr")
  assert.equal(result.documentElement.lang, "fr")
  assert.deepEqual(result.cookieWrites, [])
})

test("every market hostname defaults to English without a selector choice", () => {
  for (const hostname of [
    "nancyflow.com",
    "nancyflow.co.uk",
    "nancyflow.ca",
    "nancyflow.co.nz",
    "nancyflow.de",
    "nancyflow.nl",
    "nancyflow.fr",
    "nancyflow.se",
    "nancyflow.dk",
    "nancyflow.it",
  ]) {
    const result = runI18n({ hostname, languages: ["it-IT"] })
    assert.equal(result.window.i18n.locale, "en", hostname)
    assert.equal(result.documentElement.lang, "en", hostname)
    assert.deepEqual(result.cookieWrites, [], hostname)
  }
})

test("the manual setLocale API persists and applies a visitor choice", () => {
  const sameHost = runI18n({
    languages: ["de-DE"],
    search: "?lang=fr&utm_source=test",
  })
  sameHost.window.location.pathname = "/bridge-page/"
  sameHost.window.location.hash = "#offer"
  sameHost.window.i18n.setLocale("de")
  assert.equal(sameHost.stored.get("nancy_locale_selected_v2"), "de")
  assert.equal(sameHost.reloads, 0)
  assert.equal(
    sameHost.assignedUrl,
    "/bridge-page/?utm_source=test&lang=de#offer",
  )
  assert.ok(sameHost.cookieWrites.some((cookie) => cookie.includes("NEXT_LOCALE=de")))
  assert.ok(sameHost.cookieWrites.some((cookie) => cookie.includes("NANCY_LOCALE_SELECTED_V2=de")))

  const languageHost = runI18n({
    hostname: "nancyflow.de",
    languages: ["fr-FR"],
    search: "?utm_source=test",
  })
  languageHost.window.location.hash = "#offer"
  languageHost.window.i18n.setLocale("it")
  assert.equal(
    languageHost.assignedUrl,
    "/?utm_source=test&lang=it#offer",
  )
  assert.equal(languageHost.stored.get("nancy_locale_selected_v2"), "it")
  assert.ok(
    languageHost.cookieWrites.some((cookie) =>
      cookie.includes("NANCY_LOCALE_SELECTED_V2=it") && cookie.includes("Domain=.nancyflow.de")
    )
  )
})

function htmlFiles(directory) {
  return readdirSync(directory).flatMap((name) => {
    // Advertorials route between pretranslated HTML files. /unlock is a
    // separately generated English-only React build, not a shared JSON page.
    if (["advertorial", "unlock"].includes(name) || name.startsWith(".")) return []
    const path = join(directory, name)
    return statSync(path).isDirectory()
      ? htmlFiles(path)
      : name.endsWith(".html")
        ? [path]
        : []
  })
}

test("every shared bridge page has complete dictionaries for every locale", () => {
  const root = new URL("..", import.meta.url)
  const rootPath = root.pathname

  for (const file of htmlFiles(rootPath)) {
    const html = readFileSync(file, "utf8")
    const pageMatch = html.match(/data-i18n-page="([^"]+)"/)
    assert.ok(pageMatch, `${file} is missing data-i18n-page`)
    assert.match(html, /<script\b[^>]*\bsrc="[^"]*js\/i18n\.js"/, `${file} is missing the i18n runtime`)

    const page = pageMatch[1]
    const keys = new Set(
      [...html.matchAll(/data-i18n(?:-[a-z-]+)?="([^"]+)"/g)]
        .map((match) => match[1])
        .filter((key) => key !== page)
    )
    for (const match of html.matchAll(/(?:window\.)?i18n\.t\(\s*['"]([^'"]+)['"]/g)) {
      keys.add(match[1])
    }

    for (const locale of locales) {
      const dictionary = JSON.parse(
        readFileSync(new URL(`../i18n/${locale}/${page}.json`, import.meta.url), "utf8")
      )
      const missing = [...keys].filter((key) => !(key in dictionary))
      assert.deepEqual(missing, [], `${locale}/${page}.json is incomplete for ${file}`)
    }
  }
})
