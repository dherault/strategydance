/*
  How rich text looks, as `RichText` draws it from BlockNote's blocks. The editor's stylesheet,
  `RichTextEditor.css`, sets BlockNote's own blocks to match, so a post reads the same while it is
  written and once it is posted.

  Preflight strips list markers, so the lists name theirs. A bulleted list's marker follows its
  depth, as BlockNote draws it, and a check item's box is drawn rather than being the browser's, so
  a card's picture copies it

  A heading it ends on keeps the room its descenders hang into inside the text, so a box that clips
  the text, as a card does, does not cut them off. Inside a box that keeps that room already, a
  `descender-room` one, it adds none of its own, which would only push what follows down
*/
const richTextClassName =
  'text-[15px] leading-[1.6] wrap-anywhere text-pretty text-secondary [&>:last-child]:mb-0 [&:not(.descender-room_*)>:is(h1,h2,h3):last-child]:pb-(--descender-room)'

const richTextClasses = {
  paragraph: 'mb-2',
  // By level, each a step down the display face's sizes from the first
  headings: {
    1: 'mt-1 mb-2 font-display text-2xl/[1.2] font-normal tracking-normal text-secondary',
    2: 'mt-1 mb-1.5 font-display text-xl/[1.25] font-normal tracking-normal text-secondary',
    3: 'mt-1 mb-1 font-display text-lg/[1.3] font-normal tracking-normal text-secondary',
  },
  quote: 'mb-2 border-l-2 border-neutral-300 pl-3 text-neutral-600',
  // Its lines as typed, scrolling sideways rather than wrapping, as the editor sets it
  code: 'mb-2 overflow-x-auto rounded-xs bg-neutral-100 px-4 py-3 font-mono text-[13px] leading-[1.6] whitespace-pre [tab-size:2] text-secondary',
  bulletedList: 'mb-2 pl-[22px]',
  bulletMarkers: ['list-disc', 'list-[circle]', 'list-[square]'],
  numberedList: 'mb-2 list-decimal pl-[22px]',
  checkList: 'mb-2 list-none',
  // A nested list sits flush under its item
  listItem: 'my-0.5 [&>ol]:mb-0 [&>ul]:mb-0',
  checkLabel: 'flex items-start gap-2',
  checkBox:
    'mt-[0.3em] flex size-[0.95em] shrink-0 items-center justify-center rounded-[3px] border border-neutral-400 bg-white text-white [&_svg]:size-[0.75em] [&_svg]:stroke-3',
  checkBoxChecked: 'border-primary bg-primary',
  checkedText: 'line-through opacity-60',
  // What is nested under a block that is not a list item, and under a check item, under its text
  nested: 'pl-6 [&>:last-child]:mb-0',
  link: 'text-primary underline underline-offset-2 hover:text-primary-700',
  text: {
    bold: 'font-semibold',
    italic: 'italic',
    underline: 'underline',
    strikethrough: 'line-through',
    underlineStrikethrough: '[text-decoration-line:underline_line-through]',
  },
}

export const RICH_TEXT_CLASS_NAME = richTextClassName
export const RICH_TEXT_CLASSES = richTextClasses

/*
  Rich text as it is stored: BlockNote's blocks, kept to what the editor writes and the renderer
  draws. A block is BlockNote's partial block, without the id it is given in the editor and without
  any prop left at its default, so that the same document always serializes to the same string
*/

/**
 * The name of the Yjs type a shared text lives in, inside its Yjs document: the editor opens on it,
 * and a text converted for sharing is written to it. A document written under another name reads
 * as empty, so it never changes
 */
export const RICH_TEXT_YJS_FRAGMENT = 'prosemirror'

/** A heading's levels. The second is the default, which a heading at it leaves out */
export const RICH_TEXT_HEADING_LEVELS = [1, 2, 3] as const

export type RichTextHeadingLevel = (typeof RICH_TEXT_HEADING_LEVELS)[number]

/**
 * A block an editor can write besides paragraphs, lists being one, bulleted and numbered alike.
 * Each is one or more of the stored block types, as `getRichTextBlockTypes` names them
 */
export type RichTextEditorBlock = 'heading' | 'quote' | 'list' | 'checklist' | 'code'

/**
 * The blocks a post is written in, a log entry's: text and lists, which a feed and a card draw.
 * Here rather than beside the editor's schema, as are the lists below, so a page passing one loads
 * no editor
 */
export const RICH_TEXT_POST_BLOCKS: readonly RichTextEditorBlock[] = ['heading', 'quote', 'list', 'checklist']

/**
 * Every block an editor can write besides paragraphs, which it writes unless told fewer: a
 * document's. The Yjs helpers default to it too, and a shared text has to be read with the
 * schema its editor writes, since a read deletes whatever block the schema lacks
 */
export const RICH_TEXT_EDITOR_BLOCKS: readonly RichTextEditorBlock[] = ['heading', 'quote', 'list', 'checklist', 'code']

/**
 * The languages a code block is written in, by shiki's ids, each with its name and the names it is
 * also typed by: those of `@blocknote/code-block`, whose highlighter loads their grammars, plain
 * text first and the rest by name. A copy rather than that package's list, which would bring shiki
 * into every page that draws rich text
 */
export const RICH_TEXT_CODE_LANGUAGES = {
  text: { name: 'Plain Text', aliases: ['text', 'txt', 'plain'] },
  c: { name: 'C', aliases: ['c'] },
  csharp: { name: 'C#', aliases: ['c#', 'csharp', 'cs'] },
  cpp: { name: 'C++', aliases: ['cpp', 'c++'] },
  css: { name: 'CSS', aliases: ['css'] },
  glsl: { name: 'GLSL', aliases: ['glsl'] },
  graphql: { name: 'GraphQL', aliases: ['graphql', 'gql'] },
  haskell: { name: 'Haskell', aliases: ['haskell', 'hs'] },
  html: { name: 'HTML', aliases: ['html'] },
  java: { name: 'Java', aliases: ['java'] },
  javascript: { name: 'JavaScript', aliases: ['javascript', 'js'] },
  json: { name: 'JSON', aliases: ['json'] },
  jsonc: { name: 'JSON with Comments', aliases: ['jsonc'] },
  jsonl: { name: 'JSON Lines', aliases: ['jsonl'] },
  jsx: { name: 'JSX', aliases: ['jsx'] },
  julia: { name: 'Julia', aliases: ['julia', 'jl'] },
  kotlin: { name: 'Kotlin', aliases: ['kotlin', 'kt', 'kts'] },
  latex: { name: 'LaTeX', aliases: ['latex'] },
  less: { name: 'Less', aliases: ['less'] },
  lua: { name: 'Lua', aliases: ['lua'] },
  markdown: { name: 'Markdown', aliases: ['markdown', 'md'] },
  mdx: { name: 'MDX', aliases: ['mdx'] },
  mermaid: { name: 'Mermaid', aliases: ['mermaid', 'mmd'] },
  'objective-c': { name: 'Objective C', aliases: ['objective-c', 'objc'] },
  php: { name: 'PHP', aliases: ['php'] },
  postcss: { name: 'PostCSS', aliases: ['postcss'] },
  pug: { name: 'Pug', aliases: ['pug', 'jade'] },
  python: { name: 'Python', aliases: ['python', 'py'] },
  r: { name: 'R', aliases: ['r'] },
  regexp: { name: 'RegExp', aliases: ['regexp', 'regex'] },
  ruby: { name: 'Ruby', aliases: ['ruby', 'rb'] },
  haml: { name: 'Ruby Haml', aliases: ['haml'] },
  rust: { name: 'Rust', aliases: ['rust', 'rs'] },
  sass: { name: 'Sass', aliases: ['sass'] },
  scala: { name: 'Scala', aliases: ['scala'] },
  scss: { name: 'SCSS', aliases: ['scss'] },
  shellscript: { name: 'Shell', aliases: ['shellscript', 'bash', 'sh', 'shell', 'zsh'] },
  sql: { name: 'SQL', aliases: ['sql'] },
  svelte: { name: 'Svelte', aliases: ['svelte'] },
  swift: { name: 'Swift', aliases: ['swift'] },
  tsx: { name: 'TSX', aliases: ['tsx', 'typescriptreact'] },
  typescript: { name: 'TypeScript', aliases: ['typescript', 'ts'] },
  vue: { name: 'Vue', aliases: ['vue'] },
  'vue-html': { name: 'Vue HTML', aliases: ['vue-html'] },
  wasm: { name: 'WebAssembly', aliases: ['wasm'] },
  wgsl: { name: 'WGSL', aliases: ['wgsl'] },
  xml: { name: 'XML', aliases: ['xml'] },
  yaml: { name: 'YAML', aliases: ['yaml', 'yml'] },
} satisfies Record<string, { name: string; aliases: string[] }>

/** A code block's language, plain text being the default, which a block in it leaves out */
export type RichTextCodeLanguage = keyof typeof RICH_TEXT_CODE_LANGUAGES

/**
 * The language a name stands for, by its id or one of the names it is also typed by, ignoring
 * case: `ts` is TypeScript. Plain text for anything else, an empty name included, which is what
 * BlockNote writes for a block opened by three backticks alone
 */
export function getRichTextCodeLanguage(name: unknown): RichTextCodeLanguage {
  if (typeof name !== 'string') return 'text'

  const typed = name.trim().toLowerCase()
  const entry = Object.entries(RICH_TEXT_CODE_LANGUAGES).find(
    ([id, { aliases }]) => id === typed || aliases.includes(typed),
  )

  return (entry?.[0] as RichTextCodeLanguage | undefined) ?? 'text'
}

/** The stored block types an editor writing `blocks` keeps, which `normalizeRichText` holds a value to */
export function getRichTextBlockTypes(blocks: readonly RichTextEditorBlock[]): RichTextBlockType[] {
  return [
    'paragraph',
    ...(blocks.includes('heading') ? (['heading'] as const) : []),
    ...(blocks.includes('quote') ? (['quote'] as const) : []),
    ...(blocks.includes('list') ? (['bulletListItem', 'numberedListItem'] as const) : []),
    ...(blocks.includes('checklist') ? (['checkListItem'] as const) : []),
    ...(blocks.includes('code') ? (['codeBlock'] as const) : []),
  ]
}

/** The four styles a run of text may carry, each present only when it is on */
export type RichTextStyles = {
  bold?: true
  italic?: true
  underline?: true
  strike?: true
}

export type RichTextRun = {
  type: 'text'
  text: string
  styles?: RichTextStyles
}

/** A link, only ever to a web or mail address */
export type RichTextLink = {
  type: 'link'
  href: string
  content: RichTextRun[]
}

export type RichTextInline = RichTextRun | RichTextLink

/** A block of text: a paragraph, a heading, a quote, or an item of a list */
export type RichTextTextBlock = {
  type: 'paragraph' | 'heading' | 'quote' | 'bulletListItem' | 'numberedListItem' | 'checkListItem'
  /** A heading's level when it is not the second, a numbered list's first number when it is not 1, and a check item's tick */
  props?: {
    level?: Exclude<RichTextHeadingLevel, 2>
    start?: number
    checked?: true
  }
  content?: RichTextInline[]
  /** The blocks nested under it, which is how a list is indented */
  children?: RichTextBlock[]
}

/** Code, as typed: one run of text without styles, its line breaks in it */
export type RichTextCodeBlock = {
  type: 'codeBlock'
  /** Its language when it is not plain text */
  props?: { language: Exclude<RichTextCodeLanguage, 'text'> }
  content?: [{ type: 'text'; text: string }]
  children?: RichTextBlock[]
}

export type RichTextBlock = RichTextTextBlock | RichTextCodeBlock

/** The blocks rich text is written in, by BlockNote's names */
export type RichTextBlockType = RichTextBlock['type']
