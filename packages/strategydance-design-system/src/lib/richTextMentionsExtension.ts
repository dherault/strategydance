import { createExtension, createStore } from '@blocknote/core'
import type { RichTextMentionSource } from 'strategydance-design-system/lib/richText'

/*
  Where an editor's mentions draw their documents and tasks from: the page's source, held in a
  store the editor sets as it changes and every mention drawn subscribes to, so a title renamed, a
  document deleted or a list read reaches the mentions already drawn. Each editor makes its own.

  Marks never stay on a mention: the formatting toolbar can lay bold or a link over one in the
  editor, but its value and its shared text keep none
*/
const RichTextMentionsExtension = createExtension(
  ({ options }: { options: { source: RichTextMentionSource | null } }) => ({
    key: 'richTextMentions',
    store: createStore<RichTextMentionSource | null>(options.source),
  }),
)

export { RichTextMentionsExtension }
