import {
  BasicTextStyleButton,
  BlockTypeSelect,
  CreateLinkButton,
  FileCaptionButton,
  FileDeleteButton,
  FileReplaceButton,
  FormattingToolbar,
  useBlockNoteEditor,
  useEditorState,
} from '@blocknote/react'
import { getRichTextBlockTypeSelectItems } from 'strategydance-design-system/lib/richTextEditorMenus'

// The editor's own blocks, which no control of BlockNote's applies to, and the side menu deletes
const BLOCKS_WITHOUT_TOOLBAR = new Set(['videoEmbed', 'linkPreview'])

/*
  The toolbar over a selection in `RichTextEditor`: the block it is in, the four styles and a link,
  or over a picture, its caption, another file or address in its place, and deleting it. BlockNote's
  own controls, each drawn only where it applies, and leaving out a block the schema does not hold.
  Over a video or a link preview, none would, so there is no toolbar
*/
function RichTextEditorToolbar() {
  const editor = useBlockNoteEditor()
  const isBare = useEditorState({
    editor,
    selector: ({ editor }) => {
      const blocks = editor.getSelection()?.blocks ?? [editor.getTextCursorPosition().block]

      return blocks.length === 1 && BLOCKS_WITHOUT_TOOLBAR.has(blocks[0].type)
    },
  })

  if (isBare) return null

  return (
    <FormattingToolbar>
      <BlockTypeSelect items={getRichTextBlockTypeSelectItems(editor.dictionary)} />
      <FileCaptionButton />
      <FileReplaceButton />
      <FileDeleteButton />
      <BasicTextStyleButton basicTextStyle="bold" />
      <BasicTextStyleButton basicTextStyle="italic" />
      <BasicTextStyleButton basicTextStyle="underline" />
      <BasicTextStyleButton basicTextStyle="strike" />
      <CreateLinkButton />
    </FormattingToolbar>
  )
}

export { RichTextEditorToolbar }
