/*
  Builds the package the design sync's converter reads: the design system's component modules
  re-exported from one entry, which it bundles into `window.StrategyDanceDesignSystem`, their
  declarations, which it reads the components' props from, and the stylesheet, Tailwind's output
  with the fonts it loads, which no component imports.

  The design system ships TypeScript source and no root export, since its consumers import each
  component by its path, and the converter wants a built package: an entry, and a `package.json`
  whose `types` leads to a `.d.ts` tree. It finds the package by walking up from the entry to the
  first `package.json` with a name, so this one is written whole under the design system's
  `node_modules`, which git ignores, and names itself as the design system does.

  Run it before the converter: `bun .design-sync/buildPackage.ts`
*/
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const DESIGN_SYSTEM_PATH = join(import.meta.dir, '../packages/strategydance-design-system')
const COMPONENTS_PATH = join(DESIGN_SYSTEM_PATH, 'src/components')
const PACKAGE_PATH = join(DESIGN_SYSTEM_PATH, 'node_modules/.cache/design-sync')
const TYPES_PATH = join(PACKAGE_PATH, 'types')

// Modules only other components draw: the parts of the editor and of its mentions, which only
// `RichTextEditor` and `RichText` draw, and `Choice`, the row Checkbox, Radio and Switch lay out in
const INTERNAL_MODULE_PATTERN =
  /^ui\/(Choice|RichText(EditorFilePanel|EditorMentionMenu|EditorSideMenu|EditorSlashMenu|EditorToolbar|Mention))\.tsx$/

const modules = readdirSync(COMPONENTS_PATH, { recursive: true, encoding: 'utf8' })
  .filter(path => path.endsWith('.tsx') && !path.endsWith('.stories.tsx') && !path.endsWith('.test.tsx'))
  .filter(path => !INTERNAL_MODULE_PATTERN.test(path))
  .sort()

rmSync(PACKAGE_PATH, { recursive: true, force: true })
mkdirSync(PACKAGE_PATH, { recursive: true })

writeJson('package.json', {
  name: 'strategydance-design-system',
  private: true,
  version: '0.0.0',
  type: 'module',
  types: 'types/entry.d.ts',
})

// The design system's own settings, its alias to itself included, emitting declarations alone
writeJson('tsconfig.json', {
  extends: relative(PACKAGE_PATH, join(DESIGN_SYSTEM_PATH, 'tsconfig.app.json')),
  compilerOptions: {
    noEmit: false,
    declaration: true,
    emitDeclarationOnly: true,
    rootDir: relative(PACKAGE_PATH, join(DESIGN_SYSTEM_PATH, 'src')),
    outDir: 'types',
    tsBuildInfoFile: 'tsconfig.tsbuildinfo',
  },
  files: modules.map(path => relative(PACKAGE_PATH, join(COMPONENTS_PATH, path))),
  include: [],
})

writeFileSync(
  join(PACKAGE_PATH, 'entry.ts'),
  toExportLines(path => relative(PACKAGE_PATH, join(COMPONENTS_PATH, path))),
)

// Run from the package, so the paths tsc reports start from it
const compilation = Bun.spawnSync([join(DESIGN_SYSTEM_PATH, 'node_modules/.bin/tsc'), '-p', '.'], { cwd: PACKAGE_PATH })
const diagnostics = compilation.stdout
  .toString()
  .split('\n')
  .filter(line => /error TS\d+/.test(line))

// tsc writes every file's declarations whatever it reports. It reports a type it cannot name
// portably through Bun's store (TS2883), which lands in the modules the components import, never
// in a component's own: anything else, or anything in a component, is a declaration that is wrong
const blocking = diagnostics.filter(
  line => !line.includes('error TS2883') || line.startsWith('../../../src/components/'),
)

if (blocking.length) {
  console.error(blocking.join('\n'))
  process.exit(1)
}

writeFileSync(
  join(TYPES_PATH, 'entry.d.ts'),
  toExportLines(path => `./components/${path.replace(/\.tsx$/, '')}`),
)

/*
  The stylesheet is `index.css` built as Storybook builds it, through the design system's own
  Tailwind plugin from the design system's root, so it holds the classes Storybook's does. The
  converter appends it to the CSS the components import, and copies the fonts its `url()`s name,
  which it reads beside the file: hence relative addresses and the fonts' own names
*/
writeFileSync(
  join(PACKAGE_PATH, 'vite.config.mjs'),
  `import tailwindcss from '@tailwindcss/vite'

export default {
  root: ${JSON.stringify(DESIGN_SYSTEM_PATH)},
  base: './',
  logLevel: 'warn',
  plugins: [tailwindcss()],
  build: {
    outDir: ${JSON.stringify(join(PACKAGE_PATH, 'styles'))},
    emptyOutDir: true,
    assetsInlineLimit: 0,
    rolldownOptions: {
      input: { styles: ${JSON.stringify(join(DESIGN_SYSTEM_PATH, 'src/index.css'))} },
      output: { assetFileNames: '[name][extname]' },
    },
  },
}
`,
)

const styling = Bun.spawnSync(
  [join(DESIGN_SYSTEM_PATH, 'node_modules/.bin/vite'), 'build', '--config', join(PACKAGE_PATH, 'vite.config.mjs')],
  { cwd: DESIGN_SYSTEM_PATH },
)

if (styling.exitCode !== 0) {
  console.error(styling.stderr.toString())
  process.exit(1)
}

console.log(
  `Built ${relative(process.cwd(), PACKAGE_PATH)}: ${modules.length} modules, ${diagnostics.length} declaration warnings`,
)

function writeJson(name: string, value: unknown) {
  writeFileSync(join(PACKAGE_PATH, name), `${JSON.stringify(value, null, 2)}\n`)
}

function toExportLines(toSpecifier: (path: string) => string) {
  return `${modules.map(path => `export * from '${toSpecifier(path)}'`).join('\n')}\n`
}
