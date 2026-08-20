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
  savedLocale = null,
  cookies = "",
  hostname = "nancyflow.com",
} = {}) {
  const stored = new Map(savedLocale ? [["nancy_locale", savedLocale]] : [])
  const storageAccess = { reads: 0, writes: 0 }
  const cookieAccess = { reads: 0, writes: 0 }
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
    get() {
      cookieAccess.reads += 1
      return cookies
    },
    set() { cookieAccess.writes += 1 },
  })
  const window = {
    location: {
      hostname,
      protocol: "https:",
      search,
      pathname: "/",
      hash: "",
      origin: `https://${hostname}`,
    },
    setTimeout() {},
  }
  const localStorage = {
    getItem(key) {
      storageAccess.reads += 1
      return stored.get(key) ?? null
    },
    setItem(key, value) {
      storageAccess.writes += 1
      stored.set(key, value)
    },
  }

  vm.runInNewContext(source, {
    Promise,
    document,
    fetch: async () => ({ ok: true, json: async () => ({}) }),
    localStorage,
    navigator: { languages, language: languages[0] },
    window,
  })

  return { cookieAccess, documentElement, storageAccess, window }
}

test("browser language automatically selects every translated bridge locale", () => {
  assert.equal(runI18n({ languages: ["nb-NO", "en"] }).window.i18n.locale, "da")

  for (const [tag, expected] of [
    ["cs-CZ", "cs"],
    ["da-DK", "da"],
    ["de-AT", "de"],
    ["el-GR", "el"],
    ["es-MX", "es"],
    ["fi-FI", "fi"],
    ["fr-CA", "fr"],
    ["hr-HR", "hr"],
    ["hu-HU", "hu"],
    ["it-IT", "it"],
    ["ja-JP", "ja"],
    ["ko-KR", "ko"],
    ["nl-BE", "nl"],
    ["pl-PL", "pl"],
    ["pt-BR", "pt"],
    ["ro-RO", "ro"],
    ["sv-SE", "sv"],
    ["zh-CN", "zh-hans"],
    ["zh-TW", "zh-hant"],
  ]) {
    const result = runI18n({ languages: [tag, "en"] })
    assert.equal(result.window.i18n.locale, expected)
    assert.equal(result.documentElement.lang, expected)
  }
})

test("Chinese browser tags select the correct script catalogue", () => {
  for (const [tag, expected] of [
    ["zh", "zh-hans"],
    ["zh-Hans", "zh-hans"],
    ["zh-Hans-HK", "zh-hans"],
    ["zh-CN", "zh-hans"],
    ["zh-SG", "zh-hans"],
    ["zh-MY", "zh-hans"],
    ["zh-Hant", "zh-hant"],
    ["zh-Hant-CN", "zh-hant"],
    ["zh-TW", "zh-hant"],
    ["zh-HK", "zh-hant"],
    ["zh-MO", "zh-hant"],
  ]) {
    assert.equal(runI18n({ languages: [tag, "en"] }).window.i18n.locale, expected)
  }
})

test("language hosts pin localization without reading a saved preference", () => {
  for (const [hostname, expected] of [
    ["nancyflow.de", "de"],
    ["nancyflow.nl", "nl"],
    ["nancyflow.fr", "fr"],
    ["nancyflow.se", "sv"],
  ]) {
    const result = runI18n({
      hostname,
      languages: ["it-IT", "en"],
      search: "?lang=es",
      savedLocale: "da",
      cookies: "NEXT_LOCALE=pt; NANCY_LOCALE_MANUAL=pt",
    })
    assert.equal(result.window.i18n.locale, expected)
    assert.deepEqual(result.storageAccess, { reads: 0, writes: 0 })
    assert.deepEqual(result.cookieAccess, { reads: 0, writes: 0 })
  }
})

test("legacy query, cookie, and localStorage preferences are ignored", () => {
  const result = runI18n({
    languages: ["de-DE", "en"],
    search: "?lang=fr&utm_source=test",
    savedLocale: "sv",
    cookies: "NEXT_LOCALE=it; NANCY_LOCALE_MANUAL=it",
  })

  assert.equal(result.window.i18n.locale, "de")
  assert.equal(result.documentElement.lang, "de")
  assert.deepEqual(result.storageAccess, { reads: 0, writes: 0 })
  assert.deepEqual(result.cookieAccess, { reads: 0, writes: 0 })
})

test("the public runtime exposes translation only, with no manual switch API", () => {
  const result = runI18n({ languages: ["en-US"] })

  assert.equal(result.window.i18n.setLocale, undefined)
  assert.deepEqual(
    Object.keys(result.window.i18n).sort(),
    ["locale", "page", "ready", "supported", "t"],
  )
  assert.doesNotMatch(source, /document\.cookie|localStorage|sessionStorage/)
  assert.doesNotMatch(source, /window\.location\.(?:assign|reload|replace)/)
})

function htmlFiles(directory) {
  return readdirSync(directory).flatMap((name) => {
    // Advertorials use pretranslated HTML paths. /unlock is a separately
    // generated English-only React build, not a shared JSON page.
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
