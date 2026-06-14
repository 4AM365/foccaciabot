// scripts/publish.mjs — publish foccaciabot and propagate the change to the blog.
//
// Flow (update foccaciabot → integrate into the blog → push both):
//   1. foccaciabot: stage all tracked changes, commit, push.
//   2. blog: `npm update focaccia-widget` (pull the new commit), rebuild the
//      widget bundle, sync docs/focaccia-model.md → content/kitchen/focaccia-model.md,
//      stage just those artifacts, commit, push (push auto-deploys the site).
//
// Usage:  node scripts/publish.mjs "commit message"
//         npm run publish:blog -- "commit message"
//
// The blog repo path defaults to ../../ventures/4AM365.github.io (standard C:\Code
// layout); override with the BLOG_DIR env var. Any step failing aborts the whole
// run, so the blog is never left half-integrated.

import { execSync } from "node:child_process"
import { existsSync, copyFileSync } from "node:fs"
import { resolve, dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const FOCACCIA_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const BLOG_DIR = resolve(
  process.env.BLOG_DIR ?? join(FOCACCIA_DIR, "..", "..", "ventures", "4AM365.github.io"),
)

const message = process.argv.slice(2).join(" ").trim()
if (!message) {
  console.error('Usage: node scripts/publish.mjs "commit message"')
  process.exit(1)
}
if (!existsSync(BLOG_DIR)) {
  console.error(`Blog repo not found at ${BLOG_DIR} (set BLOG_DIR to override).`)
  process.exit(1)
}

const sh = (cmd, cwd) => {
  console.log(`\n$ ${cmd}`)
  execSync(cmd, { cwd, stdio: "inherit" })
}
const out = (cmd, cwd) => execSync(cmd, { cwd, encoding: "utf8" }).trim()

// --- 1. foccaciabot: commit + push ------------------------------------------
console.log("=== foccaciabot ===")
if (out("git status --porcelain", FOCACCIA_DIR)) {
  sh("git add -A", FOCACCIA_DIR)
  sh(`git commit -m ${JSON.stringify(message)}`, FOCACCIA_DIR)
} else {
  console.log("(no working-tree changes to commit)")
}
sh("git push", FOCACCIA_DIR)

// --- 2. blog: pull dep, rebuild widget, sync doc, commit + push --------------
console.log("\n=== blog ===")
sh("npm update focaccia-widget", BLOG_DIR)
sh("npm run build:widgets", BLOG_DIR)

const docSrc = join(FOCACCIA_DIR, "docs", "focaccia-model.md")
const docDst = join(BLOG_DIR, "content", "kitchen", "focaccia-model.md")
if (existsSync(docSrc)) {
  console.log(`\nsync model doc → ${docDst}`)
  copyFileSync(docSrc, docDst)
}

const artifacts = [
  "quartz/static/widgets/focaccia.js",
  "content/kitchen/focaccia-model.md",
  "package.json",
  "package-lock.json",
]
sh(`git add ${artifacts.join(" ")}`, BLOG_DIR)
if (out("git diff --cached --name-only", BLOG_DIR)) {
  sh(`git commit -m ${JSON.stringify("widget: " + message)}`, BLOG_DIR)
  sh("git push", BLOG_DIR)
} else {
  console.log("(blog: no artifact changes to commit)")
}

console.log("\n✓ published foccaciabot → blog")
