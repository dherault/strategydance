// The last write queued for each key, which the next one for that key waits on
const queues = new Map<string, Promise<unknown>>()

/*
  Runs writes to one row one after the other, in the order they were asked for, while writes to
  different rows still run side by side.

  The page applies each change to its cache the moment it is made, so a reader can toggle, move
  or undo faster than the server answers. Sent as they come, two writes to one row could land in
  either order: an Undo re-inserting a task before its delete, which then removes it, or an older
  position landing last. Queued by row, the server sees them in the reader's order. A write that
  fails does not hold up the ones behind it
*/
function runInOrder<T>(key: string, write: () => Promise<T>): Promise<T> {
  const previous = queues.get(key) ?? Promise.resolve()
  const next = previous.catch(() => undefined).then(write)

  queues.set(key, next)

  next.finally(() => {
    if (queues.get(key) === next) queues.delete(key)
  }).catch(() => undefined)

  return next
}

export default runInOrder
