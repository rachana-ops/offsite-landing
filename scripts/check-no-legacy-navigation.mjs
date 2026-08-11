import { readdir, readFile } from "node:fs/promises"
import path from "node:path"

const ROOT = process.cwd()
const IGNORED_DIRECTORIES = new Set([".git", ".vercel", "node_modules"])
const TEXT_EXTENSIONS = new Set([".css", ".html", ".js", ".json"])
const LEGACY_URL =
  /(?:https?:)?\/\/(?:[a-z0-9-]+\.)*hellonancy\.com(?::\d+)?(?:[/?#][^\s"'`<>{}\]\\)]*)?/gi

async function collectFiles(directory = ".") {
  const entries = await readdir(path.join(ROOT, directory), {
    withFileTypes: true,
  })
  const files = []

  for (const entry of entries) {
    if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) continue

    const relativePath = path.posix.join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(relativePath)))
    } else if (TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      files.push(relativePath)
    }
  }

  return files
}

function lineNumber(source, offset) {
  return source.slice(0, offset).split("\n").length
}

const failures = []
const files = await collectFiles()

for (const relativePath of files) {
  const source = await readFile(path.join(ROOT, relativePath), "utf8")
  for (const match of source.matchAll(LEGACY_URL)) {
    const normalized = match[0].startsWith("//")
      ? `https:${match[0]}`
      : match[0]
    const url = new URL(normalized)

    // These static pages still load a few Shopify-hosted media resources.
    // They are not navigation and remain allowed until fully mirrored locally.
    if (url.pathname.startsWith("/cdn/")) continue

    failures.push({
      file: relativePath.replace(/^\.\//, ""),
      line: lineNumber(source, match.index),
      url: match[0],
    })
  }
}

if (failures.length) {
  console.error(
    "\nLegacy Hello Nancy navigation is forbidden; use get.nancyflow.* instead:\n"
  )
  for (const failure of failures) {
    console.error(`  ${failure.file}:${failure.line}  ${failure.url}`)
  }
  console.error("")
  process.exit(1)
}

console.log(
  `No legacy hellonancy.com navigation found across ${files.length} bridge files.`
)
