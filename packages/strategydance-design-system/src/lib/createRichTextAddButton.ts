import type { BlockNoteEditor } from '@blocknote/core'
import { FilePanelExtension } from '@blocknote/core/extensions'

/*
  The place a block that has no address yet stands in, drawn as BlockNote draws a picture's: an
  icon and what it adds, which opens the file panel over the block. The block marks itself a file
  block, so the stylesheet's rules for a picture's place reach it. Text goes in as text
*/
function createRichTextAddButton(
  blockId: string,
  editor: BlockNoteEditor<any, any, any>,
  { icon, text }: { icon: string; text: string },
) {
  const wrapper = document.createElement('div')
  const button = document.createElement('div')
  const iconElement = document.createElement('div')
  const label = document.createElement('p')

  wrapper.className = 'bn-file-block-content-wrapper'
  button.className = 'bn-add-file-button'
  iconElement.className = 'bn-add-file-button-icon'
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

  button.addEventListener('mousedown', holdFocus, true)
  button.addEventListener('click', openPanel, true)

  return {
    dom: wrapper,
    destroy: () => {
      button.removeEventListener('mousedown', holdFocus, true)
      button.removeEventListener('click', openPanel, true)
    },
  }
}

export { createRichTextAddButton }
