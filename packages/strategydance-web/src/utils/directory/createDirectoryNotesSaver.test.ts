import { afterEach, beforeEach, describe, expect, it, jest } from 'bun:test'

import createDirectoryNotesSaver from '~utils/directory/createDirectoryNotesSaver'

function createSaver(save = (_content: string): Promise<unknown> => Promise.resolve()) {
  const sent: string[] = []
  const events: string[] = []
  const saver = createDirectoryNotesSaver({
    save: content => {
      sent.push(content)

      return save(content)
    },
    onError: () => events.push('error'),
    onTooLongChange: isTooLong => events.push(isTooLong ? 'tooLong' : 'fits'),
    delay: 100,
  })

  return { saver, sent, events }
}

describe('createDirectoryNotesSaver', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it('sends the last notes once the reader pauses, and nothing for notes back as they opened', () => {
    const { saver, sent } = createSaver()

    saver.open('a')
    saver.change('ab')
    saver.change('abc')
    jest.advanceTimersByTime(99)

    expect(sent).toEqual([])

    jest.advanceTimersByTime(1)

    expect(sent).toEqual(['abc'])
    expect(saver.saved()).toBe('abc')

    saver.change('abc')
    jest.advanceTimersByTime(200)

    expect(sent).toEqual(['abc'])
    expect(saver.hasPending()).toBe(false)
  })

  it('sends what waits at once on a flush, and nothing when nothing does', () => {
    const { saver, sent } = createSaver()

    saver.open('')

    expect(saver.flush()).toBe('nothing')

    saver.change('Sent the form')

    expect(saver.hasPending()).toBe(true)

    saver.flush()
    jest.advanceTimersByTime(200)

    expect(sent).toEqual(['Sent the form'])
  })

  it('counts a send on its way as waiting, until the server has it', async () => {
    let resolve = () => {}
    const { saver } = createSaver(() => new Promise<void>(done => (resolve = done)))

    saver.open('')
    saver.change('Sent the form')

    expect(saver.flush()).toBe('sent')
    expect(saver.hasPending()).toBe(true)

    resolve()
    await Promise.resolve()
    await Promise.resolve()

    expect(saver.hasPending()).toBe(false)
  })

  it('holds notes past the longest the server takes until they are shorter', () => {
    const { saver, sent, events } = createSaver()

    saver.open('')
    saver.change('x'.repeat(20001))

    expect(saver.flush()).toBe('tooLong')
    expect(sent).toEqual([])
    expect(saver.hasPending()).toBe(true)

    saver.change('x'.repeat(20000))
    saver.flush()

    expect(sent).toHaveLength(1)
    expect(events).toEqual(['fits', 'tooLong', 'fits'])
  })

  it('keeps notes a send failed with waiting, to send with the next flush', async () => {
    let attempt = 0
    const { saver, sent, events } = createSaver(() =>
      attempt++ === 0 ? Promise.reject(new Error('Offline')) : Promise.resolve(),
    )

    saver.open('')
    saver.change('Listed')
    saver.flush()
    await Promise.resolve()
    await Promise.resolve()

    expect(events).toContain('error')
    expect(saver.hasPending()).toBe(true)

    saver.flush()

    expect(sent).toEqual(['Listed', 'Listed'])
  })

  it('never brings back notes a failed send held once newer ones went out', async () => {
    const sends: { content: string; resolve: () => void; reject: () => void }[] = []
    const { saver, sent } = createSaver(
      content =>
        new Promise<void>((resolve, reject) => {
          sends.push({ content, resolve, reject: () => reject(new Error('Offline')) })
        }),
    )

    saver.open('')
    saver.change('Listed')
    saver.flush()
    saver.change('Listed, waiting')
    saver.flush()
    sends[0]?.reject()
    sends[1]?.resolve()
    await Promise.resolve()
    await Promise.resolve()

    expect(saver.hasPending()).toBe(false)
    expect(saver.flush()).toBe('nothing')
    expect(sent).toEqual(['Listed', 'Listed, waiting'])
  })

  it('never brings back notes a failed send held once the same notes went out again', async () => {
    const sends: { content: string; resolve: () => void; reject: () => void }[] = []
    const { saver, sent } = createSaver(
      content =>
        new Promise<void>((resolve, reject) => {
          sends.push({ content, resolve, reject: () => reject(new Error('Offline')) })
        }),
    )

    saver.open('')
    saver.change('Listed')
    saver.flush()
    saver.change('Listed, waiting')
    saver.change('Listed')
    saver.flush()
    sends[0]?.reject()
    sends[1]?.resolve()
    await Promise.resolve()
    await Promise.resolve()

    expect(saver.hasPending()).toBe(false)
    expect(saver.flush()).toBe('nothing')
    expect(sent).toEqual(['Listed', 'Listed'])
  })

  it('keeps the newest notes waiting when every send on its way fails', async () => {
    const sends: { content: string; reject: () => void }[] = []
    const { saver, sent } = createSaver(
      content =>
        new Promise<void>((_resolve, reject) => {
          sends.push({ content, reject: () => reject(new Error('Offline')) })
        }),
    )

    saver.open('')
    saver.change('Listed')
    saver.flush()
    saver.change('Listed, waiting')
    saver.flush()
    sends[0]?.reject()
    sends[1]?.reject()
    await Promise.resolve()
    await Promise.resolve()

    expect(saver.hasPending()).toBe(true)

    saver.flush()

    expect(sent).toEqual(['Listed', 'Listed, waiting', 'Listed, waiting'])
  })
})
