// The last write queued for each key, which the next one for that key waits on
const queues = new Map<string, Promise<unknown>>()

/*
  Runs writes to one row one after the other, in the order they were asked for, while writes to
  different rows still run side by side.

  The page applies each change to its cache the moment it is made, so a reader can toggle, move
  or undo faster than the server answers. Sent as they come, two writes to one row could land in
  either order: an Undo re-inserting a task before its delete, which then removes it, or an older
  position landing last. Queued by row, the server sees them in the reader's order. A write that
  fails does not hold up the ones behind it.

  `after` names the rows a write depends on, such as the list a task is on: it waits for what those
  rows have queued so far, without joining their queues, so a task added to a list just created
  reaches the server after the list does, while tasks on one list still write side by side
*/
function runInOrder<T>(key: string, write: () => Promise<T>, after: string[] = []): Promise<T> {
  const waits = [queues.get(key), ...after.map(dependency => queues.get(dependency))]
    .map(queued => (queued ?? Promise.resolve()).catch(() => undefined))
  const next = Promise.all(waits).then(write)

  queues.set(key, next)

  next.finally(() => {
    if (queues.get(key) === next) queues.delete(key)
  }).catch(() => undefined)

  return next
}

export default runInOrder
