import { describe, expect, test } from 'bun:test'

import isConversationSendKey from '~utils/conversation/isConversationSendKey'

function press(
  key: string,
  options: { shiftKey?: boolean; metaKey?: boolean; ctrlKey?: boolean; isComposing?: boolean; keyCode?: number } = {},
) {
  return {
    key,
    shiftKey: options.shiftKey ?? false,
    metaKey: options.metaKey ?? false,
    ctrlKey: options.ctrlKey ?? false,
    isComposing: options.isComposing ?? false,
    keyCode: options.keyCode ?? (key === 'Enter' ? 13 : 65),
  }
}

describe('isConversationSendKey', () => {
  test('sends on Enter, and breaks the line on Shift+Enter', () => {
    expect(isConversationSendKey(press('Enter'), false)).toBe(true)
    expect(isConversationSendKey(press('Enter', { shiftKey: true }), false)).toBe(false)
  })

  test('sends nothing on any other key', () => {
    expect(isConversationSendKey(press('a'), false)).toBe(false)
    expect(isConversationSendKey(press('Tab'), false)).toBe(false)
  })

  test('sends nothing while an input method composes', () => {
    expect(isConversationSendKey(press('Enter', { isComposing: true }), false)).toBe(false)
  })

  test("sends nothing on the Enter that ends Safari's composition, which only its key code says", () => {
    expect(isConversationSendKey(press('Enter', { keyCode: 229 }), false)).toBe(false)
  })

  test('breaks the line on Enter on a touch screen, and sends with Command or Control', () => {
    expect(isConversationSendKey(press('Enter'), true)).toBe(false)
    expect(isConversationSendKey(press('Enter', { metaKey: true }), true)).toBe(true)
    expect(isConversationSendKey(press('Enter', { ctrlKey: true }), true)).toBe(true)
    expect(isConversationSendKey(press('Enter', { metaKey: true, shiftKey: true }), true)).toBe(false)
  })
})
