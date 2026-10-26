/*
  Checks every name the design agent is told against the build it is told about: the props each
  component's `dtsPropsFor` body declares, the global names, icons, recharts' parts, classes and
  tokens the usage notes and the conventions use, the layout vocabulary, and the fonts. The
  converter checks none of it: a prop renamed upstream, a part that does not exist or a class
  nothing compiled would ship as written, and the agent would build with it.

  Run it from the repository's root after `buildPackage.ts`, the reference Storybook and the
  converter, since it reads the stand-in package's declarations, the stories' index and the built
  `ds-bundle/`'s stylesheet: `bun .design-sync/checkNames.ts`.
  `--only <Name,…>` checks those components alone, and `--props <dir>` reads a component's body
  from `<dir>/<Name>.txt` rather than from the config, for drafts
*/
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { parseArgs } from 'node:util'

import type * as TsMorph from '../.ds-sync/node_modules/ts-morph'

import { LAYOUT_CLASSES, expandClassPattern } from './layoutClasses'
import { RECHARTS_PARTS } from './rechartsParts'

const ROOT_PATH = join(import.meta.dir, '..')
const DESIGN_SYSTEM_PATH = join(ROOT_PATH, 'packages/strategydance-design-system')
const PACKAGE_PATH = join(DESIGN_SYSTEM_PATH, 'node_modules/.cache/design-sync')
const TYPES_PATH = join(PACKAGE_PATH, 'types')
const BUNDLE_PATH = join(ROOT_PATH, 'ds-bundle')
const DOCS_PATH = join(import.meta.dir, 'docs')
const CONVENTIONS_PATH = join(import.meta.dir, 'conventions.md')
const GLOBAL_NAME = 'StrategyDanceDesignSystem'

// The converter cuts a usage note past this many characters (`DOC_BODY_CAP` in its `docs.mjs`)
const MAX_DOC_LENGTH = 8000

// The faces the upload ships, which `runtimeFontPrefixes` would hide the loss of from validate
const SHIPPED_FONT_FAMILIES = ['Inter Variable', 'Oswald Variable']

// A class named in prose, by what it starts with, so a prop or an attribute in backticks is left
// alone: `size` and `aria-label` are none
const CLASS_PATTERN =
  /^(sm:|md:|lg:|hover:)?((bg|text|border|font|rounded|shadow|ring|outline|p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|gap|gap-x|gap-y|grid-cols|grid-rows|col-span|row-span|flex|basis|grow|shrink|items|justify|self|place-items|place-content|order|max-w|max-h|min-w|min-h|w|h|size|space-x|space-y|divide|leading|tracking|whitespace|line-clamp|top|right|bottom|left|inset|inset-x|inset-y|z|overflow|overflow-x|overflow-y|opacity|aspect|object)-\S+|flex|grid|border|truncate|relative|absolute|fixed|sticky|sr-only|descender-room)$/

// A line of a `dtsPropsFor` body as the converter reads it: a one-line comment or one prop
const PROPS_LINE_PATTERN = /^ {2}(\/\*\* .* \*\/|(?:[A-Za-z_$][\w$]*|'[\w-]+')\??: .+;)$/

const { values: options } = parseArgs({
  options: {
    only: { type: 'string' },
    props: { type: 'string' },
  },
})

const requireFromDesignSystem = createRequire(join(DESIGN_SYSTEM_PATH, 'package.json'))

// TypeScript's compiler API, which the design system's TypeScript 7 no longer ships: the
// converter's ts-morph, which reads the declarations as the converter reads them and brings the
// standard library's own
const { Project, ts }: typeof TsMorph = createRequire(import.meta.url)('../.ds-sync/node_modules/ts-morph')

const config = JSON.parse(readFileSync(join(import.meta.dir, 'config.json'), 'utf8'))
const bodies: Record<string, string> = config.dtsPropsFor ?? {}
const components = readStoriedComponents()
const only = options.only ? options.only.split(',').map(name => name.trim()) : null
const checkedComponents = only ?? components
const errors: string[] = []

for (const name of only ?? []) {
  if (!components.includes(name)) errors.push(`${name}: not a component of the bundle`)
}

const css = readCss()
const classes = readClasses(css)
const tokens = readTokens(css)
const icons = new Set(Object.keys(await import(requireFromDesignSystem.resolve('lucide-react'))))
const rechartsNames = new Set(RECHARTS_PARTS)
const rechartsExports = new Set(Object.keys(await import(requireFromDesignSystem.resolve('recharts'))))

for (const part of RECHARTS_PARTS) {
  if (!rechartsExports.has(part)) errors.push(`rechartsParts.ts: ${part} is no recharts export`)
}
const { exports: globalNames, checkProps } = loadDeclarations()

for (const name of checkedComponents) {
  const body = readBody(name)

  if (body === null) errors.push(`${name}: no dtsPropsFor body`)
  else checkProps(name, body)

  const docPath = join(DOCS_PATH, `${name}.md`)

  if (!existsSync(docPath)) {
    errors.push(`${name}: no usage note at .design-sync/docs/${name}.md`)
    continue
  }

  const doc = readFileSync(docPath, 'utf8')

  if (doc.trim().length > MAX_DOC_LENGTH) {
    errors.push(`docs/${name}.md: ${doc.trim().length} characters, past the converter's ${MAX_DOC_LENGTH}`)
  }

  // A note with its own props section keeps the converter from appending the body's
  if (/##\s*Props\b|\|\s*Prop\s*\|/.test(doc)) errors.push(`docs/${name}.md: has a props section of its own`)

  checkMarkdown(`docs/${name}.md`, doc)
}

if (!only) {
  for (const name of Object.keys(bodies)) {
    if (!components.includes(name)) errors.push(`dtsPropsFor.${name}: not a component of the bundle`)
  }

  if (existsSync(CONVENTIONS_PATH)) checkMarkdown('conventions.md', readFileSync(CONVENTIONS_PATH, 'utf8'))
  else errors.push('conventions.md: missing')

  const missingClasses = LAYOUT_CLASSES.flatMap(expandClassPattern).filter(name => !classes.has(name))

  if (missingClasses.length) {
    errors.push(`layoutClasses.ts: ${missingClasses.length} classes did not compile: ${missingClasses.join(' ')}`)
  }

  const faces = new Set(
    Array.from(css.matchAll(/@font-face\s*\{[^}]*?font-family:\s*['"]?([^;'"}]+)/g), match => match[1].trim()),
  )

  for (const family of SHIPPED_FONT_FAMILIES) {
    if (!faces.has(family)) errors.push(`fonts: no @font-face for ${family}`)
  }
}

// A name a block both draws and reads, as `<Icons.X />` and `Icons.X`, is one problem
const problems = Array.from(new Set(errors))

if (problems.length) {
  console.error(problems.join('\n'))
  console.error(`\n${problems.length} problems`)
  process.exit(1)
}

console.log(
  `Checked ${checkedComponents.length} components${only ? '' : ', the conventions, the layout vocabulary and the fonts'}: every name is in the build`,
)

// The components the upload ships are those a story's title names, as the converter reads them,
// through the config's `titleMap`: Chart's stories ship as `ChartContainer`, and null leaves one out
function readStoriedComponents() {
  const { entries } = JSON.parse(readFileSync(join(import.meta.dir, 'sb-reference/index.json'), 'utf8'))
  const titleMap: Record<string, string | null> = config.titleMap ?? {}
  const names = Object.values(entries as Record<string, { type: string; title: string }>)
    .filter(entry => entry.type === 'story')
    .map(entry => entry.title.split('/').at(-1)!.replace(/\s+/g, ''))
    .map(name => (name in titleMap ? titleMap[name] : name))
    .filter((name): name is string => typeof name === 'string')

  return Array.from(new Set(names)).sort()
}

function readBody(name: string): string | null {
  const draftPath = options.props ? join(options.props, `${name}.txt`) : null

  if (draftPath && existsSync(draftPath)) return readFileSync(draftPath, 'utf8').replace(/\n+$/, '')

  return bodies[name] ?? null
}

function readCss() {
  return [join(BUNDLE_PATH, '_ds_bundle.css'), join(BUNDLE_PATH, 'fonts/fonts.css')]
    .filter(path => existsSync(path))
    .map(path => readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ''))
    .join('\n')
}

// Every class a selector names, unescaped as the browser reads it
function readClasses(text: string) {
  const unescape = (name: string) =>
    name
      .replace(/\\([0-9a-fA-F]{1,6})\s?/g, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
      .replace(/\\(.)/g, '$1')

  return new Set(Array.from(text.matchAll(/\.((?:\\[0-9a-fA-F]{1,6}\s?|\\.|[\w-])+)/g), match => unescape(match[1])))
}

// A custom property declared, or read through `var()`, which a component may set at runtime
function readTokens(text: string) {
  return new Set([
    ...Array.from(text.matchAll(/(--[\w-]+)\s*:/g), match => match[1]),
    ...Array.from(text.matchAll(/var\(\s*(--[\w-]+)/g), match => match[1]),
  ])
}

function checkMarkdown(label: string, text: string) {
  // A chart's container sets `--color-<key>` at runtime for each series its config names: the keys
  // the text gives an entry with a `label`, as `organic: { label: 'Organic', color: … }`
  const chartTokens = new Set(Array.from(text.matchAll(/^\s*(\w+):\s*\{\s*label:/gm), match => `--color-${match[1]}`))

  for (const token of new Set(Array.from(text.matchAll(/(?<![\w-])--[a-z][\w-]*/g), match => match[0]))) {
    if (!tokens.has(token) && !chartTokens.has(token)) {
      errors.push(`${label}: ${token} is no custom property of the stylesheet`)
    }
  }

  const fences = Array.from(text.matchAll(/^```(\w*)\n([\s\S]*?)^```/gm))

  for (const [, language, code] of fences) {
    if (['jsx', 'tsx', 'js'].includes(language)) checkCode(label, code)
  }

  const prose = fences.reduce((rest, [fence]) => rest.replace(fence, ''), text)

  for (const [, span] of prose.matchAll(/`([^`\n]+)`/g)) {
    // A `className` written out in prose is checked whole, as in a block
    if (span.startsWith('className=')) {
      checkClassNames(label, span)
      continue
    }

    for (const piece of span.split(/\s+/)) {
      if (!CLASS_PATTERN.test(piece) || /[*…]|\.\./.test(piece)) continue
      if (!classes.has(piece)) errors.push(`${label}: class ${piece} has no rule in the stylesheet`)
    }
  }
}

function checkClassNames(label: string, code: string) {
  const classNames = code.matchAll(/className=(?:"([^"]*)"|'([^']*)'|\{`([^`]*)`\}|\{'([^']*)'\}|\{"([^"]*)"\})/g)

  for (const match of classNames) {
    const value = match.slice(1).find(group => group !== undefined) ?? ''

    for (const piece of value
      .replace(/\$\{[^}]*\}/g, ' ')
      .split(/\s+/)
      .filter(Boolean)) {
      if (!classes.has(piece)) errors.push(`${label}: class ${piece} has no rule in the stylesheet`)
    }
  }
}

function checkCode(label: string, code: string) {
  const locals = new Set(['Fragment'])
  const iconLocals = new Set<string>()
  const globalPattern = new RegExp(
    `(?:const|let|var)\\s*\\{([^}]*)\\}\\s*=\\s*window\\.${GLOBAL_NAME}(\\.Icons|\\.Recharts)?\\b`,
    'g',
  )

  for (const [, names, namespace] of code.matchAll(globalPattern)) {
    const fromIcons = namespace === '.Icons'
    const available = fromIcons ? icons : namespace === '.Recharts' ? rechartsNames : globalNames

    for (const entry of names.split(',')) {
      const [key, alias] = entry.split(':').map(part => part.trim())

      if (!key || key.startsWith('...')) continue

      if (!available.has(key)) errors.push(`${label}: ${key} is not on window.${GLOBAL_NAME}${namespace ?? ''}`)

      locals.add(alias ?? key)
      if (fromIcons) iconLocals.add(alias ?? key)
    }
  }

  for (const [, name] of code.matchAll(new RegExp(`window\\.${GLOBAL_NAME}\\.(\\w+)`, 'g'))) {
    if (!globalNames.has(name)) errors.push(`${label}: ${name} is not on window.${GLOBAL_NAME}`)
  }

  for (const [, name] of code.matchAll(/(?:function|const|let|var|class)\s+([A-Z]\w*)/g)) locals.add(name)

  for (const [, name, member] of code.matchAll(/<([A-Z]\w*)(?:\.(\w+))?(?=[\s/>])/g)) {
    if (member) {
      if (name === 'Icons' && !icons.has(member)) errors.push(`${label}: Icons.${member} is no Lucide icon`)
      else if (name === 'Recharts' && !rechartsNames.has(member))
        errors.push(`${label}: Recharts.${member} is not on the global's Recharts`)
      else if (name !== 'Icons' && name !== 'Recharts' && name !== 'React')
        errors.push(`${label}: <${name}.${member}> is no part on the global`)
      continue
    }

    if (!locals.has(name) && !globalNames.has(name)) errors.push(`${label}: <${name}> is not on window.${GLOBAL_NAME}`)
  }

  for (const [, member] of code.matchAll(/\bIcons\.(\w+)/g)) {
    if (!icons.has(member)) errors.push(`${label}: Icons.${member} is no Lucide icon`)
  }

  for (const [, member] of code.matchAll(/\bRecharts\.(\w+)/g)) {
    if (!rechartsNames.has(member)) errors.push(`${label}: Recharts.${member} is not on the global's Recharts`)
  }

  checkClassNames(label, code)
}

/*
  The stand-in's declarations, which `tsc` emitted from the design system's sources, give every
  export of the global and every component's real props; each body is compiled beside them, inside
  the interface the converter wraps it in, so a type it names that does not resolve is caught too
*/
function loadDeclarations() {
  const entryPath = join(TYPES_PATH, 'entry.d.ts')
  const bodyPath = (name: string) => join(PACKAGE_PATH, `__checkNames__${name}.ts`)
  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      jsx: ts.JsxEmit.ReactJSX,
      strict: true,
      skipLibCheck: true,
      // The design system's alias to itself, which its emitted declarations import each other by
      paths: { 'strategydance-design-system/*': [join(TYPES_PATH, '*')] },
    },
  })

  project.addSourceFileAtPath(entryPath)

  for (const name of new Set(checkedComponents)) {
    const body = readBody(name)

    if (body !== null) {
      project.createSourceFile(
        bodyPath(name),
        `import * as React from 'react'\n\nexport interface ${name}Props {\n${body}\n}\n`,
        {
          overwrite: true,
        },
      )
    }
  }

  project.resolveSourceFileDependencies()

  const program = project.getProgram().compilerObject
  const checker = program.getTypeChecker()
  const entry = program.getSourceFile(entryPath)
  const globalDiagnostics = program.getGlobalDiagnostics()

  // Without the standard library every type is `any`, and every prop would read as missing
  if (globalDiagnostics.length) {
    throw new Error(
      globalDiagnostics.map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ')).join('\n'),
    )
  }

  const entrySymbol = entry && checker.getSymbolAtLocation(entry)

  if (!entry || !entrySymbol) throw new Error(`${entryPath} is missing: run buildPackage.ts first`)

  const exportSymbols = new Map(checker.getExportsOfModule(entrySymbol).map(symbol => [symbol.name, symbol]))

  function readRealProps(name: string) {
    const exported = exportSymbols.get(name)

    if (!exported) return null

    const symbol = exported.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported
    const [signature] = checker.getTypeOfSymbolAtLocation(symbol, entry!).getCallSignatures()
    const [parameter] = signature?.getParameters() ?? []

    if (!parameter) return { all: new Set<string>(), own: new Set<string>() }

    const type = checker.getTypeOfSymbolAtLocation(parameter, entry!)
    const properties = (type.isUnion() ? type.types : [type]).flatMap(part =>
      checker.getPropertiesOfType(checker.getApparentType(part)),
    )
    const isOwn = (property: TsMorph.ts.Symbol) =>
      property.declarations?.some(declaration => declaration.getSourceFile().fileName.startsWith(TYPES_PATH)) ?? false

    return {
      all: new Set(properties.map(property => property.name)),
      own: new Set(properties.filter(isOwn).map(property => property.name)),
    }
  }

  function checkProps(name: string, body: string) {
    const label = `dtsPropsFor.${name}`

    for (const line of body.split('\n')) {
      if (line.trim() && !PROPS_LINE_PATTERN.test(line)) {
        errors.push(`${label}: not one prop or one-line comment at two spaces: ${line.trim()}`)
      }
    }

    const sourceFile = program.getSourceFile(bodyPath(name))

    if (!sourceFile) return

    for (const diagnostic of [
      ...program.getSyntacticDiagnostics(sourceFile),
      ...program.getSemanticDiagnostics(sourceFile),
    ]) {
      errors.push(`${label}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ')}`)
    }

    const real = readRealProps(name)

    if (!real) {
      errors.push(`${label}: ${name} is not on window.${GLOBAL_NAME}`)
      return
    }

    const declared = new Set<string>()

    sourceFile.forEachChild(node => {
      if (!ts.isInterfaceDeclaration(node)) return

      for (const member of node.members) {
        if (member.name && (ts.isIdentifier(member.name) || ts.isStringLiteral(member.name))) {
          declared.add(member.name.text)
        }
      }
    })

    for (const prop of declared) {
      if (!real.all.has(prop)) errors.push(`${label}: ${prop} is no prop of ${name}`)
    }

    for (const prop of real.own) {
      if (!declared.has(prop)) errors.push(`${label}: leaves out ${prop}, which ${name} declares`)
    }
  }

  return { exports: new Set(exportSymbols.keys()), checkProps }
}
