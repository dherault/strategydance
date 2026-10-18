import type { ConversationDockWindows } from '~types'

/*
  The dock as a tab writes it: the sets its change changed, a member's in an organization each, over
  the sets as storage holds them, which other tabs may have changed since it read them, the rest as
  storage has them. A set the change emptied goes
*/
function mergeChangedDockSets(
  stored: ConversationDockWindows,
  previous: ConversationDockWindows,
  next: ConversationDockWindows,
) {
  const merged = { ...stored }

  for (const key of new Set([...Object.keys(previous), ...Object.keys(next)])) {
    const set = next[key]

    if (set === previous[key]) continue

    if (set) merged[key] = set
    else delete merged[key]
  }

  return merged
}

export default mergeChangedDockSets
