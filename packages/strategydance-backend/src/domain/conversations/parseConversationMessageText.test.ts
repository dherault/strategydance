import { describe, expect, test } from 'bun:test'

import { MAX_CONVERSATION_MESSAGE_LENGTH } from 'strategydance-core'

import parseConversationMessageText from './parseConversationMessageText'

describe('parseConversationMessageText', () => {
  test('takes a message trimmed', () => {
    expect(parseConversationMessageText('  Help me price the beta\n')).toEqual({
      outcome: 'valid',
      text: 'Help me price the beta',
      drawnText: 'Help me price the beta',
    })
  })

  test('refuses an empty and a blank message', () => {
    expect(parseConversationMessageText('').outcome).toBe('invalid')
    expect(parseConversationMessageText(' \n\t ').outcome).toBe('invalid')
    expect(parseConversationMessageText('\u0000 \u0007').outcome).toBe('invalid')
    expect(parseConversationMessageText('\u200B\u200D\uFEFF').outcome).toBe('invalid')
  })

  test('refuses a message past its length, once trimmed', () => {
    const longest = 'a'.repeat(MAX_CONVERSATION_MESSAGE_LENGTH)

    expect(parseConversationMessageText(` ${longest} `).outcome).toBe('valid')
    expect(parseConversationMessageText(`${longest}a`).outcome).toBe('invalid')
  })

  test('refuses a message holding half a surrogate pair, and takes a whole one', () => {
    expect(parseConversationMessageText('Price \uD83D').outcome).toBe('invalid')
    expect(parseConversationMessageText('\uDE00 price').outcome).toBe('invalid')
    expect(parseConversationMessageText('Price 👍').outcome).toBe('valid')
  })

  test('keeps U+0000 for the transcript and draws the message without it', () => {
    expect(parseConversationMessageText('acct\u0000admin')).toEqual({
      outcome: 'valid',
      text: 'acct\u0000admin',
      drawnText: 'acctadmin',
    })
  })
})
