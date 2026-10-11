import { useQuery, useQueryClient } from '@tanstack/react-query'
import { executeQuery } from 'firebase/data-connect'
import { getPositionBetween } from 'strategydance-core'
import {
  type GetChecklistData,
  type GetChecklistHistoryData,
  checkChecklistItem,
  createChecklistItem,
  deleteChecklistItem,
  getChecklistRef,
  restoreChecklistItem,
  uncheckChecklistItem,
  updateChecklistItem,
} from 'strategydance-database/web'

import type { Checklist, ChecklistItem, DataSource } from '~types'

import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import recordActivity from '~utils/activity/recordActivity'
import writeOptimistically from '~utils/common/writeOptimistically'

import { dataConnect } from '~data/firebase'

const EMPTY_CHECKLIST: Checklist = {
  owner: [],
  checklistItems: [],
  earliest: [],
  anyItem: [],
}

/*
  A member's checklist in the current organization, the reader's own or a teammate's, and what
  changes it: only the reader's own changes, which the server holds to as well.

  Every change lands in the cache first, and a tick lands in the unfolded history too when it has
  been read, so the table follows at once. Each is sent after, queued behind any earlier change to
  the same column or the same day: see `writeOptimistically`.

  The query does not change at midnight: its week is the server's, and the page picks the days it
  shows. It does not retry on mount, and a failed read is `hasFailed` rather than an empty
  checklist: `TodayWait` waits on the reader's own
*/
function useChecklist(userId: string | null): DataSource<Checklist> & {
  hasFailed: boolean
  createItem: (id: string, name: string) => Promise<void>
  updateItem: (item: ChecklistItem) => Promise<void>
  deleteItem: (item: ChecklistItem) => Promise<void>
  restoreItem: (item: ChecklistItem, index: number) => Promise<void>
  moveItem: (from: number, to: number) => Promise<void>
  setChecked: (itemId: string, date: string, isChecked: boolean) => Promise<void>
} {
  const queryClient = useQueryClient()
  const { organization } = useCurrentOrganization()

  const organizationId = organization?.id ?? null
  const queryKey = ['GetChecklist', organizationId, userId]
  const historyQueryKey = ['GetChecklistHistory', organizationId, userId]

  const { data, isPending, isFetching, isError, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data: checklist } = await executeQuery(
        getChecklistRef(dataConnect, { organizationId: organizationId!, userId: userId! }),
      )

      return checklist
    },
    enabled: Boolean(organizationId && userId),
    retryOnMount: false,
  })

  const checklist = data ?? EMPTY_CHECKLIST
  const items = checklist.checklistItems

  function setItems(update: (current: ChecklistItem[]) => ChecklistItem[]) {
    queryClient.setQueryData<GetChecklistData>(
      queryKey,
      current => current && { ...current, checklistItems: update(current.checklistItems) },
    )
  }

  function change(
    rowKey: string,
    apply: () => void,
    write: () => Promise<unknown>,
    withHistory = false,
    after?: string[],
  ) {
    return writeOptimistically({
      queryClient,
      queryKeys: withHistory ? [queryKey, historyQueryKey] : [queryKey],
      rowKey,
      after,
      apply,
      // One that goes through marks the day active, for the reader's streak
      write: () => write().then(() => recordActivity(organizationId!)),
    })
  }

  function writeItem(item: ChecklistItem) {
    return () =>
      updateChecklistItem(dataConnect, {
        organizationId: organizationId!,
        id: item.id,
        name: item.name,
        position: item.position,
      })
  }

  // The id is the caller's, so the column it adds can open for naming before the server answers
  function createItem(id: string, name: string) {
    const position = getPositionBetween(items.at(-1)?.position ?? null, null)!

    return change(
      `checklistItem:${id}`,
      () => setItems(current => [...current, { id, name, position, completions: [] }]),
      () => createChecklistItem(dataConnect, { organizationId: organizationId!, id, name, position }),
    )
  }

  function updateItem(item: ChecklistItem) {
    return change(
      `checklistItem:${item.id}`,
      () => setItems(current => current.map(existing => (existing.id === item.id ? item : existing))),
      writeItem(item),
    )
  }

  function deleteItem(item: ChecklistItem) {
    return change(
      `checklistItem:${item.id}`,
      () => setItems(current => current.filter(({ id }) => id !== item.id)),
      () => deleteChecklistItem(dataConnect, { organizationId: organizationId!, id: item.id }),
      true,
    )
  }

  // Puts a removed column back where it was, every day it was ticked with it
  function restoreItem(item: ChecklistItem, index: number) {
    return change(
      `checklistItem:${item.id}`,
      () => setItems(current => [...current.slice(0, index), item, ...current.slice(index)]),
      () => restoreChecklistItem(dataConnect, { organizationId: organizationId!, id: item.id }),
      true,
    )
  }

  async function moveItem(from: number, to: number) {
    const moved = items[from]

    if (!moved || from === to) return

    const reordered = items.filter((_, index) => index !== from)

    reordered.splice(to, 0, moved)

    const position = getPositionBetween(reordered[to - 1]?.position ?? null, reordered[to + 1]?.position ?? null)

    if (position !== null) {
      const item = { ...moved, position }

      await change(
        `checklistItem:${item.id}`,
        () => setItems(() => reordered.map(existing => (existing.id === item.id ? item : existing))),
        writeItem(item),
      )

      return
    }

    // No room left between the two: every column takes a whole position again
    const renumbered = reordered.map((item, index) => ({ ...item, position: index + 1 }))
    const changed = renumbered.filter((item, index) => item.position !== reordered[index]!.position)

    await Promise.all(
      changed.map((item, index) =>
        change(`checklistItem:${item.id}`, index === 0 ? () => setItems(() => renumbered) : () => {}, writeItem(item)),
      ),
    )
  }

  function setChecked(itemId: string, date: string, isChecked: boolean) {
    function toggle(completions: { date: string }[]) {
      const others = completions.filter(completion => completion.date !== date)

      return isChecked ? [{ date }, ...others] : others
    }

    return change(
      `checklistCompletion:${itemId}:${date}`,
      () => {
        setItems(current =>
          current.map(item => (item.id === itemId ? { ...item, completions: toggle(item.completions) } : item)),
        )
        queryClient.setQueryData<GetChecklistHistoryData>(
          historyQueryKey,
          current =>
            current && {
              ...current,
              checklistItems: current.checklistItems.map(item =>
                item.id === itemId ? { ...item, completions: toggle(item.completions) } : item,
              ),
            },
        )
      },
      () =>
        (isChecked ? checkChecklistItem : uncheckChecklistItem)(dataConnect, {
          organizationId: organizationId!,
          checklistItemId: itemId,
          date,
        }),
      true,
      // Behind whatever its column has queued, so a tick on a column just added or brought back
      // reaches the server once the column is there
      [`checklistItem:${itemId}`],
    )
  }

  return {
    data: checklist,
    initialLoading: Boolean(organizationId && userId) && isPending && !isError,
    loading: Boolean(organizationId && userId) && isFetching,
    refetch: async () => {
      await refetch()
    },
    hasFailed: Boolean(organizationId && userId) && isError && data === undefined,
    createItem,
    updateItem,
    deleteItem,
    restoreItem,
    moveItem,
    setChecked,
  }
}

export default useChecklist
