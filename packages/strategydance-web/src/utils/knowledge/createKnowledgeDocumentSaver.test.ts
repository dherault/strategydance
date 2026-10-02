import { describe, expect, it } from 'bun:test'

import type { KnowledgeDocumentFields, KnowledgeDocumentSaveStatus } from '~types'

import createKnowledgeDocumentSaver, {
  type KnowledgeDocumentSaverText,
  type KnowledgeDocumentWrites,
} from '~utils/knowledge/createKnowledgeDocumentSaver'

const DELAY = 10

const BLANK: KnowledgeDocumentFields = { title: '', content: '', aspects: [], isAiLocked: false }

const STORED: KnowledgeDocumentFields = { title: 'Plan', content: '[1]', aspects: [], isAiLocked: false }

const LEGAL = ['LEGAL'] as KnowledgeDocumentFields['aspects']

function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

type StoredDocument = KnowledgeDocumentFields & { revision: number; state: string | null }

/*
  Writes that record what they were sent, each answering after `latency`. `isFull` refuses every
  create for the organization's cap. `losesCreateAnswer` stores the first create and then throws,
  as a create whose answer the network lost does, which `read` then finds
*/
function createWrites({
  latency = 0,
  isFull = false,
  losesCreateAnswer = false,
  existing = null as StoredDocument | null,
} = {}) {
  const calls: string[] = []
  let failNext = false
  let stored = existing

  async function answer(call: string) {
    calls.push(call)
    await wait(latency)

    if (failNext) {
      failNext = false
      throw new Error('offline')
    }
  }

  const writes: KnowledgeDocumentWrites = {
    create: async (fields, state) => {
      await answer(`create ${fields.title}|${fields.content}|${fields.aspects.join()}|${fields.isAiLocked}`)

      if (isFull) return 'full'
      if (stored) throw new Error('A document by that id exists')

      stored = { ...fields, revision: 0, state }

      if (losesCreateAnswer) throw new Error('The connection dropped')

      return 'created'
    },
    read: async () => {
      calls.push('read')

      return stored
    },
    rename: title => answer(`rename ${title}`),
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

// The document's text as the sync keeps it: when it is ready, a snapshot for the create, and
// whether it was edited
function createText({ isChangedHere = false, ready = Promise.resolve() as Promise<unknown> } = {}) {
  let markedCount = 0
  let isTextChangedHere = isChangedHere

  const text: KnowledgeDocumentSaverText = {
    whenReady: () => ready,
    encodeForCreate: () => 'snapshot',
    markCreated: () => {
      markedCount += 1
    },
    isChangedHere: () => isTextChangedHere,
  }

  return {
    text,
    getMarkedCount: () => markedCount,
    editHere: () => {
      isTextChangedHere = true
    },
  }
}

function createSaver(
  options: Omit<Parameters<typeof createKnowledgeDocumentSaver>[0], 'text' | 'delay'> & {
    text?: KnowledgeDocumentSaverText
    delay?: number
  },
) {
  return createKnowledgeDocumentSaver({ text: createText().text, delay: DELAY, ...options })
}

function track(saver: ReturnType<typeof createKnowledgeDocumentSaver>) {
  const statuses: KnowledgeDocumentSaveStatus[] = []
  const remoteChanges: Partial<KnowledgeDocumentFields>[] = []
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
    onRemoteChange: fields => remoteChanges.push(fields),
  })

  return { statuses, remoteChanges, getCreatedCount: () => createdCount, getSavedCount: () => savedCount }
}

describe('createKnowledgeDocumentSaver', () => {
  it('stores nothing of a draft until it has a title or some text', async () => {
    const { calls, writes } = createWrites()
    const { text, getMarkedCount } = createText()
    const saver = createSaver({ documentId: 'd1', fields: BLANK, isStored: false, writes, text })
    const { getCreatedCount } = track(saver)

    saver.change({ title: '   ', aspects: ['STRATEGY'] as KnowledgeDocumentFields['aspects'] })
    await wait(DELAY * 3)

    expect(calls).toEqual([])
    expect(saver.getStatus()).toBe('idle')

    saver.change({ title: 'Plan', isAiLocked: true })
    await wait(DELAY * 3)

    expect(calls).toEqual(['create Plan||STRATEGY|true'])
    expect(getCreatedCount()).toBe(1)
    expect(getMarkedCount()).toBe(1)
    expect(saver.getStatus()).toBe('idle')
  })

  it('creates a draft only once its text is ready', async () => {
    const { calls, writes } = createWrites()
    let markReady = () => {}
    const { text } = createText({ ready: new Promise<void>(resolve => (markReady = resolve)) })
    const saver = createSaver({ documentId: 'd33', fields: BLANK, isStored: false, writes, text })
    track(saver)

    saver.change({ title: 'Plan' })
    await wait(DELAY * 3)

    expect(calls).toEqual([])

    markReady()
    await saver.flush()

    expect(calls).toEqual(['create Plan|||false'])
  })

  it('creates a draft with its text and the snapshot of it', async () => {
    const { writes } = createWrites()
    const saver = createSaver({ documentId: 'd24', fields: BLANK, isStored: false, writes })
    track(saver)

    saver.change({ content: '[1]' })
    await saver.flush()

    expect(await writes.read()).toMatchObject({ content: '[1]', state: 'snapshot', revision: 0 })
  })

  it('sends what was typed while the draft was being created once it is, and leaves the text to the sync', async () => {
    const { calls, writes } = createWrites({ latency: DELAY * 2 })
    const saver = createSaver({ documentId: 'd2', fields: BLANK, isStored: false, writes })
    const { getCreatedCount } = track(saver)

    saver.change({ title: 'P' })
    await wait(DELAY * 1.5)
    saver.change({ title: 'Plan', content: '[1]' })
    await saver.flush()

    expect(calls).toEqual(['create P|||false', 'rename Plan'])
    expect(getCreatedCount()).toBe(1)
  })

  it('goes on from a create that went through though its answer was lost', async () => {
    const { calls, writes } = createWrites({ losesCreateAnswer: true })
    const { text, getMarkedCount } = createText()
    const saver = createSaver({ documentId: 'd21', fields: BLANK, isStored: false, writes, text })
    const { getCreatedCount } = track(saver)

    saver.change({ title: 'Plan' })

    expect(await saver.flush()).toBe(true)
    expect(getCreatedCount()).toBe(1)
    expect(getMarkedCount()).toBe(1)

    saver.change({ title: 'Plans' })
    await saver.flush()

    expect(calls).toEqual(['create Plan|||false', 'read', 'rename Plans'])
    expect(saver.getStatus()).toBe('idle')
  })

  it('never takes another document under the id for its lost create, nor writes over it', async () => {
    const { calls, writes } = createWrites({ existing: { ...STORED, revision: 3, state: 'theirs' } })
    const { text, getMarkedCount } = createText()
    const saver = createSaver({ documentId: 'd23', fields: BLANK, isStored: false, writes, text })
    const { getCreatedCount } = track(saver)

    saver.change({ title: 'Mine' })

    expect(await saver.flush()).toBe(false)
    expect(saver.getStatus()).toBe('error')
    expect(getCreatedCount()).toBe(0)

    saver.change({ content: '[2]' })
    await saver.flush()

    expect(calls).toEqual(['create Mine|||false', 'read', 'create Mine|[2]||false', 'read'])
    expect(getMarkedCount()).toBe(0)
  })

  it('says the organization is full, and tries again with the next change', async () => {
    const { calls, writes } = createWrites({ isFull: true })
    const saver = createSaver({ documentId: 'd22', fields: BLANK, isStored: false, writes })
    const { getCreatedCount } = track(saver)

    saver.change({ title: 'Plan' })

    expect(await saver.flush()).toBe(false)
    expect(saver.getStatus()).toBe('full')
    expect(saver.hasUnsaved()).toBe(true)

    saver.change({ title: 'Plans' })
    await saver.flush()

    expect(calls).toEqual(['create Plan|||false', 'create Plans|||false'])
    expect(getCreatedCount()).toBe(0)

    saver.change({ title: '' })

    expect(saver.getStatus()).toBe('idle')
  })

  it('sends nothing for the text of a stored document, which its sync pushes', async () => {
    const { calls, writes } = createWrites()
    const saver = createSaver({ documentId: 'd3', fields: STORED, isStored: true, writes })
    track(saver)

    saver.change({ content: '[2]' })
    await saver.flush()

    expect(calls).toEqual([])
    expect(saver.hasUnsaved()).toBe(false)
  })

  it('waits for the reader to pause, and sends only the latest', async () => {
    const { calls, writes } = createWrites()
    const saver = createSaver({ documentId: 'd4', fields: STORED, isStored: true, writes, delay: DELAY * 3 })
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
    const saver = createSaver({ documentId: 'd5', fields: STORED, isStored: true, writes })
    track(saver)

    saver.change({ title: 'Plan 2' })
    saver.change({ title: 'Plan' })
    await saver.flush()

    expect(calls).toEqual([])
  })

  it("takes another member's change to a field it has no change of its own to", async () => {
    const { calls, writes } = createWrites()
    const saver = createSaver({ documentId: 'd6', fields: STORED, isStored: true, writes })
    const { remoteChanges } = track(saver)

    saver.receive({ title: 'Their plan', aspects: LEGAL, isAiLocked: false })
    await saver.flush()

    expect(remoteChanges).toEqual([{ title: 'Their plan', aspects: LEGAL }])
    expect(calls).toEqual([])
    expect(saver.hasUnsaved()).toBe(false)
  })

  it("keeps its own waiting change over another member's, and sends it", async () => {
    const { calls, writes } = createWrites()
    const saver = createSaver({ documentId: 'd14', fields: STORED, isStored: true, writes })
    const { remoteChanges } = track(saver)

    saver.change({ title: 'My plan' })
    saver.receive({ title: 'Their plan', aspects: [], isAiLocked: true })
    await saver.flush()

    expect(remoteChanges).toEqual([{ isAiLocked: true }])
    expect(calls).toEqual(['rename My plan'])
  })

  it('takes its own save coming back as nothing new', async () => {
    const { calls, writes } = createWrites({ latency: DELAY })
    const saver = createSaver({ documentId: 'd25', fields: STORED, isStored: true, writes })
    const { remoteChanges } = track(saver)

    saver.change({ title: 'Plan 2' })
    const flushed = saver.flush()
    // The live query pushes the rename before its answer is back
    await wait(DELAY / 2)
    saver.receive({ title: 'Plan 2', aspects: [], isAiLocked: false })
    await flushed
    saver.receive({ title: 'Plan 2', aspects: [], isAiLocked: false })
    await saver.flush()

    expect(remoteChanges).toEqual([])
    expect(calls).toEqual(['rename Plan 2'])
  })

  it('holds a draft back while its snapshot is longer than the server keeps, and says so', async () => {
    const { calls, writes } = createWrites()
    const saver = createSaver({ documentId: 'd31', fields: BLANK, isStored: false, writes, maxStateLength: 5 })
    const { statuses } = track(saver)

    saver.change({ title: 'Plan' })
    await saver.flush()

    expect(calls).toEqual([])
    expect(saver.getStatus()).toBe('tooLong')
    expect(statuses.at(-1)).toBe('tooLong')
    expect(saver.hasUnsaved()).toBe(true)
  })

  it('ends on what another member saved while its own save was out', async () => {
    const { calls, writes } = createWrites({ latency: DELAY })
    const saver = createSaver({ documentId: 'd28', fields: STORED, isStored: true, writes })
    const { remoteChanges } = track(saver)

    saver.change({ title: 'Mine' })
    const flushed = saver.flush()
    await wait(DELAY / 2)
    // Their rename landed after this one, so its push is the last
    saver.receive({ title: 'Theirs', aspects: [], isAiLocked: false })
    await flushed
    await saver.flush()

    expect(remoteChanges).toEqual([{ title: 'Theirs' }])
    expect(calls).toEqual(['rename Mine'])
    expect(saver.hasUnsaved()).toBe(false)
  })

  it('ends on a push that set the field back while its save was out', async () => {
    const { writes } = createWrites({ latency: DELAY })
    const saver = createSaver({ documentId: 'd29', fields: STORED, isStored: true, writes })
    const { remoteChanges } = track(saver)

    saver.change({ title: 'Mine' })
    const flushed = saver.flush()
    await wait(DELAY / 2)
    saver.receive({ title: 'Plan', aspects: [], isAiLocked: false })
    await flushed

    expect(remoteChanges).toEqual([{ title: 'Plan' }])
    expect(saver.hasUnsaved()).toBe(false)
  })

  it('sends a change made while its save was out, whatever a push said meanwhile', async () => {
    const { calls, writes } = createWrites({ latency: DELAY })
    const saver = createSaver({ documentId: 'd30', fields: STORED, isStored: true, writes })
    const { remoteChanges } = track(saver)

    saver.change({ title: 'Mine' })
    const flushed = saver.flush()
    await wait(DELAY / 2)
    saver.change({ title: 'Mine, again' })
    saver.receive({ title: 'Theirs', aspects: [], isAiLocked: false })
    await flushed
    await saver.flush()

    expect(remoteChanges).toEqual([])
    expect(calls).toEqual(['rename Mine', 'rename Mine, again'])
  })

  it('holds a draft back whole while its text is too long, and stores it once short enough', async () => {
    const { calls, writes } = createWrites()
    const saver = createSaver({ documentId: 'd15', fields: BLANK, isStored: false, writes, maxContentLength: 5 })
    const { statuses } = track(saver)

    saver.change({ content: '[123456]', title: 'Plan' })
    await saver.flush()

    expect(calls).toEqual([])
    expect(saver.getStatus()).toBe('tooLong')
    expect(statuses.at(-1)).toBe('tooLong')
    expect(saver.hasUnsaved()).toBe(true)

    saver.change({ content: '[12]' })
    await saver.flush()

    expect(calls).toEqual(['create Plan|[12]||false'])
    expect(saver.getStatus()).toBe('idle')
    expect(saver.hasUnsaved()).toBe(false)
  })

  it('tries a failed change again once a push says the document is back', async () => {
    const { calls, writes, failNextWrite } = createWrites()
    const saver = createSaver({ documentId: 'd32', fields: STORED, isStored: true, writes })
    track(saver)

    // Refused, as a rename is while the document is deleted
    failNextWrite()
    saver.change({ title: 'Plan 2' })
    await saver.flush()

    expect(saver.getStatus()).toBe('error')

    // An Undo brought it back, and the live query says so
    saver.receive({ title: 'Plan', aspects: [], isAiLocked: false })
    await wait(DELAY * 3)

    expect(calls).toEqual(['rename Plan 2', 'rename Plan 2'])
    expect(saver.getStatus()).toBe('idle')
  })

  it('says a save failed, and tries again with the next change', async () => {
    const { calls, writes, failNextWrite } = createWrites()
    const saver = createSaver({ documentId: 'd7', fields: STORED, isStored: true, writes })
    track(saver)

    failNextWrite()
    saver.change({ title: 'Plan 2' })
    await saver.flush()

    expect(saver.getStatus()).toBe('error')
    expect(saver.hasUnsaved()).toBe(true)

    saver.change({ aspects: LEGAL })
    await saver.flush()

    expect(calls).toEqual(['rename Plan 2', 'rename Plan 2', 'aspects LEGAL'])
    expect(saver.getStatus()).toBe('idle')
  })

  it('forgets a failure once the failed change is taken back', async () => {
    const { calls, writes, failNextWrite } = createWrites()
    const saver = createSaver({ documentId: 'd19', fields: STORED, isStored: true, writes })
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
    const saver = createSaver({ documentId: 'd20', fields: STORED, isStored: true, writes, delay: DELAY * 10 })
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
    const saver = createSaver({ documentId: 'd8', fields: STORED, isStored: true, writes })
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
    const saver = createSaver({ documentId: 'd17', fields: STORED, isStored: true, writes, delay: DELAY * 10 })
    track(saver)

    saver.change({ title: 'A' })
    const settled = saver.settle()
    await wait(DELAY / 2)
    saver.change({ aspects: LEGAL })

    expect(await settled).toBe(true)
    expect(calls).toEqual(['rename A', 'aspects LEGAL'])
    expect(saver.hasUnsaved()).toBe(false)

    saver.change({ title: 'B' })
    await wait(DELAY * 12)

    expect(calls).toEqual(['rename A', 'aspects LEGAL'])
  })

  it('answers false and stays unpaused when a send fails, so nothing is given up', async () => {
    const { calls, writes, failNextWrite } = createWrites()
    const saver = createSaver({ documentId: 'd18', fields: STORED, isStored: true, writes })
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
    const saver = createSaver({ documentId: 'd9', fields: STORED, isStored: true, writes })
    track(saver)

    saver.change({ title: ' ', content: '' })
    await saver.detach()

    expect(calls).toEqual(['rename  ', 'discard'])
  })

  it('discards a document whose text was emptied here, once the sync is done with it', async () => {
    const { calls, writes } = createWrites()
    const { text, editHere } = createText()
    const saver = createSaver({ documentId: 'd26', fields: { ...BLANK, content: '[1]' }, isStored: true, writes, text })
    track(saver)

    editHere()
    saver.change({ content: '' })
    await saver.detach(wait(DELAY).then(() => calls.push('sync done')))

    expect(calls).toEqual(['sync done', 'discard'])
  })

  it('leaves alone a document somebody else emptied', async () => {
    const { calls, writes } = createWrites()
    const saver = createSaver({ documentId: 'd27', fields: { ...BLANK, content: '[1]' }, isStored: true, writes })
    track(saver)

    saver.change({ content: '' })
    await saver.detach()

    expect(calls).toEqual([])
  })

  it('leaves an empty document alone when the page changed nothing, as StrictMode remounts it', async () => {
    const { calls, writes } = createWrites()
    const saver = createSaver({ documentId: 'd10', fields: BLANK, isStored: true, writes })
    track(saver)

    await saver.detach()
    track(saver)
    await saver.detach()

    expect(calls).toEqual([])
  })

  it('holds every send while paused, and sends what was held once resumed', async () => {
    const { calls, writes } = createWrites()
    const saver = createSaver({ documentId: 'd11', fields: STORED, isStored: true, writes })
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

    expect(calls).toEqual(['rename '])
  })

  it('sends nothing once paused for a delete, nor discards on the way out', async () => {
    const { calls, writes } = createWrites()
    const saver = createSaver({ documentId: 'd12', fields: STORED, isStored: true, writes })
    track(saver)

    saver.change({ title: '', content: '' })
    saver.pause()
    await saver.detach()

    expect(calls).toEqual([])
  })

  it('says a send went through, but not one with nothing in it', async () => {
    const { writes } = createWrites()
    const saver = createSaver({ documentId: 'd13', fields: STORED, isStored: true, writes })
    const { getSavedCount } = track(saver)

    await saver.flush()
    saver.change({ title: 'Plan 2' })
    await saver.flush()

    expect(getSavedCount()).toBe(1)
  })
})
