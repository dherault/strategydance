import { describe, expect, it } from 'bun:test'

import readConversationPastedFiles from '~utils/conversation/readConversationPastedFiles'

// A clipboard's `DataTransfer` as a paste reads it
function pasted(files: File[], types: string[]) {
  return { files: files as unknown as FileList, types }
}

const screenshot = new File(['png'], 'image.png', { type: 'image/png' })

describe('readConversationPastedFiles', () => {
  it('attaches the files a paste carries without text', () => {
    expect(readConversationPastedFiles(pasted([screenshot], ['Files']))).toEqual([screenshot])
    expect(readConversationPastedFiles(pasted([screenshot], ['text/html', 'Files']))).toEqual([screenshot])
  })

  it('leaves a paste of text to paste its text, a picture beside it or not', () => {
    expect(readConversationPastedFiles(pasted([screenshot], ['text/plain', 'text/html', 'Files']))).toEqual([])
    expect(readConversationPastedFiles(pasted([], ['text/plain']))).toEqual([])
  })
})
