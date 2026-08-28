import assert from "node:assert/strict"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import test from "node:test"
import vm from "node:vm"

const source = readFileSync(new URL("../js/i18n.js", import.meta.url), "utf8")
const locales = [
  "cs", "da", "de", "el", "es", "fi", "fr", "hr", "hu", "it",
  "ja", "ko", "nl", "pl", "pt", "ro", "sv", "zh-hans", "zh-hant",
]

function runI18n({ languages, search = "", savedLocale = null, cookies = "" }) {
  const stored = new Map(savedLocale ? [["nancy_locale", savedLocale]] : [])
  const cookieWrites = []
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
    currentScript: { src: "https://nancyflow.com/js/i18n.js" },
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
      hostname: "nancyflow.com",
      protocol: "https:",
      search,
      pathname: "/",
      hash: "",
      reload() {},
      assign() {},
      origin: "https://nancyflow.com",
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

  return { cookieWrites, documentElement, stored, window }
}

test("browser language automatically selects the translated bridge locale", () => {
  const automatic = runI18n({ languages: ["de-DE", "en"] })
  assert.equal(automatic.window.i18n.locale, "de")
  assert.equal(automatic.documentElement.lang, "de")
  assert.deepEqual(
    automatic.cookieWrites,
    [],
    "automatic detection must not masquerade as a deliberate language choice"
  )
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
    assert.equal(runI18n({ languages: [tag, "en"] }).window.i18n.locale, expected)
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

test("legacy unmarked storefront cookies do not defeat automatic detection", () => {
  const result = runI18n({
    languages: ["de-DE", "en"],
    cookies: "NEXT_LOCALE=en",
  })
  assert.equal(result.window.i18n.locale, "de")
})

test("a malformed lang query cannot abort bridge localization", () => {
  const result = runI18n({
    languages: ["de-DE", "en"],
    search: "?lang=%E0%A4%A&utm_source=test",
  })
  assert.equal(result.window.i18n.locale, "de")
  assert.equal(result.documentElement.lang, "de")
})

test("an explicit bridge locale is shared with the storefront subdomain", () => {
  const result = runI18n({ languages: ["en"], search: "?lang=fr" })
  assert.equal(result.window.i18n.locale, "fr")
  assert.equal(result.stored.get("nancy_locale"), "fr")
  assert.ok(
    result.cookieWrites.some((cookie) =>
      cookie.includes("NEXT_LOCALE=fr") && cookie.includes("Domain=.nancyflow.com")
    )
  )
  assert.ok(
    result.cookieWrites.some((cookie) =>
      cookie.includes("NANCY_LOCALE_MANUAL=fr") && cookie.includes("Domain=.nancyflow.com")
    )
  )
})

test("a deliberate storefront choice is reused on the bridge", () => {
  const result = runI18n({
    languages: ["en-US"],
    cookies: "NEXT_LOCALE=sv; NANCY_LOCALE_MANUAL=sv",
  })
  assert.equal(result.window.i18n.locale, "sv")
  assert.equal(result.stored.get("nancy_locale"), "sv")
})

test("the explicit locale marker wins over a conflicting legacy cookie", () => {
  const result = runI18n({
    languages: ["en-US"],
    cookies: "NEXT_LOCALE=en; NANCY_LOCALE_MANUAL=fr",
  })
  assert.equal(result.window.i18n.locale, "fr")
})

function htmlFiles(directory) {
  return readdirSync(directory).flatMap((name) => {
    // advertorial/ ships one directory per language; lem-lander/ is a
    // standalone English-only lander. Neither uses the shared dictionaries.
    if (name === "advertorial" || name === "lem-lander" || name.startsWith(".")) return []
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
    // The homepage is now the English-only Lem lander (same page as
    // lem-lander/), so it carries no shared dictionary either.
    if (relative(rootPath, file) === "index.html") continue

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
