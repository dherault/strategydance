import { describe, expect, it } from 'bun:test'

import { QueryClient } from '@tanstack/react-query'

import keepNewerRead from '~utils/common/keepNewerRead'

type Read = { version: number; label: string }

const structuralSharing = keepNewerRead<Read>((cached, next) => next.version < cached.version)

function createQuery() {
  const queryClient = new QueryClient()
  const queryKey = ['read']

  queryClient.getQueryCache().build(queryClient, { queryKey, structuralSharing })

  return { queryClient, queryKey }
}

describe('keepNewerRead', () => {
  it('keeps a pushed result over an older one pushed after it', () => {
    const { queryClient, queryKey } = createQuery()

    queryClient.setQueryData<Read>(queryKey, { version: 2, label: 'newer' })
    queryClient.setQueryData<Read>(queryKey, { version: 1, label: 'older' })

    expect(queryClient.getQueryData<Read>(queryKey)).toEqual({ version: 2, label: 'newer' })
  })

  it("keeps a pushed result over an older read's that finishes after it", async () => {
    const { queryClient, queryKey } = createQuery()
    let finishRead: (read: Read) => void = () => {}
    const reading = queryClient.fetchQuery({
      queryKey,
      structuralSharing,
      queryFn: () => new Promise<Read>(resolve => (finishRead = resolve)),
    })

    queryClient.setQueryData<Read>(queryKey, { version: 2, label: 'pushed' })
    finishRead({ version: 1, label: 'read before the push' })
    await reading

    expect(queryClient.getQueryData<Read>(queryKey)).toEqual({ version: 2, label: 'pushed' })
  })

  it('takes a newer result, sharing what did not change', () => {
    const { queryClient, queryKey } = createQuery()
    const first = { version: 1, label: 'same', nested: { kept: true } }

    queryClient.setQueryData<typeof first>(queryKey, first)
    queryClient.setQueryData<typeof first>(queryKey, { version: 2, label: 'same', nested: { kept: true } })

    const latest = queryClient.getQueryData<typeof first>(queryKey)

    expect(latest?.version).toBe(2)
    expect(latest?.nested).toBe(first.nested)
  })
})
