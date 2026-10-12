// A task as the queue runs it, given the signal that aborts it
type Task = (signal: AbortSignal) => Promise<void>

/*
  Runs tasks by key, a few at a time, in the order they were asked for, the rest waiting their
  turn. Aborting a key takes a waiting task out of the line, and aborts one under way through its
  signal, which the task listens to. A task that fails, aborted or not, makes room for the next all
  the same: what it does with its failure is its own
*/
function createTaskQueue(limit: number) {
  const waiting: { key: string; task: Task; controller: AbortController }[] = []
  const running = new Map<string, AbortController>()

  function next() {
    while (running.size < limit && waiting.length) {
      const { key, task, controller } = waiting.shift()!

      running.set(key, controller)

      task(controller.signal)
        .catch(() => undefined)
        .finally(() => {
          if (running.get(key) === controller) running.delete(key)

          next()
        })
    }
  }

  // Takes a key's task out of the line, or aborts it when it runs, making room for the next
  function abort(key: string) {
    const index = waiting.findIndex(waited => waited.key === key)

    if (index !== -1) waiting.splice(index, 1)

    const controller = running.get(key)

    if (!controller) return

    running.delete(key)
    controller.abort(new DOMException('The task was aborted', 'AbortError'))
    next()
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
