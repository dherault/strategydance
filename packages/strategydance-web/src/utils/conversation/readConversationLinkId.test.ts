import { describe, expect, it } from 'bun:test'

import readConversationLinkId from '~utils/conversation/readConversationLinkId'

describe('readConversationLinkId', () => {
  it('reads a document’s id as Data Connect writes it, its hyphens and case aside', () => {
    expect(readConversationLinkId('doc:9f8e7d6c5b4a43219f8e7d6c5b4a4321', 'doc')).toBe(
      '9f8e7d6c5b4a43219f8e7d6c5b4a4321',
    )
    expect(readConversationLinkId('doc:9F8E7D6C-5B4A-4321-9F8E-7D6C5B4A4321', 'doc')).toBe(
      '9f8e7d6c5b4a43219f8e7d6c5b4a4321',
    )
  })

  it('reads a task’s id the same way, whatever the case of its scheme', () => {
    expect(readConversationLinkId('task:1a2b3c4d-5e6f-4071-8293-a4b5c6d7e8f9', 'task')).toBe(
      '1a2b3c4d5e6f40718293a4b5c6d7e8f9',
    )
    expect(readConversationLinkId('TASK:1A2B3C4D5E6F40718293A4B5C6D7E8F9', 'task')).toBe(
      '1a2b3c4d5e6f40718293a4b5c6d7e8f9',
    )
  })

  it('reads nothing from a link that names nothing of its kind', () => {
    expect(readConversationLinkId('doc:', 'doc')).toBeNull()
    expect(readConversationLinkId('doc:pricing', 'doc')).toBeNull()
    expect(readConversationLinkId('doc:9f8e7d6c5b4a43219f8e7d6c5b4a432', 'doc')).toBeNull()
    expect(readConversationLinkId('https://strategydance.com/doc:9f8e7d6c5b4a43219f8e7d6c5b4a4321', 'doc')).toBeNull()
    expect(readConversationLinkId('task:9f8e7d6c5b4a43219f8e7d6c5b4a4321', 'doc')).toBeNull()
    expect(readConversationLinkId('doc:9f8e7d6c5b4a43219f8e7d6c5b4a4321', 'task')).toBeNull()
    expect(readConversationLinkId('task:launch-post', 'task')).toBeNull()
  })
})
