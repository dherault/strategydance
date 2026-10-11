import { describe, expect, it } from 'bun:test'

import readConversationLinkTarget from '~utils/conversation/readConversationLinkTarget'

const TASK_ID = '1a2b3c4d5e6f40718293a4b5c6d7e8f9'
const HREF = 'task:1a2b3c4d-5e6f-4071-8293-a4b5c6d7e8f9'

describe('readConversationLinkTarget', () => {
  it('draws the agent’s words until the list is read, and for a link naming no id', () => {
    expect(readConversationLinkTarget(HREF, 'task', null)).toEqual({ kind: 'words' })
    expect(readConversationLinkTarget('task:launch', 'task', new Map())).toEqual({ kind: 'words' })
  })

  it('draws a task the board no longer holds as gone, then with its current name once it is restored', () => {
    const task = { id: TASK_ID, name: 'Write the launch post' }

    // Deleted, and unknown alike: the board holds neither
    expect(readConversationLinkTarget(HREF, 'task', new Map())).toEqual({ kind: 'gone' })
    expect(readConversationLinkTarget(HREF, 'task', new Map([['9f8e7d6c5b4a43219f8e7d6c5b4a4321', task]]))).toEqual({
      kind: 'gone',
    })
    expect(readConversationLinkTarget(HREF, 'task', new Map([[TASK_ID, task]]))).toEqual({ kind: 'found', item: task })
  })

  it('finds a document by a doc: link alone', () => {
    const document = { id: TASK_ID, title: 'Pricing' }
    const documents = new Map([[TASK_ID, document]])

    expect(readConversationLinkTarget(`doc:${TASK_ID}`, 'doc', documents)).toEqual({ kind: 'found', item: document })
    expect(readConversationLinkTarget(`task:${TASK_ID}`, 'doc', documents)).toEqual({ kind: 'words' })
  })
})
