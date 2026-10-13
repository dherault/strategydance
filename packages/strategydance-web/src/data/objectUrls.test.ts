import { describe, expect, it } from 'bun:test'

import { holdObjectUrl, readObjectUrl } from '~data/objectUrls'

function nextTask() {
  return new Promise(resolve => setTimeout(resolve, 1))
}

describe('objectUrls', () => {
  it('makes one address for a blob, however many hold it, and gives it back once none does', async () => {
    const blob = new Blob(['png'], { type: 'image/png' })

    expect(readObjectUrl(blob)).toBeNull()

    const releaseFirst = holdObjectUrl(blob)
    const url = readObjectUrl(blob)
    const releaseSecond = holdObjectUrl(blob)

    expect(url).toStartWith('blob:')
    expect(readObjectUrl(blob)).toBe(url)

    releaseFirst()
    releaseFirst()
    await nextTask()

    expect(readObjectUrl(blob)).toBe(url)

    releaseSecond()
    await nextTask()

    expect(readObjectUrl(blob)).toBeNull()
  })

  it('keeps the address of a blob let go of and held again in one go', async () => {
    const blob = new Blob(['png'], { type: 'image/png' })
    const release = holdObjectUrl(blob)
    const url = readObjectUrl(blob)

    release()

    const releaseAgain = holdObjectUrl(blob)

    await nextTask()

    expect(readObjectUrl(blob)).toBe(url)

    releaseAgain()
    await nextTask()

    expect(readObjectUrl(blob)).toBeNull()
  })
})
