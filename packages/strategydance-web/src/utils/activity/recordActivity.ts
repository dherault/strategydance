import { recordActivity as recordActivityMutation } from 'strategydance-database/web'

import { LOCAL_STORAGE_PREFIX } from '~constants'

import getLocalDate from '~utils/date/getLocalDate'

import { authentication, dataConnect } from '~data/firebase'

// The days marked, being marked or waiting to be again, so a tab sends each one once at a time
const recordedKeys = new Set<string>()

// The days asked for that the server has not confirmed, kept so a tab closed too soon sends them
// the next time the app opens, while it is still that day
const PENDING_STORAGE_KEY = `${LOCAL_STORAGE_PREFIX}pendingActivity`

// How long a refused day waits before each try again, after which the next change tries anew
const RETRY_DELAYS_MS = [2_000, 10_000, 60_000]

const isBrowser = typeof localStorage !== 'undefined'

type PendingDay = {
  userId: string
  organizationId: string
  date: string
}

function toKey({ userId, organizationId, date }: PendingDay) {
  return `${userId}:${organizationId}:${date}`
}

function readPendingDays(): PendingDay[] {
  if (!isBrowser) return []

  try {
    const stored: unknown = JSON.parse(localStorage.getItem(PENDING_STORAGE_KEY) ?? '[]')

    return Array.isArray(stored)
      ? stored.filter(
          (day): day is PendingDay =>
            typeof day?.userId === 'string' && typeof day?.organizationId === 'string' && typeof day?.date === 'string',
        )
      : []
  } catch {
    return []
  }
}

// Keeps only the days that can still be sent: the server takes today and nothing else
function writePendingDays(days: PendingDay[]) {
  if (!isBrowser) return

  const today = getLocalDate(Date.now())

  try {
    localStorage.setItem(PENDING_STORAGE_KEY, JSON.stringify(days.filter(day => day.date === today)))
  } catch (error) {
    console.error('Failed to keep a day to mark active', error)
  }
}

function send(day: PendingDay, attempt = 0) {
  const key = toKey(day)

  recordActivityMutation(dataConnect, { organizationId: day.organizationId, date: day.date })
    .then(() => {
      writePendingDays(readPendingDays().filter(pending => toKey(pending) !== key))
    })
    .catch((error: unknown) => {
      console.error('Failed to record the day as active', error)

      const isStillThatDay = getLocalDate(Date.now()) === day.date
      const isStillThem = authentication.currentUser?.uid === day.userId

      if (attempt < RETRY_DELAYS_MS.length && isStillThatDay && isStillThem) {
        setTimeout(() => send(day, attempt + 1), RETRY_DELAYS_MS[attempt])

        return
      }

      // Given up on for this tab: the next change tries again, and so does the next time the app
      // opens today, since the day is still kept
      recordedKeys.delete(key)
    })
}

/*
  Marks today as a day the reader was active in an organization, for the streak the build in
  public page counts, once a change of theirs on their Today page has gone through: their top
  priority, a task list or a task, their checklist or their log. See `RecordActivity`.

  Sent at most once a day per organization from a tab, and never awaited: the change it follows
  has already succeeded, and a streak missing a day is no reason to tell the reader it failed. A
  refusal is tried again a few times while it is still that day. Until the server confirms it,
  the day is kept in the browser, so one asked for as the tab closed is sent the next time the app
  opens that day
*/
function recordActivity(organizationId: string) {
  const userId = authentication.currentUser?.uid

  if (!userId) return

  const day = { userId, organizationId, date: getLocalDate(Date.now()) }
  const key = toKey(day)

  if (recordedKeys.has(key)) return

  recordedKeys.add(key)
  writePendingDays([...readPendingDays().filter(pending => toKey(pending) !== key), day])
  send(day)
}

// Once the account is known, whatever a closed tab left unconfirmed today is sent again
if (isBrowser) {
  authentication
    .authStateReady()
    .then(() => {
      const userId = authentication.currentUser?.uid
      const today = getLocalDate(Date.now())

      for (const day of readPendingDays()) {
        if (day.userId !== userId || day.date !== today || recordedKeys.has(toKey(day))) continue

        recordedKeys.add(toKey(day))
        send(day)
      }
    })
    .catch(() => undefined)
}

export default recordActivity
