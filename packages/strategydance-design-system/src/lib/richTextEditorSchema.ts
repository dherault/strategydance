import {
  BlockNoteSchema,
  createBulletListItemBlockSpec,
  createCheckListItemBlockSpec,
  createExtension,
  createHeadingBlockSpec,
  createNumberedListItemBlockSpec,
  createParagraphBlockSpec,
  createQuoteBlockSpec,
  defaultInlineContentSpecs,
  defaultStyleSpecs,
} from '@blocknote/core'
import type { RichTextBlockType } from 'strategydance-design-system/lib/richText'

/** A block the editor can write besides paragraphs, lists being one, bulleted and numbered alike */
type RichTextEditorBlock = 'heading' | 'quote' | 'list' | 'checklist'

// The props BlockNote gives every block, which `RichText` never draws
const DEFAULT_PROPS = new Set(['backgroundColor', 'textColor', 'textAlignment'])

type Spec = {
  config: { propSchema: object }
  implementation: object
  extensions?: unknown[]
}

/*
  A block without the colors and the alignment every default block carries. A pasted color or
  alignment then has no prop to land in, so the editor shows what the page will, and the color and
  alignment controls, which look for those props, stay hidden
*/
function withoutDefaultProps<TSpec extends Spec>(spec: TSpec): TSpec {
  const propSchema = Object.fromEntries(
    Object.entries(spec.config.propSchema).filter(([name]) => !DEFAULT_PROPS.has(name)),
  )

  return { ...spec, config: { ...spec.config, propSchema } }
}

const headingShortcut = createExtension({
  key: 'rich-text-heading-shortcut',
  inputRules: [
    {
      find: /^#\s$/,
      replace: () => ({ type: 'heading', props: { level: 2 } }),
    },
  ],
})

/*
  The one heading level the page draws. A pasted heading of any level comes in at it, rather than
  at the level its tag says, and `# ` makes one as `## ` does
*/
function createRichTextHeadingBlockSpec() {
  const spec = withoutDefaultProps(createHeadingBlockSpec({ levels: [2], defaultLevel: 2, allowToggleHeadings: false }))

  const parse: typeof spec.implementation.parse = element =>
    /^H[1-6]$/.test(element.tagName) ? { level: 2 } : undefined

  return {
    ...spec,
    implementation: { ...spec.implementation, parse },
    extensions: [...(spec.extensions ?? []), headingShortcut],
  }
}

/*
  The schema of an editor writing `blocks` besides paragraphs: the blocks `RichText` draws, with
  text in four styles and links. A pasted block it does not hold comes in as a paragraph, and a
  pasted color or code mark is dropped
*/
function createRichTextSchema(blocks: readonly RichTextEditorBlock[]) {
  const hasLists = blocks.includes('list')

  return BlockNoteSchema.create({
    blockSpecs: {
      paragraph: withoutDefaultProps(createParagraphBlockSpec()),
      ...(blocks.includes('heading') ? { heading: createRichTextHeadingBlockSpec() } : {}),
      ...(blocks.includes('quote') ? { quote: withoutDefaultProps(createQuoteBlockSpec()) } : {}),
      ...(hasLists
        ? {
            bulletListItem: withoutDefaultProps(createBulletListItemBlockSpec()),
            numberedListItem: withoutDefaultProps(createNumberedListItemBlockSpec()),
          }
        : {}),
      ...(blocks.includes('checklist') ? { checkListItem: withoutDefaultProps(createCheckListItemBlockSpec()) } : {}),
    },
    inlineContentSpecs: {
      text: defaultInlineContentSpecs.text,
      link: defaultInlineContentSpecs.link,
    },
    styleSpecs: {
      bold: defaultStyleSpecs.bold,
      italic: defaultStyleSpecs.italic,
      underline: defaultStyleSpecs.underline,
      strike: defaultStyleSpecs.strike,
    },
  })
}

// The stored block types an editor writing `blocks` keeps, which `normalizeRichText` holds a value to
function getRichTextBlockTypes(blocks: readonly RichTextEditorBlock[]): RichTextBlockType[] {
  return [
    'paragraph',
    ...(blocks.includes('heading') ? (['heading'] as const) : []),
    ...(blocks.includes('quote') ? (['quote'] as const) : []),
    ...(blocks.includes('list') ? (['bulletListItem', 'numberedListItem'] as const) : []),
    ...(blocks.includes('checklist') ? (['checkListItem'] as const) : []),
  ]
}

export { createRichTextSchema, getRichTextBlockTypes, type RichTextEditorBlock }
