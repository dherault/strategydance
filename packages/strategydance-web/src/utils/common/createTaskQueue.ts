// A task as the queue runs it, given the signal that aborts it
type Task = (signal: AbortSignal) => Promise<void>

type Entry = { key: string; task: Task; controller: AbortController }

/*
  Runs tasks by key, a few at a time, in the order they were asked for, the rest waiting their
  turn. Aborting a key takes a waiting task out of the line, and aborts one under way through its
  signal, which the task listens to. A task under way keeps its place until it settles, aborted or
  not, since it may go on a while before it reads its signal, as drawing an image does, so no more
  run at once than the limit. A task that fails makes room for the next all the same: what it does
  with its failure is its own
*/
function createTaskQueue(limit: number) {
  const waiting: Entry[] = []
  const running = new Set<Entry>()

  function next() {
    while (running.size < limit && waiting.length) {
      const entry = waiting.shift()!

      running.add(entry)

      entry
        .task(entry.controller.signal)
        .catch(() => undefined)
        .finally(() => {
          running.delete(entry)
          next()
        })
    }
  }

  // Takes a key's task out of the line, or aborts it when it runs
  function abort(key: string) {
    const index = waiting.findIndex(waited => waited.key === key)

    if (index !== -1) waiting.splice(index, 1)

    for (const entry of running) {
      if (entry.key === key) entry.controller.abort(new DOMException('The task was aborted', 'AbortError'))
    }
  }

  // Runs a task under its key once there is room, aborting any other the key ran
  function run(key: string, task: Task) {
    abort(key)
    waiting.push({ key, task, controller: new AbortController() })
    next()
  }

  return { run, abort }
}

export default createTaskQueue
