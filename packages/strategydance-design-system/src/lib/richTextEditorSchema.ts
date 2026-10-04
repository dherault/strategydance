import {
  BlockNoteSchema,
  createBulletListItemBlockSpec,
  createCheckListItemBlockSpec,
  createCodeBlockSpec,
  createHeadingBlockSpec,
  createImageBlockSpec,
  createNumberedListItemBlockSpec,
  createParagraphBlockSpec,
  createQuoteBlockSpec,
  createTableBlockSpec,
  defaultInlineContentSpecs,
  defaultStyleSpecs,
} from '@blocknote/core'
import {
  RICH_TEXT_CODE_LANGUAGES,
  RICH_TEXT_HEADING_LEVELS,
  type RichTextEditorBlock,
  getRichTextCodeLanguage,
} from 'strategydance-design-system/lib/richText'
import { createVideoEmbedBlockSpec } from 'strategydance-design-system/lib/videoEmbedBlockSpec'

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

/*
  The three heading levels the page draws, the second by default, as the only level there was. A
  pasted heading keeps its level up to the third, which a deeper one comes in at. `#`, `##` and
  `###` make each, and so do ⌘⌥1 to ⌘⌥3
*/
function createRichTextHeadingBlockSpec() {
  const spec = withoutDefaultProps(
    createHeadingBlockSpec({ levels: RICH_TEXT_HEADING_LEVELS, defaultLevel: 2, allowToggleHeadings: false }),
  )

  const parse: typeof spec.implementation.parse = element =>
    /^H[1-6]$/.test(element.tagName) ? { level: Math.min(Number(element.tagName[1]), 3) } : undefined

  return { ...spec, implementation: { ...spec.implementation, parse } }
}

/*
  Code in the languages `RICH_TEXT_CODE_LANGUAGES` names, plain text by default, picked from a
  select over the block. BlockNote's select throws on a language it does not list, and a block can
  come with one: three backticks alone write an empty one, a pasted `<code class="language-ts">`
  keeps `ts`, and another editor's text arrives as it is through Yjs. So a pasted block is read
  into a language listed, and a block is drawn in one, plain text when its own is unknown
*/
function createRichTextCodeBlockSpec() {
  const spec = createCodeBlockSpec({
    defaultLanguage: 'text',
    supportedLanguages: RICH_TEXT_CODE_LANGUAGES,
    indentLineWithTab: true,
  })
  const { parse, render } = spec.implementation
  const implementation: typeof spec.implementation = {
    ...spec.implementation,
    parse: element => {
      const props = parse?.(element)

      return props ? { ...props, language: getRichTextCodeLanguage(props.language) } : undefined
    },
    render(block, editor) {
      return render.call(
        this,
        { ...block, props: { ...block.props, language: getRichTextCodeLanguage(block.props.language) } },
        editor,
      )
    },
  }

  return { ...spec, implementation }
}

/*
  The schema of an editor writing `blocks` besides paragraphs: the blocks `RichText` draws, with
  text in four styles and links. A pasted block it does not hold comes in as a paragraph, and a
  pasted color or inline code mark is dropped
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
      ...(blocks.includes('code') ? { codeBlock: createRichTextCodeBlockSpec() } : {}),
      // Its cells keep the colors and the alignment their nodes always carry, which nothing here sets
      ...(blocks.includes('table') ? { table: withoutDefaultProps(createTableBlockSpec()) } : {}),
      ...(blocks.includes('image') ? { image: withoutDefaultProps(createImageBlockSpec()) } : {}),
      ...(blocks.includes('video') ? { videoEmbed: createVideoEmbedBlockSpec() } : {}),
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

export { createRichTextSchema }
