import { describe, expect, it } from 'bun:test'

import { ConversationMessageKind } from 'strategydance-database/web'

import type { ConversationMessageBody, ConversationPageMessage, ConversationTail } from '~types'

import createConversationThread from '~utils/conversation/createConversationThread'

// Small lengths, so a few messages make a full tail, a full page and several body reads
const TAIL_LENGTH = 5
const PAGE_LENGTH = 3
const BODIES_LENGTH = 2

/*
  A conversation as the server holds it, for the thread's tests: messages at positions claimed on a
  counter, deleted as Retry deletes a run's (moving the revision) and as Resume deletes a note (not
  moving it), read back as the live tail, history pages and bodies are
*/
function createConversationTestServer({ pageLength }: { pageLength: number }) {
  let revision = 0
  let counter = 0
  let rows: ConversationPageMessage[] = []

  const reads = { pages: [] as number[], bodies: [] as string[][] }

  return {
    reads,
    insert(
      count: number,
      { runId, kind = ConversationMessageKind.AGENT_TEXT }: { runId?: string; kind?: ConversationMessageKind } = {},
    ) {
      for (let index = 0; index < count; index++) {
        const position = counter++

        rows.push({
          id: `message-${position}`,
          kind,
          position,
          run: runId ? { id: runId } : undefined,
          createdAt: '2026-10-04T12:00:00Z',
          toolName: null,
          toolStatus: null,
          toolDurationMs: null,
          answerSelected: null,
          answerOther: null,
          isAnswerSkipped: false,
          answeredAt: null,
          aspects: null,
          aspectsSetBy: null,
          noteKind: null,
          text: `Message ${position}`,
          citations: null,
          questionPrompt: null,
          questionOptions: null,
          isMultipleChoice: null,
        })
      }
    },
    // As Retry does: every message the run drew goes, and the history moves on
    deleteRun(runId: string) {
      rows = rows.filter(row => row.run?.id !== runId)
      revision++
    },
    // As Resume does with the note it takes away
    deleteAt(position: number) {
      rows = rows.filter(row => row.position !== position)
    },
    tail(length: number): ConversationTail {
      return { historyRevision: revision, nextMessagePosition: counter, messages: rows.slice(-length).reverse() }
    },
    async readPage(before: number) {
      reads.pages.push(before)

      return {
        historyRevision: revision,
        messages: rows
          .filter(({ position }) => position < before)
          .slice(-pageLength)
          .reverse(),
      }
    },
    async readBodies(ids: string[]): Promise<ConversationMessageBody[]> {
      reads.bodies.push(ids)

      return rows
        .filter(({ id }) => ids.includes(id))
        .map(({ id, text, citations, questionPrompt, questionOptions, isMultipleChoice }) => ({
          id,
          text,
          citations,
          questionPrompt,
          questionOptions,
          isMultipleChoice,
        }))
    },
    positions() {
      return rows.map(({ position }) => position)
    },
  }
}

// Lets every read the thread started land, and the reads those start
async function settle() {
  for (let round = 0; round < 10; round++) await new Promise(resolve => setTimeout(resolve, 0))
}

function open(server: ReturnType<typeof createConversationTestServer>) {
  const thread = createConversationThread({
    tail: server.tail(TAIL_LENGTH),
    readPage: before => server.readPage(before),
    readBodies: ids => server.readBodies(ids),
    tailLength: TAIL_LENGTH,
    pageLength: PAGE_LENGTH,
    bodiesLength: BODIES_LENGTH,
  })

  thread.subscribe(() => {})

  return {
    thread,
    push: () => thread.receive(server.tail(TAIL_LENGTH)),
    positions: () => thread.getSnapshot().entries.map(({ position }) => position),
    // Reads older pages until there are none
    readAll: async () => {
      while (thread.getSnapshot().hasOlder) {
        thread.loadOlder()
        await settle()
      }
    },
  }
}

describe('createConversationThread', () => {
  it('reads nothing until somebody listens', async () => {
    const server = createConversationTestServer({ pageLength: PAGE_LENGTH })

    server.insert(3)
    createConversationThread({
      tail: server.tail(TAIL_LENGTH),
      readPage: before => server.readPage(before),
      readBodies: ids => server.readBodies(ids),
      tailLength: TAIL_LENGTH,
    })
    await settle()

    expect(server.reads.bodies).toEqual([])
  })

  it('reads older pages as the reader asks, until there are none', async () => {
    const server = createConversationTestServer({ pageLength: PAGE_LENGTH })

    server.insert(12)

    const { thread, positions, readAll } = open(server)

    expect(positions()).toEqual([7, 8, 9, 10, 11])
    expect(thread.getSnapshot().hasOlder).toBe(true)

    await readAll()

    expect(positions()).toEqual(server.positions())
    expect(server.reads.pages).toEqual([7, 4, 1])
  })

  it('keeps every entry when the tail slides past the pages it meets', async () => {
    const server = createConversationTestServer({ pageLength: PAGE_LENGTH })

    server.insert(12)

    const { push, positions, readAll } = open(server)

    await readAll()

    for (let round = 0; round < 4; round++) {
      server.insert(2)
      push()
    }

    await settle()

    expect(positions()).toEqual(server.positions())
    expect(server.reads.pages).toEqual([7, 4, 1])
  })

  it('reads a gap between the tail and what it holds down to the newest entry held, and no further', async () => {
    const server = createConversationTestServer({ pageLength: PAGE_LENGTH })

    server.insert(12)

    const { thread, push, positions, readAll } = open(server)

    await readAll()
    server.insert(9)
    push()
    await settle()

    expect(positions()).toEqual(server.positions())
    // The tail starts at 16, the newest held entry was 11: two pages meet it
    expect(server.reads.pages).toEqual([7, 4, 1, 16, 13])
    expect(thread.getSnapshot().hasOlder).toBe(false)
  })

  it('drops a note Resume deleted elsewhere once the tail passes it', async () => {
    const server = createConversationTestServer({ pageLength: PAGE_LENGTH })

    server.insert(6)
    server.insert(1, { kind: ConversationMessageKind.NOTE })

    const { push, positions } = open(server)

    server.deleteAt(6)
    server.insert(8)
    push()
    await settle()

    expect(positions()).toEqual(server.positions().filter(position => position >= 2))
    expect(positions()).not.toContain(6)
  })

  it("drops a retried run's entries from every page it holds, a run longer than the tail included", async () => {
    const server = createConversationTestServer({ pageLength: PAGE_LENGTH })

    server.insert(4, { runId: 'first' })
    server.insert(8, { runId: 'retried' })

    const { thread, push, positions, readAll } = open(server)

    await readAll()

    // Its first entries sit in the history pages, its latest in the tail
    expect(positions()).toEqual(server.positions())

    server.deleteRun('retried')
    server.insert(2, { runId: 'again' })
    push()

    expect(thread.getSnapshot().isFilling).toBe(true)

    await settle()

    expect(positions()).toEqual(server.positions())
    expect(thread.getSnapshot().entries.some(({ run }) => run?.id === 'retried')).toBe(false)
    expect(thread.getSnapshot().isFilling).toBe(false)
  })

  it('drops a run deleted wholly below the tail', async () => {
    const server = createConversationTestServer({ pageLength: PAGE_LENGTH })

    server.insert(3, { runId: 'old' })
    server.insert(10, { runId: 'kept' })

    const { push, positions, readAll } = open(server)

    await readAll()
    server.deleteRun('old')
    push()
    await settle()

    expect(positions()).toEqual(server.positions())
    expect(positions()[0]).toBe(3)
  })

  it('drops a page read from a newer history, and waits for the tail rather than reading it again', async () => {
    const server = createConversationTestServer({ pageLength: PAGE_LENGTH })

    server.insert(12, { runId: 'retried' })

    const { thread, push, positions } = open(server)

    server.deleteRun('retried')
    server.insert(6, { runId: 'again' })
    thread.loadOlder()
    await settle()

    expect(positions()).toEqual([7, 8, 9, 10, 11])
    expect(server.reads.pages).toEqual([7])

    push()
    await settle()

    expect(positions()).toEqual(server.positions())
  })

  it('reads each body once, a few at a time, and never again one the server no longer has', async () => {
    const server = createConversationTestServer({ pageLength: PAGE_LENGTH })

    server.insert(5, { runId: 'retried' })

    const { thread, push } = open(server)

    await settle()

    expect(server.reads.bodies).toEqual([['message-0', 'message-1'], ['message-2', 'message-3'], ['message-4']])
    expect(thread.getSnapshot().bodies.get('message-4')?.text).toBe('Message 4')

    push()
    await settle()

    expect(server.reads.bodies).toHaveLength(3)
  })

  it('does not ask again for a body the server no longer has', async () => {
    const server = createConversationTestServer({ pageLength: PAGE_LENGTH })

    server.insert(2, { runId: 'kept' })
    server.insert(1, { runId: 'retried' })

    const thread = createConversationThread({
      tail: server.tail(TAIL_LENGTH),
      readPage: before => server.readPage(before),
      readBodies: async ids => {
        // Retried away between the tail and the read
        server.deleteRun('retried')

        return server.readBodies(ids)
      },
      tailLength: TAIL_LENGTH,
      bodiesLength: BODIES_LENGTH,
    })

    thread.subscribe(() => {})
    await settle()
    thread.receive({ ...server.tail(TAIL_LENGTH), historyRevision: 0 })
    await settle()

    expect(server.reads.bodies.flat().filter(id => id === 'message-2')).toHaveLength(1)
  })

  it('asks again on the next change for bodies a failed read left out', async () => {
    const server = createConversationTestServer({ pageLength: PAGE_LENGTH })
    let isFailing = true

    server.insert(2)

    const thread = createConversationThread({
      tail: server.tail(TAIL_LENGTH),
      readPage: before => server.readPage(before),
      readBodies: async ids => {
        if (isFailing) throw new Error('Offline')

        return server.readBodies(ids)
      },
      tailLength: TAIL_LENGTH,
    })
    const originalError = console.error

    console.error = () => {}
    thread.subscribe(() => {})
    await settle()
    console.error = originalError

    expect(thread.getSnapshot().bodies.size).toBe(0)

    isFailing = false
    thread.receive(server.tail(TAIL_LENGTH))
    await settle()

    expect(thread.getSnapshot().bodies.size).toBe(2)
  })

  it('takes the bodies a page brings without reading them again', async () => {
    const server = createConversationTestServer({ pageLength: PAGE_LENGTH })

    server.insert(8)

    const { readAll } = open(server)

    await settle()
    await readAll()

    expect(server.reads.bodies.flat().sort()).toEqual(['message-3', 'message-4', 'message-5', 'message-6', 'message-7'])
  })

  it('says a page read failed, and reads it again when asked', async () => {
    const server = createConversationTestServer({ pageLength: PAGE_LENGTH })
    let isFailing = true

    server.insert(8)

    const thread = createConversationThread({
      tail: server.tail(TAIL_LENGTH),
      readPage: async before => {
        if (isFailing) throw new Error('Offline')

        return server.readPage(before)
      },
      readBodies: ids => server.readBodies(ids),
      tailLength: TAIL_LENGTH,
      pageLength: PAGE_LENGTH,
    })
    const originalError = console.error

    console.error = () => {}
    thread.subscribe(() => {})
    thread.loadOlder()
    await settle()
    console.error = originalError

    expect(thread.getSnapshot().olderStatus).toBe('failed')

    isFailing = false
    thread.loadOlder()
    await settle()

    expect(thread.getSnapshot().olderStatus).toBe('idle')
    expect(thread.getSnapshot().entries.map(({ position }) => position)).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
  })
})
