import {
  BasicTextStyleButton,
  BlockTypeSelect,
  CreateLinkButton,
  FormattingToolbar,
  useBlockNoteEditor,
} from '@blocknote/react'
import { getRichTextBlockTypeSelectItems } from 'strategydance-design-system/lib/richTextEditorMenus'

/*
  The toolbar over a selection in `RichTextEditor`: the block it is in, the four styles and a link.
  BlockNote's own controls, which leave out a block the schema does not hold
*/
function RichTextEditorToolbar() {
  const editor = useBlockNoteEditor()

  return (
    <FormattingToolbar>
      <BlockTypeSelect items={getRichTextBlockTypeSelectItems(editor.dictionary)} />
      <BasicTextStyleButton basicTextStyle="bold" />
      <BasicTextStyleButton basicTextStyle="italic" />
      <BasicTextStyleButton basicTextStyle="underline" />
      <BasicTextStyleButton basicTextStyle="strike" />
      <CreateLinkButton />
    </FormattingToolbar>
  )
}

export { RichTextEditorToolbar }
