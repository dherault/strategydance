import { describe, expect, it, spyOn } from 'bun:test'

import { createRichTextYUpdate } from 'strategydance-design-system/lib/createRichTextYUpdate'
import { getRichTextText } from 'strategydance-design-system/lib/getRichTextText'
import { readRichTextYDoc } from 'strategydance-design-system/lib/readRichTextYDoc'
import { RICH_TEXT_YJS_FRAGMENT } from 'strategydance-design-system/lib/richText'
import * as Y from 'yjs'

import type { KnowledgeDocumentSyncStatus } from '~types'

import createId from '~utils/common/createId'
import decodeBase64 from '~utils/common/decodeBase64'
import encodeBase64 from '~utils/common/encodeBase64'
import createKnowledgeDocumentSync, {
  type KnowledgeDocumentSync,
  type KnowledgeDocumentSyncWrites,
  type KnowledgeDocumentUpdate,
  type StoredKnowledgeDocumentText,
} from '~utils/knowledge/createKnowledgeDocumentSync'

const PUSH_DELAY = 5

function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function paragraph(text: string) {
  return JSON.stringify([{ type: 'paragraph', content: [{ type: 'text', text }] }])
}

function readContent(doc: Y.Doc) {
  const { value, isEmpty } = readRichTextYDoc(doc)

  return isEmpty ? '' : value
}

// The words of a document, its blocks one line each
function readText(doc: Y.Doc) {
  const content = readContent(doc)

  return content ? getRichTextText(JSON.parse(content)) : ''
}

// How many blocks a document holds at its top level, empty ones included
function countBlocks(doc: Y.Doc) {
  return (doc.getXmlFragment(RICH_TEXT_YJS_FRAGMENT).get(0) as Y.XmlElement).length
}

// The first block's text, where a writer types. An empty paragraph has no text yet, and gets one
function readFirstText(sync: KnowledgeDocumentSync) {
  let node: Y.XmlElement | Y.XmlText = sync.doc.getXmlFragment(RICH_TEXT_YJS_FRAGMENT).get(0) as Y.XmlElement

  while (!(node instanceof Y.XmlText)) {
    if (!node.length) node.insert(0, [new Y.XmlText()])

    node = node.get(0) as Y.XmlElement | Y.XmlText
  }

  return node
}

// Types into the first block's text, as an editor would: an edit of this tab's own
function type(sync: KnowledgeDocumentSync, at: number | 'end', text: string) {
  const node = readFirstText(sync)

  node.insert(at === 'end' ? node.length : at, text)
}

type StoredDocument = {
  state: string | null
  content: string
  revision: number
  updates: KnowledgeDocumentUpdate[]
}

/*
  The server as the sync sees it: one document, its snapshot, the updates pushed beside it, and a
  live query that pushes each tab subscribed to it what is pending after every write, a moment
  later, as Data Connect does. A tab can be muted, so it misses what the live query pushes
*/
function createServer(initial: Partial<StoredDocument> | null = {}) {
  let stored: StoredDocument | null = initial
    ? { state: null, content: '', revision: 0, updates: [], ...initial }
    : null
  const subscribers = new Set<KnowledgeDocumentSync>()
  const muted = new Set<KnowledgeDocumentSync>()
  const pushes: KnowledgeDocumentUpdate[] = []
  const compactions: boolean[] = []
  // The update ids each fold named, whether or not it went through
  const compactionIds: string[][] = []
  let seedCount = 0

  function readStored(): StoredKnowledgeDocumentText | null {
    return stored ? { ...stored, updates: stored.updates.map(update => ({ ...update })) } : null
  }

  function readLive() {
    return stored ? { revision: stored.revision, updates: stored.updates.map(update => ({ ...update })) } : null
  }

  function notify() {
    const live = readLive()

    for (const sync of subscribers) {
      if (!muted.has(sync)) setTimeout(() => sync.receive(live), 1)
    }
  }

  /*
    The writes of one tab. `losePushAnswers` stores that many pushes and then throws, as a push
    whose answer the network lost does. `latency` holds each answer back
  */
  function createWrites({ losePushAnswers = 0, latency = 0 } = {}): KnowledgeDocumentSyncWrites {
    let answersToLose = losePushAnswers

    return {
      read: async () => {
        await wait(latency)

        return readStored()
      },
      seed: async (state, revision) => {
        await wait(latency)

        if (!stored || stored.state !== null || stored.revision !== revision) return false

        stored.state = state
        stored.revision += 1
        seedCount += 1
        notify()

        return true
      },
      push: async (id, payload) => {
        pushes.push({ id, payload })
        await wait(latency)

        if (!stored || stored.state === null) return false

        stored.updates = [...stored.updates.filter(update => update.id !== id), { id, payload }]
        notify()

        if (answersToLose > 0) {
          answersToLose -= 1
          throw new Error('The connection dropped')
        }

        return true
      },
      compact: async (state, content, revision, updateIds) => {
        await wait(latency)

        const isCompacted = Boolean(stored && stored.revision === revision)

        compactions.push(isCompacted)
        compactionIds.push(updateIds)

        if (!stored || !isCompacted) return false

        stored.state = state
        stored.content = content
        stored.revision += 1
        stored.updates = stored.updates.filter(update => !updateIds.includes(update.id))
        notify()

        return true
      },
    }
  }

  return {
    createWrites,
    readStored,
    readLive,
    subscribe: (sync: KnowledgeDocumentSync) => subscribers.add(sync),
    mute: (sync: KnowledgeDocumentSync) => muted.add(sync),
    unmute: (sync: KnowledgeDocumentSync) => muted.delete(sync),
    // A page from before the editor was shared saving content over a document with no snapshot
    saveContent: (content: string) => {
      if (!stored) return

      stored.content = content
      stored.revision += 1
    },
    // A draft's create, as the saver sends it
    create: (state: string, content: string) => {
      stored = { state, content, revision: 0, updates: [] }
    },
    remove: () => {
      stored = null
      notify()
    },
    // A snapshot nothing can merge, folded in by a broken tab
    corrupt: () => {
      if (!stored) return

      stored.state = encodeBase64(new Uint8Array([255, 255, 255, 255, 255]))
      stored.revision += 1
      notify()
    },
    restore: (document: StoredDocument) => {
      stored = document
      notify()
    },
    // The text as a tab opening the document now would merge it
    readText: () => {
      const doc = new Y.Doc()

      if (stored?.state) Y.applyUpdate(doc, decodeBase64(stored.state))

      for (const update of stored?.updates ?? []) Y.applyUpdate(doc, decodeBase64(update.payload))

      return readText(doc)
    },
    getUpdates: () => stored?.updates ?? [],
    getContent: () => stored?.content ?? null,
    getSeedCount: () => seedCount,
    pushes,
    compactions,
    compactionIds,
  }
}

type Server = ReturnType<typeof createServer>

let tabCount = 0

/*
  A tab with the document open, subscribed to the live query. Each tab is its own document as far
  as `runInOrder` knows, as two browsers are, so their sends never wait on one another
*/
function createTab(
  server: Server,
  {
    writes = server.createWrites(),
    compactionDelay = 1_000_000,
    idleCompactionDelay = 1_000_000,
    maxContentLength,
    maxStateLength,
    maxUpdateLength,
    updatesLimit,
  }: {
    writes?: KnowledgeDocumentSyncWrites
    compactionDelay?: number
    idleCompactionDelay?: number
    maxContentLength?: number
    maxStateLength?: number
    maxUpdateLength?: number
    updatesLimit?: number
  } = {},
) {
  tabCount += 1

  const sync = createKnowledgeDocumentSync({
    documentId: `tab${tabCount}`,
    writes,
    createUpdate: value => createRichTextYUpdate(value),
    readContent,
    createId,
    pushDelay: PUSH_DELAY,
    alonePushDelay: PUSH_DELAY * 10,
    compactionDelay,
    idleCompactionDelay,
    idleCompactionJitter: 0,
    maxContentLength,
    maxStateLength,
    maxUpdateLength,
    updatesLimit,
  })
  const statuses: KnowledgeDocumentSyncStatus[] = []
  let savedCount = 0

  // Somebody else has it open, as the tests have it, unless one says otherwise
  sync.setShared(true)
  sync.attach({
    onStatus: status => statuses.push(status),
    onSaved: () => {
      savedCount += 1
    },
  })
  server.subscribe(sync)

  return { sync, writes, statuses, getSavedCount: () => savedCount }
}

async function openTab(server: Server, options: Parameters<typeof createTab>[1] = {}) {
  const tab = createTab(server, options)

  await tab.sync.start(await tab.writes.read())

  return tab
}

function seeded(text: string): Partial<StoredDocument> {
  return { state: encodeBase64(createRichTextYUpdate(paragraph(text))), content: paragraph(text), revision: 1 }
}

describe('createKnowledgeDocumentSync', () => {
  it('merges two people typing at once, so both end with both their words', async () => {
    const server = createServer(seeded('Hello'))
    const { sync: ana } = await openTab(server)
    const { sync: ben } = await openTab(server)

    type(ana, 0, 'Ana: ')
    type(ben, 'end', ' world')
    await Promise.all([ana.flush(), ben.flush()])
    await wait(10)

    expect(readText(ana.doc)).toBe('Ana: Hello world')
    expect(readText(ben.doc)).toBe('Ana: Hello world')
    expect(server.readText()).toBe('Ana: Hello world')
  })

  it('gathers what is typed in a moment into one push', async () => {
    const server = createServer(seeded('Hello'))
    const { sync } = await openTab(server)

    type(sync, 'end', ' w')
    type(sync, 'end', 'or')
    type(sync, 'end', 'ld')

    expect(sync.getStatus()).toBe('pending')
    expect(sync.hasUnsaved()).toBe(true)

    await wait(PUSH_DELAY * 4)

    expect(server.pushes).toHaveLength(1)
    expect(sync.hasUnsaved()).toBe(false)
    expect(server.readText()).toBe('Hello world')
  })

  it('pushes less often while nobody else has the document open, and sooner once somebody does', async () => {
    const server = createServer(seeded('Hello'))
    const { sync } = await openTab(server)

    sync.setShared(false)
    type(sync, 'end', '!')
    await wait(PUSH_DELAY * 4)

    expect(server.pushes).toEqual([])

    sync.setShared(true)
    await wait(PUSH_DELAY * 4)

    expect(server.pushes).toHaveLength(1)
  })

  it('merges its own echo, and a push twice, without changing a word', async () => {
    const server = createServer(seeded('Hello'))
    const { sync } = await openTab(server)

    type(sync, 'end', '!')
    await sync.flush()
    await wait(10)

    const live = server.readLive()

    sync.receive(live)
    sync.receive(live)

    expect(readText(sync.doc)).toBe('Hello!')
  })

  it('sends a push whose answer was lost again as it was, and what came after in the next', async () => {
    const server = createServer(seeded('Hello'))
    const error = spyOn(console, 'error').mockImplementation(() => {})
    const { sync, statuses } = await openTab(server, { writes: server.createWrites({ losePushAnswers: 1 }) })

    type(sync, 'end', '!')

    expect(await sync.flush()).toBe(false)
    expect(statuses.at(-1)).toBe('error')

    type(sync, 'end', '?')

    expect(await sync.flush()).toBe(true)

    await sync.flush()

    const [lost, retried, next] = server.pushes

    expect(server.pushes).toHaveLength(3)
    expect(retried).toEqual(lost)
    expect(next.id).not.toBe(lost.id)
    expect(server.getUpdates().map(({ id }) => id)).toEqual([lost.id, next.id])
    expect(server.readText()).toBe('Hello!?')

    error.mockRestore()
  })

  it('folds what is pending into the snapshot after the last edit, content and all', async () => {
    const server = createServer(seeded('Hello'))
    const { sync } = await openTab(server, { compactionDelay: 30 })

    type(sync, 'end', ' world')
    await sync.flush()
    await wait(80)

    expect(server.getUpdates()).toEqual([])
    expect(server.getContent()).toBe(paragraph('Hello world'))
    expect(server.readText()).toBe('Hello world')
  })

  it('loses nothing when two tabs fold at once while a third push lands', async () => {
    const server = createServer(seeded('Hello'))
    const { sync: ana } = await openTab(server, { writes: server.createWrites({ latency: 5 }) })
    const { sync: ben } = await openTab(server, { writes: server.createWrites({ latency: 5 }) })

    type(ana, 0, 'A ')
    type(ben, 'end', ' B')
    await Promise.all([ana.flush(), ben.flush()])
    await wait(20)

    type(ben, 'end', ' C')
    await Promise.all([ana.flushAndCompact(), ben.flushAndCompact()])
    await wait(80)

    expect(server.compactions).toContain(true)
    expect(server.readText()).toBe('A Hello B C')
    expect(readText(ana.doc)).toBe('A Hello B C')
    expect(readText(ben.doc)).toBe('A Hello B C')
  })

  it('reads the snapshot again for an update folded away before it reached the tab', async () => {
    const server = createServer(seeded('Hello'))
    const { sync: ana } = await openTab(server)
    const { sync: ben } = await openTab(server)

    server.mute(ben)
    type(ana, 'end', ' world')
    await ana.flushAndCompact()
    await wait(10)

    expect(server.getUpdates()).toEqual([])
    expect(readText(ben.doc)).toBe('Hello')

    server.unmute(ben)
    ben.receive(server.readLive())
    await wait(10)

    expect(readText(ben.doc)).toBe('Hello world')
  })

  it('never folds over a snapshot it has not merged', async () => {
    const server = createServer(seeded('Hello'))
    const { sync: ana } = await openTab(server)
    const { sync: ben } = await openTab(server, { writes: server.createWrites({ latency: 20 }) })

    type(ana, 'end', ' world')
    await ana.flushAndCompact()
    await wait(5)
    // Ben has seen the revision move, and is reading the snapshot again
    type(ben, 0, 'Oh, ')
    await ben.flushAndCompact()
    await wait(120)
    await ben.flushAndCompact()
    await wait(60)

    expect(server.compactions.every(Boolean)).toBe(true)
    expect(server.readText()).toBe('Oh, Hello world')
  })

  it('seeds a document stored before the editor was shared once, however many tabs open it at once', async () => {
    const server = createServer({ content: paragraph('Old notes') })
    const ana = createTab(server, { writes: server.createWrites({ latency: 5 }) })
    const ben = createTab(server, { writes: server.createWrites({ latency: 5 }) })
    const stored = server.readStored()

    await Promise.all([ana.sync.start(stored), ben.sync.start(stored)])

    expect(server.getSeedCount()).toBe(1)
    expect(readText(ana.sync.doc)).toBe('Old notes')
    expect(readText(ben.sync.doc)).toBe('Old notes')

    Y.applyUpdate(ana.sync.doc, Y.encodeStateAsUpdate(ben.sync.doc))

    expect(readText(ana.sync.doc)).toBe('Old notes')
  })

  it('seeds an empty document as one paragraph, however many tabs open it at once', async () => {
    const server = createServer({ content: '' })
    const ana = createTab(server, { writes: server.createWrites({ latency: 5 }) })
    const ben = createTab(server, { writes: server.createWrites({ latency: 5 }) })
    const stored = server.readStored()

    await Promise.all([ana.sync.start(stored), ben.sync.start(stored)])
    Y.applyUpdate(ana.sync.doc, Y.encodeStateAsUpdate(ben.sync.doc))

    expect(countBlocks(ana.sync.doc)).toBe(1)
  })

  it('seeds what a page from before the editor was shared saved meanwhile', async () => {
    const server = createServer({ content: paragraph('Old') })
    const { sync, writes } = createTab(server)
    const stored = server.readStored()

    server.saveContent(paragraph('Newer'))
    await sync.start(stored)

    expect(readText(sync.doc)).toBe('Newer')
    expect(server.readText()).toBe('Newer')
    expect(await writes.read()).toMatchObject({ revision: 2 })
  })

  it('stores a draft with what it has, then pushes only what was typed since', async () => {
    const server = createServer(null)
    const { sync } = createTab(server)
    const ready = sync.whenReady()

    await sync.start(null)
    await ready
    type(sync, 0, 'Draft')

    expect(sync.hasUnsaved()).toBe(false)

    server.create(sync.encodeForCreate(), paragraph('Draft'))
    type(sync, 'end', ' plan')
    sync.markCreated()
    await sync.flush()

    expect(server.pushes).toHaveLength(1)
    expect(server.readText()).toBe('Draft plan')
  })

  it('holds back edits while the text is too long, and sends them once it is short enough', async () => {
    const server = createServer(seeded('Hello'))
    const { sync, statuses } = await openTab(server, { maxContentLength: 40 })

    type(sync, 'end', ' and a great deal more')
    sync.setContent('x'.repeat(41))
    await sync.flush()

    expect(server.pushes).toEqual([])
    expect(statuses.at(-1)).toBe('tooLong')
    expect(sync.hasUnsaved()).toBe(true)

    sync.setContent('x'.repeat(40))
    await wait(PUSH_DELAY * 4)

    expect(server.pushes).toHaveLength(1)
    expect(sync.getStatus()).toBe('idle')
  })

  it('says a snapshot outgrew what the server keeps, and folds again once the text is shortened', async () => {
    const server = createServer(seeded('Hello'))
    const { sync } = await openTab(server, { maxStateLength: 600 })

    type(sync, 'end', 'x'.repeat(600))
    await sync.flushAndCompact()

    expect(sync.getStatus()).toBe('tooLong')
    expect(server.compactions).toEqual([])

    readFirstText(sync).delete(5, 600)
    await sync.flushAndCompact()

    expect(sync.getStatus()).toBe('idle')
    expect(server.compactions).toEqual([true])
    expect(server.readText()).toBe('Hello')
  })

  it('stops pushing just short of what a read takes, and goes on once a fold makes room', async () => {
    const server = createServer(seeded('Hello'))
    const { sync: ana } = await openTab(server, { updatesLimit: 12 })
    const { sync: ben } = await openTab(server)

    type(ben, 'end', ' a')
    await ben.flush()
    type(ben, 'end', ' b')
    await ben.flush()
    await wait(10)
    type(ana, 0, 'Ana: ')
    await ana.flush()

    expect(server.pushes).toHaveLength(2)
    expect(ana.getStatus()).toBe('tooLong')

    await ben.flushAndCompact()
    await wait(PUSH_DELAY * 4)

    expect(server.pushes).toHaveLength(3)
    expect(ana.getStatus()).toBe('idle')
    expect(server.readText()).toBe('Ana: Hello a b')
  })

  it('folds an edit too long to push into the snapshot instead, with no update pending', async () => {
    const server = createServer(seeded('Hello'))
    const { sync } = await openTab(server, { maxUpdateLength: 100 })

    type(sync, 'end', 'x'.repeat(200))
    await sync.flush()

    expect(server.pushes).toEqual([])
    expect(server.compactions).toEqual([true])
    expect(server.compactionIds).toEqual([[]])
    expect(server.readText()).toBe(`Hello${'x'.repeat(200)}`)
    expect(sync.hasUnsaved()).toBe(false)
    expect(sync.getStatus()).toBe('idle')
  })

  it('settles rather than waits forever while too many updates are pending to push', async () => {
    const server = createServer(seeded('Hello'))
    const { sync: ana } = await openTab(server, { updatesLimit: 12 })
    const { sync: ben } = await openTab(server)

    type(ben, 'end', ' a')
    await ben.flush()
    type(ben, 'end', ' b')
    await ben.flush()
    await wait(10)
    type(ana, 0, 'Ana: ')

    expect(await Promise.race([ana.settle(), wait(500).then(() => 'stuck')])).toBe(true)
  })

  it('forgets its pushes once another tab folded them, so its own folds name only what is pending', async () => {
    const server = createServer(seeded('Hello'))
    const { sync: ana } = await openTab(server)
    const { sync: ben } = await openTab(server)

    type(ana, 'end', ' a')
    await ana.flush()
    type(ana, 'end', ' b')
    await ana.flush()
    await wait(10)
    await ben.flushAndCompact()
    await wait(10)

    type(ana, 'end', ' c')
    await ana.flush()
    await ana.flushAndCompact()

    expect(server.compactions).toEqual([true, true])
    expect(server.compactionIds[1]).toEqual([server.pushes[2].id])
    expect(server.readText()).toBe('Hello a b c')
  })

  it('refuses to open on a snapshot it cannot merge, and folds nothing over it', async () => {
    const server = createServer({ state: encodeBase64(new Uint8Array([255, 255, 255, 255, 255])), revision: 1 })
    const { sync, writes } = createTab(server)

    await expect(sync.start(await writes.read())).rejects.toThrow()

    await wait(10)
    await sync.flushAndCompact()

    expect(server.compactions).toEqual([])
  })

  it('reads again, rather than fold over it, a snapshot it cannot merge', async () => {
    const server = createServer(seeded('Hello'))
    const error = spyOn(console, 'error').mockImplementation(() => {})
    const { sync } = await openTab(server)

    type(sync, 'end', '!')
    await sync.flush()
    server.corrupt()
    await wait(10)
    await sync.flushAndCompact()

    expect(server.compactions).toEqual([])
    expect(readText(sync.doc)).toBe('Hello!')
    expect(error).toHaveBeenCalled()

    error.mockRestore()
  })

  it('counts only its own edits as changed here, never what arrived', async () => {
    const server = createServer(seeded('Hello'))
    const { sync: ana } = await openTab(server)
    const { sync: ben } = await openTab(server)

    type(ana, 'end', '!')
    await ana.flush()
    await wait(10)

    expect(readText(ben.doc)).toBe('Hello!')
    expect(ana.isChangedHere()).toBe(true)
    expect(ben.isChangedHere()).toBe(false)
  })

  it('says a deleted document is gone, and goes on from where it was once it is back', async () => {
    const server = createServer(seeded('Hello'))
    const { sync } = await openTab(server)
    const document = server.readStored()!

    server.remove()
    type(sync, 'end', '!')
    await wait(10)

    expect(sync.getStatus()).toBe('gone')
    expect(sync.hasUnsaved()).toBe(false)

    server.restore({ ...document, state: document.state, updates: [] })
    await wait(PUSH_DELAY * 6)

    expect(sync.getStatus()).toBe('idle')
    expect(server.readText()).toBe('Hello!')
  })

  it('skips an update it cannot read, and folds it away with the rest', async () => {
    const server = createServer({ ...seeded('Hello'), updates: [{ id: 'broken', payload: 'AAAA' }] })
    const error = spyOn(console, 'error').mockImplementation(() => {})
    const { sync } = await openTab(server)

    expect(readText(sync.doc)).toBe('Hello')

    type(sync, 'end', '!')
    await sync.flushAndCompact()

    expect(server.getUpdates()).toEqual([])
    expect(server.readText()).toBe('Hello!')

    error.mockRestore()
  })

  it('settles: sends what is left, then pauses', async () => {
    const server = createServer(seeded('Hello'))
    const { sync } = await openTab(server)

    type(sync, 'end', '!')

    expect(await sync.settle()).toBe(true)
    expect(server.readText()).toBe('Hello!')

    type(sync, 'end', '?')
    await wait(PUSH_DELAY * 4)

    expect(server.pushes).toHaveLength(1)
    expect(sync.hasUnsaved()).toBe(false)
  })
})
