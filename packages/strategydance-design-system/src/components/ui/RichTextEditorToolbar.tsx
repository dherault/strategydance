import {
  BasicTextStyleButton,
  BlockTypeSelect,
  CreateLinkButton,
  FileCaptionButton,
  FileDeleteButton,
  FileReplaceButton,
  FormattingToolbar,
  useBlockNoteEditor,
} from '@blocknote/react'
import { getRichTextBlockTypeSelectItems } from 'strategydance-design-system/lib/richTextEditorMenus'

/*
  The toolbar over a selection in `RichTextEditor`: the block it is in, the four styles and a link,
  or over a picture, its caption, another file or address in its place, and deleting it. BlockNote's
  own controls, each drawn only where it applies, and leaving out a block the schema does not hold
*/
function RichTextEditorToolbar() {
  const editor = useBlockNoteEditor()

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
