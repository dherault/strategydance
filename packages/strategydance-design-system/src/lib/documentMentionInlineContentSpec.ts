import { createInlineContentSpec } from '@blocknote/core'
import {
  createRichTextMentionChip,
  createRichTextMentionWords,
} from 'strategydance-design-system/lib/createRichTextMentionChip'

/*
  A mention of a knowledge document in the text, by its id, with its title when it was made: drawn
  with the document's live title, opening it. Its props are stored under these names for good, as
  `RichTextDocumentMention` says.

  An element of the core's rather than a React one, so the editor that converts a document without
  ever drawing it loads no React. Drawn live only in an editor's view, where BlockNote calls it as a
  node view: a copy calls it with nothing to say so
*/
const documentMentionInlineContentSpec = createInlineContentSpec(
  {
    type: 'documentMention',
    propSchema: { documentId: { default: '' }, title: { default: '' } },
    content: 'none',
  },
  {
    render(this: { renderType?: string } | undefined, inlineContent, _update, editor) {
      const { documentId, title } = inlineContent.props

      return createRichTextMentionChip(
        { kind: 'document', id: documentId, words: title },
        editor,
        this?.renderType === 'nodeView',
      )
    },
    toExternalHTML: inlineContent => ({ dom: createRichTextMentionWords(inlineContent.props.title) }),
  },
)

export { documentMentionInlineContentSpec }
