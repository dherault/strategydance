import { recordActivity as recordActivityMutation } from 'strategydance-database/web'

import getLocalDate from '~utils/date/getLocalDate'

import { authentication, dataConnect } from '~data/firebase'

// The days marked, or being marked, by who, where and which day, so a tab sends each one once
const recordedKeys = new Set<string>()

/*
  Marks today as a day the reader was active in an organization, for the streak the build in
  public page counts, once a change of theirs on their Today page has gone through: their top
  priority, a task list or a task, their checklist or their log. See `RecordActivity`.

  Sent at most once a day per organization from a tab, and never awaited: the change it follows
  has already succeeded, and a streak missing a day is no reason to tell the reader it failed. A
  refusal is logged and forgotten, so the next change tries again
*/
function recordActivity(organizationId: string) {
  const userId = authentication.currentUser?.uid

  if (!userId) return

  const date = getLocalDate(Date.now())
  const key = `${userId}:${organizationId}:${date}`

  if (recordedKeys.has(key)) return

  recordedKeys.add(key)

  recordActivityMutation(dataConnect, { organizationId, date }).catch((error: unknown) => {
    recordedKeys.delete(key)
    console.error('Failed to record the day as active', error)
  })
}

export default recordActivity
