/*
  Captures the reference Storybook's stories of the components named, the whole viewport, for the
  overlays' grading. The skill's compare harness photographs Storybook's root element alone, and a
  dialog, a sheet, a popover, a menu or a tooltip portals to the body, outside it: the reference it
  keeps of an open overlay shows the page under the overlay's backdrop and nothing of the overlay,
  while the preview's is the whole viewport. This takes Storybook's at the harness's viewport, with
  its stabilization, beside the harness's own shots:
  `ds-bundle/_screenshots/compare/raw/<group>__<Name>__<story>__sb-viewport.png`

  Run it after the harness has captured the components: `bun .design-sync/captureStorybook.ts Dialog Sheet`
*/
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'

const ROOT_PATH = join(import.meta.dir, '..')
const REFERENCE_PATH = join(ROOT_PATH, '.design-sync/sb-reference')
const RAW_PATH = join(ROOT_PATH, 'ds-bundle/_screenshots/compare/raw')

// The skill's scripts and their dependencies live in `.ds-sync/`, outside Bun's lockfile
const require = createRequire(join(ROOT_PATH, '.ds-sync/package.json'))
const { chromium } = require('playwright') as typeof import('playwright')
const { serveDir } = (await import(join(ROOT_PATH, '.ds-sync/storybook/http-serve.mjs'))) as {
  serveDir: (root: string) => Promise<{ srv: { close: () => void }; port: number }>
}

type IndexEntry = { id: string; title: string; name: string; type: string }

const names = process.argv.slice(2)

if (!names.length) {
  console.error('Name the components to capture: bun .design-sync/captureStorybook.ts Dialog Sheet')
  process.exit(1)
}

const index = JSON.parse(readFileSync(join(REFERENCE_PATH, 'index.json'), 'utf8')) as {
  entries: Record<string, IndexEntry>
}
const stories = Object.values(index.entries).filter(
  entry => entry.type === 'story' && names.includes(entry.title.split('/').pop() ?? ''),
)

const { srv, port } = await serveDir(REFERENCE_PATH)
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 900, height: 700 } })

// The harness's stabilization, so both sides show the same settled frame
await page.emulateMedia({ reducedMotion: 'reduce' })
await page.clock.setFixedTime(new Date('2030-01-15T12:00:00Z'))

try {
  for (const story of stories) {
    const [group, ...rest] = story.title.split('/')
    const name = rest.pop()
    const path = join(RAW_PATH, `${group.toLowerCase()}__${name}__${story.id.replace(/-/g, '')}__sb-viewport.png`)

    await page.goto(`http://127.0.0.1:${port}/iframe.html?id=${encodeURIComponent(story.id)}&viewMode=story`, {
      waitUntil: 'networkidle',
    })
    // Storybook marks the body once the story has rendered. Its root can stay empty: a dialog open
    // from the start portals everything to the body, and RichText draws nothing for a value it
    // cannot read, and the harness, which waits for the root's content, refuses both
    await page.waitForSelector('body.sb-show-main, body.sb-show-errordisplay', { timeout: 8000 })
    await page.evaluate(() =>
      Promise.all([document.fonts.ready, ...[...document.images].map(image => image.decode().catch(() => {}))]),
    )
    await page.screenshot({ path, animations: 'disabled' })

    console.log(path)
  }
} finally {
  await browser.close()
  srv.close()
}
