/*
  Runs every example the design agent is given, each ```jsx block of the usage notes and of the
  conventions, as written, in a page that loads the upload as a design does: React from
  `_vendor/react.js`, then `styles.css` and `_ds_bundle.js`. No capture renders them, and
  `checkNames.ts` reads their names alone, so this is what says they run: it fails on a block that
  does not compile, throws, logs an error or draws nothing, and leaves a screenshot of each in
  `ds-bundle/_screenshots/examples/` to look at.

  A block ends with the JSX it draws, or with the component it declares last, which it then draws.

  Run it after the converter, from the repository's root: `bun .design-sync/runExamples.ts`, or
  `bun .design-sync/runExamples.ts Button Dialog` for those components' notes alone
*/
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT_PATH = join(import.meta.dir, '..')
const BUNDLE_PATH = join(ROOT_PATH, 'ds-bundle')
const DOCS_PATH = join(import.meta.dir, 'docs')
const SCREENSHOTS_PATH = join(BUNDLE_PATH, '_screenshots/examples')

// The skill's scripts and their dependencies live in `.ds-sync/`, outside Bun's lockfile
const require = createRequire(join(ROOT_PATH, '.ds-sync/package.json'))
const { chromium } = require('playwright') as typeof import('playwright')
const esbuild = require('esbuild') as typeof import('esbuild')

const names = process.argv.slice(2)
const sources = [
  ...readdirSync(DOCS_PATH).map(file => ({ name: file.replace(/\.md$/, ''), path: join(DOCS_PATH, file) })),
  { name: 'conventions', path: join(import.meta.dir, 'conventions.md') },
].filter(source => !names.length || names.includes(source.name))

rmSync(SCREENSHOTS_PATH, { recursive: true, force: true })
mkdirSync(SCREENSHOTS_PATH, { recursive: true })

const pagePath = join(SCREENSHOTS_PATH, 'page.html')

writeFileSync(
  pagePath,
  `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <link rel="stylesheet" href="${pathToFileURL(join(BUNDLE_PATH, 'styles.css'))}">
    <script src="${pathToFileURL(join(BUNDLE_PATH, '_vendor/react.js'))}"></script>
    <script src="${pathToFileURL(join(BUNDLE_PATH, '_vendor/react-dom.js'))}"></script>
    <script src="${pathToFileURL(join(BUNDLE_PATH, '_ds_bundle.js'))}"></script>
  </head>
  <body><div id="root"></div></body>
</html>
`,
)

const browser = await chromium.launch()
const failures: string[] = []
let count = 0

try {
  for (const source of sources) {
    const blocks = Array.from(
      readFileSync(source.path, 'utf8').matchAll(/^```jsx\n([\s\S]*?)^```/gm),
      match => match[1],
    )

    for (const [index, code] of blocks.entries()) {
      const label = `${source.name} #${index + 1}`
      const problems = await runBlock(code, `${source.name}-${index + 1}`)

      count++
      if (problems.length) failures.push(`${label}\n  ${problems.join('\n  ')}`)
    }
  }
} finally {
  await browser.close()
}

if (failures.length) {
  console.error(failures.join('\n'))
  console.error(`\n${failures.length} of ${count} examples failed`)
  process.exit(1)
}

console.log(`Ran ${count} examples: every one draws without an error`)

async function runBlock(code: string, screenshotName: string) {
  const problems: string[] = []
  let script: string

  try {
    const wrapped = `(() => {
const __render = element => ReactDOM.createRoot(document.getElementById('root')).render(element)
${toRenderedScript(code)}
})()`

    script = (
      await esbuild.transform(wrapped, {
        loader: 'jsx',
        jsxFactory: 'React.createElement',
        jsxFragment: 'React.Fragment',
      })
    ).code
  } catch (error) {
    return [`does not compile: ${(error as Error).message.split('\n').slice(0, 3).join(' ')}`]
  }

  const context = await browser.newContext({ viewport: { width: 1100, height: 800 } })
  const page = await context.newPage()

  page.on('pageerror', error => problems.push(`throws: ${error.message.split('\n')[0]}`))
  page.on('console', message => {
    if (message.type() === 'error') problems.push(`logs: ${message.text().split('\n')[0].slice(0, 200)}`)
  })

  try {
    await page.goto(pathToFileURL(pagePath).href)
    await page.addScriptTag({ content: script })
    await page.waitForTimeout(600)

    // An overlay open from the start portals to the body, beside the root
    const isEmpty = await page.evaluate(
      () => !document.getElementById('root')?.childElementCount && document.body.childElementCount <= 1,
    )

    if (isEmpty) problems.push('draws nothing')

    await page.screenshot({ path: join(SCREENSHOTS_PATH, `${screenshotName}.png`) })
  } finally {
    await context.close()
  }

  return problems
}

// Draws what the block ends with: its JSX, from the line that opens it, or else its last component
function toRenderedScript(code: string) {
  const lines = code.trimEnd().split('\n')

  for (let index = lines.length - 1; index >= 0; index--) {
    const line = lines[index]

    if (/^<[^/]/.test(line)) return [...lines.slice(0, index), '__render(', ...lines.slice(index), ')'].join('\n')

    // Inside the JSX: its indented lines, its closing tags and the end of its opening tag
    if (!line || /^\s/.test(line) || /^(<\/|\/?>|[)\]}])/.test(line)) continue

    break
  }

  const components = Array.from(code.matchAll(/^function ([A-Z]\w*)/gm), match => match[1])

  if (!components.length) throw new Error('it ends with no JSX and declares no component')

  return `${code}\n__render(<${components.at(-1)} />)`
}
