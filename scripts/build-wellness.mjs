import { build } from "esbuild";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, readdirSync, unlinkSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const result = await build({
  entryPoints: ["src/wellness/main.tsx"],
  bundle: true,
  minify: true,
  format: "esm",
  jsx: "automatic",
  alias: { "@": path.join(root, "src/wellness") },
  define: { "process.env.NODE_ENV": '"production"' },
  write: false,
  legalComments: "eof",
});
const javascript = result.outputFiles[0].text;
const css = execFileSync(process.execPath, ["node_modules/@tailwindcss/cli/dist/index.mjs", "-i", "src/wellness/index.css", "--minify"], { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
const hash = (value) => createHash("sha256").update(value).digest("hex").slice(0, 12);
const jsName = `index-${hash(javascript)}.js`;
const cssName = `index-${hash(css)}.css`;
for (const name of readdirSync("unlock/assets")) {
  if (/^index-.*\.(js|css)$/.test(name)) unlinkSync(path.join("unlock/assets", name));
}
writeFileSync(path.join("unlock/assets", jsName), javascript);
writeFileSync(path.join("unlock/assets", cssName), css);
let html = readFileSync("src/wellness/index.template", "utf8");
html = html.replace("<!-- WELLNESS_SCRIPT -->", `<script type="module" crossorigin src="/unlock/assets/${jsName}"></script>`)
  .replace("<!-- WELLNESS_STYLE -->", `<link rel="stylesheet" crossorigin href="/unlock/assets/${cssName}">`);
writeFileSync("unlock/index.html", html);
console.log(`Built Wellness guide: ${jsName}, ${cssName}`);
