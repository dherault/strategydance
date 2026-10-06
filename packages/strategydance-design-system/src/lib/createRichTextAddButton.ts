import type { BlockNoteEditor } from '@blocknote/core'
import { FilePanelExtension } from '@blocknote/core/extensions'

/*
  The place a block that has no address yet stands in, drawn as BlockNote draws a picture's: an
  icon and what it adds, which opens the file panel over the block. The block marks itself a file
  block, so the stylesheet's rules for a picture's place reach it. Text goes in as text.

  A button, so the keyboard reaches it and a screen reader names it, where BlockNote's own is a
  div. Enter and Space open the panel without reaching the editor, which would take them for typing
*/
function createRichTextAddButton(
  blockId: string,
  editor: BlockNoteEditor<any, any, any>,
  { icon, text }: { icon: string; text: string },
) {
  const wrapper = document.createElement('div')
  const button = document.createElement('button')
  const iconElement = document.createElement('span')
  const label = document.createElement('span')

  wrapper.className = 'bn-file-block-content-wrapper'
  button.type = 'button'
  button.className = 'bn-add-file-button'
  iconElement.className = 'bn-add-file-button-icon'
  iconElement.setAttribute('aria-hidden', 'true')
  iconElement.innerHTML = icon
  label.className = 'bn-add-file-button-text'
  label.textContent = text
  button.append(iconElement, label)
  wrapper.append(button)

  // Keeps the focus in the text, as BlockNote's own does
  function holdFocus(event: MouseEvent) {
    event.preventDefault()
    event.stopPropagation()
  }

  function openPanel() {
    if (editor.isEditable) editor.getExtension(FilePanelExtension)?.showMenu(blockId)
  }

  function openPanelFromKeyboard(event: KeyboardEvent) {
    if (event.key !== 'Enter' && event.key !== ' ') return

    event.preventDefault()
    event.stopPropagation()
    openPanel()
  }

  button.addEventListener('mousedown', holdFocus, true)
  button.addEventListener('click', openPanel, true)
  button.addEventListener('keydown', openPanelFromKeyboard)

  return {
    dom: wrapper,
    destroy: () => {
      button.removeEventListener('mousedown', holdFocus, true)
      button.removeEventListener('click', openPanel, true)
      button.removeEventListener('keydown', openPanelFromKeyboard)
    },
  }
}

export { createRichTextAddButton }
