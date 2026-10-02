import { describe, expect, it } from 'bun:test'

import type { KnowledgeDocumentFields, KnowledgeDocumentSaveStatus } from '~types'

import createKnowledgeDocumentSaver, {
  type KnowledgeDocumentWrites,
} from '~utils/knowledge/createKnowledgeDocumentSaver'

const DELAY = 10

const BLANK: KnowledgeDocumentFields = { title: '', content: '', aspects: [], isAiLocked: false }

const STORED: KnowledgeDocumentFields = { title: 'Plan', content: '[1]', aspects: [], isAiLocked: false }

function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Writes that record what they were sent, each answering after `latency`
function createWrites({ latency = 0, refuseContent = false } = {}) {
  const calls: string[] = []
  let failNext = false

  async function answer(call: string) {
    calls.push(call)
    await wait(latency)

    if (failNext) {
      failNext = false
      throw new Error('offline')
    }
  }

  const writes: KnowledgeDocumentWrites = {
    create: fields => answer(`create ${fields.title}|${fields.content}|${fields.aspects.join()}|${fields.isAiLocked}`),
    rename: title => answer(`rename ${title}`),
    updateContent: async (content, revision) => {
      await answer(`content ${content}@${revision}`)

      return !refuseContent
    },
    updateAspects: aspects => answer(`aspects ${aspects.join()}`),
    setAiLock: isAiLocked => answer(`lock ${isAiLocked}`),
    discard: () => answer('discard'),
  }

  return {
    calls,
    writes,
    failNextWrite: () => {
      failNext = true
    },
  }
}

function track(saver: ReturnType<typeof createKnowledgeDocumentSaver>) {
  const statuses: KnowledgeDocumentSaveStatus[] = []
  let createdCount = 0
  let savedCount = 0

  saver.attach({
    onStatus: status => statuses.push(status),
    onCreated: () => {
      createdCount += 1
    },
    onSaved: () => {
      savedCount += 1
    },
  })

  return { statuses, getCreatedCount: () => createdCount, getSavedCount: () => savedCount }
}

describe('createKnowledgeDocumentSaver', () => {
  it('stores nothing of a draft until it has a title or some text', async () => {
    const { calls, writes } = createWrites()
    const saver = createKnowledgeDocumentSaver({
      documentId: 'd1',
      fields: BLANK,
      revision: null,
      writes,
      delay: DELAY,
    })
    const { getCreatedCount } = track(saver)

    saver.change({ title: '   ', aspects: ['STRATEGY'] as KnowledgeDocumentFields['aspects'] })
    await wait(DELAY * 3)

    expect(calls).toEqual([])
    expect(saver.getStatus()).toBe('idle')

    saver.change({ title: 'Plan', isAiLocked: true })
    await wait(DELAY * 3)

    expect(calls).toEqual(['create Plan||STRATEGY|true'])
    expect(getCreatedCount()).toBe(1)
    expect(saver.getStatus()).toBe('idle')
  })

  it('sends what was typed while the draft was being created once it is', async () => {
    const { calls, writes } = createWrites({ latency: DELAY * 2 })
    const saver = createKnowledgeDocumentSaver({
      documentId: 'd2',
      fields: BLANK,
      revision: null,
      writes,
      delay: DELAY,
    })
    const { getCreatedCount } = track(saver)

    saver.change({ title: 'P' })
    await wait(DELAY * 1.5)
    saver.change({ title: 'Plan', content: '[1]' })
    await saver.flush()

    expect(calls).toEqual(['create P|||false', 'rename Plan', 'content [1]@0'])
    expect(getCreatedCount()).toBe(1)
  })

  it('names the revision each content save is made over', async () => {
    const { calls, writes } = createWrites()
    const saver = createKnowledgeDocumentSaver({ documentId: 'd3', fields: STORED, revision: 4, writes, delay: DELAY })
    track(saver)

    saver.change({ content: '[2]' })
    await saver.flush()
    saver.change({ content: '[3]' })
    await saver.flush()

    expect(calls).toEqual(['content [2]@4', 'content [3]@5'])
  })

  it('waits for the reader to pause, and sends only the latest', async () => {
    const { calls, writes } = createWrites()
    const saver = createKnowledgeDocumentSaver({
      documentId: 'd4',
      fields: STORED,
      revision: 0,
      writes,
      delay: DELAY * 3,
    })
    track(saver)

    saver.change({ title: 'Pl' })
    await wait(DELAY)
    saver.change({ title: 'Pla' })
    await wait(DELAY)
    saver.change({ title: 'Plans' })

    expect(saver.getStatus()).toBe('pending')
    expect(saver.hasUnsaved()).toBe(true)

    await wait(DELAY * 5)

    expect(calls).toEqual(['rename Plans'])
    expect(saver.hasUnsaved()).toBe(false)
  })

  it('sends a field that went back to what is stored not at all', async () => {
    const { calls, writes } = createWrites()
    const saver = createKnowledgeDocumentSaver({ documentId: 'd5', fields: STORED, revision: 0, writes, delay: DELAY })
    track(saver)

    saver.change({ title: 'Plan 2' })
    saver.change({ title: 'Plan' })
    await saver.flush()

    expect(calls).toEqual([])
  })

  it('stops saving content once somebody else saved theirs, and goes on with the rest', async () => {
    const { calls, writes } = createWrites({ refuseContent: true })
    const saver = createKnowledgeDocumentSaver({ documentId: 'd6', fields: STORED, revision: 0, writes, delay: DELAY })
    const { statuses } = track(saver)

    saver.change({ content: '[2]' })
    await saver.flush()

    expect(saver.getStatus()).toBe('conflict')
    expect(statuses.at(-1)).toBe('conflict')

    saver.change({ content: '[3]', title: 'Plan 2' })
    await saver.flush()

    expect(calls).toEqual(['content [2]@0', 'rename Plan 2'])
  })

  it("counts content refused for somebody else's save as unsaved, until paused", async () => {
    const { writes } = createWrites({ refuseContent: true })
    const saver = createKnowledgeDocumentSaver({ documentId: 'd14', fields: STORED, revision: 0, writes, delay: DELAY })
    track(saver)

    saver.change({ content: '[2]' })
    await saver.flush()

    expect(saver.hasUnsaved()).toBe(true)

    saver.pause()

    expect(saver.hasUnsaved()).toBe(false)
  })

  it('holds back content too long to send, counting it unsaved, and sends it once short enough', async () => {
    const { calls, writes } = createWrites()
    const saver = createKnowledgeDocumentSaver({
      documentId: 'd15',
      fields: STORED,
      revision: 0,
      writes,
      delay: DELAY,
      maxContentLength: 5,
    })
    const { statuses } = track(saver)

    saver.change({ content: '[123456]', title: 'Plan 2' })
    await saver.flush()

    expect(calls).toEqual(['rename Plan 2'])
    expect(saver.getStatus()).toBe('tooLong')
    expect(statuses.at(-1)).toBe('tooLong')
    expect(saver.hasUnsaved()).toBe(true)

    saver.change({ content: '[12]' })
    await saver.flush()

    expect(calls).toEqual(['rename Plan 2', 'content [12]@0'])
    expect(saver.getStatus()).toBe('idle')
    expect(saver.hasUnsaved()).toBe(false)
  })

  it('stores a draft without the content too long to send, or not at all when that is all it has', async () => {
    const { calls, writes } = createWrites()
    const saver = createKnowledgeDocumentSaver({
      documentId: 'd16',
      fields: BLANK,
      revision: null,
      writes,
      delay: DELAY,
      maxContentLength: 5,
    })
    track(saver)

    saver.change({ content: '[123456]' })
    await saver.flush()

    expect(calls).toEqual([])
    expect(saver.getStatus()).toBe('tooLong')

    saver.change({ title: 'Plan' })
    await saver.flush()

    expect(calls).toEqual(['create Plan|||false'])
  })

  it('says a save failed, and tries again with the next change', async () => {
    const { calls, writes, failNextWrite } = createWrites()
    const saver = createKnowledgeDocumentSaver({ documentId: 'd7', fields: STORED, revision: 0, writes, delay: DELAY })
    track(saver)

    failNextWrite()
    saver.change({ title: 'Plan 2' })
    await saver.flush()

    expect(saver.getStatus()).toBe('error')
    expect(saver.hasUnsaved()).toBe(true)

    saver.change({ aspects: ['LEGAL'] as KnowledgeDocumentFields['aspects'] })
    await saver.flush()

    expect(calls).toEqual(['rename Plan 2', 'rename Plan 2', 'aspects LEGAL'])
    expect(saver.getStatus()).toBe('idle')
  })

  it('forgets a failure once the failed change is taken back', async () => {
    const { calls, writes, failNextWrite } = createWrites()
    const saver = createKnowledgeDocumentSaver({ documentId: 'd19', fields: STORED, revision: 0, writes, delay: DELAY })
    track(saver)

    failNextWrite()
    saver.change({ title: 'Plan 2' })
    await saver.flush()

    expect(saver.getStatus()).toBe('error')

    saver.change({ title: 'Plan' })

    expect(saver.getStatus()).toBe('idle')
    expect(await saver.settle()).toBe(true)
    expect(calls).toEqual(['rename Plan 2'])
  })

  it('forgets a failure whose change was taken back while its send was out', async () => {
    const { writes, failNextWrite } = createWrites({ latency: DELAY })
    const saver = createKnowledgeDocumentSaver({
      documentId: 'd20',
      fields: STORED,
      revision: 0,
      writes,
      delay: DELAY * 10,
    })
    track(saver)

    failNextWrite()
    saver.change({ title: 'Plan 2' })
    const flushed = saver.flush()
    await wait(DELAY / 2)
    saver.change({ title: 'Plan' })

    expect(await flushed).toBe(true)
    expect(saver.getStatus()).toBe('idle')
  })

  it('queues at most one send behind the one out', async () => {
    const { calls, writes } = createWrites({ latency: DELAY })
    const saver = createKnowledgeDocumentSaver({ documentId: 'd8', fields: STORED, revision: 0, writes, delay: DELAY })
    track(saver)

    saver.change({ title: 'A' })
    const first = saver.flush()
    // The first send is out, with what there was when it started
    await wait(1)
    saver.change({ title: 'AB' })
    saver.flush()
    saver.change({ title: 'ABC' })
    await Promise.all([first, saver.flush()])

    expect(calls).toEqual(['rename A', 'rename ABC'])
  })

  it('settles: sends what arrives while a send is out, then pauses', async () => {
    const { calls, writes } = createWrites({ latency: DELAY })
    const saver = createKnowledgeDocumentSaver({
      documentId: 'd17',
      fields: STORED,
      revision: 0,
      writes,
      delay: DELAY * 10,
    })
    track(saver)

    saver.change({ title: 'A' })
    const settled = saver.settle()
    await wait(DELAY / 2)
    saver.change({ aspects: ['LEGAL'] as KnowledgeDocumentFields['aspects'] })

    expect(await settled).toBe(true)
    expect(calls).toEqual(['rename A', 'aspects LEGAL'])
    expect(saver.hasUnsaved()).toBe(false)

    saver.change({ title: 'B' })
    await wait(DELAY * 12)

    expect(calls).toEqual(['rename A', 'aspects LEGAL'])
  })

  it('answers false and stays unpaused when a send fails, so nothing is given up', async () => {
    const { calls, writes, failNextWrite } = createWrites()
    const saver = createKnowledgeDocumentSaver({ documentId: 'd18', fields: STORED, revision: 0, writes, delay: DELAY })
    track(saver)

    failNextWrite()
    saver.change({ title: 'A' })

    expect(await saver.settle()).toBe(false)
    expect(saver.hasUnsaved()).toBe(true)

    expect(await saver.flush()).toBe(true)
    expect(calls).toEqual(['rename A', 'rename A'])
  })

  it('discards a document the page emptied as it leaves', async () => {
    const { calls, writes } = createWrites()
    const saver = createKnowledgeDocumentSaver({ documentId: 'd9', fields: STORED, revision: 0, writes, delay: DELAY })
    track(saver)

    saver.change({ title: ' ', content: '' })
    await saver.detach()

    expect(calls).toEqual(['rename  ', 'content @0', 'discard'])
  })

  it('leaves an empty document alone when the page changed nothing, as StrictMode remounts it', async () => {
    const { calls, writes } = createWrites()
    const saver = createKnowledgeDocumentSaver({ documentId: 'd10', fields: BLANK, revision: 3, writes, delay: DELAY })
    track(saver)

    await saver.detach()
    track(saver)
    await saver.detach()

    expect(calls).toEqual([])
  })

  it('holds every send while paused, and sends what was held once resumed', async () => {
    const { calls, writes } = createWrites()
    const saver = createKnowledgeDocumentSaver({ documentId: 'd11', fields: STORED, revision: 0, writes, delay: DELAY })
    track(saver)

    saver.change({ title: 'Plan 2' })
    saver.pause()
    saver.change({ title: '', content: '' })
    await saver.flush()
    await wait(DELAY * 3)

    expect(calls).toEqual([])
    expect(saver.hasUnsaved()).toBe(false)

    saver.resume()
    await wait(DELAY * 3)

    expect(calls).toEqual(['rename ', 'content @0'])
  })

  it('sends nothing once paused for a delete, nor discards on the way out', async () => {
    const { calls, writes } = createWrites()
    const saver = createKnowledgeDocumentSaver({ documentId: 'd12', fields: STORED, revision: 0, writes, delay: DELAY })
    track(saver)

    saver.change({ title: '', content: '' })
    saver.pause()
    await saver.detach()

    expect(calls).toEqual([])
  })

  it('says a send went through, but not one with nothing in it', async () => {
    const { writes } = createWrites()
    const saver = createKnowledgeDocumentSaver({ documentId: 'd13', fields: STORED, revision: 0, writes, delay: DELAY })
    const { getSavedCount } = track(saver)

    await saver.flush()
    saver.change({ title: 'Plan 2' })
    await saver.flush()

    expect(getSavedCount()).toBe(1)
  })
})
