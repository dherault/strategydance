/*
  A limit on how many tasks run at once in this process: a task past it waits for one to finish,
  first come first served, and a finished task hands its place straight to the next, so nobody slips
  in between. A task that fails frees its place as one that succeeds does
*/
function createConcurrencyLimit(limit: number) {
  let running = 0
  const waiting: (() => void)[] = []

  async function acquire() {
    if (running < limit) {
      running += 1

      return
    }

    await new Promise<void>(resolve => waiting.push(resolve))
  }

  function release() {
    const next = waiting.shift()

    if (next) next()
    else running -= 1
  }

  return async function run<T>(task: () => Promise<T>) {
    await acquire()

    try {
      return await task()
    } finally {
      release()
    }
  }
}

export default createConcurrencyLimit
