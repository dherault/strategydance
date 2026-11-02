import { createInlineContentSpec } from '@blocknote/core'
import {
  createRichTextMentionChip,
  createRichTextMentionWords,
} from 'strategydance-design-system/lib/createRichTextMentionChip'

/*
  A mention of a conversation in the text, by its id, with its title when it was made: drawn
  with the conversation's live title, opening it. Its props are stored under these names for good,
  as `RichTextConversationMention` says.

  An element of the core's rather than a React one, so the editor that converts a document without
  ever drawing it loads no React. Drawn live only in an editor's view, where BlockNote calls it as a
  node view: a copy calls it with nothing to say so
*/
const conversationMentionInlineContentSpec = createInlineContentSpec(
  {
    type: 'conversationMention',
    propSchema: { conversationId: { default: '' }, title: { default: '' } },
    content: 'none',
  },
  {
    render(this: { renderType?: string } | undefined, inlineContent, _update, editor) {
      const { conversationId, title } = inlineContent.props

      return createRichTextMentionChip(
        { kind: 'conversation', id: conversationId, words: title },
        editor,
        this?.renderType === 'nodeView',
      )
    },
    toExternalHTML: inlineContent => ({ dom: createRichTextMentionWords(inlineContent.props.title) }),
  },
)

export { conversationMentionInlineContentSpec }
