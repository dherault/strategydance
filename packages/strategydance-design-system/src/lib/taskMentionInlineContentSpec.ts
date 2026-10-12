import { createInlineContentSpec } from '@blocknote/core'
import {
  createRichTextMentionChip,
  createRichTextMentionWords,
} from 'strategydance-design-system/lib/createRichTextMentionChip'

/*
  A mention of a task in the text, by its id, with its name when it was made: drawn
  with the task's live name, opening it. Its props are stored under these names for good, as
  `RichTextTaskMention` says.

  An element of the core's rather than a React one, so the editor that converts a document without
  ever drawing it loads no React. Drawn live only in an editor's view, where BlockNote calls it as a
  node view: a copy calls it with nothing to say so
*/
const taskMentionInlineContentSpec = createInlineContentSpec(
  {
    type: 'taskMention',
    propSchema: { taskId: { default: '' }, name: { default: '' } },
    content: 'none',
  },
  {
    render(this: { renderType?: string } | undefined, inlineContent, _update, editor) {
      const { taskId, name } = inlineContent.props

      return createRichTextMentionChip(
        { kind: 'task', id: taskId, words: name },
        editor,
        this?.renderType === 'nodeView',
      )
    },
    toExternalHTML: inlineContent => ({ dom: createRichTextMentionWords(inlineContent.props.name) }),
  },
)

export { taskMentionInlineContentSpec }
