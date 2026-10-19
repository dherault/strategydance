import { describe, expect, it } from 'bun:test'

import readDocumentRevisionSource from '~utils/knowledge/readDocumentRevisionSource'

describe('readDocumentRevisionSource', () => {
  it("reads a conversation's scope, an external agent's and a member's restore", () => {
    expect(readDocumentRevisionSource('conversation:0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f')).toEqual({
      kind: 'conversation',
      conversationId: '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f',
    })
    expect(readDocumentRevisionSource('connection:5a4b3c2d1e0f4a9b8c7d6e5f4a3b2c1d')).toEqual({ kind: 'connection' })
    expect(readDocumentRevisionSource(null)).toEqual({ kind: 'restore' })
  })

  it('takes a conversation scope it cannot read for an external agent, never linking anywhere', () => {
    expect(readDocumentRevisionSource('conversation:../elsewhere')).toEqual({ kind: 'connection' })
  })
})
