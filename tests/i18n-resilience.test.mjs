import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import vm from "node:vm"

const source = readFileSync(new URL("../js/i18n.js", import.meta.url), "utf8")

function runI18n(search) {
  const documentElement = {
    lang: "en",
    getAttribute(name) {
      return name === "data-i18n-page" ? "index" : null
    },
    classList: { add() {}, remove() {} },
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
  const window = {
    location: {
      hostname: "nancyflow.com",
      origin: "https://nancyflow.com",
      pathname: "/",
      search,
      hash: "",
      reload() {},
      assign() {},
    },
    setTimeout() {},
  }
  const localStorage = {
    getItem() { return null },
    setItem() {},
  }

  vm.runInNewContext(source, {
    Promise,
    decodeURIComponent,
    document,
    fetch: async () => ({ ok: true, json: async () => ({}) }),
    localStorage,
    navigator: { languages: ["de-DE", "en"], language: "de-DE" },
    window,
  })

  return { documentElement, window }
}

test("a malformed lang query cannot abort bridge localization", () => {
  const result = runI18n("?lang=%E0%A4%A&utm_source=test")
  assert.equal(result.window.i18n.locale, "de")
  assert.equal(result.documentElement.lang, "de")
})
